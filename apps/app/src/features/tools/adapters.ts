import { api, type ToolInput, type RunResponse } from '../../api';

// Rust owns permission checks and the approval token. No shell commands are accepted.
export const runPlatformTool = (request: ToolInput): Promise<RunResponse> =>
  api.runTool(request, `Manual tool request: ${request.tool.replace(/_/g, ' ')}`);
