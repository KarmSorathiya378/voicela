import { useCallback } from "react";
import { api } from "./api";
import { EnginePanel, useIntentEngine } from "./features/engine";
import { SpeechPanel, type SpeechPhase } from "./features/speech";
import AppShell from "./ui/AppShell";

export default function App() {
  const engine = useIntentEngine();

  // Capture → shell contract: serialize capture phases into Rust (set_state) in
  // event order. The intent engine owns thinking/acting/approval states.
  const handleCapturePhase = useCallback((phase: SpeechPhase) => {
    void api.setState(phase).catch(() => undefined);
  }, []);

  return (
    <AppShell
      speechPanel={
        <SpeechPanel
          onTranscriptReady={engine.onTranscriptReady}
          onPhaseChange={handleCapturePhase}
          disabled={engine.isActive}
        />
      }
      enginePanel={<EnginePanel engine={engine} />}
    />
  );
}
