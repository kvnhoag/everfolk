import type { Category } from "../ids.ts";
import { usesDemoCatalog } from "../ids.ts";

/**
 * Decision event ids for alexandria-demo-1. Workflow 1 should author these ids.
 * flood failure → harvest; levy → war; convoy road → road.
 */
export const DEMO_KEY_DECISIONS: Readonly<Record<string, Category>> = Object.freeze({
  "flood-failure": "harvest",
  "levy-call": "war",
  "demo-flood-failure": "harvest",
  "demo-levy": "war",
  "demo-convoy-road": "road",
});

export function isDemoWorldVersion(worldVersion: string | undefined): boolean {
  return Boolean(worldVersion && usesDemoCatalog(worldVersion));
}
