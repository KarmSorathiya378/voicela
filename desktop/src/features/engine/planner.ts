import type { AppState, PendingApproval, RunResponse, StateSnapshot, ToolInput } from "../../api";
import { parseIntent } from "./parser.ts";

export interface EngineClient {
  getState(): Promise<StateSnapshot>;
  setState(state: AppState): Promise<StateSnapshot>;
  runTool(request: ToolInput, intent: string): Promise<RunResponse>;
  approveTool(id: string, approved: boolean): Promise<RunResponse>;
}
export type PlanStatus = "ready" | "running" | "paused" | "awaiting-approval" | "completed" | "cancelled" | "error";
export interface PlanStep {
  instruction: string;
  request: ToolInput;
  status: "pending" | "running" | "awaiting-approval" | "simulated" | "executed" | "denied" | "cancelled" | "error";
  result?: string;
}
export interface Plan {
  transcript: string;
  status: PlanStatus;
  steps: PlanStep[];
  approval: PendingApproval | null;
}
export interface AuditEvent { id: number; time: string; message: string }
export interface EngineView { plan: Plan | null; notice: string; busy: boolean; audit: AuditEvent[] }

/** A single serialized executor. Stop never pretends to abort an in-flight IPC call. */
export class IntentEngine {
  private client: EngineClient;
  private listeners = new Set<() => void>();
  private view: EngineView = { plan: null, notice: "", busy: false, audit: [] };
  private stopRequested = false;
  private sequence = 0;
  constructor(client: EngineClient) { this.client = client; }
  getSnapshot = (): EngineView => this.view;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<EngineView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private plan(patch: Partial<Plan>) {
    if (this.view.plan) this.update({ plan: { ...this.view.plan, ...patch } });
  }
  private audit(message: string) {
    this.update({ audit: [...this.view.audit, { id: ++this.sequence, time: new Date().toISOString(), message }].slice(-60) });
  }
  private step(index: number, patch: Partial<PlanStep>) {
    this.plan({ steps: this.view.plan!.steps.map((step, i) => i === index ? { ...step, ...patch } : step) });
  }
  private cancelledSteps(): PlanStep[] {
    return this.view.plan!.steps.map(step => ["pending", "awaiting-approval"].includes(step.status)
      ? { ...step, status: "cancelled" } : step);
  }
  private recover(snapshot: StateSnapshot): boolean {
    if (!snapshot.pending_approval) return false;
    const approval = snapshot.pending_approval;
    this.update({ plan: { transcript: approval.intent, status: "awaiting-approval", approval,
      steps: [{ instruction: approval.intent, request: approval.request, status: "awaiting-approval" }] },
      notice: "A request is still awaiting approval in the desktop core. Review or cancel it before starting another plan." });
    this.audit("Recovered the core's pending approval. No action was replayed.");
    return true;
  }
  async connect(): Promise<void> {
    if (this.view.busy || this.view.plan) return;
    this.update({ busy: true });
    try { this.recover(await this.client.getState()); }
    catch (error) { this.update({ notice: `Desktop connection unavailable: ${String(error)}. No action was executed.` }); }
    finally { this.update({ busy: false }); }
  }
  /** Stages a visible plan; execution requires Run plan. Returns false when not accepted. */
  submitTranscript = (transcript: string): boolean => {
    const current = this.view.plan;
    if (this.view.busy || current && !["completed", "cancelled"].includes(current.status)) {
      this.update({ notice: "Finish or cancel the current plan before submitting another instruction." });
      return false;
    }
    const parsed = parseIntent(transcript);
    if (!parsed.supported) { this.update({ notice: parsed.message }); this.audit(`Instruction not accepted: ${parsed.message}`); return false; }
    this.stopRequested = false;
    this.update({ notice: "Review the steps, then run the plan.",
      plan: { transcript: parsed.transcript, status: "ready", approval: null,
        steps: parsed.actions.map(action => ({ ...action, status: "pending" })) } });
    this.audit(`Planned ${parsed.actions.length} step(s). Nothing has run.`);
    return true;
  };
  stop = (): void => {
    if (!this.view.plan || !["running", "awaiting-approval"].includes(this.view.plan.status)) return;
    this.stopRequested = true;
    this.plan({ status: "paused" });
    this.update({ notice: this.view.busy ? "Stopping after the in-flight request returns; it cannot be recalled." : "Plan paused. Resume to continue or cancel the plan." });
    this.audit("Stop requested; no further steps will start.");
  };
  run = async (): Promise<void> => {
    const plan = this.view.plan;
    if (this.view.busy || !plan || !["ready", "paused"].includes(plan.status)) return;
    this.stopRequested = false;
    if (plan.approval) { this.plan({ status: "awaiting-approval" }); this.update({ notice: "Review the pending request. Resume does not approve it." }); return; }
    this.update({ busy: true, notice: "" });
    this.plan({ status: "running" });
    try {
      const snapshot = await this.client.getState();
      if (this.recover(snapshot)) return;
      if (this.stopRequested) return;
      await this.client.setState("thinking");
      await this.advance();
    } catch (error) { this.fail(error); }
    finally { this.update({ busy: false }); }
  };
  private async advance(): Promise<void> {
    while (!this.stopRequested) {
      const index = this.view.plan!.steps.findIndex(step => step.status === "pending");
      if (index === -1) {
        this.plan({ status: "completed" });
        const executed = this.view.plan!.steps.filter(step => step.status === "executed").length;
        const simulated = this.view.plan!.steps.length - executed;
        const message = `Plan complete. Executed: ${executed}. Simulated: ${simulated}.`;
        this.update({ notice: message });
        this.audit(message);
        return;
      }
      const step = this.view.plan!.steps[index];
      this.step(index, { status: "running" });
      this.audit(`Requested ${step.request.tool}. Waiting for the desktop core.`);
      const response = await this.client.runTool(step.request, step.instruction);
      if (!this.handle(index, response)) return;
    }
    this.plan({ status: "paused" });
  }
  private handle(index: number, response: RunResponse): boolean {
    if (response.status === "awaiting_approval") {
      this.step(index, { status: "awaiting-approval" });
      this.plan({ approval: response.approval, status: this.stopRequested ? "paused" : "awaiting-approval" });
      this.audit(`Approval required for ${response.approval.request.tool}. No action executed.`);
      return false;
    }
    if (response.status === "denied") {
      this.step(index, { status: "denied", result: response.message });
      this.plan({ approval: null, status: "cancelled", steps: this.cancelledSteps() });
      this.audit(response.message);
      return false;
    }
    const tool = this.view.plan!.steps[index].request.tool;
    const expected = tool === "create_note" ? "executed" : "simulated";
    if (response.status !== expected || response.output.status !== expected
      || response.output.executed !== (expected === "executed") || response.output.tool !== tool) {
      throw new Error("Unexpected execution response; inspect desktop activity before taking another action");
    }
    this.step(index, { status: expected, result: response.output.message });
    this.plan({ approval: null });
    this.audit(`${tool}: ${expected}. ${response.output.message}`);
    return true;
  }
  approve = async (): Promise<void> => {
    const plan = this.view.plan;
    if (this.view.busy || !plan?.approval || plan.status !== "awaiting-approval") return;
    const id = plan.approval.id;
    const index = plan.steps.findIndex(step => step.status === "awaiting-approval");
    this.update({ busy: true, notice: "" });
    this.plan({ status: "running" });
    this.audit("Explicit user approval submitted for this request only.");
    try {
      const response = await this.client.approveTool(id, true);
      if (this.handle(index, response)) await this.advance();
    } catch (error) { this.fail(error); }
    finally { this.update({ busy: false }); }
  };
  cancel = async (): Promise<void> => {
    if (this.view.busy || !this.view.plan || this.view.plan.status === "completed" || this.view.plan.status === "cancelled") return;
    if (this.view.plan.status === "ready") {
      this.plan({ status: "cancelled", steps: this.cancelledSteps() });
      this.update({ notice: "Unstarted plan cancelled. No tool request was submitted." });
      this.audit("Unstarted plan cancelled locally.");
      return;
    }
    this.update({ busy: true });
    this.stopRequested = true;
    try {
      // Consult Rust even after IPC failure: a request may have reached it.
      const snapshot = await this.client.getState();
      if (snapshot.pending_approval) {
        const response = await this.client.approveTool(snapshot.pending_approval.id, false);
        if (response.status !== "denied") throw new Error("Core did not confirm cancellation");
        this.audit(response.message);
      } else await this.client.setState("idle");
      this.plan({ status: "cancelled", approval: null, steps: this.cancelledSteps() });
      this.update({ notice: "Remaining steps cancelled. Earlier returned results stay in the audit trail." });
      this.audit("Plan cancelled; remaining steps will not run.");
    } catch (error) { this.fail(error); }
    finally { this.update({ busy: false }); }
  };
  private fail(error: unknown) {
    const message = `Desktop request failed: ${String(error)}. No success is assumed. Inspect activity or cancel before making a new plan; this step will not be retried automatically.`;
    const index = this.view.plan?.steps.findIndex(step => step.status === "running" || step.status === "awaiting-approval") ?? -1;
    if (index >= 0) this.step(index, { status: "error", result: message });
    this.plan({ status: "error" });
    this.update({ notice: message });
    this.audit(message);
  }
}
