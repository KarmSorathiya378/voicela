# Final monorepo and workspace integration ? 2026-11-11

- `npm run build` in `apps/app`: passed.
- `cargo build` in `apps/app/src-tauri`: passed.
- `cargo test` in `apps/app/src-tauri`: 25 passed, 4 environment-dependent tests ignored; binary and doc tests passed.
- `node --test` over all `apps/app/src/**/*.test.mjs`: 37 passed, including the route integration test.
- UI source detector: no findings for App.tsx and SpeechPanel.tsx.

The main route mounts DesktopControls, one SpeechPanel and one TextWorkspace. Native dictation is deferred before insertion and delivered through onDictationReady into the review workspace. Manual reviewed dictation uses the same callback; command mode keeps the intent engine callback. The floating `?panel` route mounts only FloatingPanel, with scoped core event permissions. Main speech consumes tray/panel toggle, pause and mode events; mode changes pause recording first. No new model provider is implied: EditingPanel retains its documented local fallback and explicit unsupported translation behavior.

Migration preserves the shared Rust modules/registrations and uses the root pnpm lockfile for apps/app and apps/web. Downloaded speech resources, build outputs and commit-message scratch files are excluded. Native tray/shortcut/real microphone UI interaction and real-account Google tests still require manual verification; SSR route checks do not establish those behaviors.

---

# Continuous listening - 0.1.3

- Rust suite: 20 passed, 4 environment-dependent checks ignored by default. Endpoint tests cover bounded silence, multiple utterances, leading audio, click rejection and long speech splitting.
- Explicit Windows checks: all 4 passed, including actual continuous microphone capture cancellation and immediate device reuse, app lookup, and Whisper recognition of a WAV sample.
- Planner suite: 20 passed, including consecutive spoken turns and voice approve/cancel without ending the listening session.
- Frontend production build passed; UI detector returned no findings.
- Live-user accuracy and the complete native session UI still require a manual check because no connected UI automation surface is available.

Manual check: start listening once; say Open Notepad, pause, then Open Calculator. Verify the meter remains active while each turn is processed. Request a note and say approve, then try another request and cancel plan. Say pause listening and check the Windows microphone indicator switches off. Toggle Ctrl+Space twice; ensure holding it does not toggle repeatedly. Test rapid start/pause, device removal and sustained background noise. Access to Windows-protected apps is unchanged.

---

# Offline Whisper and PC controls - 0.1.2

Current checks on 2026-11-11:

- Frontend production build passed; 19 command/planner tests passed.
- Rust suite: 17 passed; 3 environment-dependent checks skipped in the default suite.
- All 3 explicit Windows checks passed: native app lookup, real microphone startup/cancellation, and Whisper transcription of a synthesized WAV as `Open Notepad.`. Silent PCM is rejected. These tests do not establish accuracy for an individual speaker.
- Tests cover low decoder-score review, invalid/stale-format window bindings, input/approval validation, shortcut restrictions, and inclusion of the system drive in the local search scope.
- Source checks and Impeccable detection passed. No connected UI surface was available for rendered inspection or real in-app clicks/typing; those require manual verification.
- Windows release build passed and produced version 0.1.2 MSI (180.38 MiB) and NSIS (174.89 MiB) installers. The installer manifest contains the offline model, executable, required libraries and licenses in the runtime resource directory. Installation itself has not been automated.

The bundled model/runtime replaces SAPI dictation. Microphone selection, English preference and a live input meter expose wrong-input/weak-signal problems. Command recording clears the previous command so empty/error recordings cannot leave an old command looking like a new transcript. The capture ring is drained in queue order, including its final partial buffers. Low decoder scores retain text for review rather than automatic actions.

PC controls use the current Windows account. Inspection reads visible accessibility labels; reviewed click/type/key/scroll actions are bound to a specific window/process/title. Unsupported interfaces are reported as errors. Local filename search scans accessible fixed/removable drives within explicit entry/depth/time limits and reports incomplete scans. No administrator rights or Windows security settings are changed.

Manual check: install 0.1.2 after closing older Voicela instances. Select the physical microphone and English, enable it, start listening and verify the meter moves with speech. Say `Open Notepad`, stop, and inspect the result. For app controls, focus an external app and use Ctrl+Space: `Inspect current app`, `Click Save`, `Type Hello`, `Press Control plus S`, `Scroll down`. Review the bound target for each change. Test quiet audio, a removed device, changed target window and an unsupported control. Whisper uncertainty scores are heuristic and do not guarantee correctness.

---

# Historical native voice commands - 0.1.1

Checks on 2026-11-11:

- `pnpm --filter @voicela/app build`: passed.
- `node --test apps/app/src/features/engine/engine.test.mjs`: 17 passed. Covers automatic spoken-command execution, no duplicate app approval, fresh sequential commands, unsupported commands, preserved write approvals, and uncertainty/replay handling.
- `cargo test --manifest-path apps/app/src-tauri/Cargo.toml`: 12 passed; 3 Windows integration checks are ignored in the default suite.
- `cargo test --manifest-path apps/app/src-tauri/Cargo.toml windows_ -- --ignored --nocapture`: all 3 integration checks passed. Native SAPI transcribed a generated WAV as `Open notepad`; the real default microphone initialized/stopped and rejected concurrent capture; native AppsFolder lookup found Calculator and rejected an invalid command-like name. No PowerShell or script host is used by these implementations.
- `cargo clippy --manifest-path apps/app/src-tauri/Cargo.toml --all-targets -- -D warnings`: passed.
- Impeccable detector on changed panels: no findings.
- `pnpm lint`: passed.
- `pnpm tauri build`: built version 0.1.1 MSI and NSIS installers successfully. Installer execution itself was not tested.

The prior implementation only filled the editor on release. The native release handler now returns capture to idle, submits only the new utterance, and runs it. Typed instructions remain staged for review. App launches no longer require a second approval; note/browser policies remain enforced by Rust. Speech and installed-app lookup are implemented through native Windows COM, replacing both PowerShell helpers.

No connected browser/native automation surface is available. Live-user recognition accuracy, physical shortcut delivery, installed-app launch windows, and text insertion still need a manual smoke test. Native audio recognition above uses a synthetic WAV and does not establish recognition accuracy for an individual speaker.

Manual check: install 0.1.1 after closing the old app; enable the microphone; select Run voice commands; hold Ctrl+Space, wait for Listening, say Open Notepad and release. It should launch without Use transcript/Run plan/Approve clicks. Alternatively click Start listening, speak, and select Stop and run. Repeat with Calculator, then test a missing app. Dictation mode remains separate. No execution-policy changes or administrator access should be needed for these features.

---

The following is historical foundation verification, before the integrations above.

# Phase 1 verification

Verified locally on Windows with Node 24.16.0, npm 12.0.0 and Rust/Cargo 1.97.0.

- `npm run build`: passed (TypeScript and Vite production build).
- `cargo build` in `src-tauri`: passed.
- `cargo test` in `src-tauri`: passed, 5 tests. Covers D02 transitions, immutable single-use approvals, replay/wrong-ID rejection, denial, malformed inputs and unknown tools, simulated result honesty, SQLite persistence/recent ordering and deletion.
- `cargo clippy --all-targets -- -D warnings`: passed without warnings.
- `impeccable detect --json apps/app/src/App.tsx apps/app/src/App.css`: returned `[]`.

The native window, end-to-end IPC interaction and installer have not been manually verified. The available computer-use inventory returned no apps or browsers, so no rendered visual QA was possible in this session. Compilation/core tests are not a claim that speech or OS integrations work. All tool adapters are simulated and return `executed: false`.

To manually smoke-test: run `npm run tauri dev`; check idle status and six tools; run `find_file` and see a simulated history entry; run `open_app`, inspect input, decline; run again, approve, and see separate approval and simulated entries; refresh the window to reload state/history; resolve pending approvals before clearing history. Push-to-talk remains disabled.
