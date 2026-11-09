// Run: node --test components/demo/machine.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
function load(name) {
  const filename = path.join(__dirname, `${name}.ts`);
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = module.paths;
  m.require = id => id === './seeds' ? load('seeds') : id.startsWith('@/lib/data/') ? load(`../../${id.slice(2)}`) : module.require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports;
}
const { initial, reducer } = load('machine');
const step = (s, ...types) => types.reduce((state, type) => reducer(state, { type }), s);
const run = s => step(s, 'START', 'THINK', 'ACT', 'RESOLVE');

test('all three file intents resolve and a preview requires a result', () => {
  for (const [prompt, id] of [['invoice', 'invoice'], ['website brief', 'brief'], ['research notes', 'notes']]) {
    let s = run({ ...initial('A'), prompt });
    assert.equal(s.fileId, id);
    assert.equal(s.phase, 'completed');
    s = reducer(s, { type: 'PREVIEW' });
    assert.equal(s.preview, true);
  }
  assert.equal(reducer(initial(), { type: 'PREVIEW' }).preview, false);
});
test('file failure paths explain recovery and never select a file', () => {
  for (const prompt of ['missing contract', 'private payroll']) {
    const s = run({ ...initial(), prompt });
    assert.equal(s.phase, 'error');
    assert.equal(s.fileId, undefined);
  }
});
test('mail, calendar, and note mutations require explicit approval exactly once', () => {
  for (const scenario of ['B', 'C', 'E']) {
    let s = run(initial(scenario));
    assert.equal(s.phase, 'awaiting-approval');
    assert.equal(s.applied, false);
    assert.equal(step(s, 'FINISH').applied, false);
    s = step(s, 'APPROVE', 'APPROVE', 'FINISH', 'FINISH');
    assert.equal(s.phase, 'completed');
    assert.equal(s.applied, true);
    assert.equal(s.log.filter(e => e.text.includes('Explicit approval')).length, 1);
    if (scenario === 'C') assert.match(s.message, /14:30/);
  }
});
test('cancel and reset reject stale timers; each scenario supports failure and recovery', () => {
  for (const id of ['A', 'B', 'C', 'D', 'E']) {
    let s = step(initial(id), 'START', 'THINK', 'ACT', 'CANCEL', 'RESOLVE', 'FINISH');
    assert.equal(s.phase, 'idle');
    assert.equal(s.applied, false);
    s = run({ ...initial(id), failure: true });
    assert.equal(s.phase, 'error');
    s = reducer(s, { type: 'RESET' });
    assert.deepEqual(s, initial(id));
    assert.notEqual(run(s).phase, 'error');
  }
});
test('screen context uses the selected source and note undo restores original', () => {
  assert.match(run(initial('D')).message, /16.7%/);
  assert.match(run({ ...initial('D'), context: 'text' }).message, /Arjun/);
  const edited = step(run(initial('E')), 'APPROVE', 'FINISH');
  assert.equal(step(edited, 'UNDO').applied, false);
});
test('an empty prompt cannot start; out-of-order transitions cannot mutate', () => {
  const s = { ...initial(), prompt: ' ' };
  assert.equal(step(s, 'START', 'APPROVE', 'FINISH').phase, 'idle');
  assert.deepEqual(step(initial('B'), 'APPROVE', 'FINISH', 'RESOLVE'), initial('B'));
});
