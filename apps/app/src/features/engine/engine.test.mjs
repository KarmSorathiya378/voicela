import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, intentExamples } from './parser.ts';
import { IntentEngine } from './planner.ts';

const simulated = request => ({ status: 'simulated', output: { tool: request.tool, executed: false, status: 'simulated', message: 'Simulated. No action executed.' } });
const executed = request => ({ status: "executed", output: { tool: request.tool, executed: true, status: "executed", message: "Action completed." } });
function fixture() {
  const calls = [];
  let pending = null;
  const client = {
    getState: async () => ({ state: pending ? 'awaiting-approval' : 'idle', pending_approval: pending }),
    setState: async state => { calls.push(['state', state]); return { state, pending_approval: null }; },
    runTool: async (request, intent) => {
      calls.push(['run', request]);
      if (['find_file', 'open_app'].includes(request.tool) || request.tool === 'control_app' && request.input.action === 'inspect') return executed(request);
      pending = { id: 'bound-request', request, intent };
      return { status: 'awaiting_approval', approval: pending };
    },
    approveTool: async (id, approved) => {
      calls.push(['approval', id, approved]);
      assert.equal(id, pending.id);
      const request = pending.request;
      pending = null;
      if (!approved) return { status: 'denied', message: 'Declined. No action executed.' };
      if (['create_note', 'open_app', 'browser_search', 'control_app'].includes(request.tool)) {
        return { status: 'executed', output: { tool: request.tool, executed: true, status: 'executed', message: 'Note saved.' } };
      }
      return simulated(request);
    },
  };
  return { client, calls, engine: new IntentEngine(client) };
}

test('six deterministic rules have exact tool inputs', () => {
  assert.deepEqual(intentExamples.map(text => parseIntent(text).actions[0].request.tool), ['find_file', 'open_app', 'create_note', 'draft_message', 'browser_search', 'calendar_event']);
  assert.deepEqual(parseIntent('draft message to Maya saying Hello').actions[0].request.input, { recipient: 'Maya', body: 'Hello' });
  assert.deepEqual(parseIntent('find my invoice').actions[0].request.input, { query: 'invoice' });
  for (const phrase of ['Create a note titled Shopping saying Buy milk', 'Make a note called Shopping that says Buy milk', 'Create note Shopping: Buy milk']) {
    assert.deepEqual(parseIntent(phrase).actions[0].request, { tool: 'create_note', input: { title: 'Shopping', body: 'Buy milk' } });
  }
});
test('unsupported or incomplete sequences reject atomically', () => {
  for (const text of ['', 'send a message to Maya', 'delete invoice', 'find invoice then send it', 'draft message to Maya', 'create note Shopping', 'open it', 'prepare event Review from tomorrow to later', 'prepare event Review from 2026-02-30T10:00:00Z to 2026-03-03T11:00:00Z', 'prepare event Review from 2026-11-11T11:00:00Z to 2026-11-11T10:00:00Z', 'find ' + 'x'.repeat(2048)]) {
    assert.equal(parseIntent(text).supported, false, text);
  }
});
test('staging never runs tools; consequential step awaits explicit approval', async () => {
  const { engine, calls } = fixture();
  assert.ok(engine.submitTranscript('find invoice then create note Shopping: Milk then open Notepad'));
  assert.equal(calls.length, 0);
  await engine.run();
  assert.equal(engine.getSnapshot().plan.status, 'awaiting-approval');
  assert.deepEqual(calls.filter(call => call[0] === 'run').map(call => call[1].tool), ['find_file', 'create_note']);
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  await engine.run();
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  await engine.approve();
  await engine.approve();
  assert.equal(calls.filter(call => call[0] === 'approval').length, 1);
  assert.equal(engine.getSnapshot().plan.status, 'completed');
  assert.deepEqual(engine.getSnapshot().plan.steps.map(step => step.status), ['executed', 'executed', 'executed']);
  assert.match(engine.getSnapshot().notice, /Executed: 3\. Simulated: 0\./);
});
test('stop during in-flight step pauses before next; resume never replays', async () => {
  const { engine, client, calls } = fixture();
  let finish;
  client.runTool = request => { calls.push(['run', request]); return new Promise(resolve => { finish = () => resolve(executed(request)); }); };
  engine.submitTranscript('find invoice then find report');
  const running = engine.run();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  engine.stop(); finish(); await running;
  assert.equal(engine.getSnapshot().plan.status, 'paused');
  assert.equal(calls.filter(call => call[0] === 'run').length, 1);
  client.runTool = async request => { calls.push(['run', request]); return executed(request); };
  await engine.run();
  assert.equal(engine.getSnapshot().plan.status, 'completed');
  assert.deepEqual(calls.filter(call => call[0] === 'run').map(call => call[1].input.query), ['invoice', 'report']);
});
test('paused approval requires resume then a separate approval; cancel stops chain', async () => {
  const { engine, calls } = fixture();
  engine.submitTranscript('create note Shopping: Milk then find invoice');
  await engine.run(); engine.stop(); await engine.approve();
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  await engine.run();
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  await engine.cancel();
  assert.deepEqual(calls.filter(call => call[0] === 'approval'), [['approval', 'bound-request', false]]);
  assert.equal(engine.getSnapshot().plan.status, 'cancelled');
  assert.ok(engine.getSnapshot().plan.steps.every(step => step.status === 'cancelled'));
  assert.equal(calls.filter(call => call[0] === 'run').length, 1);
});
test('duplicate run/approve calls are serialized', async () => {
  const { engine, calls } = fixture();
  engine.submitTranscript('Create note Test: Hello');
  await Promise.all([engine.run(), engine.run()]);
  await Promise.all([engine.approve(), engine.approve()]);
  assert.equal(calls.filter(call => call[0] === 'run').length, 1);
  assert.equal(calls.filter(call => call[0] === 'approval').length, 1);
});
test('IPC uncertainty is not success, retried, or replaceable without cancellation', async () => {
  const { engine, client, calls } = fixture();
  client.runTool = async () => { throw new Error('connection lost'); };
  engine.submitTranscript('find invoice'); await engine.run(); await engine.run();
  assert.equal(engine.getSnapshot().plan.status, 'error');
  assert.equal(engine.getSnapshot().plan.steps[0].status, 'error');
  assert.equal(engine.submitTranscript('open Notepad'), false);
  await engine.cancel();
  assert.ok(engine.submitTranscript('open Notepad'));
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
});
test('reconnect restores core approval without replaying or auto-approving', async () => {
  const { engine, client, calls } = fixture();
  engine.submitTranscript('Create note Test: Hello'); await engine.run();
  const restored = new IntentEngine(client); await restored.connect();
  assert.equal(restored.getSnapshot().plan.status, 'awaiting-approval');
  assert.equal(calls.filter(call => call[0] === 'run').length, 1);
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  await restored.cancel();
  assert.equal(restored.getSnapshot().plan.status, 'cancelled');
});
test('every consequential tool stops at approval and has exact request details', async () => {
  for (const text of intentExamples.slice(2)) {
    const { engine, calls } = fixture();
    engine.submitTranscript(text); await engine.run();
    assert.equal(engine.getSnapshot().plan.status, 'awaiting-approval', text);
    assert.deepEqual(engine.getSnapshot().plan.approval.request, parseIntent(text).actions[0].request);
    assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  }
});
test('mismatched or unexpected tool results are never reported as success', async () => {
  const { engine, client } = fixture();
  client.runTool = async () => simulated({ tool: 'open_app' });
  engine.submitTranscript('find invoice'); await engine.run();
  assert.equal(engine.getSnapshot().plan.status, 'error');
  assert.equal(engine.getSnapshot().plan.steps[0].status, 'error');
});

test('a simulated note is never reported as saved', async () => {
  const { engine, client } = fixture();
  client.approveTool = async () => simulated({ tool: 'create_note' });
  engine.submitTranscript('Create a note titled Shopping saying Buy milk');
  await engine.run();
  await engine.approve();
  assert.equal(engine.getSnapshot().plan.steps[0].status, 'error');
});


test('spoken punctuation is removed from app commands', () => {
  assert.deepEqual(parseIntent('Please open Notepad.').actions[0].request, { tool: 'open_app', input: { app: 'Notepad' } });
});
test('a simulated application launch is never reported as opened', async () => {
  const { engine, client } = fixture();
  client.runTool = async () => simulated({ tool: 'open_app' });
  engine.submitTranscript('Open Notepad'); await engine.run(); await engine.approve();
  assert.equal(engine.getSnapshot().plan.steps[0].status, 'error');
});

test('note and message punctuation is preserved verbatim', () => {
  assert.equal(parseIntent('Create note Greeting: Hello!').actions[0].request.input.body, 'Hello!');
  assert.equal(parseIntent('Draft message to Maya saying Are you coming?').actions[0].request.input.body, 'Are you coming?');
});

test('a spoken app command executes without staging clicks or approvals', async () => {
  const { engine, calls } = fixture();
  await engine.executeSpoken('Open Notepad.');
  assert.equal(engine.getSnapshot().plan.status, 'completed');
  assert.equal(calls.filter(call => call[0] === 'run').length, 1);
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  await engine.executeSpoken('Open Calculator.');
  assert.equal(calls.filter(call => call[0] === 'run')[1][1].input.app, 'Calculator');
});
test('spoken commands retain write approvals and reject unsupported actions', async () => {
  const { engine, calls } = fixture();
  await assert.rejects(engine.executeSpoken('delete my files'));
  assert.equal(calls.length, 0);
  await engine.executeSpoken('Create note Shopping: Milk');
  assert.equal(engine.getSnapshot().plan.status, 'awaiting-approval');
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  await assert.rejects(engine.executeSpoken('Open Notepad'));
});

test('natural app requests work without changing note or message text', () => {
  for (const text of ['Could you please open the Calculator?', 'Please launch my application Notepad.']) {
    const parsed = parseIntent(text);
    assert.equal(parsed.supported, true);
    assert.equal(parsed.actions[0].request.tool, 'open_app');
    assert.ok(['Calculator', 'Notepad'].includes(parsed.actions[0].request.input.app));
  }
});

test('app-control commands preserve exact targets and text', () => {
  for (const [text, action, target] of [
    ['Inspect current app', 'inspect', 'visible controls'], ['Click Save.', 'click', 'Save'],
    ['Type Hello, world!', 'type', 'Hello, world!'], ['Press Control + S', 'key', 'Control + S'], ['Scroll down', 'scroll', 'down'],
  ]) assert.deepEqual(parseIntent(text).actions[0].request, { tool: 'control_app', input: { action, target, window: 'foreground' } });
});
test('inspection runs but app changes still require explicit approval', async () => {
  const { engine, calls } = fixture();
  await engine.executeSpoken('Inspect current app'); assert.equal(engine.getSnapshot().plan.status, 'completed');
  await engine.executeSpoken('Click Save'); assert.equal(engine.getSnapshot().plan.status, 'awaiting-approval');
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  await engine.approve(); assert.equal(engine.getSnapshot().plan.status, 'completed');
});

test('continuous turns execute and voice approval works without stopping the session', async () => {
 const { engine, calls } = fixture();
 await engine.handleListeningTurn('Open Notepad');
 assert.equal(engine.getSnapshot().plan.status, 'completed');
 await engine.handleListeningTurn('Create note Shopping: Milk');
 assert.equal(engine.getSnapshot().plan.status, 'awaiting-approval');
 await engine.handleListeningTurn('Approve.');
 assert.equal(engine.getSnapshot().plan.status, 'completed');
 assert.equal(calls.filter(call => call[0] === 'approval').length, 1);
 await assert.rejects(engine.handleListeningTurn('Approve'), /no request/);
 await engine.handleListeningTurn('Create note Test: More');
 await engine.handleListeningTurn('cancel plan');
 assert.equal(engine.getSnapshot().plan.status, 'cancelled');
});
