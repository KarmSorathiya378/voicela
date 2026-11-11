import { invoke } from "@tauri-apps/api/core";

export type AppState = "idle" | "listening" | "transcribing" | "thinking" | "acting" | "awaiting-approval" | "completed" | "error";
export type ToolInput =
  | { tool: "open_app"; input: { app: string } }
  | { tool: "find_file"; input: { query: string } }
  | { tool: "create_note"; input: { title: string; body: string } }
  | { tool: "calendar_event"; input: { title: string; start: string; end: string } }
  | { tool: "draft_message"; input: { recipient: string; body: string } }
  | { tool: "browser_search"; input: { query: string } }
  | { tool: "control_app"; input: { action: string; target: string; window: string } };
export type ToolName = ToolInput["tool"];
export interface ToolDescriptor {
  name: ToolName;
  description: string;
  permission: { enabled: boolean; requires_approval: boolean };
  implementation: "simulated" | "local";
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}
export interface PendingApproval { id: string; request: ToolInput; intent: string }
export interface StateSnapshot { state: AppState; pending_approval: PendingApproval | null }
export interface ToolOutput { tool: ToolName; status: "simulated" | "executed"; message: string; executed: boolean }
export type RunResponse =
  | { status: "awaiting_approval"; approval: PendingApproval }
  | { status: "simulated" | "executed"; output: ToolOutput }
  | { status: "denied"; message: string };
export interface ActivityEntry {
  id: number;
  timestamp: string;
  tool: ToolName;
  intent: string;
  status: "awaiting_approval" | "approved" | "simulated" | "executed" | "denied" | "client_note";
}

// All IPC is centralized here. Tool inputs are discriminated unions, never arbitrary commands.
export const api = {
  startListening: (sessionId: string, dictation: boolean, options: {deviceId: number; language: string}) => invoke<void>("start_listening", {sessionId, dictation, options}),
  stopListening: () => invoke<void>("stop_listening"),
  speechDevices: () => invoke<{ devices: { id: number; name: string }[]; modelReady: boolean; engine: string }>("speech_devices"),
  speechLevel: () => invoke<number>("speech_level"),
  startSpeech: (dictation = false, options = { deviceId: 4294967295, language: "en" }) => invoke<void>("start_speech", { dictation, options }),
  stopSpeech: (cancel = false) => invoke<{ text: string; inserted: boolean; insertion_error: string | null; needs_review: boolean }>("stop_speech", { cancel }),
  getState: () => invoke<StateSnapshot>("get_state"),
  setState: (state: AppState) => invoke<StateSnapshot>("set_state", { state }),
  getTools: () => invoke<ToolDescriptor[]>("get_tools"),
  runTool: (request: ToolInput, intent: string) => invoke<RunResponse>("run_tool", { request, intent }),
  approveTool: (approvalId: string, approved: boolean) => invoke<RunResponse>("approve_tool", { approvalId, approved }),
  getActivityLog: (limit = 50) => invoke<ActivityEntry[]>("get_activity_log", { limit }),
  clearActivityLog: () => invoke<void>("clear_activity_log"),
  appendActivityLog: (tool: ToolName, intent: string) => invoke<void>("append_activity_log", { tool, intent }),
};

export const sampleRequests = {
  control_app: { tool: "control_app", input: { action: "inspect", target: "visible controls", window: "foreground" } },
  open_app: { tool: "open_app", input: { app: "Notepad" } },
  find_file: { tool: "find_file", input: { query: "invoice.pdf" } },
  create_note: { tool: "create_note", input: { title: "Sample note", body: "A foundation test note." } },
  calendar_event: { tool: "calendar_event", input: { title: "Sample meeting", start: "2026-11-11T10:00:00+05:30", end: "2026-11-11T10:30:00+05:30" } },
  draft_message: { tool: "draft_message", input: { recipient: "sample@example.com", body: "A sample draft. Nothing will be sent." } },
  browser_search: { tool: "browser_search", input: { query: "Tauri documentation" } },
} satisfies Record<ToolName, ToolInput>;
