import { useMemo, useRef, useState } from 'react';
import { InsertionSession, type TextAdapter, type TextSnapshot } from './adapter';
import { formatDictation, type DictationOptions, type WritingStyle } from './format';
import '../editing/editing.css';
/** Capture from the external app via adapter shortcut before focusing this panel. */
export function DictationPanel({ adapter, transcript = '' }: { adapter: TextAdapter; transcript?: string }) {
  const session = useMemo(() => new InsertionSession(adapter), [adapter]);
  const [target, setTarget] = useState<TextSnapshot>();
  const [style, setStyle] = useState<WritingStyle>('polished');
  const [removeFillers, setRemoveFillers] = useState(false);
  const [rules, setRules] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Capture a target before inserting.');
  const [, render] = useState(0);
  const guard = useRef(false);
  const options: DictationOptions = { style, removeFillers, replacements: rules.split('\n').flatMap(line => {
    const separator = line.indexOf('=>');
    return separator < 1 ? [] : [{ from: line.slice(0, separator).trim(), to: line.slice(separator + 2).trim() }];
  }) };
  const text = formatDictation(draft ?? transcript, options);
  async function run(action: () => Promise<void>) {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try { await action(); } catch (error) { setMessage(String(error)); }
    finally { guard.current = false; setBusy(false); render(value => value + 1); }
  }
  return <section className="ve-panel" aria-label="Dictation" aria-busy={busy}><h2>Dictation</h2>
    <div className="ve-controls"><label>Writing style<select value={style} onChange={event => setStyle(event.target.value as WritingStyle)} disabled={busy}>{(['verbatim', 'polished', 'professional', 'casual'] as const).map(value => <option key={value}>{value}</option>)}</select></label><label><span>Remove fillers</span><input type="checkbox" checked={removeFillers} onChange={event => setRemoveFillers(event.target.checked)} disabled={busy} /></label></div>
    <details><summary>Personal vocabulary</summary><label>One replacement per line, for example voice ella =&gt; Voicela<textarea value={rules} onChange={event => setRules(event.target.value)} disabled={busy} /></label></details>
    <label>Transcript<textarea value={draft ?? transcript} onChange={event => setDraft(event.target.value)} disabled={busy} /></label><button disabled={busy} onClick={() => setDraft(null)}>Use latest transcript</button>
    <h3>Insertion preview</h3><p className="ve-diff">{text || 'Your formatted words appear here.'}</p>
    <div className="ve-controls"><button disabled={busy} onClick={() => void run(async () => { setTarget(await adapter.capture()); setMessage('Target captured. Review text before inserting.'); })}>Capture target</button><button disabled={busy || !target || !text.trim()} onClick={() => void run(async () => { if (!target) return; await session.insert(target, text); setTarget(undefined); setMessage('Text inserted. Clipboard unchanged.'); })}>Insert text</button><button disabled={busy || !session.canUndo} onClick={() => void run(async () => { await session.undo(); setMessage('Insertion undone.'); })}>Undo insertion</button></div>
    <p role="status" aria-live="polite">{message}</p>{session.recoveryText && <label>Recovered transcript<textarea readOnly value={session.recoveryText} /></label>}
  </section>;
}
