import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { IntentEngine } from '../engine/planner.ts';
import { createStateSpeaker } from '../tts/controller.ts';

// Run the production hook, not a copy of its state machine. This small hook host
// models refs, state, dependency changes and effect cleanup without a DOM or new
// test dependencies. Native capture, shortcut delivery and audible TTS are fakes;
// this is a frontend integration check, not a physical desktop E2E test.
const slot = '__voicelaHoldTest';
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const bridge = moduleUrl(`
  const host = () => globalThis.${slot};
  export const useRef = value => host().ref(value);
  export const useState = value => host().state(value);
  export const useCallback = (value, deps) => host().memo(value, deps);
  export const useEffect = (value, deps) => host().effect(value, deps);
  export const isTauri = () => true;
  export const api = new Proxy({}, { get: (_, name) => (...args) => host().api[name](...args) });
  export const listen = async (name, handler) => host().listen(name, handler);
  export const register = async (key, handler) => { host().shortcut = handler; };
  export const unregister = async () => { host().shortcut = undefined; };
`);
let source = await readFile(new URL('./useSpeech.ts', import.meta.url), 'utf8');
source = source.replaceAll('"react"', JSON.stringify(bridge))
  .replaceAll('"@tauri-apps/api/event"', JSON.stringify(bridge))
  .replaceAll('"@tauri-apps/api/core"', JSON.stringify(bridge))
  .replaceAll('"@tauri-apps/plugin-global-shortcut"', JSON.stringify(bridge))
  .replaceAll('"../../api"', JSON.stringify(bridge))
  .replaceAll('"./reliability"', JSON.stringify(new URL('./reliability.ts', import.meta.url).href));
const { useSpeech } = await import(moduleUrl(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const result = (extra = {}) => ({ text: 'Open Notepad.', inserted: false, insertion_error: null, needs_review: false, ...extra });
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

async function fixture(t, options = {}) {
  const saved = new Map(['window', 'document', 'localStorage', slot].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const win = new EventTarget();
  win.location = { search: '' };
  const doc = new EventTarget();
  doc.hidden = false;
  Object.assign(globalThis, { window: win, document: doc, localStorage: { getItem: () => null, setItem() {} } });
  const calls = [], phases = [], transcripts = [], cues = [], cells = [], effects = [];
  const listeners = new Map();
  const start = deferred(), finish = deferred();
  const speaker = createStateSpeaker(async cue => { cues.push(cue); });
  const client = {
    getState: async () => ({ state: 'idle', pending_approval: null }),
    setState: async state => { calls.push(['state', state]); return { state, pending_approval: null }; },
    runTool: async request => {
      calls.push(['run', request]);
      return { status: 'executed', output: { tool: request.tool, executed: true, status: 'executed', message: 'Done' } };
    },
  };
  const engine = new IntentEngine(client);
  const unsubscribe = engine.subscribe(() => {
    const status = engine.getSnapshot().plan?.status;
    if (status === 'completed' || status === 'error') speaker.transition(status);
  });
  let index = 0, pending = [], dirty = false;
  const host = {
    api: {
      speechDevices: async () => ({ devices: [], modelReady: true }),
      speechLevel: async () => 0,
      startSpeech: (...args) => { calls.push(['start', ...args]); return start.promise; },
      stopSpeech: (cancel = false) => { calls.push(['stop', cancel]); return cancel ? Promise.resolve(result({ text: '' })) : finish.promise; },
      stopListening: async () => { calls.push(['pause']); },
    },
    listen(name, callback) {
      const handlers = listeners.get(name) ?? new Set();
      listeners.set(name, handlers); handlers.add(callback);
      return () => handlers.delete(callback);
    },
    ref(value) { const n = index++; return cells[n] ??= { current: value }; },
    state(value) {
      const n = index++;
      if (!(n in cells)) cells[n] = typeof value === 'function' ? value() : value;
      return [cells[n], next => {
        const value = typeof next === 'function' ? next(cells[n]) : next;
        if (!Object.is(cells[n], value)) { cells[n] = value; dirty = true; }
      }];
    },
    memo(value, deps) {
      const n = index++;
      if (!same(cells[n]?.deps, deps)) cells[n] = { value, deps };
      return cells[n].value;
    },
    effect(value, deps) {
      const n = index++;
      if (!same(effects[n]?.deps, deps)) pending.push(() => {
        effects[n]?.cleanup?.();
        effects[n] = { deps, cleanup: value() };
      });
    },
  };
  globalThis[slot] = host;
  const props = {
    onPhaseChange: phase => { phases.push(phase); speaker.transition(phase === 'starting' ? 'idle' : phase); },
    onSpeechReady: async text => { transcripts.push(text); await engine.handleListeningTurn(text); },
    ...options,
  };
  let speech;
  function render() {
    index = 0; dirty = false;
    speech = useSpeech(props);
    const run = pending; pending = []; run.forEach(effect => effect());
  }
  async function flush() {
    // Bounded microtask draining covers the hook's ready/stop/finally chain and
    // the engine's async state changes without wall-clock timer assumptions.
    for (let i = 0; i < 40; i++) { await Promise.resolve(); if (dirty) render(); }
  }
  t.after(() => {
    effects.forEach(effect => effect?.cleanup?.());
    unsubscribe(); speaker.stop();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  render(); await flush();
  assert.equal(typeof host.shortcut, 'function', 'global shortcut registered');
  return {
    calls, phases, transcripts, cues, start, finish, flush, engine, props,
    get speech() { return speech; },
    key: state => host.shortcut({ state }),
    emergency: () => win.dispatchEvent(new Event('voicela:emergency-stop')),
    panel: action => listeners.get('panel-action')?.forEach(handler => handler({ payload: action })),
  };
}

test('Ctrl+Space release before startup waits, transcribes once, autoexecutes and emits completion cue', async t => {
  const f = await fixture(t);
  f.key('Pressed'); f.key('Pressed'); f.key('Released'); f.key('Released');
  await f.flush();
  assert.equal(f.calls.filter(c => c[0] === 'start').length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'stop').length, 0);
  f.start.resolve(); await f.flush();
  assert.deepEqual(f.calls.filter(c => c[0] === 'stop'), [['stop', false]]);
  assert.equal(f.phases.includes('listening'), false);
  f.finish.resolve(result()); await f.flush();
  assert.deepEqual(f.transcripts, ['Open Notepad.']);
  assert.deepEqual(f.calls.filter(c => c[0] === 'run').map(c => c[1]), [{ tool: 'open_app', input: { app: 'Notepad' } }]);
  assert.equal(f.engine.getSnapshot().plan.status, 'completed');
  assert.ok(f.cues.includes('completed'));
});

test('normal hold enters listening; repeated release never duplicates a submitted command', async t => {
  const f = await fixture(t);
  f.key('Pressed'); f.start.resolve(); await f.flush();
  assert.equal(f.speech.phase, 'listening');
  assert.ok(f.cues.includes('listening'));
  f.key('Released'); f.key('Released'); await f.flush();
  f.finish.resolve(result()); await f.flush();
  f.key('Released'); await f.flush();
  assert.equal(f.transcripts.length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'stop').length, 1);
});

for (const stage of ['startup', 'transcription']) {
  test(`emergency stop during ${stage} discards late transcript and prevents execution`, async t => {
    const f = await fixture(t);
    f.key('Pressed');
    if (stage === 'transcription') { f.start.resolve(); await f.flush(); f.key('Released'); await f.flush(); }
    f.emergency(); await f.flush();
    f.start.resolve(); f.finish.resolve(result()); await f.flush();
    assert.equal(f.speech.phase, 'idle');
    assert.deepEqual(f.transcripts, []);
    assert.equal(f.calls.filter(c => c[0] === 'run').length, 0);
    assert.ok(f.calls.some(c => c[0] === 'stop' && c[1] === true));
    assert.equal(f.cues.includes('completed'), false);
  });
}

for (const [label, payload] of [
  ['unclear recognition', { needs_review: true }],
  ['insertion failure', { insertion_error: 'Focus lost' }],
  ['no speech', { text: '' }],
]) {
  test(`${label} does not autoexecute or announce completion`, async t => {
    const f = await fixture(t);
    f.key('Pressed'); f.start.resolve(); await f.flush(); f.key('Released');
    f.finish.resolve(result(payload)); await f.flush();
    assert.deepEqual(f.transcripts, []);
    assert.equal(f.calls.filter(c => c[0] === 'run').length, 0);
    assert.equal(f.cues.includes('completed'), false);
    assert.equal(f.speech.phase, 'idle');
  });
}

test('native startup failure returns idle without transcribing or executing', async t => {
  const f = await fixture(t);
  f.key('Pressed'); f.key('Released');
  f.start.reject(new Error('Microphone disconnected')); await f.flush();
  assert.equal(f.speech.phase, 'idle');
  assert.match(f.speech.message, /Microphone disconnected/);
  assert.equal(f.calls.filter(c => c[0] === 'stop').length, 0);
  assert.deepEqual(f.transcripts, []);
});

test('a disabled engine blocks hotkey capture', async t => {
  const f = await fixture(t, { disabled: true });
  f.key('Pressed'); f.key('Released'); await f.flush();
  assert.equal(f.calls.filter(c => c[0] === 'start').length, 0);
});

test('floating panel hold events share the same startup/release contract', async t => {
  const f = await fixture(t);
  f.panel('hold-start'); f.panel('hold-stop'); await f.flush();
  f.start.resolve(); await f.flush();
  f.finish.resolve(result()); await f.flush();
  assert.deepEqual(f.transcripts, ['Open Notepad.']);
  assert.equal(f.calls.filter(c => c[0] === 'start').length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'run').length, 1);
});

test('another press cannot open capture while transcript delivery is pending', async t => {
  const delivered = deferred();
  const texts = [];
  const f = await fixture(t, { onSpeechReady: text => { texts.push(text); return delivered.promise; } });
  f.key('Pressed'); f.start.resolve(); await f.flush(); f.key('Released');
  f.finish.resolve(result()); await f.flush();
  f.key('Pressed'); await f.flush();
  assert.equal(f.calls.filter(c => c[0] === 'start').length, 1);
  assert.deepEqual(texts, ['Open Notepad.']);
  delivered.resolve(); await f.flush();
  f.key('Released'); f.key('Pressed'); await f.flush();
  assert.equal(f.calls.filter(c => c[0] === 'start').length, 2);
});

test('transcription failure returns idle and never sends a partial command', async t => {
  const f = await fixture(t);
  f.key('Pressed'); f.start.resolve(); await f.flush(); f.key('Released');
  f.finish.reject(new Error('Whisper worker failed')); await f.flush();
  assert.equal(f.speech.phase, 'idle');
  assert.match(f.speech.message, /Whisper worker failed/);
  assert.deepEqual(f.transcripts, []);
  assert.equal(f.calls.filter(c => c[0] === 'run').length, 0);
});
