import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { Recognition, RecognitionConstructor, SpeechPanelProps, SpeechPhase } from "./types";

const shortcut = "Control+Space";
function recognitionConstructor(): RecognitionConstructor | undefined {
  const host = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}

export function useSpeech({ onPhaseChange, language = "en-US", disabled = false }: SpeechPanelProps) {
  const supported = Boolean(recognitionConstructor());
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [phase, setPhase] = useState<SpeechPhase>("idle");
  const [permission, setPermission] = useState<"off" | "requesting" | "enabled" | "denied">("off");
  const [message, setMessage] = useState("");
  const [shortcutMessage, setShortcutMessage] = useState("");
  const [undoCount, setUndoCount] = useState(0);
  const history = useRef<string[]>([]);
  const textRef = useRef("");
  const recognition = useRef<Recognition | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const callbacks = useRef({ onPhaseChange, disabled, permission, language });
  callbacks.current = { onPhaseChange, disabled, permission, language };

  const changePhase = useCallback((next: SpeechPhase) => {
    setPhase(next);
    callbacks.current.onPhaseChange?.(next);
  }, []);
  const replaceText = useCallback((next: string, remember = true) => {
    if (next === textRef.current) return;
    if (remember) {
      history.current = [...history.current.slice(-99), textRef.current];
      setUndoCount(history.current.length);
    }
    textRef.current = next;
    setText(next);
  }, []);
  const undo = () => {
    const previous = history.current.pop();
    if (previous !== undefined) replaceText(previous, false);
    setUndoCount(history.current.length);
  };

  const stop = useCallback(() => {
    const active = recognition.current;
    if (!active) return;
    changePhase("transcribing");
    try { active.stop(); } catch { active.abort(); }
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      if (recognition.current !== active) return;
      recognition.current = null;
      active.abort();
      setInterim("");
      changePhase("idle");
      setMessage("Speech service did not finish. Review captured text or continue typing.");
    }, 8000);
  }, [changePhase]);

  const start = useCallback(() => {
    if (recognition.current || callbacks.current.disabled || callbacks.current.permission !== "enabled") return;
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const active = new Constructor();
    const prefix = textRef.current.trimEnd();
    let captured = "";
    active.continuous = true;
    active.interimResults = true;
    active.lang = callbacks.current.language;
    recognition.current = active;
    setMessage("");
    changePhase("listening");
    const current = () => mounted.current && recognition.current === active;
    active.onresult = event => {
      if (!current()) return;
      const final: string[] = [];
      const partial: string[] = [];
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        (result.isFinal ? final : partial).push(result[0].transcript.trim());
      }
      const next = final.join(" ");
      if (next !== captured) {
        // One undo checkpoint per recording, rather than one per recognition event.
        replaceText([prefix, next].filter(Boolean).join(" "), captured === "");
        captured = next;
      }
      setInterim(partial.join(" "));
    };
    active.onerror = event => {
      if (!current()) return;
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      if (denied) setPermission("denied");
      setMessage(denied ? "Microphone or speech service access was denied. Allow access in system settings, then enable again, or type below."
        : event.error === "no-speech" ? "No speech detected. Try again or type below."
        : `Speech recognition stopped (${event.error}). You can continue typing.`);
      recognition.current = null;
      clearTimeout(timeout.current);
      active.abort();
      setInterim("");
      changePhase("idle");
    };
    active.onend = () => {
      if (!current()) return;
      recognition.current = null;
      clearTimeout(timeout.current);
      setInterim("");
      changePhase("idle");
    };
    try { active.start(); } catch {
      recognition.current = null;
      changePhase("idle");
      setMessage("Speech could not start in this environment. Please type your instruction.");
    }
  }, [changePhase, replaceText]);

  // This function is invoked by the Enable microphone button only. Never on mount or shortcut.
  async function enable() {
    if (!supported || callbacks.current.permission === "requesting") return;
    setPermission("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is unavailable in this environment.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      if (!mounted.current) return;
      setPermission("enabled");
      setMessage("Microphone enabled for this session. Hold to talk when ready.");
    } catch {
      if (!mounted.current) return;
      setPermission("denied");
      setMessage("Microphone access is unavailable or denied. Check system permissions, retry, or type below.");
    }
  }

  useEffect(() => {
    if (disabled && recognition.current) stop();
  }, [disabled, stop]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const active = recognition.current;
      recognition.current = null;
      if (active) { active.onend = null; active.onerror = null; active.onresult = null; active.abort(); }
      clearTimeout(timeout.current);
    };
  }, []);

  useEffect(() => {
    if (permission !== "enabled" || !supported) return;
    if (!isTauri()) { setShortcutMessage("Global shortcut requires the desktop app. Use Hold to talk here."); return; }
    let disposed = false;
    let unregister: (() => Promise<void>) | undefined;
    const registration = (async () => {
      try {
        const plugin = await import("@tauri-apps/plugin-global-shortcut");
        if (disposed) return;
        await plugin.register(shortcut, event => {
          if (disposed) return;
          if (event.state === "Pressed") start(); else stop();
        });
        unregister = () => plugin.unregister(shortcut);
        if (!disposed) setShortcutMessage("Hold Ctrl+Space anywhere to talk. Release to stop.");
      } catch {
        if (!disposed) setShortcutMessage("Ctrl+Space could not be registered; it may be in use. Use Hold to talk.");
      }
    })();
    return () => {
      disposed = true;
      void registration.then(() => unregister?.()).catch(() => undefined);
    };
  }, [permission, supported, start, stop]);

  return { text, interim, phase, permission, supported, message, shortcutMessage, undoCount, replaceText, undo, start, stop, enable };
}
