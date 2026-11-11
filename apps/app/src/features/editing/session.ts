import type { TextAdapter, TextSnapshot } from '../dictation/adapter.ts';
import { InsertionSession } from '../dictation/adapter.ts';
export type EditInstruction = { kind: 'shorten' | 'grammar' | 'professional' } | { kind: 'translate'; language: string };
export type EditProvider = (text: string, instruction: EditInstruction) => Promise<string>;
export interface Proposal { original: TextSnapshot; replacement: string; instruction: EditInstruction }
export class EditingSession {
  proposal: Proposal | undefined;
  private revision = 0;
  private applying = false;
  readonly insertion: InsertionSession;
  private adapter: TextAdapter;
  private provider: EditProvider;
  constructor(adapter: TextAdapter, provider: EditProvider) { this.adapter = adapter; this.provider = provider; this.insertion = new InsertionSession(adapter); }
  cancel() { this.revision++; this.proposal = undefined; }
  async propose(instruction: EditInstruction) {
    if (this.applying) throw new Error('Wait for the current edit to finish.');
    const revision = ++this.revision;
    this.proposal = undefined;
    const original = await this.adapter.capture();
    if (original.password || !original.editable || !original.text.trim()) throw new Error('Select editable, non-protected text first.');
    const replacement = await this.provider(original.text, instruction);
    if (revision !== this.revision) return;
    if (!replacement.trim()) throw new Error('The editing provider returned no text. Retry.');
    this.proposal = { original, replacement, instruction };
  }
  async retry() {
    const instruction = this.proposal?.instruction;
    if (!instruction) throw new Error('Create a proposal first.');
    await this.propose(instruction);
  }
  async apply() {
    if (this.applying || !this.proposal) throw new Error('Review a proposal before applying.');
    const proposal = this.proposal;
    this.applying = true;
    try {
      // Atomic native validation uses the original token; a fresh capture must never replace it.
      await this.insertion.insert(proposal.original, proposal.replacement);
      this.cancel();
    } finally { this.applying = false; }
  }
}
/** Common prefix/suffix diff is bounded even for large documents. */
export function textDiff(before: string, after: string) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (end < before.length - start && end < after.length - start && before[before.length - end - 1] === after[after.length - end - 1]) end++;
  return { prefix: before.slice(0, start), removed: before.slice(start, before.length - end), added: after.slice(start, after.length - end), suffix: end ? before.slice(-end) : '' };
}

