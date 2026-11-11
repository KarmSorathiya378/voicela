import { useId, useRef, useState } from "react";
import type { SpeechPanelProps } from "./types";
import { useSpeech } from "./useSpeech";
import "./speech.css";

export function SpeechPanel(props: SpeechPanelProps) {
  const [sending, setSending] = useState(false);
  const speech = useSpeech({ ...props, disabled: props.disabled || sending });
  const id = useId();
  const [feedback, setFeedback] = useState("");
  const submitting = useRef(false);
  const keyboardHeld = useRef(false);
  const recording = speech.phase !== "idle" || speech.starting;
  const unavailable = props.disabled || sending || speech.testing;

  const submitTranscript = speech.dictation && props.onDictationReady ? props.onDictationReady : props.onTranscriptReady;

  async function submit() {
    const transcript = speech.text.trim();
    if (!transcript || !submitTranscript || unavailable || recording || submitting.current) return;
    submitting.current = true;
    setSending(true);
    setFeedback("");
    try {
      await submitTranscript(transcript);
      setFeedback("Transcript submitted. Your text is kept here for reference.");
    } catch {
      setFeedback("Transcript could not be submitted. Your text is saved in this editor; please retry.");
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(speech.text);
      setFeedback("Transcript copied.");
    } catch {
      setFeedback("Copy is unavailable. Select the transcript and press Ctrl+C.");
    }
  }

  return <section className="speech-panel" aria-labelledby={`${id}-title`}>
    <div className="speech-heading">
      <div><h2 id={`${id}-title`}>Your next instruction</h2><p>Start listening once. Speak naturally and pause between commands; each sentence is analyzed automatically.</p></div>
      <span className="speech-state" role="status" aria-live="polite">
        {(recording || speech.testing) && <span className="speech-recording-dot" aria-hidden="true" />}
        {speech.testing ? "Microphone on ? Testing" : speech.starting ? "Starting microphone" : speech.phase === "listening" ? "Microphone on · Listening" : speech.phase === "transcribing" ? "Transcribing locally" : "Microphone off"}
      </span>
    </div>

    {speech.native && <label className="speech-mode" htmlFor={`${id}-mode`}>When I speak
      <select id={`${id}-mode`} disabled={recording || unavailable || speech.permission === "requesting"} value={speech.dictation ? "dictation" : "command"} onChange={event => speech.setDictation(event.target.value === "dictation")}>
        <option value="command">Run voice commands</option>
        <option value="dictation">{props.onDictationReady ? "Dictate for review" : "Dictate into the focused app"}</option>
      </select>
      {speech.dictation && <span className="speech-help">{props.onDictationReady ? "Dictation goes to the connected review workspace before insertion." : "Keep a text field focused while speaking."} Pauses finish each dictation turn. Pause listening before changing modes.</span>}
    </label>}
    <div className="speech-device-settings">
      {speech.native && <label htmlFor={`${id}-device`}>Microphone
        <select id={`${id}-device`} disabled={recording || unavailable} value={speech.deviceId} onChange={event => speech.chooseDevice(Number(event.target.value))}>
          {speech.devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}
        </select>
      </label>}
      <label htmlFor={`${id}-language`}>Speech language
        <select id={`${id}-language`} disabled={recording || unavailable} value={speech.nativeLanguage} onChange={event => speech.chooseLanguage(event.target.value)}>
          <option value="en">English</option><option value="auto">Auto / mixed languages</option><option value="hi">Hindi</option><option value="gu">Gujarati</option>
        </select>
      </label>
      {speech.native && <><label htmlFor={`${id}-sensitivity`}>Sensitivity: {speech.sensitivity}%
        <input id={`${id}-sensitivity`} type="range" min="0" max="100" disabled={recording || unavailable} value={speech.sensitivity} onChange={e => speech.tune("sensitivity", Number(e.target.value))} />
      </label>
      <label htmlFor={`${id}-silence`}>Pause before decoding: {speech.silenceMs / 1000} seconds
        <input id={`${id}-silence`} type="range" min="900" max="3000" step="100" disabled={recording || unavailable} value={speech.silenceMs} onChange={e => speech.tune("silenceMs", Number(e.target.value))} />
      </label>
      <div className="speech-actions"><button type="button" disabled={recording || unavailable} onClick={() => void speech.testMicrophone()}>Test microphone</button>{speech.testing && <button type="button" onClick={speech.stopTest}>Stop microphone test</button>}</div>
      <div className="speech-input-level"><span id={`${id}-level`}>Input level {Math.round(speech.level * 100)}%</span><meter aria-labelledby={`${id}-level`} min={0} max={1} value={speech.level} /><p className="speech-help">{speech.modelReady ? "Whisper small is ready. Audio stays on this PC; temporary recordings are deleted after transcription." : "Preparing offline speech engine?"} If the meter stays at zero while you speak, choose another microphone.</p></div></>}
    </div>
    {!speech.supported ? <p className="speech-notice">Speech recognition is unavailable in this app environment. Type your instruction below; all transcript tools still work.</p>
      : <>
        <p className="speech-help" id={`${id}-privacy`}>Start a listening session when ready. {speech.native ? "Offline Whisper transcribes your selected microphone in the language above. Enabling checks that input device briefly." : "The browser speech service may process audio online."} The microphone remains on until you pause listening or close the app. Short pauses finish utterances; transcription and command processing happen in the background.</p>
        {speech.native ? <div className="speech-actions">
          {!speech.continuous && !speech.starting && <button type="button" disabled={!speech.modelReady || speech.testing} onClick={() => void speech.startListening()}>Start listening</button>}
          {(speech.continuous || speech.starting) && <button type="button" className="secondary" onClick={() => void speech.pauseListening()}>Pause listening</button>}
        </div> : <>
        <div className="speech-actions">
          {speech.permission !== "enabled" && <button type="button" disabled={speech.permission === "requesting" || unavailable || (speech.native && !speech.modelReady)} onClick={() => void speech.enable()}>
            {speech.permission === "requesting" ? "Requesting microphone…" : speech.permission === "denied" ? "Retry microphone access" : "Enable microphone"}
          </button>}
          <button type="button" className="secondary speech-talk" aria-describedby={`${id}-privacy ${id}-shortcut`}
            disabled={speech.permission !== "enabled" || unavailable || speech.phase === "transcribing"}
            onPointerDown={event => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              speech.start();
            }}
            onPointerUp={() => speech.stop()} onPointerCancel={() => speech.stop()} onLostPointerCapture={() => { if (speech.phase === "listening" || speech.starting) speech.stop(); }}
            onKeyDown={event => {
              if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                event.preventDefault(); keyboardHeld.current = true; speech.start();
              }
            }}
            onKeyUp={event => {
              if (event.key === " " || event.key === "Enter") { event.preventDefault(); keyboardHeld.current = false; speech.stop(); }
            }}
            onBlur={() => { if (keyboardHeld.current) { keyboardHeld.current = false; speech.stop(); } }}>
            {speech.starting ? "Starting - release to cancel" : speech.phase === "listening" ? "Listening · release to stop" : "Hold to talk"}
          </button>
          {speech.phase === "idle" && <button type="button" className="secondary" disabled={speech.permission !== "enabled" || unavailable} onClick={speech.start}>Start listening</button>}
          {speech.phase === "listening" && <button type="button" className="secondary" onClick={speech.stop}>{speech.dictation ? "Stop dictation" : "Stop and run"}</button>}
        </div>
        </>}
        <p className="speech-help" id={`${id}-shortcut`}>{speech.shortcutMessage || "Hold to talk also works with Space or Enter while the button is focused."}</p>
      </>}
    {speech.latencyMs !== null && <p className="speech-help">Last decode: {speech.latencyMs} ms. Timing stays in memory; no audio or transcript analytics are collected.</p>}
    {speech.message && <p className="speech-notice" role="status">{speech.message}</p>}

    <label htmlFor={`${id}-transcript`}>Editable transcript</label>
    <textarea id={`${id}-transcript`} value={speech.text} readOnly={recording}
      onChange={event => { speech.replaceText(event.currentTarget.value); setFeedback(""); }}
      placeholder="Type an instruction, or enable the microphone to dictate…" rows={5}
      aria-describedby={`${id}-editing`} />
    {speech.interim && <p className="speech-interim" aria-label="Live partial transcript">{speech.interim}</p>}
    <p className="speech-help" id={`${id}-editing`}>{recording ? "Listening is active. Pause listening to edit the transcript." : "Edit words and punctuation freely. Undo restores previous edits or the text before your last recording."}</p>
    <div className="speech-actions">
      <button type="button" disabled={!speech.text.trim() || recording || unavailable || !submitTranscript} onClick={() => void submit()}>{sending ? "Submitting…" : "Use transcript"}</button>
      <button type="button" className="secondary" disabled={!speech.undoCount || recording} onClick={speech.undo}>Undo</button>
      <button type="button" className="secondary" disabled={!speech.text} onClick={() => void copy()}>Copy</button>
      <button type="button" className="secondary" disabled={!speech.text || recording} onClick={() => { speech.replaceText(""); setFeedback(""); }}>Clear</button>
    </div>
    {!submitTranscript && <p className="speech-help">The action engine is not connected. You can edit and copy your transcript.</p>}
    {feedback && <p className="speech-notice" role="status">{feedback}</p>}
  </section>;
}
