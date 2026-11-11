/** Track F — agent decisions, offers, delegation and credits. The engine never talks to the network. */
import type { AgentCommand, AgentState, AssignAgentsCommand, DelegateCommand, DemoContext, DemoEffect, TownDecision, TownRole } from "./contracts.ts";

export function initialAgents(): AgentState {
  return { assigned: {}, player: null, pending: {}, credits: {} };
}
/** Only at age 0 before the first year. */
export function assignAgents(ctx: DemoContext, command: AssignAgentsCommand): void { void ctx; void command; }
export function delegate(ctx: DemoContext, command: DelegateCommand): void { void ctx; void command; }
/**
 * Accepts a decision from the assigned agent if within limits. A town decision waits in `pending`
 * for the next settlement; an offer becomes `demo.offer`; a player command runs through `run`.
 * Throws (changing nothing) when the agent is not assigned to that role.
 */
export function applyAgentCommand(ctx: DemoContext, command: AgentCommand, run: (inner: AgentCommand["decision"] & { kind: "command" }) => void): void {
  void ctx; void command; void run;
}
/** The decision for a role this year: a pending in-limit agent decision, else the fixed rule (null). */
export function townDecision(ctx: DemoContext, role: TownRole): TownDecision | null { void ctx; void role; return null; }
/** After settlement: credits agents whose decisions touched the player, clears pending. */
export function closeAgentYear(ctx: DemoContext): void { void ctx; }
export function applyOffer(ctx: DemoContext, effect: Extract<DemoEffect, { kind: "offer" }>): void { void ctx; void effect; }
/** Credits per agent account, for evidence. */
export function agentCredits(credits: AgentState["credits"]): { agent: string; decisions: number }[] {
  return Object.entries(credits).filter(([, n]) => n > 0).map(([agent, decisions]) => ({ agent, decisions }))
    .sort((a, b) => b.decisions - a.decisions || a.agent.localeCompare(b.agent));
}
