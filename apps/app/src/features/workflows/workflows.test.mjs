import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextSession, isStale } from '../context/index.ts';
import { WorkflowRunner } from './index.ts';
const storage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v) }; };
test('stale bindings, expiry, clock rollback and generation are rejected', () => {
 const c = { binding: 'a', capturedAt: 100, generation: 1 };
 assert.equal(isStale(c,'a',101),false);
 for (const args of [['b',101,1],['a',30101,1],['a',99,1],['a',101,2]]) assert.equal(isStale(c,...args),true);
});
test('disable discards in-flight context', async () => {
 const s = new ContextSession(); s.enable('a');
 let resolve; const pending = s.capture('a',{ read: () => new Promise(r => resolve=r) });
 s.disable(); resolve({text:'private',source:'accessibility'});
 await assert.rejects(pending); assert.equal(s.captured,null);
});
test('idempotency survives runner recreation and concurrent execution', async () => {
 const store=storage(); const runner=new WorkflowRunner(store); let calls=0;
 const steps=[{ name:'send', run:async()=>{ calls++; return 'receipt'; }, verify:async()=>true }];
 const first=runner.run('same',steps);
 await assert.rejects(runner.run('same',steps));
 assert.equal((await first).status,'verified');
 await assert.rejects(new WorkflowRunner(store).run('same',steps)); assert.equal(calls,1);
});
test('failed verification never reports success or permits replay', async () => {
 const runner=new WorkflowRunner(storage()); const steps=[{name:'write',run:async()=> 'id',verify:async()=>false}];
 assert.equal((await runner.run('x',steps)).status,'uncertain'); await assert.rejects(runner.run('x',steps));
});


test('safe verification retries never repeat a provider write', async () => {
 const runner = new WorkflowRunner(storage()); let writes = 0; let reads = 0;
 const result = await runner.run('verify-retry', [{ name: 'event', run: async () => { writes++; return 'event-id'; }, verify: async () => { if (++reads < 3) throw new Error('Transient read failure'); return true; } }]);
 assert.equal(result.status, 'verified'); assert.equal(writes, 1); assert.equal(reads, 3);
});

test('ambiguous failed write is never automatically retried', async () => {
 const runner = new WorkflowRunner(storage()); let calls = 0;
 const steps = [{ name: 'send', run: async () => { calls++; throw new Error('Network result uncertain'); }, verify: async () => true }];
 assert.equal((await runner.run('network', steps)).status, 'uncertain');
 await assert.rejects(runner.run('network', steps)); assert.equal(calls, 1);
});

test('timeout bounds verification and blocks later steps and replay', async () => {
 const runner = new WorkflowRunner(storage()); let later = 0;
 const steps = [{ name: 'event', run: async () => 'id', verify: async () => new Promise(() => {}) }, { name: 'mail', run: async () => { later++; return 'id'; }, verify: async () => true }];
 const result = await runner.run('timeout', steps, () => {}, 10);
 assert.equal(result.status, 'uncertain'); assert.equal(result.receipts.event, 'id'); assert.equal(later, 0);
 await assert.rejects(runner.run('timeout', steps));
});

test('partial completion and interrupted work retain receipts for recovery', async () => {
 const store = storage(); const runner = new WorkflowRunner(store);
 const result = await runner.run('partial', [{ name: 'event', run: async () => 'event-id', verify: async () => true }, { name: 'mail', run: async () => { throw new Error('Provider unavailable'); }, verify: async () => true }]);
 assert.equal(result.status, 'partial'); assert.deepEqual(result.completed, ['event']); assert.equal(result.receipts.event, 'event-id');
 store.setItem('workflow:interrupted', JSON.stringify({ status: 'running', completed: ['event'], current: 'mail', receipts: {event: 'event-id'} }));
 const recovered = new WorkflowRunner(store).inspect('interrupted');
 assert.equal(recovered.status, 'partial'); assert.match(recovered.detail, /Interrupted during mail/);
});

test('Gmail acknowledgement cannot be reported as verified delivery', async () => {
 const result = await new WorkflowRunner(storage()).run('mail', [{ name: 'send', evidence: 'acknowledged', run: async () => 'mail-id', verify: async () => true }]);
 assert.equal(result.status, 'acknowledged'); assert.match(result.detail, /Delivery is not verified/);
});

test('journal failure prevents execution', async () => {
 let calls = 0; const runner = new WorkflowRunner({getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); }});
 await assert.rejects(runner.run('storage', [{name:'send', run: async () => { calls++; return 'id'; }, verify: async () => true}]));
 assert.equal(calls, 0);
});


test('cancellation before the first step does not execute or leave an unhandled rejection', async () => {
 const runner = new WorkflowRunner(storage()); let calls = 0;
 const result = await runner.run('cancel-now', [{name:'mail',run:async()=>{calls++;return 'id';},verify:async()=>true}], () => runner.cancel('cancel-now'));
 assert.equal(calls, 0); assert.equal(result.status, 'cancelled');
});

test('corrupt persisted history blocks replay and explains reconciliation', async () => {
 const store = storage(); store.setItem('workflow:corrupt', '{'); const runner = new WorkflowRunner(store);
 assert.equal(runner.inspect('corrupt').status, 'uncertain');
 await assert.rejects(runner.run('corrupt', [{name:'mail',run:async()=> 'id',verify:async()=>true}]));
});


test('cancelling from step progress cannot start that provider action', async () => {
 const runner = new WorkflowRunner(storage()); let writes = 0;
 const result = await runner.run('cancel-at-intent', [{name:'send',run:async()=>{writes++;return 'id';},verify:async()=>true}], record => {if (record.current) runner.cancel('cancel-at-intent');});
 assert.equal(writes, 0); assert.equal(result.status, 'cancelled');
});
