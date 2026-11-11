import { useEffect, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { nativeTextAdapter } from './nativeAdapter';
import type { TextAdapter, TextSnapshot } from './adapter';
import { DictationPanel } from './DictationPanel';
import { EditingPanel } from '../editing/EditingPanel';
import type { EditProvider } from '../editing/session';
/** Mount once in AppShell. Ctrl+Shift+E captures the external caret/selection before
 * the user returns to Voicela. No microphone listeners or duplicate insertion path. */
export function TextWorkspace({ transcript, provider }: { transcript?: string; provider?: EditProvider }) {
  const [snapshot, setSnapshot] = useState<TextSnapshot>();
  const [status, setStatus] = useState('Focus a text field and press Ctrl+Shift+E to capture it, then return here.');
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unregister: (() => Promise<void>) | undefined;
    const registration = (async () => {
      const plugin = await import('@tauri-apps/plugin-global-shortcut');
      if (disposed) return;
      await plugin.register('Control+Shift+E', event => {
        if (event.state !== 'Pressed' || disposed) return;
        void nativeTextAdapter.capture().then(value => {
          if (disposed) return;
          setSnapshot(value); setStatus('Target captured. Return to Voicela to dictate or propose an edit.');
        }).catch(error => { if (!disposed) { setSnapshot(undefined); setStatus(String(error)); } });
      });
      unregister = () => plugin.unregister('Control+Shift+E');
    })();
    void registration.catch(error => { if (!disposed) setStatus(`Selection shortcut unavailable: ${String(error)}`); });
    return () => { disposed = true; void registration.then(() => unregister?.()).catch(() => undefined); };
  }, []);
  const adapter = useMemo<TextAdapter>(() => ({ ...nativeTextAdapter, capture: async () => {
    if (!snapshot) throw new Error('Focus the target field and press Ctrl+Shift+E first.');
    return snapshot;
  } }), [snapshot]);
  return <div><p role="status">{status}</p><DictationPanel adapter={adapter} transcript={transcript} /><EditingPanel adapter={adapter} provider={provider} /></div>;
}
