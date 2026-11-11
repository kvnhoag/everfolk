import type { Choice, LifeEngine, LifeState, WorldPack } from "../../src/types.ts";
import type { DemoCommand, TradeCommand, TownRole } from "../../src/demo/types.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";
import { availability } from "../../src/demo/availability.ts";
import { UNAVAILABLE_REASON } from "../../src/demo/types.ts";
import { householdView } from "../../src/demo/household.ts";
import { marketView, tradeReason } from "../../src/demo/market.ts";
import { convoyPreview, serviceView } from "../../src/demo/service.ts";
import { worksView } from "../../src/demo/works.ts";
import { yearView } from "../../src/demo/timeline.ts";
import type { HouseholdView } from "../../src/demo/household.ts";
import type { MarketView } from "../../src/demo/market.ts";
import type { ConvoyPreview, ServiceView } from "../../src/demo/service.ts";
import type { WorksView } from "../../src/demo/works.ts";
import type { YearView } from "../../src/demo/timeline.ts";

export { DEMO_WORLD_VERSION } from "../../chain/ids.ts";
import { isDemoVersion } from "../../chain/ids.ts";
export { UNAVAILABLE_REASON };

const ROLE_LABEL: Record<TownRole, string> = { merchant: "Merchant", grower: "Grower", army: "Army" };

export interface AgentLine { role: TownRole; text: string }
export interface DemoScreen {
  year: YearView;
  household: HouseholdView;
  market: MarketView;
  service: ServiceView;
  convoy: ConvoyPreview | null;
  works: WorksView;
  agents: AgentLine[];
  offerText: string | null;
  futurePaths: { id: string; title: string; description: string; prerequisites?: string }[];
}

export function isDemoWorld(world: Pick<WorldPack, "version">): boolean {
  return isDemoVersion(world.version);
}

export function freePlayIntro(world: Pick<WorldPack, "version">): string | null {
  if (!isDemoWorld(world)) return null;
  return "Farm a household plot or serve with the army. Grain, wages and the convoy stay in the story. No wallet is asked.";
}

export function demoScreen(world: WorldPack, life: LifeState): DemoScreen | null {
  if (!world.demo || !life.demo) return null;
  const typed = life as LifeStateWithDemo;
  const def = world.demo;
  return {
    year: yearView(def, typed),
    household: householdView(def, typed),
    market: marketView(def, typed),
    service: serviceView(def, typed),
    convoy: convoyPreview(def, typed),
    works: worksView(def, typed),
    agents: (["merchant", "grower", "army"] as const).map(role => {
      const name = typed.demo.agents.assigned[role];
      return { role, text: name ? ROLE_LABEL[role] + ": agent " + name : ROLE_LABEL[role] + ": fixed rules" };
    }),
    offerText: offerLine(typed),
    futurePaths: def.availability.futurePaths,
  };
}

function offerLine(life: LifeStateWithDemo): string | null {
  const offer = life.demo.offer;
  if (!offer) return null;
  const who = offer.agent ? "agent " + offer.agent : "fixed rules";
  return ROLE_LABEL[offer.role] + " (" + who + ") offers " + offer.quantity + " " + offer.item + " at " + offer.price + " each.";
}

export function orderPreview(world: WorldPack, life: LifeState, command: TradeCommand): string | null {
  if (!world.demo || !life.demo) return "This life has no grain market.";
  return tradeReason(world.demo, life as LifeStateWithDemo, command) ?? null;
}

export function beginOrder(slot: { current: boolean }): boolean {
  if (slot.current) return false;
  slot.current = true;
  return true;
}

export function releaseOrder(slot: { current: boolean }): void {
  slot.current = false;
}

export function sendDemoCommand(
  engine: LifeEngine,
  life: LifeState,
  command: DemoCommand,
  slot: { current: boolean },
): { sent: true; life: LifeState } | { sent: false; reason: string } {
  if (command.type === "trade") {
    const reason = orderPreview(engine.world, life, command);
    if (reason) return { sent: false, reason };
  }
  if (!beginOrder(slot)) return { sent: false, reason: "That order is already being sent." };
  try {
    return { sent: true, life: engine.demo(life, command) };
  } catch (error) {
    releaseOrder(slot);
    return { sent: false, reason: error instanceof Error ? error.message : "That order could not be sent." };
  }
}

export type ActivityGate =
  | { action: "ignore" }
  | { action: "blocked"; reason: string }
  | { action: "loan" }
  | { action: "act" };

export function activityGate(
  world: WorldPack,
  activity: { id: string; available: boolean; reason?: string; outcomes?: Choice["outcomes"] } | undefined,
  loanOffer: boolean,
  borrowChoice: boolean,
): ActivityGate {
  if (!activity) return { action: "ignore" };
  const mark = availability(world.demo, "activity", activity.id);
  const grantsUnavailable = activity.outcomes?.some(outcome => outcome.effects.some(effect => {
    if (effect.type === "job" && effect.job) return availability(world.demo, "job", effect.job).status === "unavailable";
    if (effect.type === "accomplishment") return availability(world.demo, "accomplishment", effect.achievement).status === "unavailable";
    return false;
  })) ?? false;
  if (mark.status === "unavailable" || activity.reason === UNAVAILABLE_REASON || grantsUnavailable) {
    return { action: "blocked", reason: mark.status === "unavailable" ? mark.reason : UNAVAILABLE_REASON };
  }
  if (loanOffer) return { action: "loan" };
  if (activity.available && borrowChoice) return { action: "loan" };
  return { action: "act" };
}

export function occupationBadge(world: WorldPack, jobId: string, current: boolean, canTake: boolean): { label: string; detail: string | null } {
  if (current) return { label: "Current job", detail: null };
  const mark = availability(world.demo, "job", jobId);
  if (mark.status === "unavailable") return { label: "Unavailable", detail: UNAVAILABLE_REASON };
  if (canTake) return { label: "Available", detail: null };
  if (world.demo) return { label: "Locked", detail: null };
  return { label: "Unavailable", detail: null };
}

export function choiceIsUnavailable(world: WorldPack | undefined, choice: Choice): boolean {
  if (!world?.demo) return false;
  if (availability(world.demo, "activity", choice.id).status === "unavailable") return true;
  return choice.outcomes.some(outcome => outcome.effects.some(effect => {
    if (effect.type === "job" && effect.job) return availability(world.demo, "job", effect.job).status === "unavailable";
    if (effect.type === "accomplishment") return availability(world.demo, "accomplishment", effect.achievement).status === "unavailable";
    return false;
  }));
}
