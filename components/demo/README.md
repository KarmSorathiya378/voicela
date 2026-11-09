# Interactive demo lab

Owned entry point: `app/demo/page.tsx`. All demo implementation lives here.

The desktop exposes Mail, Calendar, Files, Notes, and Browser as simulated tabs.
Nothing connects to an account, opens an actual document, or sends a message.

## Scenarios

- A: three suggested file intents, seeded index search, a read-only preview, not-found and scope-denied failures.
- B: seeded inbox message, full draft preview, explicit simulated-send approval, simulated sent state.
- C: seeded scheduling conflict, alternative time with timezone, approval, simulated insertion.
- D: explicit chart or paragraph context selection, visible scope highlight, source-limited explanation. Chart changes are computed from shared seed values.
- E: bonus filler removal with original/rewrite diff, explicit apply, and undo.

All scenarios support reset/replay, in-flight cancellation, unavailable-app failure injection, and recovery. Choosing another scenario cancels the current run and clears its simulated changes.

## State machine

`machine.ts` is a pure reducer: `idle → listening → thinking → acting → completed/error`. B, C, and E pause at `awaiting-approval`, then return through `acting` only after `APPROVE`. `FINISH` cannot mutate without approval. Here, `listening` means reading submitted intent; it does not start microphone capture.

The client owns one phase timer and cleans it up on every phase change. The reducer also rejects stale/out-of-order actions. Reset returns fresh seeded state. Cancel clears pending approval and returns idle; repeated approval cannot duplicate an action.

File prompts deterministically query the index. Other scenarios explicitly replay fixed seeded tasks; they do not pretend to interpret arbitrary natural language.

## Dependencies

Uses every shared UI/layout/motion contract plus consent-gated `track` and `EVENTS`. `seeds.ts` normalizes all four shared `lib/data/demo-*` modules. No shared import fallback remains. Only the bonus dictation note and launch paragraph are demo-specific local fixtures. No edits to shared components, data, globals, or config are needed here.

## Input and accessibility

Typed input is the default and works without speech APIs. Optional browser SpeechRecognition starts only on an explicit microphone action, stops on request/timeout/reset/unmount, and supplies a reviewable transcript. Permission denial or unavailable recognition retains typed input. Browsers may use a remote speech provider; this is disclosed before activation. Approval has a native keyboard button with focus moved to it. Status captions use a polite live region. Progress has an accessible label. Motion is removed under `prefers-reduced-motion`.

## Verification

`node --test components/demo/machine.test.cjs` covers intent lookup, both file errors, gates, duplicate approval, stale transitions, cancellation, reset, every scenario's failure/recovery, context source, and undo.

`node components/demo/browser.test.mjs <path-to-design-skill/scripts/lib/cdp.mjs>` exercises A–E in local Chromium, keyboard approval, error recovery, cancellation, undo, responsive overflow, and reduced motion. Screenshots are written to the temporary `voicela-demo-qa` directory by default. Browser microphone permission is optional and is not required for tests.

The stylesheet uses the `v-demo-` prefix to keep selectors isolated. `style-names.ts` supplies explicit class names because the initial project-wide Tailwind Turbopack loader rewrites CSS-module filenames and drops their exported class maps.

Run `npm run build` and `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/demo` for the project acceptance checks.
