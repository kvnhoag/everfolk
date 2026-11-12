import type { Condition } from "../../src/types.ts";
import type { InfluenceEntry } from "./influence-entry.ts";
import { age, all } from "./content.ts";

const yearAtLeast = (value: number): Condition => ({ type: "year", op: "gte", value });
const conditionsOf = (condition: Condition | undefined): Condition[] =>
  condition?.type === "all" ? condition.conditions : condition ? [condition] : [];

function afterYear(condition: Condition | undefined, year: number): Condition {
  return all(...conditionsOf(condition).filter(item =>
    !(item.type === "year" && item.op === "gte" && item.value === year)), yearAtLeast(year));
}

/** Exact Euclid life dates are unknown; preserve skill gates without inventing a last year. */
function matureGeometry(condition: Condition | undefined): Condition {
  const others = conditionsOf(condition).filter(item =>
    item.type !== "age" && !(item.type === "year" && item.op === "gte" && item.value === -300));
  return all(age("gte", 18), yearAtLeast(-300), ...others);
}

/**
 * Historical corrections for a newly authored pack. Never apply this to a
 * retained world during loading or replay: that world's content and fingerprint
 * must remain the exact version in which the life was played.
 */
export function correctHistoricalInfluences(influences: readonly InfluenceEntry[]): InfluenceEntry[] {
  const corrected = structuredClone([...influences]);
  for (const entry of corrected) {
    const event = entry.event;
    if (!event) continue;
    switch (entry.id) {
      case "aristotle.lyceum":
        entry.label = "Aristotle's teaching reaches readers through questions and demonstrations from the Lyceum.";
        event.when = afterYear(event.when, -335);
        break;
      case "aristotle.tutor-court":
        entry.label = "Aristotelian teaching reaches a royal household through a tutor familiar with his arguments.";
        event.text = event.text.replace("a tutor trained in Aristotle's school", "a tutor familiar with Aristotle's arguments");
        break;
      case "euclid.school": {
        entry.label = "Euclid's geometrical teaching: readers learn to justify each step of a demonstration.";
        event.when = matureGeometry(event.when);
        event.text = "Around 300 BCE, a teacher in Alexandria invites readers to work through geometrical demonstrations of the kind collected in Euclid's Elements. Figures help you follow a construction, but each claim must be justified from definitions and earlier results. A small fee can be met with practical help.";
        for (const choice of event.choices) {
          if (choice.id === "euclid-school-attend") {
            choice.text = "Join the geometry lessons";
            const result = choice.outcomes.find(item => item.id === "euclid-school-attend-result");
            if (result) result.text = "You read the propositions, draw the constructions and explain why one result follows from another. By the end of the season you can present a short demonstration and answer an objection.";
          }
          if (choice.id === "euclid-school-errands") {
            choice.text = "Help the teaching circle and listen to the lessons";
            const result = choice.outcomes.find(item => item.id === "euclid-school-errands-result");
            if (result) result.text = "You carry materials and messages for the teacher, then listen as readers justify the steps of a construction. The practical work earns you a place at the edge of the discussion.";
          }
        }
        break;
      }
      case "euclid.museum": {
        entry.label = "Check the proofs: readers copy constructions and justify each step in Euclid's geometrical tradition.";
        event.title = "Work with the geometers";
        event.text = "A geometrical teaching circle in Alexandria needs a capable reader to check constructions and copy demonstrations. The paid work draws on the mathematical tradition represented by Euclid's Elements. Each step must follow from agreed definitions or earlier results, and careless help is soon dismissed.";
        event.when = matureGeometry(event.when);
        event.sourceIds = ["classical-euclid"];
        for (const choice of event.choices) {
          if (choice.id === "euclid-museum-accept") {
            choice.text = "Accept the work and check the demonstrations";
            if (choice.opportunity) choice.opportunity.label = "Work with the geometers";
            for (const outcome of choice.outcomes) {
              if (outcome.id === "euclid-museum-accepted") outcome.text = "You check constructions line by line, justify the disputed steps and copy corrected demonstrations. At the end of the season the readers recommend you for further paid work.";
              if (outcome.id === "euclid-museum-dismissed") outcome.text = "An error in your first copied figure costs you the readers' trust, and the work goes to someone else. You keep what you learned checking the demonstration.";
            }
          }
          if (choice.id === "euclid-museum-decline") {
            const result = choice.outcomes.find(item => item.id === "euclid-museum-decline-result");
            if (result) result.text = "You decline the work. The circle finds another reader, and your own work goes on as before.";
          }
        }
        break;
      }
      case "cleomenes.granaries":
        // Authored relief alternative, not an attested benevolent policy or proof
        // Cleomenes personally filled these stores. The existing source supports
        // the setting only; hostile historical grain-policy accounts need criticism.
        entry.label = "Release grain reserves: the administration issues rations to households weakened during a shortage.";
        event.text = "A grain shortage has left your household weak. Officials in Cleomenes' revenue administration release grain from reserve stores and issue measured rations. A clerk records your household's name and the share you receive.";
        break;
    }
  }
  return corrected;
}
