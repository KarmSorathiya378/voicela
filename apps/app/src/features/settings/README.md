# Onboarding and privacy

`SettingsPanel` mounts `PrivacyControls` outside the collapsible settings panel. The emergency microphone stop button remains fixed and visible while settings are collapsed. It stops both native capture modes and dispatches `voicela:emergency-stop`; the shell must cancel its active plan on that event. Already completed external actions cannot be undone.

First run loads `privacy.json` from app data. The optional three-step flow chooses language, checks a microphone signal without transcription, then captures a held-button dictation for review. It uses `deferInsertion: true`, never executes commands and clears practice text on completion/dismissal. Completion persists only after a successful save. Re-run is always available. Microphone/device failures leave setup incomplete and allow retry.

All tool and integration grants default off. Native `permission::policy` reads current preferences on each invocation, including approval execution. Approval requirements remain enforced. Native initialization errors fail startup closed. Retention defaults to zero days; choices are 1, 7, 30 or 90 days. Exports contain private history and are saved as uniquely named JSON files in app data; deleting history does not delete exports. Deletion uses SQLite secure deletion and vacuum. Diagnostics use a numeric field allowlist; arbitrary strings, nested content, transcripts, emails and file contents are excluded. The diagnostics preference authorizes local counters only, with no network collector.

## Required shell/backend integration

Owned outside this feature:
- Call `permission::initialize(&directory)?` during setup after creating the activity database; register `get_privacy_settings`, `set_privacy_settings`, `export_private_history`, `delete_private_history` Tauri commands.
- Call `permission::enforce_retention()` after history writes and before reads (and at startup). It must execute outside a held privacy-settings lock.
- Gate direct integration entry points with `permission::integration_enabled("google" | "application_access" | "page_context")`. Tool grants alone do not guard direct integration IPC.
- Handle `voicela:emergency-stop` in the shell to cancel pending/active tasks; native microphone stop is already called directly by the button. Handle `voicela:history-changed` to refresh history views.

These hooks were requested from shell owners. Without command registration, setup displays the native IPC error instead of claiming to save. Until integration gates and retention hooks land, their preferences cannot enforce those external paths.

Verification: `npm run build` in apps/app; `cargo build` and `cargo test` in apps/app/src-tauri. Permission tests cover defaults/persistence and diagnostic redaction. Real microphone and pointer/keyboard practice still require desktop interaction verification.
