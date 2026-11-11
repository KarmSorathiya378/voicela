import { isTauri } from "@tauri-apps/api/core";
import type { IntentEngineBinding } from "./useIntentEngine";
import { intentExamples, supportedInstructions } from "./parser";
import "./engine.css";

const label = (value: string) => value.replace(/[_-]/g, " ");

export function EnginePanel({ engine }: { engine: IntentEngineBinding }) {
  const { plan, controller, notice, busy, audit } = engine;
  const done = plan?.steps.filter(step => step.status === "executed" || step.status === "simulated").length ?? 0;
  const desktop = isTauri();
  const realAction = ["open_app", "find_file", "browser_search", "control_app"].includes(plan?.approval?.request.tool ?? "");
  const savesNote = plan?.approval?.request.tool === "create_note";
  return <section className="intent-engine" aria-labelledby="engine-title">
    <div className="section-title"><h2 id="engine-title">Action plan</h2>
      {plan && <span className="state" role="status" aria-live="polite">{label(plan.status)}</span>}</div>
    <p>In a listening session, pauses submit spoken commands automatically. Say approve or cancel plan for a pending request. Typed instructions wait for Run plan. Open installed apps, save notes, search local filenames, or search the web. File search scans accessible local drives within limits. App control supports inspect, click, type, scroll and common shortcuts. Calendar and messaging are previews.</p>
    {desktop && <p className="hint">PC access uses your Windows account: installed apps, accessible local drives, and visible app controls. In-app changes are reviewed for a specific target window.</p>}
    {!desktop && <p className="notice">Browser preview: you can prepare a plan. Running and approval require the Windows desktop app.</p>}
    {notice && <p className={plan?.status === "error" ? "error" : "notice"} role={plan?.status === "error" ? "alert" : "status"}>{notice}</p>}
    {plan ? <>
      <p className="engine-transcript">{plan.transcript}</p>
      <label htmlFor="engine-progress">{done} of {plan.steps.length} steps finished</label>
      <progress id="engine-progress" value={done} max={plan.steps.length} />
      <ol className="engine-steps">{plan.steps.map((step, index) => <li key={index}>
        <div className="section-title"><strong>{label(step.request.tool)}</strong><span className="badge">{label(step.status)}</span></div>
        <p>{step.instruction}</p>
        <details><summary>Exact tool input</summary><pre>{JSON.stringify(step.request.input, null, 2)}</pre></details>
        {step.result && <p>{step.result}</p>}
      </li>)}</ol>
      <div className="actions">
        {["ready", "paused"].includes(plan.status) && <button disabled={busy || !desktop} onClick={() => void controller.run()}>{plan.status === "paused" ? "Resume plan" : "Run plan"}</button>}
        {["running", "awaiting-approval"].includes(plan.status) && <button className="secondary" onClick={controller.stop}>Stop after current request</button>}
        {!["completed", "cancelled"].includes(plan.status) && <button className="secondary" disabled={busy || (!desktop && plan.status !== "ready")} onClick={() => void controller.cancel()}>Cancel plan</button>}
      </div>
      {plan.approval && <div className="engine-approval" role="region" aria-labelledby="engine-approval-title">
        <h3 id="engine-approval-title">Approval required: {label(plan.approval.request.tool)}</h3>
        <p>{plan.approval.intent}</p>
        <pre>{JSON.stringify(plan.approval.request, null, 2)}</pre>
        <p>{savesNote ? "Approval saves this note on this device. Clearing local history deletes it." : realAction ? "Approval runs this action on your computer." : "Approval runs a simulation."} Cancel stops the remaining plan.</p>
        {plan.status === "paused" && <p>Plan paused. Resume to review this approval; resuming does not approve it.</p>}
        <div className="actions"><button disabled={busy || !desktop || plan.status !== "awaiting-approval"} onClick={() => void controller.approve()}>{savesNote ? "Approve and save note" : realAction ? "Approve and run" : "Approve simulation"}</button>
          <button className="secondary" disabled={busy || !desktop} onClick={() => void controller.cancel()}>Cancel</button></div>
      </div>}
    </> : <p className="empty">Say an app command to run it, or submit typed text to prepare a plan.</p>}
    <details><summary>Supported instructions</summary><p>{supportedInstructions}</p>
      <ul>{intentExamples.map(example => <li key={example}>{example}</li>)}</ul>
      <p>Join up to eight independent steps with “then”. Include exact details for every step. Follow-ups can revise an unstarted event or select between two previously searched filenames. Ambiguous references ask for details. For message or note text containing “then”, submit separate plans.</p>
    </details>
    <details open={audit.length > 0}><summary>Plan audit ({audit.length})</summary>
      <p className="hint">This window keeps the latest 60 planner events. The desktop activity feed stores core approval and tool records in SQLite.</p>
      {audit.length ? <ol className="engine-audit">{audit.map(event => <li key={event.id}><time dateTime={event.time}>{new Date(event.time).toLocaleTimeString()}</time><span>{event.message}</span></li>)}</ol>
        : <p>No plan events yet.</p>}
    </details>
  </section>;
}
