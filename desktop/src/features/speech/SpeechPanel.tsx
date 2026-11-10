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
  const recording = speech.phase !== "idle";
  const unavailable = props.disabled || sending;

  async function submit() {
    const transcript = speech.text.trim();
    if (!transcript || !props.onTranscriptReady || unavailable || recording || submitting.current) return;
    submitting.current = true;
    setSending(true);
    setFeedback("");
    try {
      await props.onTranscriptReady(transcript);
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
      <div><h2 id={`${id}-title`}>Your next instruction</h2><p>Speak or type, then review your words before sending.</p></div>
      <span className="speech-state" role="status" aria-live="polite">
        {recording && <span className="speech-recording-dot" aria-hidden="true" />}
        {speech.phase === "listening" ? "Microphone on · Listening" : speech.phase === "transcribing" ? "Finishing transcription" : "Microphone off"}
      </span>
    </div>

    {!speech.supported ? <p className="speech-notice">Speech recognition is unavailable in this app environment. Type your instruction below; all transcript tools still work.</p>
      : <>
        <p className="speech-help" id={`${id}-privacy`}>Enable the microphone to use speech for this session. The browser speech service may process audio online. Nothing is recorded until you hold to talk.</p>
        <div className="speech-actions">
          {speech.permission !== "enabled" && <button type="button" disabled={speech.permission === "requesting" || unavailable} onClick={() => void speech.enable()}>
            {speech.permission === "requesting" ? "Requesting microphone…" : speech.permission === "denied" ? "Retry microphone access" : "Enable microphone"}
          </button>}
          <button type="button" className="secondary speech-talk" aria-describedby={`${id}-privacy ${id}-shortcut`}
            disabled={speech.permission !== "enabled" || unavailable || speech.phase === "transcribing"}
            onPointerDown={event => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              speech.start();
            }}
            onPointerUp={() => speech.stop()} onPointerCancel={() => speech.stop()} onLostPointerCapture={() => { if (speech.phase === "listening") speech.stop(); }}
            onKeyDown={event => {
              if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                event.preventDefault(); keyboardHeld.current = true; speech.start();
              }
            }}
            onKeyUp={event => {
              if (event.key === " " || event.key === "Enter") { event.preventDefault(); keyboardHeld.current = false; speech.stop(); }
            }}
            onBlur={() => { if (keyboardHeld.current) { keyboardHeld.current = false; speech.stop(); } }}>
            {speech.phase === "listening" ? "Listening · release to stop" : "Hold to talk"}
          </button>
          {speech.phase === "listening" && <button type="button" className="secondary" onClick={speech.stop}>Stop</button>}
        </div>
        <p className="speech-help" id={`${id}-shortcut`}>{speech.shortcutMessage || "Hold to talk also works with Space or Enter while the button is focused."}</p>
      </>}
    {speech.message && <p className="speech-notice" role="status">{speech.message}</p>}

    <label htmlFor={`${id}-transcript`}>Editable transcript</label>
    <textarea id={`${id}-transcript`} value={speech.text} readOnly={recording}
      onChange={event => { speech.replaceText(event.currentTarget.value); setFeedback(""); }}
      placeholder="Type an instruction, or enable the microphone to dictate…" rows={5}
      aria-describedby={`${id}-editing`} />
    {speech.interim && <p className="speech-interim" aria-label="Live partial transcript">{speech.interim}</p>}
    <p className="speech-help" id={`${id}-editing`}>{recording ? "Stop recording to edit. Partial words appear below the editor until finalized." : "Edit words and punctuation freely. Undo restores previous edits or the text before your last recording."}</p>
    <div className="speech-actions">
      <button type="button" disabled={!speech.text.trim() || recording || unavailable || !props.onTranscriptReady} onClick={() => void submit()}>{sending ? "Submitting…" : "Use transcript"}</button>
      <button type="button" className="secondary" disabled={!speech.undoCount || recording} onClick={speech.undo}>Undo</button>
      <button type="button" className="secondary" disabled={!speech.text} onClick={() => void copy()}>Copy</button>
      <button type="button" className="secondary" disabled={!speech.text || recording} onClick={() => { speech.replaceText(""); setFeedback(""); }}>Clear</button>
    </div>
    {!props.onTranscriptReady && <p className="speech-help">The action engine is not connected. You can edit and copy your transcript.</p>}
    {feedback && <p className="speech-notice" role="status">{feedback}</p>}
  </section>;
}
