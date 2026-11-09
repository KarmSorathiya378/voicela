import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, intentExamples } from './parser.ts';
import { IntentEngine } from './planner.ts';

const simulated = request => ({ status: 'simulated', output: { tool: request.tool, executed: false, status: 'simulated', message: 'Simulated. No action executed.' } });
function fixture() {
  const calls = [];
  let pending = null;
  const client = {
    getState: async () => ({ state: pending ? 'awaiting-approval' : 'idle', pending_approval: pending }),
    setState: async state => { calls.push(['state', state]); return { state, pending_approval: null }; },
    runTool: async (request, intent) => {
      calls.push(['run', request]);
      if (request.tool === 'find_file') return simulated(request);
      pending = { id: 'bound-request', request, intent };
      return { status: 'awaiting_approval', approval: pending };
    },
    approveTool: async (id, approved) => {
      calls.push(['approval', id, approved]);
      assert.equal(id, pending.id);
      const request = pending.request;
      pending = null;
      return approved ? simulated(request) : { status: 'denied', message: 'Declined. No action executed.' };
    },
  };
  return { client, calls, engine: new IntentEngine(client) };
}

test('six deterministic rules have exact tool inputs', () => {
  assert.deepEqual(intentExamples.map(text => parseIntent(text).actions[0].request.tool), ['find_file', 'open_app', 'create_note', 'draft_message', 'browser_search', 'calendar_event']);
  assert.deepEqual(parseIntent('draft message to Maya saying Hello').actions[0].request.input, { recipient: 'Maya', body: 'Hello' });
  assert.deepEqual(parseIntent('find my invoice').actions[0].request.input, { query: 'invoice' });
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
  assert.equal(engine.getSnapshot().plan.status, 'awaiting-approval');
  assert.equal(engine.getSnapshot().plan.approval.request.tool, 'open_app');
  await engine.approve();
  await engine.approve();
  assert.equal(calls.filter(call => call[0] === 'approval').length, 2);
  assert.equal(engine.getSnapshot().plan.status, 'completed');
  assert.ok(engine.getSnapshot().plan.steps.every(step => step.status === 'simulated'));
});
test('stop during in-flight step pauses before next; resume never replays', async () => {
  const { engine, client, calls } = fixture();
  let finish;
  client.runTool = request => { calls.push(['run', request]); return new Promise(resolve => { finish = () => resolve(simulated(request)); }); };
  engine.submitTranscript('find invoice then find report');
  const running = engine.run();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  engine.stop(); finish(); await running;
  assert.equal(engine.getSnapshot().plan.status, 'paused');
  assert.equal(calls.filter(call => call[0] === 'run').length, 1);
  client.runTool = async request => { calls.push(['run', request]); return simulated(request); };
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
  engine.submitTranscript('open Notepad');
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
  engine.submitTranscript('open Notepad'); await engine.run();
  const restored = new IntentEngine(client); await restored.connect();
  assert.equal(restored.getSnapshot().plan.status, 'awaiting-approval');
  assert.equal(calls.filter(call => call[0] === 'run').length, 1);
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
  await restored.cancel();
  assert.equal(restored.getSnapshot().plan.status, 'cancelled');
});
test('every consequential tool stops at approval and has exact request details', async () => {
  for (const text of intentExamples.slice(1)) {
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
