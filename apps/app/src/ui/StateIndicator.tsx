import type { AppState } from '../api';
import { Icon, type IconName } from './Icon';

export const statePresentation: Record<AppState, { label: string; icon: IconName; tone: string }> = {
  idle: { label: 'Ready', icon: 'circle', tone: 'neutral' },
  listening: { label: 'Listening', icon: 'mic', tone: 'blue' },
  transcribing: { label: 'Transcribing', icon: 'text', tone: 'blue' },
  thinking: { label: 'Thinking', icon: 'think', tone: 'violet' },
  acting: { label: 'Acting', icon: 'bolt', tone: 'blue' },
  'awaiting-approval': { label: 'Awaiting approval', icon: 'shield', tone: 'amber' },
  completed: { label: 'Completed', icon: 'check', tone: 'green' },
  error: { label: 'Error', icon: 'error', tone: 'red' },
};
export function StateIndicator({ state }: { state: AppState | null }) {
  const view = state ? statePresentation[state] : { label: 'Core disconnected', icon: 'circle' as const, tone: 'neutral' };
  return <span className={`vs-state vs-tone-${view.tone}`} role="status" aria-live="polite"><Icon name={view.icon} />{view.label}</span>;
}
