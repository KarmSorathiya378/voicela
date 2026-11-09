import { files, mail, calendar, chart, cleanNote } from './seeds';

export type Scenario = 'A' | 'B' | 'C' | 'D' | 'E';
export type Phase = 'idle' | 'listening' | 'thinking' | 'acting' | 'awaiting-approval' | 'completed' | 'error';
export type Entry = { kind: 'Plan' | 'Action' | 'Result'; text: string };
export type State = { scenario: Scenario; phase: Phase; prompt: string; log: Entry[]; message: string; fileId?: string; preview: boolean; approved: boolean; applied: boolean; failure: boolean; context: 'chart' | 'text' };
export const scenarios: { id: Scenario; name: string; app: string; prompt: string; description: string }[] = [
  { id: 'A', name: 'Find my document', app: 'Files', prompt: 'Find my October invoice', description: 'Search a small file index and open a preview.' },
  { id: 'B', name: 'Draft and send', app: 'Mail', prompt: 'Reply to Maya and confirm Thursday', description: 'Review every word before a simulated send.' },
  { id: 'C', name: 'Schedule a meeting', app: 'Calendar', prompt: 'Meet Maya on Thursday at 2 pm', description: 'Resolve a conflict before adding an event.' },
  { id: 'D', name: 'Screen context', app: 'Browser', prompt: 'Explain the selected context', description: 'See exactly what the assistant can read.' },
  { id: 'E', name: 'Dictation & edit', app: 'Notes', prompt: 'Remove filler words from this note', description: 'Compare a rewrite, apply it, or undo.' },
];
export function initial(scenario: Scenario = 'A'): State { return { scenario, phase: 'idle', prompt: scenarios.find(s => s.id === scenario)!.prompt, log: [], message: 'Ready when you are. This workspace is simulated.', preview: false, approved: false, applied: false, failure: false, context: 'chart' }; }
export type Action = { type: 'RESET'; scenario?: Scenario } | { type: 'PROMPT'; value: string } | { type: 'CONTEXT'; value: 'chart' | 'text' } | { type: 'FAILURE'; value: boolean } | { type: 'START' | 'THINK' | 'ACT' | 'RESOLVE' | 'APPROVE' | 'FINISH' | 'CANCEL' | 'PREVIEW' | 'UNDO' };
const add = (s: State, phase: Phase, kind: Entry['kind'], text: string): State => ({ ...s, phase, message: text, log: [...s.log, { kind, text }] });
export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'RESET': return initial(a.scenario ?? s.scenario);
    case 'PROMPT': return s.phase === 'idle' ? { ...s, prompt: a.value } : s;
    case 'CONTEXT': return s.phase === 'idle' ? { ...s, context: a.value } : s;
    case 'FAILURE': return s.phase === 'idle' ? { ...s, failure: a.value } : s;
    case 'START': return s.phase === 'idle' && s.prompt.trim() ? add(s, 'listening', 'Plan', `Read typed or transcribed intent: “${s.prompt.trim()}”`) : s;
    case 'THINK': return s.phase === 'listening' ? add(s, 'thinking', 'Plan', `Use only the seeded ${scenarios.find(x => x.id === s.scenario)!.app} window. ${s.scenario === 'B' || s.scenario === 'C' ? 'Pause for explicit approval before changing anything.' : 'No external action is needed.'}`) : s;
    case 'ACT': return s.phase === 'thinking' ? add(s, 'acting', 'Action', s.scenario === 'A' ? 'Searching the simulated file index…' : s.scenario === 'B' ? 'Reading Maya’s seeded message and preparing a reply…' : s.scenario === 'C' ? `Checking ${calendar.date}: ${calendar.blocked} overlaps ${calendar.conflict}. Propose ${calendar.available}.` : s.scenario === 'D' ? `Reading only the highlighted ${s.context === 'chart' ? 'completed projects chart' : 'launch paragraph'}…` : 'Preparing a filler-free rewrite of the selected note…') : s;
    case 'RESOLVE': {
      if (s.phase !== 'acting' || s.approved) return s;
      if (s.failure) return add(s, 'error', 'Result', 'Simulated app unavailable. Nothing changed. Reset to retry without the failure toggle.');
      if (s.scenario === 'A') {
        const query = s.prompt.toLowerCase();
        if (/private|restricted|payroll/.test(query)) return add(s, 'error', 'Result', 'Access denied: the private folder is outside this demo’s allowed scope. Try the October invoice.');
        const match = files.find(f => f.keywords.some(k => query.includes(k)));
        return match ? { ...add(s, 'completed', 'Result', `Found ${match.name} in ${match.folder}. Open its simulated preview below.`), fileId: match.id } : add(s, 'error', 'Result', 'No matching document. Try “invoice”, “website brief”, or “research notes”.');
      }
      if (s.scenario === 'B') return add(s, 'awaiting-approval', 'Result', `Draft ready for ${mail.address}. Review the composer, then explicitly approve the simulated send.`);
      if (s.scenario === 'C') return add(s, 'awaiting-approval', 'Result', `Conflict found at ${calendar.blocked}. ${calendar.available} is free. Approve this alternative to insert one simulated event.`);
      if (s.scenario === 'D') { const growth = ((chart[3].value - chart[2].value) / chart[2].value * 100).toFixed(1); return add(s, 'completed', 'Result', s.context === 'chart' ? `October has ${chart[3].value} completed projects, up ${growth}% from September’s ${chart[2].value}. August dipped; October improved. Source: only the four highlighted chart values. This does not establish why completions changed.` : 'The launch depends on onboarding review and a release checklist. Maya owns onboarding; Arjun owns the checklist. Suggested next step: ask both owners for readiness. Source: only the highlighted launch paragraph.'); }
      return add(s, 'awaiting-approval', 'Result', `Rewrite ready: “${cleanNote}” Review the diff before applying it to the simulated note.`);
    }
    case 'APPROVE': return s.phase === 'awaiting-approval' ? { ...add(s, 'acting', 'Action', 'Explicit approval received. Applying the reviewed simulated action…'), approved: true } : s;
    case 'FINISH': return s.phase === 'acting' && s.approved ? { ...add(s, 'completed', 'Result', s.scenario === 'B' ? 'Simulated send complete. No email was sent to an external account.' : s.scenario === 'C' ? `Simulated event inserted: ${calendar.title}, ${calendar.available} (${calendar.zone}).` : 'Rewrite applied to the simulated note. Undo is available.'), applied: true } : s;
    case 'CANCEL': return ['listening', 'thinking', 'acting', 'awaiting-approval'].includes(s.phase) ? { ...add(s, 'idle', 'Result', 'Cancelled. No pending action will run. You can start again.'), approved: false, applied: false } : s;
    case 'PREVIEW': return s.fileId && s.phase === 'completed' ? { ...s, preview: !s.preview } : s;
    case 'UNDO': return s.scenario === 'E' && s.applied ? { ...add(s, 'completed', 'Result', 'Undo complete. The original simulated note is restored.'), applied: false } : s;
  }
}
