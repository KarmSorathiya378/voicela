export type RunStatus = 'running' | 'verified' | 'partial' | 'cancelled' | 'uncertain';
export interface Step { name: string; run(signal: AbortSignal): Promise<string>; verify(receipt: string): Promise<boolean> }
export interface RunRecord { status: RunStatus; completed: string[]; detail: string }
export interface Routine { id: string; name: string; command: string }
export class WorkflowRunner {
  private active = new Map<string, AbortController>();
  private store: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(store: Pick<Storage, 'getItem' | 'setItem'>) { this.store = store; }
  save(routine: Routine) { this.store.setItem(`routine:${routine.id}`, JSON.stringify(routine)); }
  cancel(key: string) { this.active.get(key)?.abort(); }
  async run(key: string, steps: Step[], onProgress: (record: RunRecord) => void = () => {}, timeoutMs = 30000): Promise<RunRecord> {
    const storageKey = `workflow:${key}`;
    if (this.store.getItem(storageKey)) throw new Error('Execution already recorded. Inspect its result before creating a new execution.');
    const controller = new AbortController();
    const record: RunRecord = { status: 'running', completed: [], detail: '' };
    const persist = () => { this.store.setItem(storageKey, JSON.stringify(record)); onProgress({ ...record, completed: [...record.completed] }); };
    persist(); this.active.set(key, controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      for (const step of steps) {
        if (controller.signal.aborted) { record.status = 'cancelled'; break; }
        record.detail = step.name; persist();
        // A timeout does not prove a remote write failed. Never automatically replay it.
        const receipt = await Promise.race([step.run(controller.signal), new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Cancelled or timed out; reconcile provider results before retry.')), { once: true }))]);
        if (!await step.verify(receipt)) throw new Error('Provider result could not be verified. Reconcile before retry.');
        record.completed.push(step.name); persist();
      }
      if (record.status === 'running') record.status = 'verified';
    } catch (error) { record.status = record.completed.length ? 'partial' : 'uncertain'; record.detail = error instanceof Error ? error.message : 'Unknown result; reconcile before retry.'; }
    finally { clearTimeout(timer); this.active.delete(key); persist(); }
    return record;
  }
}

