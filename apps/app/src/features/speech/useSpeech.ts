import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api } from "../../api";
import { isTauri } from "@tauri-apps/api/core";
import type { Recognition, RecognitionConstructor, SpeechPanelProps, SpeechPhase } from "./types";

function readNumber(key: string, fallback: number) {
  try { const raw = localStorage.getItem(`voicela.${key}`); const value = Number(raw); return raw !== null && Number.isFinite(value) ? Math.max(key === "sensitivity" ? 0 : 900, Math.min(key === "sensitivity" ? 100 : 3000, value)) : fallback; } catch { return fallback; }
}
import { classifyTurn, cleanTranscript } from "./reliability";
const shortcut = "Control+Space";
function recognitionConstructor(): RecognitionConstructor | undefined {
  const host = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}

export function useSpeech({ onPhaseChange, onSpeechReady, onDictationReady, language = "en-US", disabled = false, formatTranscript }: SpeechPanelProps) {
  const native = isTauri();
  const supported = native || Boolean(recognitionConstructor());
  const nativeSession = useRef<{ ready: Promise<void>; stopping: boolean; prefix: string; dictation: boolean; routed: boolean } | null>(null);
  const deliveringSpeech = useRef(false);
  const [sensitivity, setSensitivity] = useState(() => readNumber("sensitivity", 50));
  const [silenceMs, setSilenceMs] = useState(() => readNumber("silenceMs", 1500));
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const testCancel = useRef(false);
  const [continuous, setContinuous] = useState(false);
  const continuousId = useRef<string | null>(null);
  const continuousStarting = useRef(false);
  const shortcutHeld = useRef(false);
  const listeners = useRef<UnlistenFn[]>([]);
  const deliveries = useRef<Promise<void>>(Promise.resolve());
  const [devices, setDevices] = useState<{ id: number; name: string }[]>([]);
  const [deviceId, setDeviceId] = useState(4294967295);
  const [nativeLanguage, setNativeLanguage] = useState("en");
  const [modelReady, setModelReady] = useState(false);
  const [level, setLevel] = useState(0);
  const [dictation, setDictation] = useState(false);
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
  const callbacks = useRef({ onPhaseChange, onSpeechReady, onDictationReady, disabled, permission, language, dictation, deviceId, nativeLanguage, sensitivity, silenceMs, formatTranscript, testing });
  callbacks.current = { onPhaseChange, onSpeechReady, onDictationReady, disabled, permission, language, dictation, deviceId, nativeLanguage, sensitivity, silenceMs, formatTranscript, testing };

  const changePhase = useCallback((next: SpeechPhase) => {
    if (!mounted.current) return;
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
    const session = nativeSession.current;
    if (session) {
      if (session.stopping) return;
      session.stopping = true;
      clearTimeout(timeout.current);
      timeout.current = undefined;
      changePhase("transcribing");
      void session.ready.then(() => api.stopSpeech()).then(async result => {
        if (!mounted.current || nativeSession.current !== session) return;
        const cleaned = cleanTranscript(result.text);
        const output = callbacks.current.formatTranscript?.(cleaned) ?? cleaned;
        if (output) replaceText([session.prefix, output].filter(Boolean).join(" "), session.dictation);
        setMessage(result.insertion_error ?? (result.needs_review ? "Speech was unclear. Review the transcript before using it; nothing was run or inserted." : result.inserted ? "Dictation sent to the focused app. A copy is kept below." : result.text ? "Transcript ready. Review your words below." : "No speech detected. Check your input device and try speaking for a few seconds."));
        // Finish capture before submitting: engine execution owns the next state.
        deliveringSpeech.current = true;
        nativeSession.current = null;
        changePhase("idle");
        if (output.trim() && session.dictation && session.routed && !result.needs_review && !result.insertion_error) {
          await callbacks.current.onDictationReady?.(output);
        }
        if (result.text && !session.dictation && !result.insertion_error && !result.needs_review) {
          await callbacks.current.onSpeechReady?.(output);
          if (mounted.current && callbacks.current.onSpeechReady) setMessage("Voice command submitted. See the action result below.");
        }
      }).catch(error => { if (mounted.current) setMessage(String(error)); })
        .finally(() => {
          deliveringSpeech.current = false;
          if (nativeSession.current === session) { nativeSession.current = null; if (mounted.current) changePhase("idle"); }
        });
      return;
    }
    const active = recognition.current;
    if (!active || timeout.current !== undefined) return;
    changePhase("transcribing");
    timeout.current = setTimeout(() => {
      if (recognition.current !== active) return;
      recognition.current = null;
      timeout.current = undefined;
      active.abort();
      setInterim("");
      changePhase("idle");
      setMessage("Speech service did not finish. Review captured text or continue typing.");
    }, 8000);
    try { active.stop(); } catch { active.abort(); }
  }, [changePhase, replaceText]);

  const start = useCallback(() => {
    if (deliveringSpeech.current || nativeSession.current || recognition.current || callbacks.current.disabled || callbacks.current.permission !== "enabled") return;
    if (native) {
      if (!callbacks.current.dictation) replaceText("");
      changePhase("starting");
      setMessage("Starting Windows microphone. Speak when Listening appears.");
      const session = { ready: api.startSpeech(callbacks.current.dictation, { deviceId: callbacks.current.deviceId, language: callbacks.current.nativeLanguage, ...{deferInsertion: Boolean(callbacks.current.onDictationReady)} }), stopping: false, prefix: callbacks.current.dictation ? textRef.current.trimEnd() : "", dictation: callbacks.current.dictation, routed: Boolean(callbacks.current.onDictationReady) };
      nativeSession.current = session;
      void session.ready.then(() => {
        if (!mounted.current) { if (!session.stopping) void api.stopSpeech(true).catch(() => undefined); return; }
        if (!session.stopping) { timeout.current = setTimeout(stop, 60_000); changePhase("listening"); setMessage("Recording from your selected microphone. Release or select Stop to transcribe with Whisper."); }
      }).catch(error => {
        if (nativeSession.current === session) nativeSession.current = null;
        if (mounted.current) { setMessage(String(error)); changePhase("idle"); }
      });
      return;
    }
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const active = new Constructor();
    const prefix = textRef.current.trimEnd();
    let captured = "";
    active.continuous = true;
    active.interimResults = true;
    active.lang = callbacks.current.nativeLanguage === "auto" ? callbacks.current.language : callbacks.current.nativeLanguage;
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
      timeout.current = undefined;
      active.abort();
      setInterim("");
      changePhase("idle");
    };
    active.onend = () => {
      if (!current()) return;
      recognition.current = null;
      clearTimeout(timeout.current);
      timeout.current = undefined;
      setInterim("");
      changePhase("idle");
    };
    try { active.start(); } catch {
      recognition.current = null;
      changePhase("idle");
      setMessage("Speech could not start in this environment. Please type your instruction.");
    }
  }, [changePhase, replaceText, native, stop]);

  // This function is invoked by the Enable microphone button only. Never on mount or shortcut.
  async function enable() {
    if (!supported || callbacks.current.permission === "requesting") return;
    setPermission("requesting");
    try {
      if (native) {
        // A real device check, requested explicitly by the microphone button.
        await api.startSpeech(false, { deviceId, language: nativeLanguage });
        await api.stopSpeech(true);
        if (!mounted.current) return;
        setPermission("enabled");
        setMessage("Microphone ready. Check the input meter while speaking. Whisper will transcribe locally after you stop.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is unavailable in this environment.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      if (!mounted.current) return;
      setPermission("enabled");
      setMessage("Microphone enabled for this session. Hold to talk when ready.");
    } catch (error) {
      if (!mounted.current) return;
      setPermission("denied");
      setMessage(`Microphone could not be enabled: ${String(error)}`);
    }
  }

  useEffect(() => { setNativeLanguage(language.split("-")[0]); }, [language]);

  useEffect(() => {
    if (disabled && (recognition.current || nativeSession.current)) stop();
  }, [disabled, stop]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      testCancel.current = true;
      const session = nativeSession.current;
      if (session && !session.stopping) {
        session.stopping = true;
        void session.ready.then(() => api.stopSpeech(true)).catch(() => undefined);
      }
      const active = recognition.current;
      recognition.current = null;
      if (active) { active.onend = null; active.onerror = null; active.onresult = null; active.abort(); }
      clearTimeout(timeout.current);
      timeout.current = undefined;
    };
  }, []);



  useEffect(() => {
    if (!native) return;
    let disposed = false;
    void api.speechDevices().then(result => {
      if (disposed) return;
      setDevices(result.devices); setModelReady(result.modelReady);
      try {
        const savedName = localStorage.getItem("voicela.microphone");
        setDeviceId(result.devices.find(device => device.name === savedName)?.id ?? 4294967295);
        const savedLanguage = localStorage.getItem("voicela.speechLanguage");
        if (language !== "en-US") setNativeLanguage(language.split("-")[0]);
        else if (savedLanguage && ["en", "auto", "hi", "gu"].includes(savedLanguage)) setNativeLanguage(savedLanguage);
      } catch { /* Storage can be unavailable. Keep defaults. */ }
      if (!result.modelReady) setMessage("Offline Whisper model is missing. Reinstall Voicela or run pnpm speech:setup for development.");
    }).catch(error => { if (!disposed) setMessage(String(error)); });
    return () => { disposed = true; };
  }, [native]);

  useEffect(() => {
    if (!native || (phase !== "listening" && !testing)) { setLevel(0); return; }
    let disposed = false;
    const timer = setInterval(() => { void api.speechLevel().then(value => { if (!disposed) setLevel(value); }).catch(() => undefined); }, 150);
    return () => { disposed = true; clearInterval(timer); };
  }, [native, phase, testing]);
  const pauseListening = useCallback(async () => {
    continuousId.current = null;
    listeners.current.splice(0).forEach(unlisten => unlisten());
    if (mounted.current) { setContinuous(false); changePhase("idle"); setMessage("Listening paused. No new utterances will run."); }
    await api.stopListening();
  }, [changePhase]);

  useEffect(() => {
    const emergencyStop = () => {
      testCancel.current = true;
      const session = nativeSession.current;
      nativeSession.current = null;
      if (session) {
        session.stopping = true;
        void session.ready.then(() => api.stopSpeech(true)).catch(() => undefined);
      }
      const active = recognition.current;
      recognition.current = null;
      active?.abort();
      clearTimeout(timeout.current);
      timeout.current = undefined;
      setInterim("");
      if (native) void pauseListening().catch(error => setMessage(String(error)));
      else changePhase("idle");
    };
    window.addEventListener("voicela:emergency-stop", emergencyStop);
    return () => window.removeEventListener("voicela:emergency-stop", emergencyStop);
  }, [native, pauseListening, changePhase]);

  const startListening = useCallback(async () => {
    if (!native || callbacks.current.testing || continuousId.current || continuousStarting.current) return;
    continuousStarting.current = true;
    const routeDictation = Boolean(callbacks.current.onDictationReady);
    const id = crypto.randomUUID(); continuousId.current = id;
    changePhase("starting"); setMessage("Opening your microphone for continuous listening...");
    try {
      let lastSequence = 0;
      type Turn = { sessionId: string; sequence: number; latencyMs?: number; text: string; needs_review: boolean; inserted?: boolean; insertion_error?: string; error?: string };
      const onTurn = await listen<Turn>("listening-transcript", event => {
        deliveries.current = deliveries.current.then(async () => {
          const result = event.payload;
          if (!mounted.current || continuousId.current !== id || result.sessionId !== id) return;
          const delivery = classifyTurn(lastSequence, result.sequence);
          if (delivery === "duplicate") return;
          if (delivery === "gap") { await pauseListening(); setMessage("A speech turn was missing or arrived out of order. Listening paused; review your transcript and restart."); return; }
          lastSequence = result.sequence;
          setLatencyMs(result.latencyMs ?? null);
          if (result.error) { setMessage(result.error); return; }
          if (!result.text.trim()) return;
          const clean = callbacks.current.formatTranscript?.(cleanTranscript(result.text)) ?? cleanTranscript(result.text);
          replaceText(clean);
          if (!clean.trim()) return;
          const command = result.text.trim().toLowerCase().replace(/[.!?]+$/, "");
          if (["stop listening", "pause listening", "microphone off"].includes(command)) { await pauseListening(); return; }
          if (result.needs_review || result.insertion_error) { setMessage(result.insertion_error || "Unclear speech retained for review. Listening continues."); return; }
          if (callbacks.current.dictation) { if (routeDictation) await callbacks.current.onDictationReady?.(clean); setMessage(result.inserted ? "Text inserted. Listening continues." : "Transcript ready. Listening continues."); return; }
          try { await callbacks.current.onSpeechReady?.(clean); if (continuousId.current === id) setMessage("Command processed. Listening for your next sentence."); }
          catch (error) { if (continuousId.current === id) setMessage(`Heard: ${result.text}. ${String(error)}`); }
        }).catch(error => { if (continuousId.current === id) setMessage(String(error)); });
      });
      listeners.current.push(onTurn);
      const onEnd = await listen<{sessionId: string; error?: string}>("listening-ended", event => {
        if (continuousId.current !== id || event.payload.sessionId !== id) return;
        void pauseListening().then(() => { if (mounted.current) setMessage(event.payload.error || "Listening ended."); });
      });
      listeners.current.push(onEnd);
      if (continuousId.current !== id || !mounted.current) { listeners.current.splice(0).forEach(unlisten => unlisten()); return; }
      await api.startListening(id, callbacks.current.dictation, {deviceId: callbacks.current.deviceId, language: callbacks.current.nativeLanguage, ...{sensitivity: callbacks.current.sensitivity, silenceMs: callbacks.current.silenceMs, deferInsertion: routeDictation}});
      if (continuousId.current !== id || !mounted.current) { await api.stopListening(); return; }
      setPermission("enabled"); setContinuous(true); changePhase("listening"); setMessage("Listening continuously. Speak a command, then pause briefly. Say pause listening to switch the microphone off.");
    } catch (error) {
      if (continuousId.current === id) { await pauseListening().catch(() => undefined); if (mounted.current) setMessage(String(error)); }
    } finally { continuousStarting.current = false; }
  }, [native, pauseListening, replaceText, changePhase]);

  useEffect(() => {
    // A reloaded view has no owner/session ID for an older native capture.
    if (native) void api.stopListening().catch(() => undefined);
    return () => {
      continuousId.current = null;
      listeners.current.splice(0).forEach(unlisten => unlisten());
      void api.stopListening().catch(() => undefined);
    };
  }, [native]);
  useEffect(() => {
    if (!native || !supported) return;
    let disposed = false; let unregister: (() => Promise<void>) | undefined;
    const registration = (async () => {
      try {
        const plugin = await import("@tauri-apps/plugin-global-shortcut");
        if (disposed) return;
        await plugin.register(shortcut, event => {
          if (disposed) return;
          if (event.state !== "Pressed") { shortcutHeld.current = false; return; }
          if (shortcutHeld.current) return;
          shortcutHeld.current = true;
          if (continuousId.current) void pauseListening(); else void startListening();
        });
        unregister = () => plugin.unregister(shortcut);
        if (!disposed) setShortcutMessage("Ctrl+Space switches continuous listening on or off. No holding or Stop and run needed.");
      } catch { if (!disposed) setShortcutMessage("Use Start listening / Pause listening; Ctrl+Space is unavailable or already in use."); }
    })();
    return () => { disposed = true; void registration.then(() => unregister?.()).catch(() => undefined); };
  }, [native, supported, startListening, pauseListening]);
  useEffect(() => {
    if (!native) return;
    let disposed = false;
    let actions = Promise.resolve();
    const registration = listen<string>("panel-action", event => {
      actions = actions.then(async () => {
        if (disposed) return;
        const action = event.payload;
        if (action === "pause") await pauseListening();
        else if (action === "toggle") {
          if (continuousId.current) await pauseListening(); else await startListening();
        } else if (["assistant", "dictation", "edit"].includes(action)) {
          await pauseListening();
          if (!disposed) setDictation(action !== "assistant");
        }
      }).catch(error => { if (!disposed) setMessage(String(error)); });
    });
    void registration.catch(error => { if (!disposed) setMessage(`Panel controls unavailable: ${String(error)}`); });
    return () => { disposed = true; void registration.then(unlisten => unlisten()).catch(() => undefined); };
  }, [native, pauseListening, startListening]);
  function chooseDevice(id: number) {
    setDeviceId(id);
    try { localStorage.setItem("voicela.microphone", devices.find(device => device.id === id)?.name ?? ""); } catch { /* Optional preference storage. */ }
  }
  function chooseLanguage(value: string) {
    setNativeLanguage(value);
    try { localStorage.setItem("voicela.speechLanguage", value); } catch { /* Optional preference storage. */ }
  }

  async function testMicrophone() {
    if (testing || continuousId.current || nativeSession.current || recognition.current) return;
    setTesting(true); testCancel.current = false; setMessage("Microphone check: speak for five seconds. No transcription or actions run.");
    let opened = false;
    let peak = 0;
    try {
      await api.startSpeech(false, {deviceId, language: nativeLanguage}); opened = true;
      const end = Date.now() + 5000;
      while (mounted.current && !testCancel.current && Date.now() < end) { peak = Math.max(peak, await api.speechLevel()); await new Promise(resolve => setTimeout(resolve, 100)); }
      if (mounted.current) setMessage(peak > 0.025 ? "Microphone check complete: input signal detected. No audio was transcribed or saved." : "No clear microphone signal detected. Select another input, move closer, or check Windows microphone permissions.");
    } catch (error) { if (mounted.current) setMessage(String(error)); }
    finally { if (opened) await api.stopSpeech(true).catch(() => undefined); if (mounted.current) setTesting(false); }
  }
  useEffect(() => {
    if (!native) return;
    let disposed = false;
    let lastCheck = Date.now();
    const refresh = async () => {
      const resumed = Date.now() - lastCheck > 10000; lastCheck = Date.now();
      if (resumed && continuousId.current) { await pauseListening(); setMessage("PC resumed or microphone monitoring was interrupted. Check your input and start listening again."); }
      try {
        const result = await api.speechDevices();
        if (disposed) return;
        const topologyChanged = devices.length > 0 && JSON.stringify(devices) !== JSON.stringify(result.devices);
        setDevices(result.devices);
        if (topologyChanged && continuousId.current) { await pauseListening(); setMessage("Audio devices changed. Check your selected input and start listening again."); }
        if (deviceId !== 4294967295 && !result.devices.some(device => device.id === deviceId && device.name === devices.find(old => old.id === deviceId)?.name)) {
          if (continuousId.current) await pauseListening();
          setDeviceId(4294967295); setMessage("Microphone changed. Check the Windows default input, then start listening again.");
        }
      } catch { /* Capture watchdog reports stalled devices. */ }
    };
    const timer = setInterval(() => void refresh(), 3000);
    const visibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { disposed = true; clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [native, deviceId, devices, pauseListening]);
  function tune(key: "sensitivity" | "silenceMs", value: number) {
    if (key === "sensitivity") setSensitivity(value); else setSilenceMs(value);
    try { localStorage.setItem(`voicela.${key}`, String(value)); } catch { /* Preferences are optional. */ }
  }
  return { testing, testMicrophone, stopTest: () => { testCancel.current = true; }, sensitivity, silenceMs, tune, latencyMs, continuous, startListening, pauseListening, devices, deviceId, chooseDevice, nativeLanguage, chooseLanguage, modelReady, level, text, interim, phase, permission, supported, message, shortcutMessage, undoCount, native, dictation, setDictation, starting: phase === "starting", replaceText, undo, start, stop, enable };
}
