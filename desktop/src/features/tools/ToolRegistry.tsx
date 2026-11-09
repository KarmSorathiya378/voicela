import { useState } from 'react';
import { api, sampleRequests, type StateSnapshot, type ToolDescriptor, type ToolInput, type ToolName } from '../../api';
import { findFiles, runPlatformTool, saveNoteToHistory } from './adapters';
import { Icon } from '../../ui/Icon';

const names: Record<ToolName, string> = { open_app: 'Open app', find_file: 'Find file', create_note: 'Create note', calendar_event: 'Calendar event', draft_message: 'Draft message', browser_search: 'Browser search' };
const descriptions: Record<ToolName, string> = { open_app: 'Known application launch · Rust simulation', find_file: 'Search a sample index · no disk access', create_note: 'Save a note to local SQLite history', calendar_event: 'Preview a calendar request · no event created', draft_message: 'Preview a message draft · nothing sent', browser_search: 'Search request · Rust simulation, no browser opened' };
const order = Object.keys(names) as ToolName[];
export interface ToolRegistryProps { tools: ToolDescriptor[]; snapshot: StateSnapshot | null; desktop: boolean; onRefresh: () => Promise<void>; engineMounted?: boolean }

export function ToolRegistry({ tools, snapshot, desktop, onRefresh, engineMounted }: ToolRegistryProps) {
  const [selected, setSelected] = useState<ToolName>('open_app');
  const [inputs, setInputs] = useState<Record<ToolName, Record<string, string>>>(() => ({
    open_app: { ...sampleRequests.open_app.input }, find_file: { ...sampleRequests.find_file.input },
    create_note: { ...sampleRequests.create_note.input }, calendar_event: { ...sampleRequests.calendar_event.input },
    draft_message: { ...sampleRequests.draft_message.input }, browser_search: { ...sampleRequests.browser_search.input },
  }));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tool: ToolName; input: unknown; output: unknown } | null>(null);
  const [error, setError] = useState('');
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const descriptor = tools.find(tool => tool.name === selected);
  const pending = snapshot?.pending_approval;
  const localSearch = selected === 'find_file';
  const localNote = selected === 'create_note';
  const fields = inputs[selected];

  async function perform(action: () => Promise<unknown>, tool: ToolName, input: unknown) {
    setBusy(true); setError('');
    try {
      const output = await action();
      if (output && typeof output === 'object' && 'status' in output && output.status === 'awaiting_approval' && 'approval' in output) {
        setApprovalId((output.approval as { id: string }).id);
      }
      setResult({ tool, input, output });
    }
    catch (reason) { setError(String(reason)); setResult({ tool, input, output: { status: 'error', message: String(reason), executed: false } }); }
    finally { await onRefresh().catch(() => undefined); setBusy(false); }
  }

  return <section className="vs-tools" aria-labelledby="vs-tools-heading">
    <div className="vs-section-heading"><div><h2 id="vs-tools-heading">Tools, with boundaries.</h2><p>Inspect a request before you run it.</p></div><Icon name="tools" size={24} /></div>
    <div className="vs-tool-layout">
      <nav className="vs-tool-list" aria-label="Allowlisted tools">{order.map(name => {
        const tool = tools.find(item => item.name === name);
        return <button key={name} type="button" className={selected === name ? 'vs-tool-option is-selected' : 'vs-tool-option'} aria-pressed={selected === name} onClick={() => setSelected(name)}>
          <span className="vs-tool-name">{names[name]}{selected === name && <Icon name="arrow" size={16} />}</span>
          <span className="vs-tool-meta">{name === 'find_file' ? 'Sample index' : name === 'create_note' ? 'SQLite note' : 'Simulated'} · {tool ? tool.permission.enabled ? 'Enabled' : 'Disabled' : 'Core offline'}</span>
        </button>;
      })}</nav>
      <div className="vs-tool-detail">
        <div className="vs-detail-title"><h3>{names[selected]}</h3><span className="vs-badge">{localSearch ? 'Simulated files' : localNote ? 'Real local storage' : 'Simulated action'}</span></div>
        <p>{descriptions[selected]}</p>
        <span className="vs-permission"><Icon name="shield" size={15} />{localSearch ? 'No file permission needed' : localNote ? 'Save button authorizes this local write' : descriptor ? descriptor.permission.requires_approval ? 'Rust approval required for every request' : 'No approval required' : 'Permission policy available in desktop app'}</span>
        <form onSubmit={event => { event.preventDefault(); const request = { tool: selected, input: fields } as ToolInput; void perform(async () => localSearch ? { status: 'simulated', executed: false, results: findFiles(fields.query), message: 'Sample index only. No disk search was performed.' } : localNote ? saveNoteToHistory(fields.title, fields.body) : runPlatformTool(request), selected, request.input); }}>
          {Object.entries(fields).map(([key, value]) => <label key={`${selected}-${key}`} htmlFor={`vs-tool-${key}`}><span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>{key === 'body' ? <textarea id={`vs-tool-${key}`} rows={4} required maxLength={1500} value={value} onChange={event => setInputs(previous => ({ ...previous, [selected]: { ...previous[selected], [key]: event.target.value } }))} /> : key === 'app' ? <select id="vs-tool-app" value={value} onChange={event => setInputs(previous => ({ ...previous, open_app: { app: event.target.value } }))}><option>Notepad</option><option>Calculator</option><option>Paint</option></select> : <input id={`vs-tool-${key}`} required maxLength={1500} value={value} onChange={event => setInputs(previous => ({ ...previous, [selected]: { ...previous[selected], [key]: event.target.value } }))} />}</label>)}
          {localNote && <p className="vs-caption">Title and text are stored in activity.sqlite3 as a client note. Clearing history deletes them. This does not create a separate file.</p>}
          <button className="vs-primary" disabled={busy || (!localSearch && (!desktop || !snapshot || !!pending || !descriptor?.permission.enabled))} type="submit">{busy ? 'Working…' : localSearch ? 'Search sample files' : localNote ? 'Save note to SQLite' : 'Request simulation'}<Icon name="arrow" size={16} /></button>
        </form>
      </div>
    </div>
    {pending && (!engineMounted || pending.id === approvalId) && <section className="vs-approval" aria-labelledby="vs-approval-title"><h3 id="vs-approval-title"><Icon name="shield" /> Review pending request</h3><p>{pending.intent}</p><pre>{JSON.stringify(pending.request, null, 2)}</pre><p>One-time approval. This foundation adapter is simulated; no OS or service action will occur.</p><div className="vs-actions"><button className="vs-primary" disabled={busy} onClick={() => void perform(() => api.approveTool(pending.id, true), pending.request.tool, pending.request.input)}>Approve simulation</button><button className="vs-secondary" disabled={busy} onClick={() => void perform(() => api.approveTool(pending.id, false), pending.request.tool, pending.request.input)}>Decline</button></div></section>}
    {pending && engineMounted && pending.id !== approvalId && <p className="vs-notice">An engine request is awaiting approval. Review it in the action plan above.</p>}
    {error && <p className="vs-error" role="alert">{error}</p>}
    {result && <section className="vs-tool-result" aria-label="Latest tool input and output"><h3>{names[result.tool]} · latest result</h3><div className="vs-result-columns"><div><h4>Input</h4><pre>{JSON.stringify(result.input, null, 2)}</pre></div><div><h4>Output</h4><pre role="status">{JSON.stringify(result.output, null, 2)}</pre></div></div></section>}
  </section>;
}
