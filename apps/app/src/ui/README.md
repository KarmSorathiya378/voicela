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

- Open app: Rust launches a fixed built-in alias or an exact Windows Start menu entry immediately; no second approval is required. App names are data, never shell code.
- Find file: bounded real filename search in Desktop, Documents and Downloads, including OneDrive; no sample index.
- Create note: Rust approval saves title/body atomically as an executed SQLite entry. Clearing history deletes saved notes.
- Browser search: after approval, opens an encoded search URL through the default browser.
- Calendar event and draft message: simulations with one-time approval. Nothing is created or sent.

Input/output for the latest manual request is displayed. Activity also stores execution results and matched file paths. Browser preview cannot run Windows tools.

All shell controls use native links, buttons, labels, selects and form submission, with visible keyboard focus. Layout collapses the activity rail below the workspace at narrow widths.
