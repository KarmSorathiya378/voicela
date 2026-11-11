# Dependable workflows

WorkflowPanel is mounted in the desktop workspace and saves named local commands/notes and reusable event/message routines. Event creation runs before sending the email. Saved notes are never interpreted as executable instructions. Each execution obtains fresh native previews and requires approval of every exact action, with an explicit real/sandbox mode. Real Google operations also require the default-off Google privacy setting. Unavailable persistent storage cannot fall back to a volatile journal: writes fail closed.

WorkflowRunner journals intent before invoking a step and persists receipts before verification. A recorded execution key cannot run again, including after runner recreation/restart. Native Google SQLite guards additionally atomically reject duplicate action content across processes/windows and new frontend execution IDs. Frontend localStorage alone is not a cross-process lock. Storage failure before execution prevents writes.

Progress lists completed steps and retains provider receipts. Cancellation and the whole-run timeout cover both execution and verification; late provider work cannot advance the routine or start its next step. Cancellation cannot retract a write already in flight. The emergency-stop DOM event cancels active runners and discards approval previews. Shell/microphone cancellation belongs to the shell owner.

Only verification reads retry, bounded to three attempts. A failing or uncertain write is never automatically replayed. Gmail acknowledgement produces acknowledged rather than verified status; Calendar verifies the returned provider event. Partial failure preserves completed steps. Restart inspection explains running records as interrupted/uncertain and blocks replay. Pending native Calendar event IDs survive even if the frontend never receives the result.

Recovery is deliberately manual: inspect Google Calendar and Gmail Sent, compare retained receipts, remove an unwanted event in Calendar, and create a freshly reviewed routine containing only confirmed unexecuted steps. Gmail undo and automatic compensation are unavailable. Native uncertain guards remain blocked, so an uncertain write cannot be recovered by blindly replaying the routine. Identical previously attempted actions remain blocked even after a known provider rejection. There is no general arbitrary-command execution or dependency data substitution.

Saved command/message content and frontend run history live in unencrypted localStorage. Native journal contains action hashes/status/receipts, not content or OAuth credentials. Clearing browser storage can lose the explanation/history but cannot remove native duplicate guards; deleting app data can remove guards. Successful same-content actions cannot be intentionally repeated without an explicit future recovery design.

Reminders and scheduled execution remain disabled (schedulingEnabled=false) because send-only Gmail cannot verify delivery or support safe unattended reconciliation.

Verification:

- `node --test apps/app/src/features/workflows/workflows.test.mjs`
- `npm run build` from apps/app, and repository-wide `npm run build`
- `cargo build --manifest-path apps/app/src-tauri/Cargo.toml`
- `cargo test --manifest-path apps/app/src-tauri/Cargo.toml`

Tests cover preview-before-send, single-use/expired previews, contact/date ambiguity, header injection, durable duplicate prevention, restart/concurrent execution keys, verification-only retry, uncertain write replay rejection, timeout during verification, partial completion and journal failure. Live-account OAuth and native visual validation require a configured account/available browser and are not simulated by these tests.
