# Screen and application context

This slice owns `src/features/context/**`, `src-tauri/src/context_bridge.rs`, and the embedded `src-tauri/src/context_ocr.ps1` helper. Capture is off by default and never starts from a voice request alone.

## Capture and privacy

`ContextPanel` selects the remembered foreground window through `context_bind`. The user must enable that exact window. A separate unchecked screenshot consent grants pixel access for the current session only. `context_read` defaults to accessibility labels; `source: 'ocr'` is rejected without screenshot consent. Stop/clear, changing permission, hiding/unmounting the panel, or excluding the window invalidate all pending JS results. Rust generations invalidate native results and terminate an in-flight OCR helper (checked every 40 ms). Accessibility traversal also checks cancellation between elements. There is no recurring/background screenshot loop.

Window bindings contain HWND, process ID and title. Native checks reject changed/reused windows, our own process, protected desktops and excluded processes. Existing adapter policy is checked before/after capture and throughout OCR startup/inference. Nonempty allow lists restrict capture; application exclusions win. The panel edits the existing persisted executable-basename policy through the adapter API. Window exclusions are session-only.

Accessibility reads skip entire password, editable, offscreen and sensitive-labelled subtrees before reading their contents. OCR verifies the UI Automation raw tree before copying pixels, rejects password controls anywhere in the window, and rejects editable or sensitive-labelled controls intersecting the region. Unverifiable properties/traversal limits fail closed. Region coordinates are physical pixels relative to the window frame's top left; dimensions are 1–4096 and must fit inside the window. Windows OCR's own maximum dimensions are checked too.

OCR uses the installed **Windows.Media.Ocr.OcrEngine** and user-profile language packs via a fixed embedded Windows PowerShell/.NET helper. There is no downloaded OCR binary, cloud OCR or new Cargo dependency. A visible, topmost native capture indicator appears at the monitor's bottom edge before pixel access. It remains until OCR completes or the process is cancelled. GDI `BitBlt` reads only the approved rectangle into an in-memory bitmap; it never captures the rest of the window to crop later. DPI awareness keeps pixel and UIA coordinates consistent. Intersecting windows above the target cause refusal before/after pixel access, rather than capturing their content. Fullscreen windows overlapping the indicator must use an unobscured region. Pixels are encoded to PNG in memory solely for WinRT decoding, then disposed; neither pixels nor text are written to disk or history. Missing OCR languages produce an actionable error. Only bounded OCR text crosses IPC.

Sensitive-field protection relies on accurate accessibility metadata from the target application. Custom-drawn applications can hide or mislabel secrets, and screen changes cannot be made atomic with UIA inspection. Post-capture safety checks discard results after detected changes, but cannot guarantee semantic detection of every secret in arbitrary page prose. Exclude sensitive applications, and do not opt in to capturing them. This is not an absolute content DLP guarantee.

## Summary/engine contract

Import `handlePageContextIntent`, `summarizeThisPage`, `validatePageContext`, `pageContext`, `PageSummaryRequest` and `PageAnswer` from `features/context`.

- `handlePageContextIntent(utterance, answer?)` accepts only explicit “Summarize this page”/“Summarize the current page” (including UK spelling), returning `Promise<string | null>`; null means another engine route owns the intent. Missing/disabled/stale context throws a recoverable error. It never grants capture permission.
- `summarizeThisPage(answer)` sends `{ intent: 'summarize-this-page', instruction, untrustedText, context }` to a typed `PageAnswer` callback. Context includes binding, native capture ID, source, region, timestamp, permission generation, and `trust: 'untrusted'`. Supply the instruction separately from quoted page data. Consumers must not promote page text or answers into tools, system messages, approvals, navigation, or application actions.
- The default `localPageAnswer` is real deterministic **extractive** summarization: up to five ranked, original-order page sentences, each bounded to 600 characters. It is not generative reasoning. A model-backed answer provider can be injected with `<ContextPanel onSummarize={answerProvider} />` or the intent adapter. This slice introduces no model, network endpoint or tool authority.
- Before inference and again before publishing the answer, the native bridge verifies the selected window and adapter policy, then recaptures the same source/region and compares text. Native snapshot IDs are single-current-capture identifiers, with a 30-second lifetime that validation never refreshes. A changed title/process, replaced capture, changed text, revoked permission, clock rollback (JS), or expired context rejects the result. OCR validation deliberately performs another indicated screenshot. No answer is automatically acted upon.

Captured text, source, time and character count appear in the panel as plain text. The summary is also rendered as text, never HTML. Snapshot text is memory-only and bounded to 24,000 characters. Returned summaries must remain untrusted if consumed elsewhere.

Shell integration: Lark mounted `ContextPanel` in the workspace and added the global `page_context` privacy gate. That grant is required in addition to window consent and separate screenshot consent. Revocation is checked during OCR cancellation polling and between accessibility elements, as well as before/after reads; a denied read clears the native binding, screenshot consent and snapshot. The panel also stops and clears context on `voicela:emergency-stop`. Engine/speech owners can route the summary intent to `handlePageContextIntent`; automatic voice routing and a model-backed answer provider are not supplied by this slice.

## Verification

From `apps/app`: `npm run build`.
From `apps/app/src-tauri`: `cargo build` and `cargo test`.
From `apps/app`: `node --test src/features/context/context.test.mjs`.
On an interactive Windows desktop: `powershell -NoProfile -File src/features/context/native-ocr.test.ps1`.

The native fixture verifies real whole-window OCR, rectangle cropping without outside pixels, obscured-window refusal, editable-field refusal, a safe region outside inputs, and password-field refusal. It exercises the same embedded helper and encoded-command launch as production. It does not grant the desktop app's own permission or test the Tauri IPC UI end to end. Rust tests cover separate screenshot consent, disabling, generation invalidation, exclusions, and region bounds. JS tests cover cancellation, untrusted summary data, stale generations/time/window identity and intent routing. Browser visual QA could not run because no browser surfaces were available in this session.

Verified in this session (2026-11-11): `npm run build` exit 0; `cargo build` exit 0; `cargo test` exit 0 (28 passed, 4 pre-existing microphone/catalogue tests ignored); JS context tests 4/4 passed; interactive native OCR fixture 6/6 passed. No external app integration or browser visual pass is claimed.

After shell/privacy integration: `npm run build` and `cargo build` exit 0; `cargo test` exits 0 (34 unit tests plus 1 privacy-history integration test passed, 4 existing tests ignored); all 4 context JS tests pass. Privacy denial assertions verify that native window/screenshot consent is cleared.
