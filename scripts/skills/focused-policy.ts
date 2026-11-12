import { createEngine } from "../../src/engine.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { CAPABILITY_NODES } from "../../src/capabilities/catalog.ts";
import { selectAutomaticChoice } from "../../client/models/yearly-focus.ts";
import { householdView } from "../../src/demo/household.ts";
import { marketView } from "../../src/demo/market.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";

export const FOCUSED_TARGETS = ["FC10", "FR10", "AT10", "AC10", "AS10", "PS10", "PP10", "T10"] as const;
export interface FocusedResult { seed: string; target: string; mastered: boolean; survived18: boolean; age: number; deepest: number; next: string | null; reason: string; commands: number; home: string | null }

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
    reason = work?.reason ?? "Required work is unavailable.";
    // The military lane needs an appointment before service work: seek it as a player would.
    const appointment = /Enlist and serve/.test(reason) ? "enlist-royal-army" : /Officer appointment is required/.test(reason) ? "seek-officer-commission" : null;
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
      if (!selected && /cash|afford|fund|fee|materials|stock|buy/i.test(reason)) selected = actions.find(a => a.id.startsWith("v-apprentice-") && a.available);
      if (selected) {
        try { life = engine.act(life, selected.id); } catch (error) { reason = error instanceof Error ? error.message : String(error); }
      }
    }
    if (life.phase === "ready") life = engine.advance(life);
  }
  const next = path.find(id => !life.capabilities?.learned[id]) ?? null;
  return { seed, target, mastered: Boolean(life.capabilities?.learned[target]), survived18, age: life.age,
    deepest: Math.max(0, ...path.filter(id => life.capabilities?.learned[id]).map(id => nodes.find(n => n.id === id)!.depth)), next,
    reason, commands: life.commands.length, home: life.paths?.home ?? null };
}
