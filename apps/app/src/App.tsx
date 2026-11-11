import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { api } from "./api";
import { EnginePanel, useIntentEngine } from "./features/engine";
import { SpeechPanel, type SpeechPhase } from "./features/speech";
import { listen } from "@tauri-apps/api/event";
import { DesktopControls, FloatingPanel } from "./features/panel";
import { TextWorkspace } from "./features/dictation";
import AppShell from "./ui/AppShell";

export default function App() {
  if (new URLSearchParams(window.location.search).has("panel")) return <FloatingPanel />;
  return <MainWorkspace />;
}

function MainWorkspace() {
  const engine = useIntentEngine();
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
            await captureSync.current;
            engine.onTranscriptReady(transcript);
          }}
          onSpeechReady={async transcript => {
            await captureSync.current;
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
      enginePanel={<EnginePanel engine={engine} />}
    />
  );
}
