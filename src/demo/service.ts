/** Track C — wages and rations from the army purse, escort assignment, convoy resolution. */
import type { DemoContext, DemoDefinition, DemoEffect, LifeStateWithDemo } from "./contracts.ts";

/** Soldiers are paid from the purse (partial when short) and fed from army grain. */
export function payWages(ctx: DemoContext): void { void ctx; }
/** Assigns an escort shipment to a soldier when the cooldown allows. */
export function assignConvoy(ctx: DemoContext): void { void ctx; }
/** A grain dealer's army sale: routine on a safe road, otherwise a contract shipment. */
export function startContractShipment(ctx: DemoContext, quantity: number, price: number): void { void ctx; void quantity; void price; }
export function applyConvoy(ctx: DemoContext, effect: Extract<DemoEffect, { kind: "convoy" }>): void { void ctx; void effect; }

export interface ServiceView { serving: boolean; wage: number; ration: number; purse: number; reputation: number; readiness: string[]; shipment: LifeStateWithDemo["demo"]["shipment"] }
export function serviceView(def: DemoDefinition, life: LifeStateWithDemo): ServiceView {
  void def;
  return { serving: life.character?.jobId === "soldier", wage: 0, ration: 0, purse: life.demo.town.army.purse, reputation: life.demo.reputation, readiness: [], shipment: life.demo.shipment };
}
export interface ConvoyPreview { knownCosts: string[]; expectedLossBps: number; riskFactors: { label: string; effectBps: number }[] }
export function convoyPreview(def: DemoDefinition, life: LifeStateWithDemo): ConvoyPreview | null {
  void def; void life;
  return null;
}
