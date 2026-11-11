export type RunStatus = 'running' | 'verified' | 'acknowledged' | 'partial' | 'cancelled' | 'uncertain';
export interface Step {
  name: string;
  run(signal: AbortSignal): Promise<string>;
  verify(receipt: string): Promise<boolean>;
  evidence?: 'acknowledged' | 'verified';
}
export interface RunRecord {
  status: RunStatus; completed: string[]; detail: string;
  receipts?: Record<string, string>; current?: string; acknowledged?: boolean;
}
export interface Routine { id: string; name: string; command: string }
export const schedulingEnabled = false; // Gmail send-only cannot verify delivery or safely replay writes.
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export class WorkflowRunner {
  private active = new Map<string, AbortController>();
  private store: Store;
  constructor(store: Store) { this.store = store; }
  save(routine: Routine) { this.store.setItem(`routine:${routine.id}`, JSON.stringify(routine)); }
  inspect(key: string): RunRecord | null {
    const raw = this.store.getItem(`workflow:${key}`);
    if (!raw) return null;
    let record: RunRecord;
    try {
      record = JSON.parse(raw) as RunRecord;
      if (!record || !Array.isArray(record.completed) || typeof record.status !== 'string') throw new Error('Invalid journal');
    } catch { return { status: 'uncertain', completed: [], detail: 'Stored execution history is unreadable. Replay remains blocked; inspect Google Sent/Calendar.' }; }
    if (record.status === 'running' && !this.active.has(key)) return { ...record, status: record.completed.length ? 'partial' : 'uncertain', detail: `Interrupted during ${record.current || 'execution'}. Inspect Google Sent/Calendar. Completed steps will not replay.` };
    return record;
  }
  cancel(key: string) { this.active.get(key)?.abort(); }
  cancelAll() { for (const controller of this.active.values()) controller.abort(); }
  async run(key: string, steps: Step[], onProgress: (record: RunRecord) => void = () => {}, timeoutMs = 30000): Promise<RunRecord> {
    if (!steps.length || new Set(steps.map(s => s.name)).size !== steps.length) throw new Error('Supply uniquely named steps.');
    const storageKey = `workflow:${key}`;
    if (this.store.getItem(storageKey)) throw new Error('Execution already recorded. Inspect its result; remote writes cannot be replayed.');
    const controller = new AbortController();
    const record: RunRecord = { status: 'running', completed: [], detail: '', receipts: {} };
    const persist = () => { this.store.setItem(storageKey, JSON.stringify(record)); };
    const notify = () => { try { onProgress({ ...record, completed: [...record.completed], receipts: { ...record.receipts } }); } catch { /* UI cannot change execution semantics. */ } };
    persist(); this.active.set(key, controller);
    let abortListener: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      abortListener = () => reject(new Error('Cancelled or timed out. An in-flight action may have completed; inspect Google Sent/Calendar before recovery.'));
      controller.signal.addEventListener('abort', abortListener, { once: true });
    });
    void aborted.catch(() => {}); // Cancellation before the first step still has a rejection handler.
    const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
    notify();
    try {
      for (const step of steps) {
        if (controller.signal.aborted) { record.status = record.completed.length ? 'partial' : 'cancelled'; break; }
        record.current = step.name; record.detail = step.name; persist(); notify();
        if (controller.signal.aborted) { record.status = record.completed.length ? 'partial' : 'cancelled'; record.detail = 'Stopped before the next action. No further steps started.'; break; }
        // Persist intent before invoking. A write is never retried, even after timeout/restart.
        const receipt = await Promise.race([step.run(controller.signal), aborted]);
        record.receipts![step.name] = receipt; persist();
        // Only verification (a read) can retry. A failed verification never re-executes a step.
        let verified = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (controller.signal.aborted) throw new Error('Stopped during verification; reconcile the stored receipt.');
          try { verified = await Promise.race([step.verify(receipt), aborted]); } catch (error) { if (attempt === 2 || controller.signal.aborted) throw error; }
          if (verified) break;
        }
        if (!verified) throw new Error('Provider result could not be verified. Inspect the stored receipt; do not replay.');
        record.acknowledged ||= step.evidence === 'acknowledged';
        record.completed.push(step.name); delete record.current; persist(); notify();
      }
      if (record.status === 'running') { record.status = record.acknowledged ? 'acknowledged' : 'verified'; record.detail = record.acknowledged ? 'Google accepted the message. Delivery is not verified.' : 'All results verified.'; }
    } catch (error) {
      record.status = record.completed.length ? 'partial' : 'uncertain';
      record.detail = error instanceof Error ? error.message : 'Unknown result; reconcile before recovery.';
    } finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', abortListener); this.active.delete(key); persist(); notify();
    }
    return record;
  }
}
