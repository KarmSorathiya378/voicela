import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { api, type ActivityEntry, type AppState, type StateSnapshot, type ToolDescriptor } from '../api';
import { ToolRegistry } from '../features/tools/ToolRegistry';
import { StateIndicator } from './StateIndicator';
import { Icon } from './Icon';
import './shell.css';

export interface AppShellProps { speechPanel?: ReactNode; enginePanel?: ReactNode; state?: AppState }
export default function AppShell({ speechPanel, enginePanel, state }: AppShellProps) {
  const desktop = isTauri();
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null);
  const [tools, setTools] = useState<ToolDescriptor[]>([]);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(desktop);
  const [clearing, setClearing] = useState(false);
  const refresh = useCallback(async () => {
    if (!desktop) return;
    try {
      const [next, registry, history] = await Promise.all([api.getState(), api.getTools(), api.getActivityLog()]);
      setSnapshot(next); setTools(registry); setEntries(history); setError(''); setLoading(false);
    } catch (reason) {
      setSnapshot(null); setTools([]); setError(String(reason)); setLoading(false);
      throw reason;
    }
  }, [desktop]);
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    let pending = false;
    async function poll() { if (pending || !active) return; pending = true; try { await refresh(); } catch (reason) { if (active) { setError(String(reason)); setLoading(false); } } finally { pending = false; } }
    void poll(); const timer = window.setInterval(() => void poll(), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [desktop, refresh]);
  async function clearHistory() {
    setClearing(true);
    try { await api.clearActivityLog(); await refresh(); } catch (reason) { setError(String(reason)); } finally { setClearing(false); }
  }
  return <div className="vs-shell">
    <a className="vs-skip" href="#vs-workspace">Skip to workspace</a>
    <header className="vs-header"><a className="vs-brand" href="#vs-workspace" aria-label="Voicela workspace"><span className="vs-brand-mark"><Icon name="voice" size={24} /></span>voicela<span className="vs-platform">Windows</span></a><StateIndicator state={state ?? snapshot?.state ?? null} /></header>
    <div className="vs-body"><main id="vs-workspace" className="vs-workspace">
      <div className="vs-intro"><h1>A little less doing.<br /><em>A little more done.</em></h1><p>Your voice, a clear plan, and the final say.</p></div>
      {!desktop && <p className="vs-notice"><Icon name="circle" />Browser preview. Rust and SQLite are disconnected. Sample file search works here; desktop actions require Tauri.</p>}
      {error && <div className="vs-error" role="alert"><p>Desktop connection failed: {error}</p><button className="vs-secondary" onClick={() => void refresh().catch(reason => setError(String(reason)))}>Retry connection</button></div>}
      <div className="vs-speech-mount" data-panel="speech">{speechPanel ?? <section className="vs-panel-placeholder"><Icon name="mic" size={26} /><div><h2>Your next instruction</h2><p>Speech panel is waiting for integration. No microphone is recording.</p></div></section>}</div>
      <div className="vs-engine-mount" data-panel="engine">{enginePanel ?? <section className="vs-panel-placeholder"><Icon name="think" size={26} /><div><h2>From instruction to plan</h2><p>Engine panel is waiting for integration. Inspect individual tools below.</p></div></section>}</div>
      <ToolRegistry tools={tools} snapshot={snapshot} desktop={desktop} onRefresh={refresh} engineMounted={!!enginePanel} />
      <footer className="vs-footer"><Icon name="shield" size={15} />Explicit requests. Visible results. You stay in control.</footer>
    </main>
    <aside className="vs-activity" aria-labelledby="vs-activity-title"><div className="vs-activity-heading"><h2 id="vs-activity-title"><Icon name="history" />Activity</h2><button className="vs-text-button" disabled={!desktop || loading} onClick={() => void refresh().catch(reason => setError(String(reason)))}>Refresh</button></div><p className="vs-caption">Local SQLite history. Intent text is stored; tool payloads are excluded except notes you explicitly save here.</p>
      {loading ? <p className="vs-empty" role="status">Connecting to local history…</p> : entries.length ? <ol className="vs-feed">{entries.map(entry => <li key={entry.id}><div className="vs-feed-heading"><strong>{entry.tool.replace(/_/g, ' ')}</strong><time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p>{entry.intent}</p><span className={`vs-badge ${entry.status === 'denied' ? 'vs-tone-red' : ''}`}>{entry.status.replace(/_/g, ' ')}</span></li>)}</ol> : <div className="vs-empty"><Icon name="history" size={30} /><h3>{desktop ? 'A clean slate.' : 'History lives on your PC.'}</h3><p>{desktop ? 'Your tool requests and saved notes will appear here.' : 'Open the desktop app to read your local activity.'}</p></div>}
      <details className="vs-history-settings"><summary>History & storage</summary><p className="vs-caption">Clearing history permanently removes all activity and notes saved to this history. Resolve any pending approval first.</p><button className="vs-secondary" disabled={!desktop || !entries.length || !!snapshot?.pending_approval || clearing} onClick={() => void clearHistory()}>{clearing ? 'Clearing…' : 'Clear local history'}</button></details>
      <div className="vs-storage"><span className={`vs-connection-dot ${snapshot ? 'is-connected' : ''}`} />{snapshot ? 'Connected to desktop core' : 'Desktop core disconnected'}</div>
    </aside></div>
  </div>;
}

