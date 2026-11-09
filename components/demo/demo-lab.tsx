'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowUpRight, Check, FileText, Folder, Mail, CalendarDays, StickyNote, Globe, Mic, MousePointer2, RotateCcw, ShieldCheck, Square, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Section } from '@/components/ui/section';
import { Container } from '@/components/ui/container';
import { Reveal } from '@/components/motion/reveal';
import { AnimatedVoiceOrb } from '@/components/motion/voice-orb';
import { track, EVENTS } from '@/lib/metrics';
import { initial, reducer, scenarios, type Scenario, type State } from './machine';
import { files, mail, calendar, chart, originalNote, cleanNote } from './seeds';
import './demo-lab.css';
import { styles } from './style-names';

type SpeechResult = { results: { [key: number]: { [key: number]: { transcript: string } } } };
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: SpeechResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const icons = { Files: Folder, Mail, Calendar: CalendarDays, Notes: StickyNote, Browser: Globe };
const labels = { idle: 'Ready', listening: 'Reading intent', thinking: 'Planning', acting: 'Acting', 'awaiting-approval': 'Your approval needed', completed: 'Completed', error: 'Needs attention' };
const progress = { idle: 0, listening: 15, thinking: 35, acting: 65, 'awaiting-approval': 80, completed: 100, error: 100 };

export function DemoLab() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initial());
  const [app, setApp] = useState('Files');
  const [mic, setMic] = useState(false);
  const [micNotice, setMicNotice] = useState('Typed input is on. Microphone access is optional.');
  const recognition = useRef<Recognition | null>(null);
  const micTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const approvalRef = useRef<HTMLButtonElement>(null);
  const scenario = scenarios.find(x => x.id === state.scenario)!;
  const busy = ['listening', 'thinking', 'acting'].includes(state.phase);
  const locked = state.phase !== 'idle';

  useEffect(() => {
    const action = state.phase === 'listening' ? 'THINK' : state.phase === 'thinking' ? 'ACT' : state.phase === 'acting' ? state.approved ? 'FINISH' : 'RESOLVE' : null;
    if (!action) return;
    const timeout = setTimeout(() => dispatch({ type: action }), state.phase === 'acting' ? 1000 : 700);
    return () => clearTimeout(timeout);
  }, [state.phase, state.approved]);
  useEffect(() => { if (state.phase === 'awaiting-approval') approvalRef.current?.focus(); }, [state.phase]);
  useEffect(() => { if (state.phase === 'completed') track(EVENTS.DEMO_COMPLETE, { scenario: state.scenario, simulated: true }); }, [state.phase, state.scenario]);
  useEffect(() => () => { recognition.current?.abort(); if (micTimer.current) clearTimeout(micTimer.current); }, []);

  function stopMic() {
    recognition.current?.abort(); recognition.current = null;
    if (micTimer.current) clearTimeout(micTimer.current);
    setMic(false);
  }
  function reset(id?: Scenario) {
    stopMic(); dispatch({ type: 'RESET', scenario: id });
    setApp(scenarios.find(s => s.id === (id ?? state.scenario))!.app);
    setMicNotice('Typed input is on. Microphone access is optional.');
  }
  function start() {
    if (state.phase !== 'idle' || !state.prompt.trim()) return;
    stopMic(); setApp(scenario.app); dispatch({ type: 'START' });
    // Event names are provided by the shared metrics contract; no transcript is logged.
    track(EVENTS.DEMO_START, { scenario: state.scenario, simulated: true });
  }
  function toggleMic() {
    if (mic) { recognition.current?.stop(); setMic(false); return; }
    const w = window as SpeechWindow;
    const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Constructor) { setMicNotice('Speech recognition is unavailable in this browser. Type your intent below.'); return; }
    try {
      const rec = new Constructor(); recognition.current = rec;
      rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false;
      rec.onresult = e => { dispatch({ type: 'PROMPT', value: e.results[0][0].transcript }); setMicNotice('Transcript ready. Review it, then run the simulation.'); };
      rec.onerror = () => { setMic(false); setMicNotice('Microphone unavailable or permission declined. Typed input still works.'); };
      rec.onend = () => { setMic(false); if (micTimer.current) clearTimeout(micTimer.current); };
      rec.start(); setMic(true); setMicNotice('Listening. Select Stop microphone when finished. Automatically stops after 15 seconds.');
      micTimer.current = setTimeout(() => { rec.stop(); setMic(false); }, 15000);
    } catch { setMic(false); setMicNotice('Could not start speech recognition. Please use typed input.'); }
  }

  return <div className={styles.lab}>
    <Section className={styles.section} containerClassName={styles.sectionContainer}><Container className={styles.innerContainer}>
      <Reveal><header className={styles.intro}>
        <div><h1>Intent. Action. In your control.</h1><p>Try Voicela in a desktop made for exploring. Pick a task, follow the plan, and decide what happens next.</p></div>
        <div className={styles.safety}><ShieldCheck size={20} /><span>Simulated environment<br /><strong>No real accounts connected</strong></span></div>
      </header></Reveal>

      <div className={styles.workspace}>
        <aside className={styles.scenarios} aria-label="Demo scenarios">
          <div className={styles.railHeading}><h2>Demo lab</h2><Badge>Simulated</Badge></div>
          <p className={styles.muted}>One intent. A visible chain of actions.</p>
          <div className={styles.scenarioList}>{scenarios.map(s => { const Icon = icons[s.app as keyof typeof icons]; return <button key={s.id} type="button" aria-pressed={state.scenario === s.id} onClick={() => reset(s.id)} className={`${styles.scenario} ${state.scenario === s.id ? styles.selected : ''}`}><Icon size={18} /><span><strong>{s.name}</strong><small>{s.description}</small></span><ArrowUpRight size={15} /></button>; })}</div>
          <div className={styles.railFoot}><ShieldCheck size={17} /><p>Every send and calendar change pauses for your approval. Reset restores this demo’s seeded workspace.</p></div>
        </aside>

        <div className={styles.mainPane}>
          <div className={styles.desktopBar}><span><span className={styles.desktopMark} />Voicela workspace</span><span>Local simulation · Nov 12, 2026</span></div>
          <div className={styles.desktop}>
            <nav className={styles.dock} aria-label="Simulated apps">{Object.entries(icons).map(([name, Icon]) => <button key={name} type="button" className={app === name ? styles.activeApp : ''} aria-pressed={app === name} onClick={() => setApp(name)}><Icon size={17} />{name}</button>)}</nav>
            <div data-ui className={`${styles.window} ${busy && app === scenario.app ? styles.target : ''}`}>
              <div className={styles.windowBar}><span className={styles.windowDots} aria-hidden="true"><i /><i /><i /></span><strong>{app}</strong><span>Simulated app</span></div>
              <AppWindow app={app} state={state} dispatch={dispatch} />
              {state.phase !== 'idle' && <div aria-hidden="true" className={`${styles.cursor} ${busy ? styles.cursorActing : ''}`}><MousePointer2 size={23} fill="currentColor" /><span>Voicela</span></div>}
            </div>
            <div className={styles.assistant}>
              <div className={styles.orb}><AnimatedVoiceOrb activity={busy || mic ? 0.75 : 0.12} label="Simulated assistant activity" /></div>
              <div className={styles.assistantText}><div><strong>Voicela</strong><span>{labels[state.phase]}</span></div><p role="status" aria-live="polite" aria-atomic="true">{state.message}</p></div>
            </div>
          </div>

          <div className={styles.controls}>
            <div className={styles.controlTitle}><h2>{scenario.name}</h2><Button onClick={() => reset()} aria-label={`Reset ${scenario.name}`}><RotateCcw size={15} /> Reset</Button></div>
            {state.scenario === 'A' && <div className={styles.examples} aria-label="File search examples">{['Find my October invoice', 'Open the website project brief', 'Find my research notes', 'Find missing contract', 'Find private payroll'].map(text => <button type="button" key={text} disabled={locked || mic} onClick={() => dispatch({ type: 'PROMPT', value: text })}>{text}</button>)}</div>}
            {state.scenario === 'D' && <fieldset className={styles.contextChoices} disabled={locked}><legend>Visible context to share</legend>{(['chart', 'text'] as const).map(value => <label key={value}><input type="radio" name="context" checked={state.context === value} onChange={() => dispatch({ type: 'CONTEXT', value })} />{value === 'chart' ? 'Completed projects chart' : 'Selected launch paragraph'}</label>)}</fieldset>}
            <form onSubmit={e => { e.preventDefault(); start(); }}>
              <label htmlFor="demo-intent">Your intent <span className={styles.muted}>(typed by default)</span></label>
              <div className={styles.inputRow}><input id="demo-intent" value={state.prompt} disabled={locked || mic} onChange={e => dispatch({ type: 'PROMPT', value: e.target.value })} maxLength={300} autoComplete="off" aria-describedby="intent-help" /><Button type="submit" disabled={locked || mic || !state.prompt.trim()}>Run simulation <ArrowUpRight size={16} /></Button></div>
              <p id="intent-help" className={styles.inputHelp}>Seeded scenario: {scenario.description} Typed intent chooses a file in Files; other scenarios replay the selected task with fixed sample data.</p>
            </form>
            <div className={styles.options}><label><input type="checkbox" checked={state.failure} disabled={locked} onChange={e => dispatch({ type: 'FAILURE', value: e.target.checked })} /> Simulate an unavailable app</label><button type="button" disabled={locked} onClick={toggleMic} className={styles.micButton}><Mic size={16} />{mic ? 'Stop microphone' : 'Use microphone (optional)'}</button></div>
            <p className={styles.micHelp} role="status">{micNotice} Enabling speech may share audio with your browser’s speech provider.</p>
            <details className={styles.micPrivacy}><summary>Before enabling your microphone</summary><p>Only selecting “Use microphone” starts the browser’s speech service and permission flow. Depending on your browser, audio may be processed by its speech provider. Voicela does not store audio here. Review the transcript before running; typed mode needs no microphone.</p></details>
            <div className={styles.progressLine}><progress aria-label="Scenario progress" value={progress[state.phase]} max={100} /><span>{labels[state.phase]}</span></div>
            {state.phase === 'awaiting-approval' && <div className={styles.approval} role="region" aria-label="Review and approve simulated action"><ShieldCheck size={21} /><div><strong>{state.scenario === 'B' ? 'Approve this exact reply?' : state.scenario === 'C' ? 'Approve the conflict-free time?' : 'Apply the reviewed rewrite?'}</strong><p>{state.scenario === 'B' ? `To ${mail.address} · Re: ${mail.subject}. The full reply appears in Mail.` : state.scenario === 'C' ? `${calendar.title} · ${calendar.date} · ${calendar.available} · ${calendar.zone}.` : 'Only the seeded Notes document will change.'}</p><div className={styles.approvalActions}><Button ref={approvalRef} onClick={() => { setApp(scenario.app); dispatch({ type: 'APPROVE' }); }}>{state.scenario === 'B' ? 'Approve simulated send' : state.scenario === 'C' ? 'Approve simulated event' : 'Apply simulated edit'}</Button><Button onClick={() => dispatch({ type: 'CANCEL' })}>Decline</Button><button type="button" onClick={() => setApp(scenario.app)}>Review {scenario.app}</button></div></div></div>}
            {busy && <Button onClick={() => { stopMic(); dispatch({ type: 'CANCEL' }); }}><Square size={14} />Cancel run</Button>}
            {(state.phase === 'completed' || state.phase === 'error') && <div className={styles.resultActions}><Button onClick={() => reset()}><RotateCcw size={15} />{state.phase === 'error' ? 'Reset and recover' : 'Reset to replay'}</Button>{state.scenario === 'E' && state.applied && <Button onClick={() => dispatch({ type: 'UNDO' })}>Undo edit</Button>}</div>}
          </div>
        </div>

        <Card className={styles.audit} role="complementary" aria-label="Scenario audit timeline"><div className={styles.auditHeading}><h2>Action trail</h2><Volume2 size={17} aria-hidden="true" /></div><p className={styles.muted}>Scripted steps, visible as they happen. No live telemetry.</p>{state.log.length === 0 ? <div className={styles.emptyTrail}><span /><p>Your plan, actions, and results will appear here.</p></div> : <ol>{state.log.map((entry, i) => <li key={i}><span className={styles.auditDot}>{entry.kind === 'Result' ? <Check size={12} /> : <span />}</span><div><strong>{entry.kind}</strong><p>{entry.text}</p></div></li>)}</ol>}<p className={styles.auditFoot}>Only this run is shown. Reset clears its history.</p></Card>
      </div>
      <div className={styles.below}><p><ShieldCheck size={18} /> A safe place to explore. All documents, messages, and events are sample data.</p><p>Keyboard ready · Motion follows your device preferences</p></div>
    </Container></Section>
  </div>;
}

function AppWindow({ app, state, dispatch }: { app: string; state: State; dispatch: React.Dispatch<Parameters<typeof reducer>[1]> }) {
  const result = files.find(f => f.id === state.fileId);
  const hasDraft = state.scenario === 'B' && ['awaiting-approval', 'completed'].includes(state.phase) || state.scenario === 'B' && state.approved;
  const hasRewrite = state.scenario === 'E' && ['awaiting-approval', 'completed'].includes(state.phase);
  return <div className={styles.appContent}>
    {app === 'Files' && <><div className={styles.appHeading}><h3>{state.preview && result ? 'Document preview' : 'Your documents'}</h3><span>{files.length} seeded files</span></div>{state.preview && result ? <div className={styles.preview}><Button onClick={() => dispatch({ type: 'PREVIEW' })}>Back to files</Button><h4>{result.name}</h4><p>{result.content}</p><small>Simulated preview · Read only</small></div> : <><div className={styles.searchWell}>{state.scenario === 'A' && state.phase !== 'idle' ? state.prompt : 'Search the demo file index'}</div><div className={styles.fileList}>{files.map(file => <div key={file.id} className={result?.id === file.id ? styles.highlight : ''}><FileText size={23} /><div><strong>{file.name}</strong><small>{file.folder}</small></div>{result?.id === file.id && <Button onClick={() => dispatch({ type: 'PREVIEW' })}>Open preview</Button>}</div>)}</div></>}</>}
    {app === 'Mail' && <><div className={styles.appHeading}><h3>{state.scenario === 'B' && state.applied ? 'Sent · simulated' : 'Inbox'}</h3><span>1 sample conversation</span></div><div className={styles.email}><div className={styles.avatar}>MR</div><div><strong>{mail.from}</strong><small>{mail.address}</small><h4>{mail.subject}</h4><p>{mail.body}</p></div></div>{hasDraft && <div className={styles.composer}><strong>{state.applied ? 'Simulated sent reply' : 'Draft for your review'}</strong><small>To: {mail.address} · Re: {mail.subject}</small><p>{mail.draft}</p><span>{state.applied ? 'No external email was sent.' : 'Waiting for your explicit approval below.'}</span></div>}</>}
    {app === 'Calendar' && <><div className={styles.appHeading}><h3>{calendar.date}</h3><span>{calendar.zone}</span></div><div className={styles.calendar}><div><time>14:00</time><div className={styles.conflict}><strong>{calendar.conflict}</strong><small>{calendar.blocked} · Existing seeded event</small></div></div><div><time>14:30</time><div className={state.scenario === 'C' && state.phase !== 'idle' ? styles.proposal : styles.freeSlot}><strong>{state.scenario === 'C' && state.phase !== 'idle' ? calendar.title : 'Available'}</strong><small>{calendar.available} · {state.scenario === 'C' && state.applied ? 'Added · simulated' : state.scenario === 'C' && state.phase !== 'idle' ? 'Proposed · not yet added' : 'No event'}</small></div></div><div><time>15:00</time><div className={styles.freeSlot}><strong>Focus time</strong><small>15:00–16:00 · Sample event</small></div></div></div></>}
    {app === 'Browser' && <><div className={styles.address}>demo.voicela.local / launch-report <span>Simulated browser</span></div><div className={styles.appHeading}><h3>Launch report</h3><span>Seeded snapshot</span></div><div className={state.scenario === 'D' && state.context === 'chart' ? styles.contextHighlight : ''}><h4>Completed projects</h4><div className={styles.chart} role="img" aria-label={chart.map(c => `${c.month}: ${c.value} completed projects`).join(', ')}>{chart.map(c => <div key={c.month}><span>{c.value}</span><div style={{ height: `${c.value / Math.max(...chart.map(point => point.value)) * 115}px` }} /><small>{c.month}</small></div>)}</div></div><p className={`${styles.launchText} ${state.scenario === 'D' && state.context === 'text' ? styles.contextHighlight : ''}`}>Before launch, Maya will review onboarding. Arjun will prepare the release checklist. Both reviews must be complete before the team confirms readiness.</p>{state.scenario === 'D' && <small className={styles.scope}>Shared scope: {state.context === 'chart' ? 'only the four monthly chart values' : 'only the selected launch paragraph'}. No other tabs or screen content.</small>}</>}
    {app === 'Notes' && <><div className={styles.appHeading}><h3>Prototype follow-up</h3><span>Sample note</span></div><div className={styles.note}><small>{state.scenario === 'E' && state.applied ? 'Edited · simulated' : 'Original text'}</small><p>{state.scenario === 'E' && state.applied ? cleanNote : originalNote}</p></div>{hasRewrite && <div className={styles.diff}><h4>Review the change</h4><p><del>{originalNote}</del></p><p><ins>{cleanNote}</ins></p><small>Filler removal only. Names and Friday’s deadline are preserved.</small></div>}</>}
  </div>;
}
