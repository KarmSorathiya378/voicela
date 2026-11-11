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
 const s = new ContextSession(); s.enable();
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
