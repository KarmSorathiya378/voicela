/** Native adapters must validate these opaque tokens in the same operation as mutation. */
export interface TextSnapshot {
  token: string;
  text: string;
  password: boolean;
  editable: boolean;
  formatting: 'plain' | 'preserved';
}
export interface TextReceipt { token: string; insertedText: string }
export interface TextAdapter {
  capture(): Promise<TextSnapshot>;
  /** Must reject password, stale selection/caret/document, changed focus and duplicate tokens.
   * Must preserve clipboard in every format, or use UIA without touching it.
   * On partial input failure throw; never issue an unguarded Ctrl+Z. */
  replace(snapshot: TextSnapshot, text: string): Promise<TextReceipt>;
  /** Native token verifies document, range and inserted content before restoring original. */
  undo(receipt: TextReceipt): Promise<void>;
}
export class InsertionSession {
  private receipt: TextReceipt | undefined;
  private busy = false;
  recoveryText = '';
  private adapter: TextAdapter;
  constructor(adapter: TextAdapter) { this.adapter = adapter; }
  get canUndo() { return !!this.receipt && !this.busy; }
  async insert(snapshot: TextSnapshot, text: string) {
    if (this.busy) throw new Error('A text operation is already running.');
    this.recoveryText = text;
    if (snapshot.password || !snapshot.editable) throw new Error('This field is protected or cannot be edited.');
    if (!text.trim()) throw new Error('There is no text to insert.');
    this.busy = true;
    try { this.receipt = await this.adapter.replace(snapshot, text); this.recoveryText = ''; }
    finally { this.busy = false; }
  }
  async undo() {
    if (!this.receipt || this.busy) throw new Error('No safe undo is available.');
    this.busy = true;
    try { await this.adapter.undo(this.receipt); this.receipt = undefined; }
    finally { this.busy = false; }
  }
}

