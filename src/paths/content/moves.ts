/** District moves. Only the player moves; the household and its plot stay in the birth district. */
import type { Condition, LifeEvent } from "../../types.ts";
import { buildDecision } from "./needs.ts";

const not = (condition: Condition): Condition => ({ type: "not", condition });
const introducedAny = (...fields: Array<"clothing" | "ceramics" | "sculpture" | "trade" | "research" | "civic">): Condition =>
  ({ type: "any", conditions: fields.map(field => ({ type: "introduced", field })) });

export function moveEvents(): LifeEvent[] {
  return [
    buildDecision({ id: "move-city-apprenticeship", title: "An apprenticeship in the city", fields: ["clothing", "ceramics", "sculpture", "trade"],
      stages: ["adolescence", "youth"], scope: "work", anchor: true,
      when: { type: "all", conditions: [introducedAny("clothing", "ceramics", "sculpture", "trade"), not({ type: "district", district: "city-quarter" })] },
      text: "Through the master you met, a city workshop offers to take you on and give you a corner to sleep in. Your family would stay at home.",
      choices: [
        { key: "go", text: "Go to the city", result: "You tie up a bundle and walk to the city with a cousin.", effects: [{ type: "move-district", district: "city-quarter", reason: "an apprenticeship in a city workshop" }] },
        { key: "stay", text: "Stay with your family", result: "You send your thanks and stay at home.", effects: [] },
      ] }),
    buildDecision({ id: "move-court-study", title: "A place to study near the court", fields: ["research", "civic"],
      stages: ["youth", "adulthood"], scope: "work", anchor: true,
      when: { type: "all", conditions: [introducedAny("research", "civic"), { type: "skill", skill: "literacy", op: "gte", value: 20 },
        not({ type: "district", district: "court-quarter" })] },
      text: "A scholar you met offers lodging near the court quarter in return for copying and errands, and time to study.",
      choices: [
        { key: "go", text: "Go and study near the court", result: "You find a room above a copyist's shop.", effects: [{ type: "move-district", district: "court-quarter", reason: "study and copying work near the court" }] },
        { key: "stay", text: "Stay where you are", result: "You stay. The offer is not repeated.", effects: [] },
      ] }),
    { id: "move-garrison-posting", title: "Posted to the garrison", text: "Your unit is posted to the garrison. Soldiers go where they are sent.",
      trigger: { type: "random", weight: 2 }, stages: ["adulthood"], fields: ["soldiering"], maxOccurrences: 1, evidence: "fictional", mode: "automatic",
      when: { type: "all", conditions: [{ type: "job", job: "soldier" }, not({ type: "district", district: "garrison" })] },
      effects: [{ type: "move-district", district: "garrison", reason: "a posting with your unit" }], choices: [] },
    buildDecision({ id: "move-return-home", title: "Thinking of home", fields: ["farming"], stages: ["adulthood", "later-life"], scope: "personal", max: 2, cooldown: 5,
      when: { type: "all", conditions: [{ type: "away-from-home" }, { type: "job", job: null }] },
      text: "Without work here, you think more and more of your family's home.",
      choices: [
        { key: "return", text: "Go home to the family", result: "You walk home with everything you own on your back.", effects: [{ type: "move-district", district: "home", reason: "going back to the family" }] },
        { key: "stay", text: "Stay and look for work here", result: "You stay and keep looking.", effects: [] },
      ] }),
    { id: "move-letter-from-home", title: "A letter from home", trigger: { type: "random", weight: 1 }, stages: ["youth", "adulthood", "later-life"],
      maxOccurrences: 3, cooldownYears: 3, evidence: "fictional", mode: "automatic", choices: [],
      when: { type: "all", conditions: [{ type: "away-from-home" }, { type: "demo", condition: { kind: "year", family: "flood", level: "low" } } as Condition] },
      text: "A letter comes from home: the flood was low and the family is eating less. There is little you can do from here.",
      effects: [{ type: "stat", stat: "bonds", delta: -1 }] },
  ];
}
