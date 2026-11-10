import type { ToolInput } from "../../api";

export interface IntentAction { instruction: string; request: ToolInput }
export type ParsedIntent =
  | { supported: true; transcript: string; actions: IntentAction[] }
  | { supported: false; message: string };

export const supportedInstructions = "I can save a local note or simulate finding files, opening an app, preparing a calendar event, drafting a message, or searching the web.";
export const intentExamples = [
  "Find my invoice",
  "Open Notepad",
  "Create a note titled Shopping saying buy milk",
  "Draft message to Maya saying I will be there at five",
  "Search the web for train times",
  "Prepare calendar event Review from 2026-11-11T10:00:00+05:30 to 2026-11-11T10:30:00+05:30",
];

const unsupported = (message: string): ParsedIntent => ({ supported: false, message });
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/;
function validDate(value: string): boolean {
  if (!timestamp.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const day = value.slice(0, 10);
  return new Date(`${day}T00:00:00Z`).toISOString().startsWith(day);
}

/** Entire sequences are validated before any action is offered to the executor. */
export function parseIntent(raw: string): ParsedIntent {
  const transcript = raw.trim();
  if (!transcript) return unsupported("Enter an instruction first.");
  if (new TextEncoder().encode(transcript).length > 2048) return unsupported("Keep your instruction within 2,048 bytes. Split a longer request into smaller plans.");
  const clauses = transcript.split(/\s+(?:and\s+)?then\s+/i);
  if (clauses.length > 8) return unsupported("Use at most eight steps in one plan.");
  const actions: IntentAction[] = [];
  for (const original of clauses) {
    const instruction = original.trim().replace(/^please\s+/i, "");
    let match: RegExpMatchArray | null;
    let request: ToolInput;
    if (/^(?:send|delete|remove|purchase|buy|share|change permissions)\b/i.test(instruction)) {
      return unsupported(`I can't do that yet. ${supportedInstructions} No steps have run.`);
    }
    if ((match = instruction.match(/^(?:find|locate)(?:\s+(?:my|the|a))?(?:\s+file)?\s+(.+)$/i))) {
      request = { tool: "find_file", input: { query: match[1].trim() } };
    } else if ((match = instruction.match(/^(?:open|launch)(?:\s+(?:app|application))?\s+(.+)$/i))) {
      request = { tool: "open_app", input: { app: match[1].trim() } };
    } else if ((match = (instruction.match(/^(?:create|make)(?:\s+a)?\s+note\s+(?:titled|called)\s+(.+?)\s+(?:saying|that says)\s+([\s\S]+)$/i)
      ?? instruction.match(/^(?:create|make)(?:\s+a)?\s+note\s+([^:]+):\s*([\s\S]+)$/i)))) {
      request = { tool: "create_note", input: { title: match[1].trim(), body: match[2].trim() } };
    } else if ((match = instruction.match(/^draft(?:\s+a)?\s+message\s+to\s+(.+?)\s+(?:saying|that says|:)\s*(.+)$/i))) {
      request = { tool: "draft_message", input: { recipient: match[1].trim(), body: match[2].trim() } };
    } else if ((match = instruction.match(/^(?:search(?:\s+the)?\s+web(?:\s+for)?|search\s+for|browser\s+search)\s+(.+)$/i))) {
      request = { tool: "browser_search", input: { query: match[1].trim() } };
    } else if ((match = instruction.match(/^(?:prepare|create|schedule)(?:\s+a)?\s+(?:calendar\s+)?event\s+(.+?)\s+from\s+(\S+)\s+to\s+(\S+)$/i))) {
      const [, title, start, end] = match;
      if (!validDate(start) || !validDate(end) || Date.parse(end) <= Date.parse(start)) {
        return unsupported("Use valid ISO dates with time zones and an end after the start, for example 2026-11-11T10:00:00+05:30. No steps have run.");
      }
      request = { tool: "calendar_event", input: { title: title.trim(), start, end } };
    } else if (/^draft\b/i.test(instruction)) {
      return unsupported('Add the recipient and message, for example “Draft message to Maya saying I will be there at five”. No steps have run.');
    } else if (/^(?:create|make)\b.*\bnote\b/i.test(instruction)) {
      return unsupported('Add a title and body, for example “Create a note titled Shopping saying buy milk”. No steps have run.');
    } else if (/\b(?:calendar|event)\b/i.test(instruction)) {
      return unsupported(`Give an event title, start and end with time zones. Example: “${intentExamples[5]}”. No steps have run.`);
    } else {
      return unsupported(`I can't do that yet. ${supportedInstructions} Join explicit steps with “then”. No steps have run.`);
    }
    if (Object.values(request.input).some(value => !value.trim())) return unsupported("Each step needs complete details. No steps have run.");
    // Do not resolve references using invented results from a previous step.
    if (Object.values(request.input).some(value => /^(?:it|that|them|the result|those)$/i.test(value))) {
      return unsupported("Name the exact app, file, recipient or content for each step. References to earlier results are not supported yet. No steps have run.");
    }
    actions.push({ instruction: original.trim(), request });
  }
  return { supported: true, transcript, actions };
}
