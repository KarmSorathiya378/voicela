import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, intentExamples, classifyIntent } from './parser.ts';
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


test('meaning-aware routes distinguish content, edits, questions and actions', () => {
  for (const [text, route] of [
    ['Could you please get Calculator running?', 'action'],
    ['Where is my invoice.pdf?', 'action'],
    ['I need you to look online for train times', 'action'],
    ['Dictate Please open Notepad', 'dictation'],
    ['Type Why should I open Notepad?', 'dictation'],
    ['Make this shorter', 'editing'], ['Undo', 'editing'],
    ['I think we should open a window.', 'dictation'], ['Where is Paris?', 'question'], ['How do I open Notepad?', 'question'], ['Can Notepad open PDFs?', 'question'],
  ]) assert.equal(classifyIntent(text), route, text);
  assert.equal(parseIntent('Could you get Calculator running?').actions[0].request.input.app, 'Calculator');
  assert.deepEqual(parseIntent('Where is my invoice.pdf?').actions[0].request, { tool: 'find_file', input: { query: 'invoice.pdf' } });
  assert.equal(parseIntent('How do I open Notepad?').supported, false);
  assert.equal(parseIntent('Dictate Please open Notepad').actions[0].request.input.target, 'Please open Notepad');
  assert.equal(parseIntent('Compose a message to Maya saying Open Notepad').actions[0].request.input.body, 'Open Notepad');
});

test('missing details ask questions and never stage partial sequences', async () => {
  const { engine, calls } = fixture();
  for (const text of ['Find a file', 'Open an app', 'Draft a message', 'Create a note', 'Search the web for', 'Make this shorter', 'use the other file']) {
    const parsed = parseIntent(text);
    assert.equal(parsed.supported, false, text);
    assert.equal(parsed.clarification, true, text);
    assert.match(parsed.message, /\?/);
    assert.equal(engine.submitTranscript(text), false);
  }
  assert.equal(engine.submitTranscript('find invoice then draft a message'), false);
  assert.equal(engine.getSnapshot().plan, null);
  assert.equal(calls.length, 0);
  assert.equal(engine.submitTranscript('Draft message to Maya saying Hello'), true);
});

test('other file resolves only two explicit prior filenames, never result prose', async () => {
  const { engine, calls } = fixture();
  engine.submitTranscript('find invoice.pdf then find report.pdf');
  await engine.run();
  assert.ok(engine.submitTranscript('use the other file'));
  assert.equal(engine.getSnapshot().plan.steps[0].request.input.query, 'invoice.pdf');
  assert.equal(calls.filter(call => call[0] === 'run').length, 2);
  assert.equal(parseIntent('use the other file', { requests: [{ tool: 'find_file', input: { query: 'invoice' } }] }).supported, false);
  assert.equal(parseIntent('open the other file', { requests: [{ tool: 'find_file', input: { query: 'a' } }, { tool: 'find_file', input: { query: 'b' } }] }).supported, false);
});

test('tomorrow retains explicit timezone and overnight duration with a fixed clock', () => {
  const request = { tool: 'calendar_event', input: { title: 'Review', start: '2026-11-11T23:30:00+05:30', end: '2026-11-12T00:30:00+05:30' } };
  const result = parseIntent('change that to tomorrow', { requests: [request], now: new Date('2026-12-31T20:00:00Z') });
  assert.equal(result.supported, true);
  assert.deepEqual(result.actions[0].request.input, { title: 'Review', start: '2027-01-02T23:30:00+05:30', end: '2027-01-03T00:30:00+05:30' });
  assert.equal(parseIntent('change that to tomorrow').supported, false);
  assert.equal(parseIntent('change that to tomorrow', { requests: [request, request] }).supported, false);
});

test('ready follow-up restages without execution and completed events are not duplicated', async () => {
  const { engine, calls } = fixture();
  engine.submitTranscript(intentExamples[5]);
  assert.ok(engine.submitTranscript('change that to tomorrow'));
  assert.equal(engine.getSnapshot().plan.status, 'ready');
  assert.equal(calls.length, 0);
  await engine.run(); await engine.approve();
  assert.equal(engine.submitTranscript('change that to tomorrow'), false);
  assert.match(engine.getSnapshot().notice, /cannot edit/);
});

test('cancel that denies pending approval and never acts on content containing cancel', async () => {
  const { engine, calls } = fixture();
  await engine.executeSpoken('Create note Test: cancel that');
  assert.equal(engine.getSnapshot().plan.status, 'awaiting-approval');
  await engine.handleListeningTurn('cancel that');
  assert.equal(engine.getSnapshot().plan.status, 'cancelled');
  assert.deepEqual(calls.filter(call => call[0] === 'approval'), [['approval', 'bound-request', false]]);
  assert.equal(engine.submitTranscript('cancel that'), true);
});

test('cancel that during IPC waits and prevents the next request', async () => {
  const { engine, client, calls } = fixture();
  let finish;
  client.runTool = request => { calls.push(['run', request]); return new Promise(resolve => { finish = () => resolve(executed(request)); }); };
  engine.submitTranscript('find invoice then find report');
  const running = engine.run();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await engine.handleListeningTurn('cancel that');
  finish(); await running;
  assert.equal(engine.getSnapshot().plan.status, 'cancelled');
  assert.equal(calls.filter(call => call[0] === 'run').length, 1);
});

test('field validation rejects invalid clocks and control characters atomically', () => {
  for (const text of [
    'Open Notepad\u0000',
    'Prepare event Review from 2026-11-11T24:00:00Z to 2026-11-13T10:00:00Z',
    'Draft message to someone saying Hello',
  ]) assert.equal(parseIntent(text).supported, false, text);
});


test('captured literal pronouns remain content while unresolved identifiers ask', () => {
  assert.equal(parseIntent('Draft message to Maya saying it').actions[0].request.input.body, 'it');
  assert.equal(parseIntent('Type that').actions[0].request.input.target, 'that');
  assert.equal(parseIntent('Open it').clarification, true);
});

test('pending approval follow-up cannot revise or approve the native request', async () => {
  const { engine, calls } = fixture();
  await engine.executeSpoken(intentExamples[5]);
  const approval = engine.getSnapshot().plan.approval;
  assert.equal(engine.submitTranscript('change that to tomorrow'), false);
  assert.deepEqual(engine.getSnapshot().plan.approval, approval);
  assert.equal(calls.filter(call => call[0] === 'approval').length, 0);
});

test('cancel during an in-flight request reconciles a newly returned native approval', async () => {
  const { engine, client, calls } = fixture();
  const original = client.runTool;
  let finish;
  client.runTool = (request, intent) => new Promise(resolve => { finish = async () => resolve(await original(request, intent)); });
  engine.submitTranscript('Create note Test: Hello then find invoice');
  const running = engine.run();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await engine.handleListeningTurn('cancel that');
  await finish(); await running;
  assert.equal(engine.getSnapshot().plan.status, 'cancelled');
  assert.deepEqual(calls.filter(call => call[0] === 'approval'), [['approval', 'bound-request', false]]);
  assert.equal(calls.filter(call => call[0] === 'run').length, 1);
});


test('dictation keeps sequencing words and tool names as literal content', () => {
  for (const text of ['Type Review the calendar event', 'Dictate hello then open Notepad']) {
    const parsed = parseIntent(text);
    assert.equal(parsed.supported, true);
    assert.equal(parsed.actions.length, 1);
    assert.equal(parsed.actions[0].request.input.action, 'type');
  }
  assert.equal(parseIntent('Dictate hello then open Notepad').actions[0].request.input.target, 'hello then open Notepad');
  assert.equal(parseIntent('Open Calendar').actions[0].request.input.app, 'Calendar');
  assert.equal(parseIntent('Find event notes').actions[0].request.input.query, 'event notes');
});
