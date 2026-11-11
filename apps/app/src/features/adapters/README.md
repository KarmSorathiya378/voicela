# Adapter API for Ella and Lark

Import `adapter` from `features/adapters`.

`readSelectedText()` and `readAccessibleContent()` return `{binding, text, trust: 'untrusted', source: 'windows-uia'}`. Selection requires UIA TextPattern, bounded to 8 ranges / 8192 characters. Accessible content is visible labels, bounded to 500 elements / 80 labels, not OCR. Never promote retrieved text to instructions or approval; render as text, never HTML.

`applyText(binding,text)` and `act(binding,'click'|'scroll'|'key',target)` return the existing RunResponse. Present `awaiting_approval` and resolve through api.approveTool. Neither API auto-approves. Window/process/title bindings are rechecked. Unicode insertion replaces selection without Enter. Click requires an exact unique UIA label; no coordinate guessing. `launch(app)` uses native aliases / AppsFolder lookup through open_app permissions; no shell or arbitrary path.

`getPolicy/setPolicy({allowed,excluded})` persist executable basenames. Exclusions win; nonempty allowed list restricts access. Protected desktop, known credential apps, password fields/subtrees and unverifiable focus are rejected. Applications can mislabel fields; explicitly exclude sensitive apps.

Render FloatingPanel alone for ?panel and DesktopControls in the workspace. No speech hook lives in the panel. Main speech owner consumes panel-action events: toggle, pause, dictation, edit, assistant. SettingsPanel accepts speechSettings for Ella's mic/language/model controls.

Real: UI Automation reads/actions, Unicode insertion, native app lookup, policy persistence, tray menu, hide-on-close, always-on-top window, current-user Run-key startup, conflict-checked panel shortcuts. Model switching/download is outside this slice. Native tray/shortcut delivery and real-app UIA need manual verification. Build success is not an end-to-end native test.
Verification for this slice (2026-11-11): apps/app npm run build passed; cargo build passed; cargo test passed (22 passed, 4 environment-dependent tests ignored). Policy exclusion precedence and protected credential-app tests added. Native visual inspection, tray/shortcut interaction and real-app UIA remain manual checks. Panel/settings mount and speech-event consumption are integration responsibilities coordinated with Ember/Ella.
