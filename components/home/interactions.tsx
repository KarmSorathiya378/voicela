"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Mic,
  Square,
  Mail,
  CalendarDays,
  Folder,
  NotebookPen,
  Globe,
  RotateCcw,
  Check,
  ShieldCheck,
} from "lucide-react";
import { AnimatedVoiceOrb } from "@/components/motion/voice-orb";
import { Button } from "@/components/ui/button";
import { track, EVENTS } from "@/lib/metrics";
import { submitWaitlist, type Platform } from "@/lib/waitlist";
import "./home.css";
import { homeClasses as s } from "./classes";

export function HeroActions() {
  return (
    <div className={s.actions}>
      <Button asChild size="lg">
        <Link href="/demo">
          Try Interactive Demo <ArrowUpRight size={18} />
        </Link>
      </Button>
      <Button asChild variant="secondary" size="lg">
        <a href="#waitlist">
          Join Waitlist <ArrowUpRight size={18} />
        </a>
      </Button>
    </div>
  );
}

export function HeroInstrument() {
  const reduced = useReducedMotion();
  const [activity, setActivity] = useState(0.2);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [12, -12]);
  return (
    <div
      ref={ref}
      className={s.instrument}
      data-ui
      onPointerMove={(e) => {
        if (!reduced) {
          const rect = e.currentTarget.getBoundingClientRect();
          setActivity(0.2 + (0.6 * (e.clientX - rect.left)) / rect.width);
        }
      }}
      onPointerLeave={() => setActivity(0.2)}
    >
      <motion.div style={{ y: reduced ? 0 : y }} className={s.orb}>
        <AnimatedVoiceOrb
          activity={activity}
          size="100%"
          style={{ color: "#9fddd6" }}
        />
      </motion.div>
      <div className={s.instrumentText}>
        <div className={s.command}>
          <span aria-hidden="true">●</span> Voicela · Ready when you are
        </div>
        <p>
          “Make room for
          <br />
          what matters.”
        </p>
        <span>A little less between you and your next move.</span>
      </div>
    </div>
  );
}
export function VoiceActivation() {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState(
    "Ready. Tap the mic to play a simulated request.",
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function sample() {
    if (listening) {
      if (timer.current) clearTimeout(timer.current);
      setListening(false);
      setResult("Stopped. Nothing was recorded or changed.");
      return;
    }
    setListening(true);
    setResult("Simulating: “Find my project brief and draft a summary.”");
    timer.current = setTimeout(() => {
      setListening(false);
      setText("Find my project brief and draft a summary");
      setResult(
        "Sample brief found. A summary is ready for review in the demo lab.",
      );
    }, 1700);
  }
  function typed(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setResult(
      /brief|summary|summarize|project/i.test(text)
        ? "Sample project brief found. Summary: align on scope, confirm the owner, then review the launch checklist. No real files were read."
        : "This preview knows one sample task: finding a project brief. Try “find my project brief”, or explore more scenarios in the demo lab.",
    );
  }
  return (
    <div className={`${s.panel} ${s.split}`} data-ui>
      <div className={s.micArea}>
        <button
          type="button"
          className={s.mic}
          aria-label={
            listening
              ? "Stop simulated voice input"
              : "Start simulated voice input"
          }
          aria-pressed={listening}
          onClick={sample}
        >
          {listening ? <Square size={28} /> : <Mic size={32} />}
        </button>
        <div
          className={`${s.wave} ${listening ? s.active : ""}`}
          aria-hidden="true"
        >
          {Array.from({ length: 25 }, (_, i) => (
            <i key={i} style={{ height: 8 + ((i * 7) % 25) }} />
          ))}
        </div>
        <span className={s.quiet}>
          Sample input only · microphone stays off
        </span>
      </div>
      <div>
        <h3>Go ahead. Try an intent.</h3>
        <form onSubmit={typed}>
          <label htmlFor="voice-text" className={s.quiet}>
            Or type a request
          </label>
          <div className={s.typed}>
            <input
              id="voice-text"
              className={s.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Find my project brief"
              required
              maxLength={240}
            />
            <button className={s.iconButton} aria-label="Run typed sample">
              <ArrowRight size={20} />
            </button>
          </div>
        </form>
        <p className={s.status} role="status">
          {result}
        </p>
        <Link href="/demo" className={s.textLink}>
          Open the full demo <ArrowUpRight size={17} />
        </Link>
      </div>
    </div>
  );
}
const stages = [
  [
    "Instruction",
    "“Read Maya’s project update and draft a reply with a meeting time.”",
  ],
  [
    "Plan",
    "Read the selected sample message, check the mock calendar, and prepare a reply. No sending permission requested yet.",
  ],
  [
    "Tool actions",
    "Mail → read the selected message. Calendar → check Friday afternoon. Composer → prepare an editable draft.",
  ],
  [
    "Result",
    "Draft: Hi Maya, thanks for the update. Could we review the next steps on Friday at 2 PM?",
  ],
  [
    "Approval",
    "The draft is ready. Sending would be a separate, explicit decision. This preview never sends a real message.",
  ],
];
export function Workflow() {
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();
  return (
    <div className={s.panel} data-ui>
      <div className={s.steps} role="group" aria-label="Workflow stages">
        {stages.map(([name], i) => (
          <button
            key={name}
            className={`${s.step} ${step === i ? s.selected : ""}`}
            aria-pressed={step === i}
            onClick={() => setStep(i)}
          >
            {name}
          </button>
        ))}
      </div>
      <motion.div
        key={step}
        initial={reduced ? false : { opacity: 0.4, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22 }}
        className={s.stepBody}
      >
        <p role="status">{stages[step][1]}</p>
        {step === 4 && <ShieldCheck size={44} aria-hidden="true" />}
      </motion.div>
      <div className={s.controls}>
        <button
          className={s.iconButton}
          aria-label="Previous workflow stage"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          className={s.iconButton}
          aria-label="Next workflow stage"
          disabled={step === 4}
          onClick={() => setStep(step + 1)}
        >
          <ArrowRight size={18} />
        </button>
        <button
          className={s.iconButton}
          aria-label="Reset workflow"
          onClick={() => setStep(0)}
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <p className={s.quiet}>
        Walk through at your own pace. Actual task times depend on models,
        hardware and integrations.
      </p>
    </div>
  );
}
const apps = [
  {
    name: "Mail",
    icon: Mail,
    title: "A reply, ready to review.",
    body: "Maya Chen · Project check-in",
    note: "Hi Maya, thanks for the update. Friday at 2 PM works for a review. I’ll bring the revised project brief.",
    command: "Draft a reply to Maya’s project update.",
  },
  {
    name: "Calendar",
    icon: CalendarDays,
    title: "Find a little breathing room.",
    body: "Friday · Sample calendar",
    note: "1:00–1:30 PM · Design review\n2:00–2:30 PM · Available\n3:00–4:00 PM · Focus time",
    command: "Find half an hour on Friday afternoon.",
  },
  {
    name: "Files",
    icon: Folder,
    title: "The right file. Less digging.",
    body: "Sample workspace / Projects",
    note: "Project brief.pdf · Planning\nLaunch checklist.md · Operations\nResearch notes.txt · Discovery",
    command: "Find the latest project brief.",
  },
  {
    name: "Notes",
    icon: NotebookPen,
    title: "Keep the thought moving.",
    body: "Project review · Sample note",
    note: "Confirm the project owner.\nReview the revised scope.\nBring open questions to Friday’s meeting.",
    command: "Turn that update into a short checklist.",
  },
  {
    name: "Browser",
    icon: Globe,
    title: "An answer with its context.",
    body: "Sample research / Release checklist",
    note: "Before sharing: confirm the scope, review the permissions, and get an explicit approval for publishing.",
    command: "Summarize this selected page.",
  },
];
export function DesktopPreview() {
  const [active, setActive] = useState(0);
  const app = apps[active];
  return (
    <div className={s.desktop} data-ui>
      <div className={s.desktopTop}>
        <strong>Voicela workspace</strong>
        <span>Simulated apps · sample data</span>
      </div>
      <div
        className={s.appTabs}
        role="group"
        aria-label="Choose a mock desktop app"
      >
        {apps.map((item, i) => (
          <button
            key={item.name}
            className={`${s.appTab} ${active === i ? s.selected : ""}`}
            aria-pressed={active === i}
            onClick={() => setActive(i)}
          >
            <item.icon size={18} />
            {item.name}
          </button>
        ))}
      </div>
      <div className={s.appContent} aria-live="polite">
        <div>
          <p className={s.quiet}>{app.body}</p>
          <h3>{app.title}</h3>
          <p>“{app.command}”</p>
        </div>
        <div className={s.previewNote} style={{ whiteSpace: "pre-line" }}>
          {app.note}
        </div>
      </div>
      <Link href="/demo" className={s.textLink}>
        Take it for a spin in the demo lab <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
const excerpts = [
  "The project is ready for a scope review. Maya will lead the discussion on Friday.",
  "Before launch, confirm accessibility, document permissions, and review the rollback plan.",
];
export function ContextPreview() {
  const [selected, setSelected] = useState<number | null>(null);
  const [summarized, setSummarized] = useState(false);
  return (
    <div className={`${s.panel} ${s.split}`} data-ui>
      <div className={s.document}>
        <h3>Project brief</h3>
        <p className={s.quiet}>
          Hover to preview. Click or tap to select a paragraph.
        </p>
        {excerpts.map((text, i) => (
          <button
            key={i}
            className={s.excerpt}
            aria-pressed={selected === i}
            onClick={() => {
              setSelected(i);
              setSummarized(false);
            }}
          >
            {text}
          </button>
        ))}
      </div>
      <div>
        <h3>You choose the scope.</h3>
        <div className={s.contextRead} aria-live="polite">
          <strong>
            {selected === null
              ? "No context selected"
              : "Context shared: one paragraph"}
          </strong>
          <p>
            {selected === null
              ? "Nothing outside this sample document is accessible."
              : summarized
                ? selected === 0
                  ? "Summary: Maya leads Friday’s scope review."
                  : "Summary: check accessibility, permissions and rollback before launch."
                : excerpts[selected]}
          </p>
        </div>
        <div className={s.controls} style={{ marginTop: 18 }}>
          <button
            className={`${s.primary} ${s.submit}`}
            disabled={selected === null}
            onClick={() => setSummarized(true)}
          >
            Summarize selection
          </button>
          <button
            className={s.iconButton}
            aria-label="Clear context selection"
            onClick={() => {
              setSelected(null);
              setSummarized(false);
            }}
          >
            <RotateCcw size={18} />
          </button>
        </div>
        <p className={s.quiet}>
          Read: selected text only. Not read: other windows, files or your
          screen.
        </p>
      </div>
    </div>
  );
}
export function PrivacyLab() {
  const [settings, setSettings] = useState([false, false, false, true]);
  const labels = [
    "Allow cloud processing",
    "Allow microphone input",
    "Share the current window",
    "Require action approvals",
  ];
  return (
    <div className={`${s.panel} ${s.split}`} data-ui>
      <div>
        {labels.map((label, i) => (
          <div className={s.toggleRow} key={label}>
            <label id={`privacy-label-${i}`}>{label}</label>
            <button
              type="button"
              role="switch"
              aria-checked={settings[i]}
              aria-labelledby={`privacy-label-${i}`}
              className={s.toggle}
              onClick={() =>
                setSettings(settings.map((v, j) => (j === i ? !v : v)))
              }
            >
              <span />
            </button>
          </div>
        ))}
      </div>
      <div className={s.path} aria-live="polite">
        <h3>{settings[0] ? "Device → cloud model" : "Device → local model"}</h3>
        <p>
          {settings[0]
            ? "Illustration: selected input may leave the device for cloud inference after consent."
            : "Illustration: supported tasks stay on device. Tasks needing cloud services wait for opt-in."}
        </p>
        <p>
          Microphone:{" "}
          {settings[1]
            ? "push-to-talk permission requested before capture"
            : "off"}
          . Context: {settings[2] ? "current window only" : "none shared"}.
        </p>
        <p>
          {settings[3]
            ? "Consequential actions wait for explicit approval."
            : "Routine actions could run after setup. Sending, deleting and purchases still require approval."}
        </p>
        <p className={s.quiet}>
          This is a model of the controls, not an active privacy configuration.
        </p>
      </div>
    </div>
  );
}
export function WaitlistForm() {
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "pending") return;
    const data = new FormData(e.currentTarget);
    setState("pending");
    try {
      const result = await submitWaitlist(
        String(data.get("email")),
        String(data.get("platform")) as Platform,
      );
      if (result && "ok" in result && !result.ok)
        throw new Error("Please try again in a moment.");
      track(EVENTS.waitlist_submit);
      setState("success");
    } catch {
      setState("error");
      setMessage(
        "We could not validate your request. Please check your email and try again.",
      );
    }
  }
  return (
    <div className={s.waitlist}>
      {state === "success" ? (
        <div className={s.success} role="status">
          <Check size={28} />
          <p>Your preview is complete.</p>
          <p className={s.quiet}>
            Your address was validated. This preview does not save a signup or
            send email; a connected waitlist is coming.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className={s.fields}>
            <label className={s.field} htmlFor="waitlist-email">
              Email address
              <input
                id="waitlist-email"
                name="email"
                className={s.input}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
              />
            </label>
            <label className={s.field} htmlFor="waitlist-platform">
              Your platform
              <select
                id="waitlist-platform"
                name="platform"
                className={s.select}
                defaultValue="windows"
              >
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
                <option value="linux">Linux</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
            </label>
            <button
              disabled={state === "pending"}
              className={`${s.primary} ${s.submit}`}
            >
              {state === "pending" ? "Joining…" : "Join Waitlist"}
              <ArrowUpRight size={17} />
            </button>
          </div>
          <p className={s.quiet}>
            Form preview: no signup is saved and no updates are sent yet. See
            our <Link href="/privacy">privacy policy</Link>. No payment
            required.
          </p>
          <p role="status" className={s.status}>
            {state === "error" ? message : ""}
          </p>
        </form>
      )}
    </div>
  );
}
