# Voicela desktop foundation

An isolated Tauri 2 + React + TypeScript + Rust + SQLite app. The Next.js marketing site in `../web/` is independent.

## Run

Windows prerequisites: Node.js and pnpm 11.5.2, Rust MSVC toolchain, Visual Studio C++ Build Tools, and Microsoft Edge WebView2 Runtime.

From the repository root:

```powershell
pnpm install
pnpm tauri dev
```

Inside `apps/app/`, `pnpm dev` alone is a browser preview; it explicitly reports that the desktop core is unavailable. No browser mock results are substituted.

```powershell
cd apps/app
pnpm build
cd src-tauri
cargo build
cargo test
cargo clippy --all-targets -- -D warnings
```

Build the frontend before invoking plain `cargo build`. `pnpm tauri build` also runs the frontend build and produces bundles, but installer/signing/distribution testing is outside this foundation.

## Use voice commands and dictation

Run the native app with `pnpm tauri dev` from the repository root. The website and browser preview cannot launch Windows apps or insert text into other apps.

1. Select your microphone and English, then click **Start listening** once.
2. Speak naturally and pause for about a second between commands. Voicela splits utterances and transcribes them automatically while keeping the microphone open. There is no Stop and run step.
3. Say **pause listening** or use **Pause listening** to switch recording off. Ctrl+Space toggles the session, without holding the keys. Say **approve** or **cancel plan** to resolve a pending action by voice.

The microphone remains active during decoding and command execution. A bounded processing queue handles completed turns. If the decoder cannot keep up, the session pauses with an explicit error instead of silently discarding speech or buffering indefinitely. Each long speech turn is split into bounded chunks; this is local turn-based transcription, not word-by-word live decoding. Only supported commands are executed; arbitrary conversational reasoning is not implemented.

Try `Open Notepad`, `Open Calculator`, `Open Google Chrome` (use its exact Start menu name), `Search the web for train times`, `Find my invoice`, or `Create a note titled Shopping saying buy milk`. Each spoken command replaces the previous command transcript; it is not appended to old instructions.

For dictation into another application, select **Dictate into the focused app**, focus its text field, start listening and speak with a short pause between sentences. Keep the same window focused. Voicela inserts Unicode text without pressing Enter. A copy remains in the transcript editor. If focus changes or Windows blocks insertion, it reports the problem and retains your transcript. Elevated applications may block insertion.

Version 0.1.3 uses SAPI dictation with a local Whisper small model. The first development run downloads the pinned whisper.cpp 1.8.4 CPU runtime and quantized multilingual model (about 190 MB), verifies SHA-256 hashes, and includes them in the installer. `pnpm speech:setup` prepares these assets separately. Subsequent transcription needs no network or API key. App lookup remains native Windows AppsFolder lookup; neither feature uses PowerShell. Browser preview uses its browser speech service separately.

The selected microphone records 16 kHz mono audio. Silent and short recordings are rejected. Low decoder scores retain the transcript for review instead of automatically executing or inserting it. This heuristic does not guarantee every confident transcript is correct. Temporary audio and decoder output are deleted after transcription, including normal error paths; a crash can leave files in the app cache. No audio is uploaded.

App launch, web search, local note storage, and filename search are implemented. Filename search covers accessible fixed/removable local drives, prioritizes personal folders, skips links/junctions, and uses an 8-level, 50,000-entry, 100-result, 5-second scan budget. It reports incomplete scans and unavailable folders. Network drives and file contents are not searched. App/browser launch acceptance does not verify application readiness. Calendar and message integrations remain simulations.

## PC access and app control

Voicela uses your current Windows account's access. It does not change Windows security settings or obtain administrator rights. Focus the app you want to control, then use Ctrl+Space in Run voice commands mode:

- `Inspect current app`: list visible accessibility labels (password controls excluded).
- `Click Save`: invoke an exact, unique visible control.
- `Type Hello, world!`: insert text into the approved app without pressing Enter.
- `Press Control plus S`, `Select all`, `Copy`, `Paste`, `Undo`, `Redo`, `Save`: common keyboard actions.
- `Scroll down`, `Scroll up`, `Scroll left`, `Scroll right`: use an exposed scrollable control.

Inspection is read-only. App changes require review and are bound to a window/process/title; changed targets are rejected. Controls must expose Windows accessibility patterns. Unsupported or ambiguous controls return errors; no coordinate click is guessed. Inspection is bounded to 500 elements and 80 labels. These are app-control primitives, not autonomous operation of every app or arbitrary freeform task planning. Give separate commands after a new app window is ready. Protected/elevated applications may reject control.

## Layout

- `src/api.ts`: typed IPC facade, discriminated tool inputs, wire responses, fixed sample requests.
- `src/App.tsx`, `src/App.css`: minimal status, transcript placeholder, tool inventory, approval review, activity feed.
- `src-tauri/src/state.rs`: D02 state enum and valid transition graph.
- `src-tauri/src/tools.rs`: seven typed adapters, `Tool` trait, typed inputs and JSON schemas.
- `src-tauri/src/permission.rs`: per-tool enabled and requires-approval policy.
- `src-tauri/src/engine.rs`: serialized tool orchestration and one pending immutable approval.
- `src-tauri/src/activity_log.rs`: parameterized SQLite append/recent/clear operations.
- `src-tauri/src/lib.rs`: Tauri setup and command registration.

## Command contract

Tauri command argument names use camelCase. Wire enum values use snake_case for tools/statuses and kebab-case for D02 states.

| Command | Arguments | Result |
| --- | --- | --- |
| `get_state` | none | `{ state, pending_approval }` |
| `set_state` | `{ state }` | state snapshot |
| `get_tools` | none | descriptors with permission flags and input/output schemas |
| `run_tool` | `{ request: { tool, input }, intent }` | discriminated `awaiting_approval`, `simulated`, `executed`, or `denied` response |
| `approve_tool` | `{ approvalId, approved }` | executed or simulated result, or denial |
| `get_activity_log` | `{ limit?: number }` | newest first, default 50, bounded to 1â€“200 |
| `clear_activity_log` | none | void; rejected while an approval is pending |
| `append_activity_log` | `{ tool, intent }` | void; always a `client_note`, cannot forge an execution record |

`set_state` accepts capture/reset/error transitions only. The engine owns acting, awaiting-approval and completed, preventing frontend state changes from bypassing approval. Idle/completed/error can enter thinking for typed input; capture follows idle â†’ listening â†’ transcribing â†’ thinking. Tools proceed through thinking â†’ acting â†’ completed, or thinking â†’ awaiting-approval â†’ acting â†’ completed. Decline returns to idle. Errors are explicit.

Approval IDs are generated in Rust, refer to an immutable request, and are consumed once. Only one pending request is supported. Unknown IDs, concurrent requests and approval replay are rejected. Pending approvals are intentionally memory-only and are discarded on restart; the history may retain an awaiting-approval record, which is not proof of approval or execution. No auto-resume.

The `create_note` adapter saves the approved title and body as an executed activity entry in local SQLite. The note and its execution record are committed together. App launch, browser search and filename search use local Windows adapters. Calendar and message tools return simulated results with `executed: false`. The permission policy is static in this milestone.

Inputs reject unknown fields and blank/oversized strings. Semantic checks such as calendar date parsing and app/path allowlists belong to future real adapters, which must add execution verification before ever reporting actual success. There is no arbitrary shell tool. App names are matched against the Start menu or fixed built-in aliases; they are never interpolated into shell commands.

## Local data and limits

SQLite lives in Tauri's application data directory (`com.voicela.apps/app/activity.sqlite3` on Windows). It stores UTC timestamp, tool, caller-provided intent, and status. Approved note content is stored in the activity history. Executed action messages and matched file paths are also stored. Microphone audio and transcript scratch text are not persisted. Intent can still contain sensitive text; the frontend fixed samples use generic intent labels. Clear deletes records and vacuums SQLite with secure_delete enabled; this does not promise forensic erasure of filesystem backups or snapshots. The database is not encrypted in this phase.

Native push-to-talk uses Windows speech recognition; the global shortcut depends on registration being available. Model routing, arbitrary OS automation, calendar/message integrations, installer signing and updater support are pending. Default scaffold icons are placeholders.

## Verification

See `VERIFICATION.md` for commands actually run and their results. Compilation and core tests do not establish a tested native UI, installer, speech pipeline or working OS integration.


## Integrated workspace

The default route mounts desktop settings/controls, one speech owner, the intent engine and the dictation/editing TextWorkspace. Choose **Dictate for review** to send speech to the dictation editor without automatic native insertion; review the preview and explicitly insert through the captured target. Ctrl+Shift+E captures the external text target before returning to the workspace. Typed dictation uses the same review route. Command mode retains the reviewed plan / intent-engine path.

The floating window uses `?panel` and mounts only FloatingPanel. Its toggle/pause and mode events are consumed by the main speech owner; switching mode pauses capture before the next session. DesktopControls exposes the tray/shortcut settings. Editing uses the feature's conservative local provider unless a real EditProvider is explicitly configured; translation is unavailable by default.

Run all desktop frontend tests from `apps/app` with `node --test src/**/*.test.mjs src/integration.test.mjs` (or enumerate test paths on shells without glob expansion). See VERIFICATION.md for the final integration checks.
