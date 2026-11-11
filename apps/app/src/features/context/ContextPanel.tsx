import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { adapter, type AppPolicy } from '../adapters';
import { capturePageContext, enablePageContext, handlePageContextIntent, pageContext, stopPageContext, type CaptureRegion, type CaptureSource, type PageAnswer } from './index';

export function ContextPanel({ onSummarize }: { onSummarize?: PageAnswer }) {
  const [binding, setBinding] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState(false);
  const [source, setSource] = useState<CaptureSource>('accessibility');
  const [scope, setScope] = useState('window');
  const [region, setRegion] = useState<CaptureRegion>({ x: 0, y: 100, width: 800, height: 500 });
  const [text, setText] = useState('');
  const [metadata, setMetadata] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState<AppPolicy>({ allowed: [], excluded: [] });
  const [application, setApplication] = useState('');
  const clear = () => { setEnabled(false); setText(''); setMetadata(''); setSummary(''); };
  const attempt = async (fn: () => Promise<void>) => {
    try { setError(''); setBusy(true); await fn(); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  const stop = () => { clear(); void attempt(stopPageContext); };
  useEffect(() => {
    void adapter.getPolicy().then(setPolicy).catch(e => setError(String(e)));
    const hide = () => { if (document.hidden) { clear(); void stopPageContext().catch(e => setError(String(e))); } };
    const emergency = () => { clear(); void stopPageContext().catch(e => setError(String(e))); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('voicela:emergency-stop', emergency);
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('voicela:emergency-stop', emergency); void stopPageContext().catch(() => undefined); };
  }, []);
  return <section aria-label="Screen context">
    <h2>Screen context</h2>
    <p role="status" aria-live="polite">{enabled ? busy ? 'Capture enabled — working locally' : 'Capture enabled for the selected window' : 'Capture off'}</p>
    <p>Capture once, review the text, then summarize. Password controls are excluded; OCR refuses regions containing editable or sensitive fields. Application exclusions apply to every read.</p>
    <button disabled={busy || enabled} onClick={() => void attempt(async () => { setBinding(await invoke<string>('context_bind')); })}>Select focused window</button>
    <p style={{ overflowWrap: 'anywhere' }}>{binding || 'No window selected. Focus the target app and use the panel shortcut first.'}</p>
    <label><input type="checkbox" checked={permission} onChange={e => { setPermission(e.target.checked); if (enabled) stop(); }} />Allow local window and region screenshots for this session</label>
    <p>Pixels stay in memory. A separate capture indicator appears during OCR. Hiding Voicela stops permission.</p>
    <button disabled={!binding || enabled || busy} onClick={() => void attempt(async () => { await enablePageContext(binding, permission); setEnabled(true); })}>Enable this window</button>
    <button disabled={!enabled && !busy} onClick={stop}>Stop and clear</button>
    <fieldset disabled={busy}>
      <legend>Capture source</legend>
      <label>Read using <select value={source} onChange={e => setSource(e.target.value as CaptureSource)}><option value="accessibility">Accessibility labels</option><option value="ocr">Local screenshot OCR</option></select></label>
      {source === 'ocr' && <>
        <label>Area <select value={scope} onChange={e => setScope(e.target.value)}><option value="window">Whole window</option><option value="region">Region within window</option></select></label>
        {scope === 'region' && <><p>Physical pixels from the window’s top left. Keep inputs outside the region.</p>{(['x', 'y', 'width', 'height'] as const).map(key => <label key={key}>{key}<input type="number" min={key === 'x' || key === 'y' ? 0 : 1} max={4096} value={region[key]} onChange={e => setRegion({ ...region, [key]: Number(e.target.value) })} /></label>)}</>}
      </>}
    </fieldset>
    <button disabled={!enabled || busy || (source === 'ocr' && !permission)} onClick={() => void attempt(async () => {
      setText(''); setMetadata(''); setSummary('');
      const capture = await capturePageContext(source, source === 'ocr' && scope === 'region' ? region : undefined);
      setText(capture.text); setMetadata(`${capture.source} · ${new Date(capture.capturedAt).toLocaleTimeString()} · ${capture.text.length} characters · untrusted`);
    })}>Capture once</button>
    <button disabled={!enabled || busy || !text} onClick={() => void attempt(async () => { setSummary(''); setSummary(await handlePageContextIntent('Summarize this page', onSummarize) ?? ''); })}>Summarize this page</button>
    {!onSummarize && <p>Uses a local excerpt summary: up to five sentences from the captured text. No model or network request.</p>}
    <p>{metadata || 'Nothing captured yet. Captures expire after 30 seconds and are checked again before use.'}</p>
    <label>Captured text (untrusted)<textarea readOnly value={text} rows={8} /></label>
    {summary && <label>Page summary<textarea readOnly value={summary} rows={6} /></label>}
    <fieldset disabled={busy}>
      <legend>Exclude applications</legend>
      <label>Executable name<input value={application} placeholder="example.exe" onChange={e => setApplication(e.target.value)} /></label>
      <button disabled={!application.trim()} onClick={() => void attempt(async () => {
        const current = await adapter.getPolicy();
        const value = { ...current, excluded: [...new Set([...current.excluded, application.trim().toLowerCase()])] };
        clear(); await stopPageContext(); await adapter.setPolicy(value); setPolicy(value); setApplication('');
      })}>Exclude application</button>
      {policy.excluded.length ? <ul>{policy.excluded.map(app => <li key={app}>{app} <button onClick={() => void attempt(async () => {
        const current = await adapter.getPolicy();
        const value = { ...current, excluded: current.excluded.filter(v => v.toLowerCase() !== app.toLowerCase()) };
        await adapter.setPolicy(value); setPolicy(value);
      })}>Remove exclusion for {app}</button></li>)}</ul> : <p>No custom application exclusions.</p>}
      {policy.allowed.length > 0 && <p>Only allowed applications: {policy.allowed.join(', ')}</p>}
    </fieldset>
    <button disabled={!binding || busy} onClick={() => void attempt(async () => { pageContext.exclude(binding); clear(); await invoke('context_exclude', { binding }); })}>Exclude selected window for this session</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
