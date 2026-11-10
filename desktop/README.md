# Voicela desktop foundation

An isolated Tauri 2 + React + TypeScript + Rust + SQLite app. The Next.js marketing site in the parent directory is independent.

## Run

Windows prerequisites: Node/npm, Rust MSVC toolchain, Visual Studio C++ Build Tools, and Microsoft Edge WebView2 Runtime.

```powershell
cd desktop
npm ci
npm run tauri dev
```

`npm run dev` alone is a browser preview; it explicitly reports that the desktop core is unavailable. No browser mock results are substituted.

```powershell
npm run build
cd src-tauri
cargo build
cargo test
cargo clippy --all-targets -- -D warnings
```

Build the frontend before invoking plain `cargo build`. `npm run tauri build` also runs the frontend build and produces bundles, but installer/signing/distribution testing is outside this foundation.

## Try a local voice command

In the desktop app, enable the microphone and hold **Ctrl+Space** to say “Create a note titled Shopping saying buy milk.” Release, review the transcript, and choose **Use transcript → Run plan → Approve and save note**. You can also type the same command or request a note from the tools panel. The saved note appears in **Activity** and survives a restart. Clearing local history deletes saved notes.

Speech currently uses the webview's speech service where available. It may process audio online. Typed input and local note storage work without a network connection.

## Layout

- `src/api.ts`: typed IPC facade, discriminated tool inputs, wire responses, fixed sample requests.
- `src/App.tsx`, `src/App.css`: minimal status, transcript placeholder, tool inventory, approval review, activity feed.
- `src-tauri/src/state.rs`: D02 state enum and valid transition graph.
- `src-tauri/src/tools.rs`: six allowlisted adapters, `Tool` trait, typed input enum, JSON input/output schemas via Schemars.
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
| `get_activity_log` | `{ limit?: number }` | newest first, default 50, bounded to 1–200 |
| `clear_activity_log` | none | void; rejected while an approval is pending |
| `append_activity_log` | `{ tool, intent }` | void; always a `client_note`, cannot forge an execution record |

`set_state` accepts capture/reset/error transitions only. The engine owns acting, awaiting-approval and completed, preventing frontend state changes from bypassing approval. Idle/completed/error can enter thinking for typed input; capture follows idle → listening → transcribing → thinking. Tools proceed through thinking → acting → completed, or thinking → awaiting-approval → acting → completed. Decline returns to idle. Errors are explicit.

Approval IDs are generated in Rust, refer to an immutable request, and are consumed once. Only one pending request is supported. Unknown IDs, concurrent requests and approval replay are rejected. Pending approvals are intentionally memory-only and are discarded on restart; the history may retain an awaiting-approval record, which is not proof of approval or execution. No auto-resume.

The `create_note` adapter saves the approved title and body as an executed activity entry in local SQLite. The note and its execution record are committed together. The other five tools return simulated results with `executed: false`. The permission policy is static in this milestone.

Inputs reject unknown fields and blank/oversized strings. Semantic checks such as calendar date parsing and app/path allowlists belong to future real adapters, which must add execution verification before ever reporting actual success. There is no arbitrary shell tool, filesystem plugin, opener plugin or remote content capability.

## Local data and limits

SQLite lives in Tauri's application data directory (`com.voicela.desktop/activity.sqlite3` on Windows). It stores UTC timestamp, tool, caller-provided intent, and status. Approved note content is stored in the activity history. Other tool payloads, microphone audio and transcript scratch text are not persisted. Intent can still contain sensitive text; the frontend fixed samples use generic intent labels. Clear deletes records and vacuums SQLite with secure_delete enabled; this does not promise forensic erasure of filesystem backups or snapshots. The database is not encrypted in this phase.

Push-to-talk and its shortcut depend on speech and microphone support in the host webview. Offline speech recognition, model routing, OS automation, calendar/message integrations, installer signing and updater support are pending. Default scaffold icons are placeholders.

## Verification

See `VERIFICATION.md` for commands actually run and their results. Compilation and core tests do not establish a tested native UI, installer, speech pipeline or working OS integration.
