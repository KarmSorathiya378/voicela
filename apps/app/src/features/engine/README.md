# Intent engine

`useIntentEngine()` owns one serialized planner. Pass its `onTranscriptReady`
callback to `SpeechPanel` and the same binding to `<EnginePanel engine={engine} />`.
The callback implements the speech slice's `TranscriptReadyHandler` and throws on
rejection so reviewed text is retained. Typed text stages a visible plan; Run plan starts IPC. `executeSpoken` stages and runs a fresh spoken utterance automatically. Rust does not request a second approval for app launching; write and browser policies remain enforced. The parser supports these six deterministic rules:

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
ambiguous dates and unresolved references are rejected. The parser does not
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
