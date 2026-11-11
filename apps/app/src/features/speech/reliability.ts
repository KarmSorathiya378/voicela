/** Sequence numbers identify deliveries, never text: repeated phrases are legitimate turns. */
export function classifyTurn(last: number, next: number): "accept" | "duplicate" | "gap" {
  if (!Number.isSafeInteger(next) || next < 1) return "gap";
  if (next <= last) return "duplicate";
  return next === last + 1 ? "accept" : "gap";
}
/** Preserve punctuation and paragraph boundaries; only normalize capture whitespace. */
export function cleanTranscript(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").trim();
}
