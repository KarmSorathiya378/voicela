# Dictation and editing contract

The desktop package moved from `desktop/` to `apps/app/` during this work.

Mount `TextWorkspace` once in AppShell and pass the current speech transcript as `transcript`.
It registers Ctrl+Shift+E to capture the external selection/caret before the user returns to Voicela.
The speech owner must deliver transcript text here without also performing native insertion.
The existing speech auto-insert path is not owned by this slice and must be disabled when routing here.

`TextAdapter` is the shared boundary. `capture` returns opaque selection token and plain text;
`replace` validates native token and returns a one-use undo receipt; `undo` checks target and
current document before restoring. All tokens expire after ten minutes and are in-memory only.
Native commands: `text_capture`, `text_replace({token,text})`, `text_undo({token})`.
The helper reuses Theo's `app_control::bind/execute` and app-exclusion checks.

Windows UIA text + value patterns are required. Password, disabled, read-only, ambiguous,
unsupported and oversized controls fail closed. Text/value disagreement fails closed. The
native helper performs plain text replacement using ValuePattern; rich formatting is not
preserved and the preview states this. No clipboard APIs are called, preserving all formats.
A dedicated COM worker serializes mutations; external application changes can still race UIA
calls because Windows exposes no cross-process compare-and-swap operation. Changed text,
selection, element, process, window or title is rejected before mutation. No raw Ctrl+Z.

`EditingSession` accepts an `EditProvider(text,instruction)` for a configured language model.
Instructions support shorten, grammar, professional and translate with target language.
The default conservative local provider offers literal shortening and punctuation/style
rules; it is not a general grammar model. Translation fails explicitly until a real provider
is supplied. Proposal rendering uses escaped React text, with deletions/insertions marked.
Apply is always explicit; stale tokens require recapture and a new proposal. Retry captures
again through the supplied adapter. Recovery text survives failed insertions in memory.

Verification:
- `node --test apps/app/src/features/dictation/dictation.test.mjs`
- `npm run build --prefix apps/app`
- `cargo build --manifest-path apps/app/src-tauri/Cargo.toml`

Manual native checks still required: Notepad/browser/Office/editor compatibility; password
rejection; clipboard with text/image/HTML before and after; focus/selection/document changes;
undo after external typing; shortcut collision and real microphone transcript handoff.
