import type { ToolInput } from "../../api";

export type IntentRoute = "dictation" | "editing" | "question" | "action";

/** Local speech-act classification uses outer request framing, not payload keywords. */
export function normalizeRequest(raw: string): string {
  return raw.trim().replace(/^(?:(?:can|could|would|will) you\s+|please\s+|(?:I (?:want|need|would like)|I'd like) (?:you )?to\s+)+/i, "")
    .replace(/^where (?:is|are|can I find) (?:my |the file )([\s\S]+?)[.!?]?$/i, "find $1")
    .replace(/^(?:look up|look on the web for|look online for|google)\s+/i, "search the web for ")
    .replace(/^(?:help me )?(?:get|bring) (.+?) (?:running|up)[.!?]?$/i, "open $1")
    .replace(/^jot down (?:a )?note\s*/i, "create note ")
    .replace(/^(?:compose|write)(?: a)? message\b/i, "draft message");
}

export function classifyIntent(raw: string): IntentRoute {
  const text = normalizeRequest(raw);
  if (/^(?:dictate|take dictation|type|write text)\b/i.test(text)) return "dictation";
  if (/^(?:select all|copy|paste|undo|redo|save|replace|rewrite|rephrase|correct|make (?:this|that|it)|change (?:this|that|it))\b/i.test(text)) return "editing";
  // Information requests do not silently become browser searches or app commands.
  if (/^(?:who|what|where|why|when|how|is|are|does|do|can|could|would|should|tell me|explain)\b/i.test(text)) return "question";
  if (/^(?:I|we|they|he|she|it|the|this|our)\s/i.test(text)) return "dictation";
  return "action";
}

export function missingDetails(text: string): string | null {
  if (/^(?:find|locate)(?:\s+(?:my|the|a))?(?:\s+file)?[.!?]?$/i.test(text)) return "Which filename or search terms should I look for?";
  if (/^(?:open|launch)(?:\s+(?:the|my|an|a))?(?:\s+(?:app|application))?[.!?]?$/i.test(text)) return "Which installed app should I open?";
  if (/^draft\b/i.test(text)) return "Who is the recipient, and what exact message should I draft? Reply with: Draft message to NAME saying TEXT.";
  if (/^(?:create|make)\b.*\bnote\b/i.test(text)) return "What title and exact text should the note have? Reply with: Create note TITLE: TEXT.";
  if (/^(?:prepare|create|schedule)(?:\s+a)?\s+(?:calendar\s+)?event\b/i.test(text)) return "What event title, start, end, and time zone should I use? Please give ISO timestamps with time zones.";
  if (/^(?:type|write text|dictate|take dictation)[.!?]?$/i.test(text)) return "What exact text should I type?";
  if (/^(?:search|search the web|search the web for)[.!?]?$/i.test(text)) return "What should I search the web for?";
  return null;
}

const fields: Record<ToolInput["tool"], string[]> = {
  open_app: ["app"], find_file: ["query"], create_note: ["title", "body"],
  draft_message: ["recipient", "body"], browser_search: ["query"],
  calendar_event: ["title", "start", "end"], control_app: ["action", "target", "window"],
};

export function validateRequest(request: ToolInput): string | null {
  const expected = fields[request.tool];
  if (!expected || Object.keys(request.input).length !== expected.length) return "Unsupported tool input.";
  for (const key of expected) {
    const value = (request.input as Record<string, string>)[key];
    if (typeof value !== "string" || !value.trim() || new TextEncoder().encode(value).length > 16384 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return "Please provide complete, valid text for each tool field.";
    if (!["body", "target"].includes(key) && /^(?:it|that|them|the result|those|the other file|someone|something)$/i.test(value.replace(/[.!?]+$/, ""))) return "Which exact app, filename, recipient or title do you mean?";
  }
  if (request.tool === "control_app" && (!['inspect', 'click', 'type', 'key', 'scroll'].includes(request.input.action) || request.input.window !== "foreground")) return "Unsupported app control.";
  if (request.tool === "calendar_event") {
    const { start, end } = request.input;
    if (![start, end].every(validTimestamp) || Date.parse(end) <= Date.parse(start)) return "What valid ISO start and end timestamps, including time zones, should I use? The end must follow the start.";
  }
  return null;
}

function validTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const day = value.slice(0, 10);
  return new Date(`${day}T00:00:00Z`).toISOString().startsWith(day) && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60;
}

export interface IntentContext { requests: ToolInput[]; now?: Date }

/** Results are deliberately absent: native result prose cannot supply instructions or identifiers. */
export function resolveFollowUp(text: string, context?: IntentContext): ToolInput | string | null {
  if (/^(?:use|find|open) the other file[.!?]?$/i.test(text)) {
    const files = context?.requests.filter(request => request.tool === "find_file") ?? [];
    const queries = [...new Set(files.map(request => request.input.query))];
    if (queries.length !== 2) return "Which other file do you mean? Please give its filename or search terms.";
    if (/^open /i.test(text)) return "I can search for that file. Opening files is not supported; should I search for its exact filename?";
    return { tool: "find_file", input: { query: queries.find(query => query !== files[files.length - 1].input.query)! } };
  }
  if (/^(?:change|move|reschedule) (?:that|it) to tomorrow[.!?]?$/i.test(text)) {
    const events = context?.requests.filter(request => request.tool === "calendar_event") ?? [];
    if (events.length !== 1) return "Which event do you mean? Give its title, start, end and time zone.";
    const input = events[0].input;
    if (validateRequest(events[0])) return "Please provide valid event timestamps first.";
    // Tomorrow is relative to now in the explicitly supplied event offset, never a guessed zone.
    const zone = input.start.match(/(?:Z|[+-]\d{2}:\d{2})$/)![0];
    const offset = zone === "Z" ? 0 : (zone[0] === "-" ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4))) * 60000;
    const now = new Date((context?.now ?? new Date()).getTime() + offset);
    const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const delta = tomorrow - Date.parse(`${input.start.slice(0, 10)}T00:00:00Z`);
    const shift = (value: string) => new Date(Date.parse(`${value.slice(0, 10)}T00:00:00Z`) + delta).toISOString().slice(0, 10) + value.slice(10);
    return { tool: "calendar_event", input: { ...input, start: shift(input.start), end: shift(input.end) } };
  }
  return null;
}
