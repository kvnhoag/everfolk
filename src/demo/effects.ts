/** Lead — dispatch of demo effects and conditions to their modules. */
import type { LifeState } from "../types.ts";
import type { DemoCondition, DemoContext, DemoEffect } from "./types.ts";
import { applyConvoy } from "./service.ts";
import { applyWork, changeReputation, isBuilt } from "./works.ts";
import { applyOffer } from "./agents.ts";

function compare(left: number, op: string, right: number): boolean {
  return op === "gte" ? left >= right : op === "lte" ? left <= right : op === "gt" ? left > right : op === "lt" ? left < right : left === right;
}

function itemAmount(life: LifeState, item: string): number {
  const demo = life.demo!;
  if (item === "grain") return demo.household.grain;
  if (item === "flax") return demo.household.flax;
  if (item === "ox" || item === "donkey") return demo.household.animals[item];
  return demo.goods[item as keyof typeof demo.goods] ?? 0;
}

export function applyDemoEffect(ctx: DemoContext, effect: DemoEffect): void {
  const { demo } = ctx;
  switch (effect.kind) {
    case "grain": {
      const next = demo.household.grain + effect.delta;
      demo.household.grain = Math.max(0, next);
      ctx.journal(`grain-${effect.cause}`, effect.delta >= 0 ? `${effect.delta} measures of grain reach your store (${effect.cause}).` : `${-effect.delta} measures of grain leave your store (${effect.cause}).`);
      break;
    }
    case "item": {
      if (effect.item === "flax") demo.household.flax = Math.max(0, demo.household.flax + effect.delta);
      else if (effect.item === "ox" || effect.item === "donkey") demo.household.animals[effect.item] = Math.max(0, demo.household.animals[effect.item] + effect.delta);
      else demo.goods[effect.item] = Math.max(0, demo.goods[effect.item] + effect.delta);
      break;
    }
    case "reputation": changeReputation(ctx, effect.delta, "your choice"); break;
    case "work": applyWork(ctx, effect); break;
    case "share-grain": {
      const shared = Math.min(effect.quantity, demo.household.grain);
      demo.household.grain -= shared;
      demo.town.grower.grain += shared; // neighbours' households; stays in the town's grain
      break;
    }
    case "grain-to": {
      const moved = Math.min(effect.quantity, demo.household.grain);
      demo.household.grain -= moved;
      if (effect.to === "crown") demo.town.army.grain += moved; else demo.town.grower.grain += moved;
      ctx.journal(`grain-${effect.cause}`, `${moved} measures of grain go to the ${effect.to === "crown" ? "royal granary" : "temple store"} (${effect.cause}).`);
      break;
    }
    case "plot": {
      demo.household.plots = Math.max(0, demo.household.plots + effect.delta);
      ctx.journal(`plot-${effect.cause}`, `The household now holds ${demo.household.plots} plots (${effect.cause}).`);
      break;
    }
    case "harvest-bonus": demo.household.harvestBonusBps += effect.bps; break;
    case "convoy": applyConvoy(ctx, effect); break;
    case "offer": applyOffer(ctx, effect); break;
  }
}

export function matchesDemoCondition(life: LifeState, condition: DemoCondition): boolean {
  const demo = life.demo;
  if (!demo) return false;
  switch (condition.kind) {
    case "year": return demo.year[condition.family] === condition.level && (!condition.fresh || demo.year.fresh.includes(condition.family));
    case "item": return compare(itemAmount(life, condition.item), condition.op, condition.value);
    case "reputation": return compare(demo.reputation, condition.op, condition.value);
    case "work": return isBuilt(demo, condition.work) === condition.built;
    case "convoy": return condition.stage === "none" ? demo.shipment === null : demo.shipment?.stage === condition.stage;
    case "offer": return demo.offer?.kind === condition.offer;
    case "hungry": return demo.household.lastShortfallBps > 0;
    case "plots": return compare(demo.household.plots, condition.op, condition.value);
    case "head-of-plot": return (demo.household.headSinceAge !== null) === condition.value;
  }
}
