import { useEffect, useState, useSyncExternalStore } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { api } from "../../api";
import { IntentEngine } from "./planner";

export function useIntentEngine() {
  const [controller] = useState(() => new IntentEngine(api));
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { if (isTauri()) void controller.connect(); }, [controller]);
  // Structurally matches speech's TranscriptReadyHandler without a runtime dependency.
  const onTranscriptReady = (transcript: string): void => {
    if (!controller.submitTranscript(transcript)) throw new Error(controller.getSnapshot().notice);
  };
  const isActive = view.busy || !!view.plan && !["completed", "cancelled"].includes(view.plan.status);
  return { ...view, controller, onTranscriptReady, isActive };
}

export type IntentEngineBinding = ReturnType<typeof useIntentEngine>;
