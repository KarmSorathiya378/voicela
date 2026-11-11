import { useId, useRef, useState } from 'react';
import type { TextAdapter } from '../dictation/adapter';
import { EditingSession, textDiff, type EditInstruction, type EditProvider } from './session';
import { localEditProvider } from './provider';
import './editing.css';
export function EditingPanel({ adapter, provider = localEditProvider }: { adapter: TextAdapter; provider?: EditProvider }) {
  const session = useRef<EditingSession | null>(null);
  const dependencies = useRef({ adapter, provider });
  if (!session.current || dependencies.current.adapter !== adapter || dependencies.current.provider !== provider) {
    session.current = new EditingSession(adapter, provider); dependencies.current = { adapter, provider };
  }
  const engine = session.current;
  const [kind, setKind] = useState<EditInstruction['kind']>('grammar');
  const [language, setLanguage] = useState('English');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Select text in the target app before requesting an edit.');
  const [, render] = useState(0);
  const guard = useRef(false);
  const id = useId();
  async function run(action: () => Promise<void>, success: string) {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try { await action(); setMessage(success); } catch (error) { setMessage(String(error)); }
    finally { guard.current = false; setBusy(false); render(value => value + 1); }
  }
  const proposal = engine.proposal;
  const diff = proposal && textDiff(proposal.original.text, proposal.replacement);
  return <section className="ve-panel" aria-labelledby={`${id}-title`} aria-busy={busy}>
    <h2 id={`${id}-title`}>Edit selected text</h2>
    <p>Review every change before replacing your selection.</p>
    <div className="ve-controls"><label htmlFor={`${id}-action`}>Change<select id={`${id}-action`} value={kind} disabled={busy} onChange={event => { setKind(event.target.value as EditInstruction['kind']); engine.cancel(); render(value => value + 1); }}>
      <option value="grammar">Fix grammar</option><option value="shorten">Shorten</option><option value="professional">Make professional</option><option value="translate">Translate</option>
    </select></label>
    {kind === 'translate' && <label htmlFor={`${id}-language`}>Language<input id={`${id}-language`} value={language} disabled={busy} onChange={event => setLanguage(event.target.value)} /></label>}
    <button disabled={busy || kind === 'translate' && !language.trim()} onClick={() => void run(() => engine.propose(kind === 'translate' ? { kind, language } : { kind }), 'Proposal ready. Review the change below.')}>Propose change</button></div>
    {!provider || provider === localEditProvider ? <p className="ve-hint">Local edits use conservative rules. Translation needs a connected editing provider.</p> : null}
    {proposal && diff && <div className="ve-preview"><h3>Proposed change</h3><p className="ve-diff">{diff.prefix}{diff.removed && <del>{diff.removed}</del>}{diff.added && <ins>{diff.added}</ins>}{diff.suffix}</p><p className="ve-hint">{proposal.original.formatting === 'preserved' ? 'The adapter supports preserving formatting.' : 'This app supports plain text replacement. Formatting may change.'}</p>
      <div className="ve-controls"><button disabled={busy || proposal.original.text === proposal.replacement} onClick={() => void run(() => engine.apply(), 'Change applied.')}>Apply change</button><button disabled={busy} onClick={() => { engine.cancel(); render(value => value + 1); setMessage('Edit cancelled.'); }}>Cancel</button><button disabled={busy} onClick={() => void run(() => engine.retry(), 'New proposal ready.')}>Retry</button></div></div>}
    <button disabled={busy || !engine.insertion.canUndo} onClick={() => void run(() => engine.insertion.undo(), 'Previous text restored.')}>Undo last change</button>
    <p role="status" aria-live="polite">{message}</p>
    {engine.insertion.recoveryText && <label>Recovered replacement<textarea readOnly value={engine.insertion.recoveryText} /></label>}
  </section>;
}
