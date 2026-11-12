/** Fixes from play-testing that apply to the new free-play world only; older packs keep their exact text and rules. */
import type { Condition, WorldPack } from "../types.ts";

const SHORT_STORE: Condition = { type: "demo", condition: { kind: "item", item: "grain", op: "lte", value: 1000 } } as Condition;

export function applyPlaytestFixes(world: WorldPack): void {
  // Sixteen errand meetings shared the same prompt at double weight; as ordinary stories they no longer crowd every year.
  for (const event of world.events) if (event.id.startsWith("meet-person-") && event.trigger.type === "random") event.trigger = { ...event.trigger, weight: 1 };
  // A flax harvest pays rent like a grain harvest.
  if (world.demo) world.demo.household.rentOnFlax = true;
  const flood = world.events.find(event => event.id === "flood-failure");
  const ration = flood?.choices.find(choice => choice.id === "flood-ration-keep-seed");
  if (ration) {
    // Rationing only makes sense when the store is short; its cost is hunger (health), not a smaller ledger line.
    ration.when = SHORT_STORE;
    ration.outcomes = ration.outcomes.map(outcome => ({ ...outcome,
      text: "Everyone goes a little hungry to stretch the store, but the seed grain stays in its jars and the whole plot is sown when the water allows." }));
  }
}
