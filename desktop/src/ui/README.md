# Desktop shell

`AppShell` is the default export from `AppShell.tsx`. Mount it in the application entry with these optional props:

```tsx
<AppShell
  speechPanel={<SpeechPanel {...speechProps} />}
  enginePanel={<EnginePanel engine={engine} />}
  state={currentState}
/>
```

The shell imports `shell.css`; the scaffold's `App.css` should not be imported alongside it. The two ReactNode slots preserve feature ownership. `state` can reflect immediate speech/engine updates; otherwise the shell polls `get_state`. `StateIndicator` covers all eight foundation states with text, SVG icons, and semantic color. No mock state is presented as desktop state.

The shell reads `get_tools` and `get_activity_log` through the shared API every two seconds, and refreshes after manual tool requests. Failed reads disconnect the indicator and disable desktop tool controls. Previously loaded history remains visible with the connection error.

`ToolRegistry` owns manual requests only. When an engine panel is mounted, approval controls are shown only for tokens created by manual tool requests, leaving engine plan advancement to the engine feature.

## Adapter truth

- Open app: calls foundation `run_tool`; approval and execution are simulated. No app opens.
- Find file: a searchable, explicitly fictional in-memory index. No filesystem is scanned.
- Create note: explicit save writes title/body through `append_activity_log` as a `client_note` in real local SQLite history. The UI never calls it a standalone file. The 2,048-byte foundation limit is enforced before invoking. Clearing history deletes saved notes.
- Browser search: calls foundation `run_tool`; simulated. No search URL opens in the foundation version.
- Calendar event and draft message: foundation simulations with one-time Rust approval. Nothing is created or sent.

Input/output for the most recent manual request is shown in the current session. SQLite activity payloads remain excluded except for notes explicitly saved into history. Browser preview supports sample search; persistent storage and Rust simulations require Tauri.

All shell controls use native links, buttons, labels, selects and form submission, with visible keyboard focus. Layout collapses the activity rail below the workspace at narrow widths.
