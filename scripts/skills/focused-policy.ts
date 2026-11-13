import { createEngine } from "../../src/engine.ts";
import { getNetWorth } from "../../src/economy.ts";
import { capabilityProgress, requirementReasons } from "../../src/capabilities/engine.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { CAPABILITY_NODES } from "../../src/capabilities/catalog.ts";
import { selectAutomaticChoice } from "../../client/models/yearly-focus.ts";
import { householdView } from "../../src/demo/household.ts";
import { marketView } from "../../src/demo/market.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";

export const FOCUSED_TARGETS = ["FC10", "FR10", "AT10", "AC10", "AS10", "PS10", "PP10", "T10"] as const;
export type BottleneckCategory = "cash" | "materials" | "opportunity" | "proof" | "skills" | "early-death" | "none";
export type WealthGroup = "low-wealth" | "ordinary";
export interface PolicyDiagnostics {
  cashBlockedTurns: number;
  materialBlockedTurns: number;
  opportunityBlockedTurns: number;
  proofBlockedTurns: number;
  skillDetourTurns: number;
  apprenticeFallbackTurns: number;
  adultTurns: number;
  lastBlocker: Exclude<BottleneckCategory, "early-death" | "none">;
  lastUnmetNode: string | null;
  lastUnmetReason: string | null;
}
export interface FocusedResult {
  seed: string; target: string; mastered: boolean; survived18: boolean; age: number;
  deepest: number; next: string | null; reason: string; commands: number; home: string | null;
  originId: string; startCash: number; startNetWorth: number; wealthGroup: WealthGroup;
  blocker: BottleneckCategory; diagnostics: PolicyDiagnostics;
}

export function classifyWorkReason(reason: string): Exclude<BottleneckCategory, "early-death" | "none"> {
  if (/needs \d+ dr|costs \d+ dr|reserves \d+ dr|afford|cannot borrow|short \d+ dr/i.test(reason)) return "cash";
  if (/Reserve \d+ grain|owned grain|flax-seed|timber and \d+ clay|cannot supply \d+|prepared-clay|papyrus|single-crop plan/i.test(reason)) return "materials";
  if (/cannot fund the quoted|Both buyers must fund|insufficient remaining demand|reputation|commission|Enlist|Officer appointment|market visit has already been used|old enough to use the grain market|Finish the .* before|Leave military service/i.test(reason)) return "opportunity";
  if (/three distinct earlier records|Record the paid basket|cost basis|awaitingService/i.test(reason)) return "proof";
  return "skills";
}

function nodesOf(world: WorldPack) { return world.capabilities?.nodes ?? CAPABILITY_NODES; }
function pathTo(world: WorldPack, target: string): string[] {
  const path: string[] = [];
  function visit(id: string) {
    const node = nodesOf(world).find(n => n.id === id);
    if (!node) throw new Error(`Unknown focus target ${id}`);
    for (const parent of node.prerequisites.all) visit(parent);
    if (!path.includes(id)) path.push(id);
  }
  visit(target); return path;
}

/** A disclosed policy: ordinary accepted commands, 3 of 4 work years on the path. */
export function runFocusedPolicy(world: WorldPack, target: string, seed: string): FocusedResult {
  const engine = createEngine(world), path = pathTo(world, target), nodes = nodesOf(world);
  let life = engine.start(seed), reason = "Not old enough for work.", survived18 = false;
  const startOrigin = life.originId;
  const startCash = life.economy?.cash ?? 0;
  const startNetWorth = getNetWorth(world, life);
  // In alexandria-lives-8, delta-newcomers begins at the bottom endowment tier (20-80 dr cash).
  const wealthGroup: WealthGroup = startOrigin === "delta-newcomers" ? "low-wealth" : "ordinary";
  const diagnostics: PolicyDiagnostics = {
    cashBlockedTurns: 0, materialBlockedTurns: 0, opportunityBlockedTurns: 0,
    proofBlockedTurns: 0, skillDetourTurns: 0, apprenticeFallbackTurns: 0, adultTurns: 0,
    lastBlocker: "skills", lastUnmetNode: path[0] ?? target, lastUnmetReason: null,
  };
  let turns = 0;
  while (life.phase !== "ended" && !life.capabilities?.learned[target] && turns++ < world.maxAge * 14) {
    survived18 ||= life.age >= 18;
    if (life.phase === "choice") {
      const choices = engine.getChoices(life), choice = selectAutomaticChoice(choices, world, life) ?? choices[0];
      if (!choice) break;
      life = engine.choose(life, choice.id); continue;
    }
    // Sell actual finished products to finite funded buyers; this is not another annual work action.
    for (let count = 0; count < 24 && life.phase === "ready"; count++) {
      const sale = engine.getActivities(life).find(a => a.available && a.id.startsWith("v-sell-"));
      if (!sale) break;
      life = engine.act(life, sale.id);
    }
    const next = path.find(id => !life.capabilities?.learned[id]);
    if (!next) break;
    // Keep the annual market visit for supply work once the trading path needs it.
    const supplyYear = /^T(?:[5-9]|10)$/.test(next) && life.age % 4 !== 3;
    // Preserve one coming year's food and seed before financing work with grain surplus.
    if (life.demo && world.demo && life.age >= 12 && life.demo.lastTradeAge !== life.age && !supplyYear) {
      const h = householdView(world.demo, life as LifeStateWithDemo), m = marketView(world.demo, life as LifeStateWithDemo);
      const grain = m.quotes.find(q => q.item === "grain")!;
      const surplus = Math.max(0, life.demo.household.grain - h.expectedEating - 20 * life.demo.household.plots);
      const quantity = Math.floor(Math.min(surplus, world.demo.market.maxOrderQuantity, grain.merchantCanBuy));
      if (quantity > 0) {
        try { life = engine.demo(life, { type: "trade", item: "grain", side: "sell", quantity, counterparty: "merchant" }); } catch { /* The reserve guard remains authoritative. */ }
      }
    }
    // Two single-crop FC8 assessments, using the actual plan command and purchased seed.
    if (next === "FC8" && life.demo) {
      const grainDone = life.capabilities!.evidence.some(e => e.nodeId === "FC8" && e.kind === "farm-settlement" && e.data.qualifies === true && e.data.crop === "grain");
      const flaxPlots = grainDone ? life.demo.household.plots : 0;
      if (life.demo.household.flaxPlots !== flaxPlots) life = engine.demo(life, { type: "plan", flaxPlots });
      const seed = engine.getActivities(life).find(a => a.id === "v-buy-flax-seed" && a.available);
      if (grainDone && (life.vocations?.inventory["flax-seed"] ?? 0) < flaxPlots * 4 && seed) life = engine.act(life, seed.id);
    } else if (life.demo?.household.flaxPlots) life = engine.demo(life, { type: "plan", flaxPlots: 0 });
    const node = nodes.find(n => n.id === next)!;
    let actions = engine.getActivities(life);
    const workNode = next === "PP10" && (life.demo?.reputation ?? 0) < 60 ? "PP8" : next;
    const work = actions.find(a => a.id === `cap-work-${workNode.toLowerCase()}`);
    if (life.age >= 12 && life.age % 4 !== 3) {
      diagnostics.adultTurns++;
      diagnostics.lastUnmetNode = next;
      const progress = capabilityProgress(world, life, next);
      const reqs = requirementReasons(world, life, next);
      if (work?.available) {
        reason = `Advancing ${workNode} proof (${progress.done}/${progress.required} years).`;
        diagnostics.proofBlockedTurns++;
        diagnostics.lastBlocker = "proof";
        diagnostics.lastUnmetReason = reason;
      } else {
        reason = work?.reason ?? (reqs[0] ?? "Required work is unavailable.");
        const category = classifyWorkReason(reason);
        if (category === "cash") diagnostics.cashBlockedTurns++;
        else if (category === "materials") diagnostics.materialBlockedTurns++;
        else if (category === "opportunity") diagnostics.opportunityBlockedTurns++;
        else if (category === "proof") diagnostics.proofBlockedTurns++;
        else diagnostics.skillDetourTurns++;
        diagnostics.lastBlocker = category;
        diagnostics.lastUnmetReason = reason;
      }
    } else {
      reason = work?.reason ?? (life.age < 12 ? "Not old enough for work." : reason);
    }
    // The military lane needs an appointment before service work: seek it as a player would.
    // On the military lane a player asks for promotion as soon as it is open, not only when the next step demands it.
    const military = /^M\d+$/.test(target);
    const appointment = /Enlist and serve/.test(reason) ? "enlist-royal-army"
      : /Officer appointment is required/.test(reason) || military && life.character?.jobId === "soldier" ? "seek-officer-commission" : null;
    const appoint = appointment ? actions.find(a => a.id === appointment && a.available) : undefined;
    if (appoint) {
      try { life = engine.act(life, appoint.id); actions = engine.getActivities(life); } catch (error) { reason = error instanceof Error ? error.message : String(error); }
    }
    if (life.age >= 8 && life.age % 4 !== 3) {
      let selected = work?.available ? work : undefined;
      if (!selected) {
        const missing = Object.entries(node.minimumProficiency).filter(([id, n]) => (life.character?.skills[id] ?? 0) < n)
          .sort(([a, na], [b, nb]) => (nb - (life.character?.skills[b] ?? 0)) - (na - (life.character?.skills[a] ?? 0)));
        if (node.anyProficiency && !node.anyProficiency.some(group => Object.entries(group).every(([id,n]) => (life.character?.skills[id] ?? 0) >= n))) {
          missing.push(...Object.entries(node.anyProficiency[0]));
        }
        selected = missing.map(([id]) => actions.find(a => a.id === `v-practice-${id}` && a.available)).find(Boolean);
      }
      if (!selected && /cash|afford|fund|fee|materials|stock|buy/i.test(reason)) {
        selected = actions.find(a => a.id.startsWith("v-apprentice-") && a.available);
        if (selected) diagnostics.apprenticeFallbackTurns++;
      }
      if (selected) {
        try { life = engine.act(life, selected.id); } catch (error) { reason = error instanceof Error ? error.message : String(error); }
      }
    }
    if (life.phase === "ready") life = engine.advance(life);
  }
  const next = path.find(id => !life.capabilities?.learned[id]) ?? null;
  const mastered = Boolean(life.capabilities?.learned[target]);
  const blocker: BottleneckCategory = mastered ? "none" : !survived18 ? "early-death" : diagnostics.lastBlocker;
  return {
    seed, target, mastered, survived18, age: life.age,
    deepest: Math.max(0, ...path.filter(id => life.capabilities?.learned[id]).map(id => nodes.find(n => n.id === id)!.depth)),
    next, reason, commands: life.commands.length, home: life.paths?.home ?? null,
    originId: startOrigin, startCash, startNetWorth, wealthGroup, blocker, diagnostics,
  };
}
