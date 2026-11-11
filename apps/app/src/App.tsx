import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { api } from "./api";
import { EnginePanel, useIntentEngine } from "./features/engine";
import { SpeechPanel, type SpeechPhase } from "./features/speech";
import { listen } from "@tauri-apps/api/event";
import { DesktopControls, FloatingPanel } from "./features/panel";
import { TextWorkspace } from "./features/dictation";
import AppShell from "./ui/AppShell";
import { GooglePanel } from "./features/integrations/GooglePanel";
import { WorkflowPanel } from "./features/workflows/WorkflowPanel";
import { ContextPanel } from "./features/context/ContextPanel";

export default function App() {
  if (new URLSearchParams(window.location.search).has("panel")) return <FloatingPanel />;
  return <MainWorkspace />;
}

function MainWorkspace() {
  const engine = useIntentEngine();
  const emergencyGeneration = useRef(0);
  useEffect(() => {
    const stop = () => { emergencyGeneration.current++; void engine.controller.cancel(); };
    window.addEventListener("voicela:emergency-stop", stop);
    return () => window.removeEventListener("voicela:emergency-stop", stop);
  }, [engine.controller]);
  const [dictationTranscript, setDictationTranscript] = useState("");
  const textWorkspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const registration = listen<string>("panel-action", event => {
      if (!disposed && ["dictation", "edit"].includes(event.payload)) {
        textWorkspace.current?.scrollIntoView({ block: "start" });
        textWorkspace.current?.focus();
      }
    });
    return () => { disposed = true; void registration.then(unlisten => unlisten()).catch(() => undefined); };
  }, []);
  const captureSync = useRef<Promise<unknown>>(Promise.resolve());

  // Capture → shell contract: serialize capture phases into Rust (set_state) in
  // event order. The intent engine owns thinking/acting/approval states.
  const handleCapturePhase = useCallback((phase: SpeechPhase) => {
    if (!isTauri()) return;
    captureSync.current = captureSync.current
      .then(() => api.setState(phase === "starting" ? "listening" : phase))
      .catch(() => undefined);
  }, []);

  return (
    <AppShell
      speechPanel={<>
        <DesktopControls />
        <SpeechPanel
          onTranscriptReady={async transcript => {
            const generation = emergencyGeneration.current;
            await captureSync.current;
            if (generation !== emergencyGeneration.current) return;
            engine.onTranscriptReady(transcript);
          }}
          onSpeechReady={async transcript => {
            const generation = emergencyGeneration.current;
            await captureSync.current;
            if (generation !== emergencyGeneration.current) return;
            await engine.controller.handleListeningTurn(transcript);
          }}
          onDictationReady={transcript => {
            setDictationTranscript(previous => [previous, transcript].filter(Boolean).join("\n"));
          }}
          onPhaseChange={handleCapturePhase}
          disabled={engine.isActive}
        />
        <div ref={textWorkspace} tabIndex={-1} aria-label="Dictation and editing workspace">
          <TextWorkspace transcript={dictationTranscript} />
        </div>
      </>}
      enginePanel={<>
        <EnginePanel engine={engine} />
        <ContextPanel />
        <GooglePanel />
        <WorkflowPanel />
      </>}
    />
  );
}
