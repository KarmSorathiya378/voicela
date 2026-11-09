import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { api, sampleRequests, type ActivityEntry, type RunResponse, type StateSnapshot, type ToolDescriptor } from "./api";
import "./App.css";

const desktop = isTauri();
const label = (value: string) => value.replace(/[_-]/g, " ");

export default function App() {
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null);
  const [tools, setTools] = useState<ToolDescriptor[]>([]);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");

  const refresh = useCallback(async () => {
    const [state, available, log] = await Promise.all([api.getState(), api.getTools(), api.getActivityLog()]);
    setSnapshot(state); setTools(available); setEntries(log);
  }, []);

  useEffect(() => {
    if (desktop) void refresh().catch((reason: unknown) => setError(String(reason)));
  }, [refresh]);

  async function act(action: () => Promise<RunResponse | void>) {
    setBusy(true); setError(null);
    try {
      const response = await action();
      if (response?.status === "simulated") setResult(response.output.message);
      else if (response?.status === "denied") setResult(response.message);
      else if (response?.status === "awaiting_approval") setResult(null);
      await refresh();
    } catch (reason) {
      setError(String(reason));
      await refresh().catch(() => undefined);
    } finally { setBusy(false); }
  }

  const pending = snapshot?.pending_approval;
  return <main>
    <header>
      <div><h1>Voicela <span>Desktop foundation</span></h1><p>Voice to action, with you in control.</p></div>
      <span className="state" role="status">{snapshot ? label(snapshot.state) : desktop ? "Connecting" : "Desktop unavailable"}</span>
    </header>

    {!desktop && <p className="notice">Browser preview only. Open the Tauri app to connect to Rust and SQLite.</p>}
    {error && <div className="error" role="alert"><p>{error}</p><button disabled={busy || !desktop} onClick={() => void act(async () => {})}>Retry connection</button></div>}

    <section aria-labelledby="voice-title" className="voice">
      <div><h2 id="voice-title">Your next instruction</h2><p>Microphone capture and transcription are not connected yet.</p></div>
      <button disabled className="talk">Push to talk · coming later</button>
      <label htmlFor="transcript">Transcript placeholder</label>
      <input id="transcript" value={transcript} onChange={event => setTranscript(event.target.value)} placeholder="Type a scratch transcript…" />
      <p className="hint">Scratch text stays in this window. Tool samples below use fixed test inputs.</p>
    </section>

    {pending && <section className="approval" aria-labelledby="approval-title">
      <h2 id="approval-title">Review simulated action</h2><p>{pending.intent}</p>
      <pre>{JSON.stringify(pending.request, null, 2)}</pre>
      <p>Approval applies to this request once. This adapter is simulated.</p>
      <div className="actions"><button disabled={busy} onClick={() => void act(() => api.approveTool(pending.id, true))}>Approve simulation</button>
        <button className="secondary" disabled={busy} onClick={() => void act(() => api.approveTool(pending.id, false))}>Decline</button></div>
    </section>}
    {result && <p className="notice" role="status">{result}</p>}

    <section aria-labelledby="tools-title">
      <div className="section-title"><h2 id="tools-title">Available tools</h2><span>All adapters simulated</span></div>
      <p>Inspect the fixed input, then test the permission and activity flow.</p>
      <ul className="tools">{tools.map(tool => <li key={tool.name}>
        <div className="tool-title"><h3>{label(tool.name)}</h3><span className="badge">{tool.permission.requires_approval ? "Approval required" : "No approval required"}</span></div>
        <p>{tool.description}</p>
        <details><summary>Sample input</summary><pre>{JSON.stringify(sampleRequests[tool.name].input, null, 2)}</pre></details>
        <button className="secondary" disabled={busy || !!pending || !tool.permission.enabled || !snapshot} onClick={() => void act(() => api.runTool(sampleRequests[tool.name], `Foundation sample: ${label(tool.name)}`))}>Run simulated sample</button>
      </li>)}</ul>
      {tools.length === 0 && <p className="empty">{desktop ? "Tools will appear when the desktop core connects." : "Tool inventory requires the desktop app."}</p>}
    </section>

    <section aria-labelledby="activity-title">
      <div className="section-title"><h2 id="activity-title">Activity</h2><div className="actions">
        <button className="secondary" disabled={busy || !desktop} onClick={() => void act(async () => {})}>Refresh</button>
        <button className="secondary" disabled={busy || !entries.length || !!pending} onClick={() => void act(api.clearActivityLog)}>Clear local history</button>
      </div></div>
      <p>Local SQLite history. Tool payloads are excluded; intent text is stored until cleared.</p>
      {entries.length ? <ol className="feed">{entries.map(entry => <li key={entry.id}>
        <div><strong>{label(entry.tool)}</strong><span className="badge">{label(entry.status)}</span></div>
        <p>{entry.intent}</p><time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString()}</time>
      </li>)}</ol> : <p className="empty">No activity loaded. Run a simulated sample in the desktop app to begin.</p>}
    </section>
    <footer>Phase 1 · OS integrations, speech recognition and global shortcuts are not implemented.</footer>
  </main>;
}
