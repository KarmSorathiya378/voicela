import { useCallback, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { api } from "./api";
import { EnginePanel, useIntentEngine } from "./features/engine";
import { SpeechPanel, type SpeechPhase } from "./features/speech";
import AppShell from "./ui/AppShell";

export default function App() {
  const engine = useIntentEngine();
  const captureSync = useRef<Promise<unknown>>(Promise.resolve());

  // Capture → shell contract: serialize capture phases into Rust (set_state) in
  // event order. The intent engine owns thinking/acting/approval states.
  const handleCapturePhase = useCallback((phase: SpeechPhase) => {
    if (!isTauri()) return;
    captureSync.current = captureSync.current
      .then(() => api.setState(phase))
      .catch(() => undefined);
  }, []);

  return (
    <AppShell
      speechPanel={
        <SpeechPanel
          onTranscriptReady={async transcript => {
            await captureSync.current;
            engine.onTranscriptReady(transcript);
          }}
          onPhaseChange={handleCapturePhase}
          disabled={engine.isActive}
        />
      }
      enginePanel={<EnginePanel engine={engine} />}
    />
  );
}
