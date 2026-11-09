# Speech and dictation

Import `SpeechPanel` from `features/speech`. The feature does not execute tools or write activity history.

```tsx
<SpeechPanel
  onTranscriptReady={engine.onTranscriptReady}
  onPhaseChange={handleCapturePhase}
  disabled={engine.isActive}
  language="en-US"
/>
```

`TranscriptReadyHandler = (transcript: string) => void | Promise<void>` is the speech → engine contract. It runs only on **Use transcript**, receives trimmed nonempty text, and is awaited. Throw or reject when the engine cannot accept the text. Text remains in the editor on success and failure; the panel prevents duplicate submissions while awaiting the callback. Omitting the callback visibly disables submission while editing/copying work.

`SpeechPhase = 'idle' | 'listening' | 'transcribing'` is the capture → shell contract. The shell should serialize `api.setState` calls in event order and expose failures. Set `disabled` during planning, execution, and approvals; capture stops and submission is blocked while text editing/copying remain usable. The feature emits capture phases and the engine owns thinking/acting/approval states.

The only permission request is **Enable microphone** (or its retry button). `getUserMedia` verifies permission and immediately stops its tracks. SpeechRecognition starts separately on button/key hold, only after permission is enabled. Global Ctrl+Space is registered only for the enabled session using the Tauri global-shortcut plugin and unregisters on unmount. It handles Pressed and Released separately. The foundation must install the JS/Rust plugin, initialize it, and allow register/unregister commands. Shortcut failures have visible on-screen fallback guidance.

Recognition availability is detected honestly. WebView2 installations may expose no speech service, or deny it even after microphone access succeeds. Speech errors retain final text and leave the editor usable. Recognition may use the browser's online service; no offline guarantee is made. Interim text is shown separately and is not sent as final text. Stop allows up to eight seconds for final results before aborting. Every unmount aborts active recognition. Permission is not persisted between sessions.

Editing includes arbitrary punctuation, bounded 100-step undo (one checkpoint per recording), clear with undo, and clipboard copy with manual-copy guidance on failure. Recording uses a static dot plus text, without motion. The textarea is read-only only while capture is finishing; it always remains usable when speech is unsupported or denied.

## Verification

- Run `npm run build` in `desktop`, then `cargo build` in `desktop/src-tauri`.
- With speech unavailable, type punctuation, submit, clear, undo, and copy.
- Deny permission; verify typing/submission continue and retry is explicit.
- Enable permission; verify no recognition starts until a hold. Press/release Ctrl+Space and the on-screen button (including keyboard Space/Enter). Verify listening → transcribing → idle and Stop.
- Dictate final/interim results, edit after release, undo the edit then undo recording. Submit only reviewed final text.
- Check 360px width and reduced-motion preference. Real Windows shortcut delivery and speech-service availability require testing in the native app.
