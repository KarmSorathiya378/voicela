import { api, type ToolInput, type RunResponse } from '../../api';

export const mockFileIndex = [
  { name: 'November invoice.pdf', path: 'Sample files / Finance / November invoice.pdf' },
  { name: 'Project brief.docx', path: 'Sample files / Work / Project brief.docx' },
  { name: 'Meeting notes.txt', path: 'Sample files / Notes / Meeting notes.txt' },
];

export function findFiles(query: string) {
  const value = query.trim().toLocaleLowerCase();
  if (!value) throw new Error('Enter a file name to search.');
  return mockFileIndex.filter(file => file.path.toLocaleLowerCase().includes(value));
}

// Rust owns permission checks and the approval token. No shell commands are accepted.
export const runPlatformTool = (request: ToolInput): Promise<RunResponse> =>
  api.runTool(request, `Manual tool request: ${request.tool.replace(/_/g, ' ')}`);
