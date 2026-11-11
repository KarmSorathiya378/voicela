import { invoke } from '@tauri-apps/api/core';
import type { TextAdapter, TextReceipt, TextSnapshot } from './adapter';
/** Clipboard is never opened or changed; every format stays intact. Focus the bound app
 * before invoking capture/apply/undo (e.g. from a global shortcut). UIA plain text only. */
export const nativeTextAdapter: TextAdapter = {
  capture: () => invoke<TextSnapshot>('text_capture'),
  replace: (snapshot, text) => invoke<TextReceipt>('text_replace', { token: snapshot.token, text }),
  undo: receipt => invoke<void>('text_undo', { token: receipt.token }),
};
