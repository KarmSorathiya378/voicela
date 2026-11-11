"use client";
import { useEffect, useRef, useState } from "react";
import { AudioLines, Check, ArrowUpRight, Play, RotateCcw, Square } from "lucide-react";
import Link from "next/link";
import { useReducedMotion } from "@/components/motion/use-motion";

const steps = ["Read the project update", "Find a time on Friday", "Prepare a reply for review"];
export function ProductStory() {
  const [step, setStep] = useState(3);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!playing || step >= 3) return;
    timer.current = setTimeout(() => {
      setStep(step + 1);
      if (step === 2) setPlaying(false);
    }, reduced ? 100 : 850);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, step, reduced]);
  function replay() { setStep(0); setPlaying(true); }
  return <div className="product-story app-frame" data-ui>
    <div className="story-title"><span><AudioLines size={18} /> voicela</span><span className="story-preview">Interactive preview</span></div>
    <div className="story-command"><span className="command-label">Your request</span><p>“Find a time with Maya on Friday and draft a reply.”</p></div>
    <div className="story-steps">{steps.map((label, index) => <div className={`story-step ${index < step ? "is-complete" : ""}`} key={label}><span className="step-marker">{index < step ? <Check size={13} /> : index + 1}</span><span>{label}</span><span className="step-state">{index < step ? "Done" : index === step && playing ? "Working" : "Next"}</span></div>)}</div>
    <div className="story-draft" aria-live="polite"><span>{step === 3 ? "Draft ready for review" : playing ? "Preparing your draft…" : "Preview paused"}</span><p>{step === 3 ? "Hi Maya, Friday at 2 PM works for me. Shall we review the project then?" : "Read the update, check the calendar, then prepare a reply. You stay in control."}</p><Link href="/demo">Open in demo <ArrowUpRight size={15} /></Link></div>
    <div className="story-bottom"><span>Simulation · nothing sent</span><button onClick={playing ? () => setPlaying(false) : replay} aria-label={playing ? "Pause workflow preview" : "Replay workflow preview"}>{playing ? <Square size={13} /> : step === 3 ? <RotateCcw size={14} /> : <Play size={14} />}{playing ? "Pause" : "Replay"}</button></div>
  </div>;
}
