import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDictation } from './format.ts';
import { InsertionSession } from './adapter.ts';
import { EditingSession, textDiff } from '../editing/session.ts';
const snapshot = {token:'selection-1',text:'old',password:false,editable:true,formatting:'plain'};
function fixture() {
 let current = 'old'; let revision = 1; let undoCalls = 0;
 const adapter = { capture: async () => ({...snapshot, token:`selection-${revision}`, text:current}), replace: async (s,text) => {if(s.token !== `selection-${revision}`) throw Error('stale'); current=text; revision++; return {token:`undo-${revision}`,insertedText:text};}, undo: async r => {if(r.token !== `undo-${revision}`) throw Error('stale undo'); undoCalls++; current='old'; revision++;} };
 return {adapter, change: () => {revision++;}, undoCalls: () => undoCalls};
}
test('spoken punctuation, capitalization and paragraphs',()=>assert.equal(formatDictation('hello comma world new paragraph i am here question mark',{style:'polished'}),'Hello, world\n\nI am here?'));
test('verbatim and literal vocabulary preserve exact input',()=>assert.equal(formatDictation('um c++ hello',{style:'verbatim',replacements:[{from:'c++',to:'C++'}]}),'um C++ hello'));
test('fillers opt in and professional/casual variants',()=>{assert.equal(formatDictation("um i can't go",{style:'professional',removeFillers:true}),'I cannot go.'); assert.equal(formatDictation('i cannot go',{style:'casual'}),"I can't go.");});
test('passwords block before adapter and preserve recovery',async()=>{const f=fixture();const s=new InsertionSession(f.adapter);await assert.rejects(s.insert({...snapshot,password:true},'secret'));assert.equal(s.recoveryText,'secret');assert.equal(s.canUndo,false);});
test('failed insertion retains transcript',async()=>{const f=fixture();f.change();const s=new InsertionSession(f.adapter);await assert.rejects(s.insert(snapshot,'recover'));assert.equal(s.recoveryText,'recover');});
test('undo is consumed once and stale undo never sends keys',async()=>{const f=fixture();const s=new InsertionSession(f.adapter);await s.insert(snapshot,'new');await s.undo();await assert.rejects(s.undo());assert.equal(f.undoCalls(),1);await s.insert(await f.adapter.capture(),'next');f.change();await assert.rejects(s.undo());assert.equal(f.undoCalls(),1);});
test('proposal does not mutate and rejects stale selection',async()=>{const f=fixture();const s=new EditingSession(f.adapter,async()=> 'new');await s.propose({kind:'grammar'});assert.equal((await f.adapter.capture()).text,'old');f.change();await assert.rejects(s.apply());assert.equal(s.proposal.replacement,'new');});
test('apply/cancel/undo',async()=>{const f=fixture();const s=new EditingSession(f.adapter,async()=> 'new');await s.propose({kind:'shorten'});s.cancel();await assert.rejects(s.apply());await s.propose({kind:'grammar'});await s.apply();assert.equal((await f.adapter.capture()).text,'new');await s.insertion.undo();assert.equal((await f.adapter.capture()).text,'old');});
test('late provider response cannot resurrect cancelled proposal',async()=>{const f=fixture();let resolve;const s=new EditingSession(f.adapter,()=>new Promise(r=>resolve=r));const pending=s.propose({kind:'grammar'});await Promise.resolve();s.cancel();resolve('new');await pending;assert.equal(s.proposal,undefined);});
test('diff reconstructs both versions',()=>{for(const [a,b] of [['old','new'],['same','same'],['a middle z','a other z'],['','x']]){const d=textDiff(a,b);assert.equal(d.prefix+d.removed+d.suffix,a);assert.equal(d.prefix+d.added+d.suffix,b);}});
