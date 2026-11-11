import '../integrations/panels.css';
import { useEffect, useRef, useState } from 'react';
import { WorkflowRunner, schedulingEnabled, type Routine, type RunRecord } from './index';
import { GoogleAdapter, type GoogleAction, type GoogleMode, type GooglePreview, type GoogleResult } from '../integrations';
interface GoogleRoutine extends Routine { actions?: GoogleAction[] }
export function WorkflowPanel() {
  const runner = useRef(new WorkflowRunner(localStorage)).current;
  const [name, setName] = useState(''); const [command, setCommand] = useState('');
  const [to, setTo] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [mode, setMode] = useState<GoogleMode>('sandbox');
  const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<GooglePreview[]>([]);
  const [routines, setRoutines] = useState<GoogleRoutine[]>(() => { try { return JSON.parse(localStorage.getItem('voicela:routines') || '[]'); } catch { return []; } });
  const [keys, setKeys] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('voicela:workflow-history') || '[]'); } catch { return []; } });
  const [records, setRecords] = useState<Record<string, RunRecord>>(() => Object.fromEntries(keys.flatMap(key => { const r = runner.inspect(key); return r ? [[key, r]] : []; })));
  useEffect(() => {
    const stop = () => { runner.cancelAll(); setReview([]); };
    window.addEventListener('voicela:emergency-stop', stop);
    return () => { stop(); window.removeEventListener('voicela:emergency-stop', stop); };
  }, [runner]);
  const attempt = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); try { await fn(); } catch (e) { setStatus(String(e)); } finally { setBusy(false); } };
  return <section className="vs-workflow-panel" aria-label="Reusable workflows">
    <h2>Reusable workflows</h2>
    <p>Save a Calendar event followed by a Gmail message, or either action alone. Every execution requires review. Dates need an explicit UTC offset; enter the full recipient email address.</p>
    <label>Name<input value={name} onChange={e => setName(e.target.value)} /></label>
    <label>Reusable command or notes<textarea value={command} onChange={e => setCommand(e.target.value)} /></label>
    <label>Recipient email (optional)<input type="email" value={to} onChange={e => setTo(e.target.value)} /></label>
    <label>Subject / event title<input value={subject} onChange={e => setSubject(e.target.value)} /></label>
    <label>Exact message<textarea value={body} onChange={e => setBody(e.target.value)} /></label>
    <label>Event start (optional, RFC3339)<input placeholder="2026-11-20T09:00:00+05:30" value={start} onChange={e => setStart(e.target.value)} /></label>
    <label>Event end (RFC3339)<input value={end} onChange={e => setEnd(e.target.value)} /></label>
    <button disabled={busy || !name.trim() || (!command.trim() && !to && !start)} onClick={() => void attempt(async () => {
      const actions: GoogleAction[] = [];
      if (start || end) actions.push({ kind: 'event', summary: subject, start, end });
      if (to) actions.push({ kind: 'mail', to, subject, body });
      const adapter = new GoogleAdapter('sandbox');
      for (const action of actions) await adapter.preview(action);
      const routine: GoogleRoutine = { id: crypto.randomUUID(), name, command, actions };
      const next = [...routines, routine]; localStorage.setItem('voicela:routines', JSON.stringify(next)); setRoutines(next); setStatus('Saved locally. Message and command text are not encrypted.');
    })}>Save routine</button>
    <label>Execution mode<select disabled={busy} value={mode} onChange={e => { setMode(e.target.value as GoogleMode); setReview([]); }}><option value="sandbox">Sandbox: no provider writes</option><option value="real">Real Google account</option></select></label>
    <ul>{routines.map(r => <li key={r.id}><strong>{r.name}</strong><p>{r.command}</p>
      <button disabled={busy || !r.actions?.length} onClick={() => void attempt(async () => {
        setReview([]); const adapter = new GoogleAdapter(mode); const previews: GooglePreview[] = [];
        for (const action of r.actions || []) previews.push(await adapter.preview(action));
        setReview(previews); setStatus('Review every action below. Approval expires after five minutes.');
      })}>Review workflow</button>
      <button disabled={busy} onClick={() => { setName(r.name); setCommand(r.command); setStatus('Command loaded. Saved notes do not execute as instructions.'); }}>Load command</button>
    </li>)}</ul>
    {!!review.length && <div><h3>Approve exact actions: {review[0].mode}</h3><ol>{review.map(p => <li key={p.id}><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(p.action, null, 2)}</pre></li>)}</ol>
      <button disabled={busy} onClick={() => void attempt(async () => {
        const previews = review; setReview([]); const key = crypto.randomUUID(); const next = [...keys, key];
        localStorage.setItem('voicela:workflow-history', JSON.stringify(next)); setKeys(next);
        const adapter = new GoogleAdapter(previews[0].mode);
        const result = await runner.run(key, previews.map((p, i) => ({
          name: `${i + 1}: ${p.action.kind}`,
          evidence: p.action.kind === 'mail' && p.mode === 'real' ? 'acknowledged' as const : 'verified' as const,
          run: async (signal: AbortSignal) => { if (signal.aborted) throw new Error('Stopped before action'); return JSON.stringify(await adapter.confirm(p.id)); },
          verify: async (receipt: string) => { const r = JSON.parse(receipt) as GoogleResult; return !!r.id && (r.verified || (p.action.kind === 'mail' && r.acknowledged === true)); },
        })), record => setRecords(old => ({ ...old, [key]: record })), 90000);
        setStatus(result.detail);
      })}>Approve and execute all actions</button><button disabled={busy} onClick={() => setReview([])}>Discard preview</button>
    </div>}
    {busy && <button onClick={() => runner.cancelAll()}>Cancel execution</button>}
    <p role="status" aria-live="polite">{status}</p>
    <h3>Execution history and recovery</h3>
    <p>Cancellation cannot retract a provider write. After interruption, inspect Google Calendar and Gmail Sent using the receipts below. Delete an unwanted event in Calendar; Gmail has no undo here. Create a new routine containing only confirmed unexecuted steps. Identical attempted actions remain blocked by the native journal.</p>
    <ul>{keys.map(key => { const r = records[key]; return r && <li key={key}><strong>{r.status}</strong><p>{r.detail}</p><p>Completed: {r.completed.join(', ') || 'None verified'}</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(r.receipts || {}, null, 2)}</pre></li>; })}</ul>
    {!schedulingEnabled && <p>Reminders and scheduled execution are unavailable until provider verification and recovery support safe unattended execution.</p>}
  </section>;
}
