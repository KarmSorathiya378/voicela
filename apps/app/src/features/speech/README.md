# Continuous listening (0.1.3)

Start listening registers event handlers before opening the selected microphone. Native capture stays open while a separate bounded decoder queue handles utterances. An energy endpoint detector uses leading audio, a short speech minimum, a configurable 900?3000 ms of quiet (1500 ms by default) and a 20-second turn cap. Silence does not allocate unbounded buffers or trigger recognition. Slow decoding pauses capture with an explicit error if the queue fills.

Each event has a listening-session ID. Pausing invalidates queued frontend deliveries and pending decoder results; an action already submitted can still finish. Capture releases the device before a new session starts. Unmount/close ends recording. The native microphone test verifies continuous capture cancellation and immediate reuse.

The frontend serializes decoded turns, keeps listening during action execution/approvals, and accepts pause listening / approve / cancel plan by voice. It does not overwrite the tool engine's states with microphone states. Ctrl+Space toggles once per press, with repeat events ignored. The continuous session does not auto-start on app launch.

Whisper remains local, defaults to English and retains uncertain text for review. The decoder is turn-based rather than word-by-word streaming and the intent engine still supports a defined command grammar. PC access remains under the Windows account's existing permissions, as documented in the desktop README.

The legacy one-shot capture commands remain for compatibility and browser-preview controls; the native interface exposes Start listening / Pause listening.
# Underlying capture and decoding

Native WinMM records 16 kHz mono PCM from the selected microphone. Settings include a persisted microphone choice, English/language choice, and a live input-level meter. Hold-to-talk and Start/Stop use one serialized lifecycle. Capture is capped at 60 seconds. No recording starts on mount.

Enable microphone checks the selected device. Global Ctrl+Space is registered only after that check. Browser preview uses SpeechRecognition separately. Stop invokes the bundled whisper.cpp 1.8.4 CPU CLI and pinned quantized Whisper small model. Only English has been tested here. Silent/short recordings are rejected; low token scores require transcript review. There is no SAPI dictation or script host. Temporary WAV, JSON and diagnostic files in the app cache are deleted after transcription; crash leftovers may remain. Audio is not uploaded.

Voice-command mode delivers each fresh utterance to `onSpeechReady` after capture becomes idle; it stages and runs the command automatically. App launch requires no second approval. `onTranscriptReady` remains the manual typed-plan path. Stop finalization never resets a subsequent execution state. Dictation mode captures the foreground window before recording and sends Unicode text only when that same external window is still focused and all shortcut modifiers are released. It never presses Enter. Errors retain the transcript for manual copy.

Windows microphone access, an input device and the bundled model/runtime are required. Elevated applications can reject text insertion. Uncertain speech is not inserted or run automatically; text remains available for review/copy.

`pnpm speech:setup` downloads and integrity-checks the model/runtime. Tauri dev/build hooks prepare and bundle those resources automatically. Verification: `pnpm --filter @voicela/app build`, `node --test apps/app/src/features/engine/engine.test.mjs`, `cargo test --manifest-path apps/app/src-tauri/Cargo.toml`. Explicit environment checks: `cargo test --manifest-path apps/app/src-tauri/Cargo.toml windows_ -- --ignored --nocapture`. These check the real microphone, native app lookup and Whisper recognition of synthetic audio; they do not establish accuracy for an individual speaker.


## Reliability contract

`SpeechPanel` preserves `onTranscriptReady?: (text: string) => void | Promise<void>`, `onPhaseChange?: (phase: "idle" | "starting" | "listening" | "transcribing") => void`, `disabled?: boolean`, and `language?: string` (default `en-US`). The existing `onSpeechReady?: TranscriptReadyHandler` receives each fresh command turn; continuous capture stays listening during delivery. Typed submission remains reviewed and uses `onTranscriptReady`; text, copy, undo and clear work when recognition is unavailable or denied. Pause recording before editing.

New optional `formatTranscript?: (text: string) => string` is a synchronous pure hook for **decoded native frontend delivery**. `cleanTranscript(text)` is exported and preserves existing punctuation, Unicode and paragraph boundaries while normalizing whitespace. The hook runs after normalization and before editor / `onSpeechReady` delivery. It does not rewrite typed text or native text already inserted by the legacy dictation backend. Consumers needing styled insertion should supply `onDictationReady` to defer insertion and consume the delivered transcript. No automatic punctuation is invented.

Native `Options` accepts optional `sensitivity` (0?100, default 50) and `silenceMs` (900?3000, default 1500); older callers remain valid. Settings are stored locally as `voicela.sensitivity` / `voicela.silenceMs` and take effect next session. Sensitivity adjusts the endpoint detector's RMS threshold, not Windows hardware gain. Language choices are English, auto/mixed, Hindi and Gujarati; the browser preview uses the selected language too. `language` initializes the choice and subsequent prop changes update it.

`listening-transcript` adds `sequence` (one-based, session-scoped) and `latencyMs` (decoder duration only, excluding capture/queue). Duplicate/stale deliveries are ignored by sequence, never by matching text. A sequence gap pauses capture with explicit review/restart guidance rather than executing incomplete or reordered speech. Decoder errors consume a sequence and retain editor contents. Four queued audio turns remain the hard limit.

A four-second native no-buffer watchdog releases stalled capture; device topology changes and delayed resume monitoring pause sessions. Select/check the microphone and explicitly restart after interruption. Recording never resumes silently after sleep or device removal. Normal quiet audio does not trip the watchdog. Explicit Pause cancels pending turns; already submitted actions can finish.

**Test microphone** opens the selected device for up to five seconds, shows its meter, reports whether an input signal was detected and provides **Stop microphone test**. It cancels capture without transcription or action delivery and releases capture on unmount. Transcript tools remain usable during the test. The recording indicator is text plus a static dot; controls have explicit labels and existing reduced-motion styles remain in force.

Only preferences are persisted here. Sequence/state/timing diagnostics remain in memory. No transcript, raw audio or analytics is collected by these diagnostics. Browser speech services may process audio online as disclosed in the panel; native Whisper stays local.

Checks: `npm run build` in `apps/app`; `cargo build` and `cargo test --lib` in `apps/app/src-tauri`; `node --test apps/app/src/features/speech/reliability.test.mjs`. Hardware unplug/replug, real sleep/wake, language accuracy and native focused-app insertion still need a live-user smoke test.


### Dictation workspace handoff

`onDictationReady?: TranscriptReadyHandler` is additive. When present **at native session start**, speech passes `deferInsertion: true` in capture options, retaining dictation-mode decoding while disabling native foreground binding/insertion. Confident fresh dictation goes through `cleanTranscript` and optional `formatTranscript`, into the editor and then this callback, once per sequence. Uncertain/error turns stay in the editor for review. The same deferral applies to legacy native one-shot capture. An absent or failing callback never falls back to automatic insertion; text is retained. Stop/restart capture when changing callback routing. Browser preview remains manual editor submission.

Integrator: mount one speech owner, pass `onDictationReady={text => setDictationTranscript(text)}` and pass that state as `<TextWorkspace transcript={dictationTranscript} />`. The speech mode selector then labels this route ?Dictate for review?. `onSpeechReady` continues to handle command mode. No App.tsx, shared Cargo or lib.rs wiring is changed by this slice.
