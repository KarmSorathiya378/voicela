# Intent engine

`useIntentEngine()` owns one serialized planner. Pass its `onTranscriptReady`
callback to `SpeechPanel` and the same binding to `<EnginePanel engine={engine} />`.
The callback implements the speech slice's `TranscriptReadyHandler` and throws on
rejection so reviewed text is retained. Typed text stages a visible plan; Run plan starts IPC. `executeSpoken` stages and runs a fresh spoken utterance automatically. Rust does not request a second approval for app launching; write and browser policies remain enforced. The parser keeps these six deterministic tool grammars and recognizes natural request phrasing around them:

| Instruction | Tool | Required detail |
| --- | --- | --- |
| Find / locate my invoice | `find_file` | Literal query |
| Open / launch Notepad | `open_app` | App name |
| Create / make note Shopping: Buy milk | `create_note` | Title and body |
| Draft message to Maya saying Hello | `draft_message` | Recipient and body |
| Search the web for train times | `browser_search` | Query |
| Prepare / create / schedule calendar event Review from … to … | `calendar_event` | Title; ISO start/end with zones |

Join up to eight independent steps using `then`. Validation is atomic before
the first call. Sending, deleting, unknown instructions, incomplete fields,
ambiguous dates and unresolved references ask for details without staging a partial plan. The parser does not
invent message text, timestamps, identifiers, or prior-step output.

Plans progress through ready, running, awaiting-approval, paused, completed,
cancelled or error. Steps retain pending/running/awaiting-approval/simulated/
denied/cancelled/error status and exact input plus returned result. Stop waits for the
in-flight IPC call and prevents the next step. Resume skips returned steps and
never approves a request. Cancellation denies a pending Rust request and stops
the remaining chain. An uncertain IPC failure blocks replacement/retry until
cancellation reconciles with Rust. Reconnection recovers a pending approval
without replaying a tool.

IPC uses foundation `api.getState`, `setState("thinking" | "idle")`, `runTool`
and `approveTool`. Rust enforces tool permission policy and stores the approval
request; only the explicit Approve button calls `approveTool(id, true)`. IDs are
single-use and request-bound. Send/delete tools are not registered or executed.
Windows app launch, browser search, filename search and local notes return executed results. Calendar and message tools remain simulations. The planner rejects mismatched execution claims.

The panel keeps the latest 60 planner events in memory. Foundation SQLite stores
the core's approval and tool records. The planner's pending sequence is not
persisted across process restarts; only the live Rust pending approval can be
recovered in a remounted UI.

Verification: `node --test src/features/engine/engine.test.mjs` (Node 24),
`pnpm build`, and `cargo build` in `src-tauri`.


## Language understanding

`understanding.ts` is a local deterministic speech-act classifier and slot validator,
not a remote model. Request framing ("could you", "I need you to"), paraphrases
("get Calculator running", "where is my invoice", "look online for"), and the
position of content distinguish `action`, `dictation`, `editing`, and `question`.
A word such as "open" inside dictated text or a question does not request launch.
Explicit dictation builds the existing `control_app/type` input, subject to native
approval. Plain declarative prose asks whether to dictate rather than typing by
inference. Existing editing shortcuts work; generative editing asks for exact
source/replacement text because there is no selected-text or rewrite backend.
Questions ask whether the user wants an explicit web search; no local answer or
implicit browser action is fabricated. This is deliberately a bounded grammar,
not general-purpose language reasoning.

Missing fields produce a visible question via the existing notice and return
`false` to the transcript callback, retaining reviewed text. Supply a complete
instruction with the requested fields to continue. No placeholder recipient,
filename, message, time, or selected text is filled in. Sequences are atomic.
Tool field names, nonblank bounded text, control characters, supported app-control
operations, and calendar dates/order are checked before staging; staged fields
are checked again before running. Rust still validates inputs and owns permissions.

Follow-ups use only the latest plan's structured requests, never returned result
prose. "Use the other file" selects the other of exactly two distinct search
queries; otherwise it asks for a filename. It prepares another filename search;
there is no file-opening tool. "Change that to tomorrow" revises exactly one
unstarted calendar preview, retaining its explicit offset, wall-clock times, and
overnight duration. Tomorrow uses the current day in that offset. Multiple events,
missing context, and already returned event previews ask for details: there is no
update-existing-event tool. Running, paused, uncertain, and pending approval plans
must finish or be cancelled before replacement. "Cancel that" uses the existing
cancellation/reconciliation path, including denying native pending approval; during
IPC it waits for the result and prevents the next step. It never undoes returned
side effects. Completed/cancelled plans are never replayed by cancellation.

`parseIntent(raw, context?)` adds an optional structured context and `route` on
successful parses; unsuccessful parses may include `route`, `clarification`, or
`cancel`. Existing `supported`, `actions`, and `message` behavior remains intact.
`classifyIntent` is exported for consumers/tests. `useIntentEngine`, `EnginePanel`
props, `EngineView`, `Plan`, IPC payloads, and approval methods are unchanged.
All captured text and result prose remain untrusted data, not permission grants.
No network model, direct execution, or additional frontend authority is introduced.
