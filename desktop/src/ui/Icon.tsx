export type IconName = 'voice' | 'circle' | 'mic' | 'text' | 'think' | 'bolt' | 'shield' | 'check' | 'error' | 'tools' | 'history' | 'arrow';
const paths: Record<IconName, string> = {
  voice: 'M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4',
  circle: 'M12 8v4m0 4h.01M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  mic: 'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5m-3 6a6 6 0 0 0 12 0m-6 6v4m-4 0h8',
  text: 'M4 5h16M4 10h16M4 15h10M4 20h7',
  think: 'M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 2H9l-1-2',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7l1-7',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3m-3 9 2 2 4-4',
  check: 'm5 12 4 4L19 6',
  error: 'M12 8v5m0 4h.01M10 3 2 18q-1 3 2 3h16q3 0 2-3L14 3q-2-3-4 0',
  tools: 'M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3',
  history: 'M3 10a9 9 0 1 1 1 7M3 4v6h6m3-3v6l4 2',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
