/** Validation for life stages, event time frames, scopes and dependent resolutions. */
import { DECISION_SCOPES } from "./types.ts";

type DataObject = Record<string, unknown>;

export interface LifeStageValidationTools {
  fail(path: string, message: string): never;
  object(value: unknown, path: string, fields?: readonly string[], required?: readonly string[]): DataObject;
  array(value: unknown, path: string, min?: number, max?: number): unknown[];
  string(value: unknown, path: string, max?: number): string;
  id(value: unknown, path: string): string;
  integer(value: unknown, path: string, min: number, max: number): number;
  condition(value: unknown, path: string): void;
  effects(value: unknown, path: string): void;
}

export interface StageRules {
  /** Stage IDs in age order, and the first stage index deciding each scope. */
  order: string[];
  scopeStart: Record<string, number>;
  minAges: number[];
}

export function validateLifeStagesDefinition(value: unknown, maxAge: number, tools: LifeStageValidationTools): StageRules {
  const { fail, object, array, string, id, integer } = tools;
  const path = "world.lifeStages";
  const definition = object(value, path, ["stages", "scopes"]);
  const stages = array(definition.stages, `${path}.stages`, 1, 32);
  const order: string[] = [];
  const minAges: number[] = [];
  stages.forEach((entry, i) => {
    const stagePath = `${path}.stages[${i}]`;
    const stage = object(entry, stagePath, ["id", "title", "minAge"]);
    const stageId = id(stage.id, `${stagePath}.id`);
    if (order.includes(stageId)) fail(`${stagePath}.id`, `duplicate life stage '${stageId}'`);
    string(stage.title, `${stagePath}.title`, 100);
    const minAge = integer(stage.minAge, `${stagePath}.minAge`, 0, maxAge);
    if (i === 0 && minAge !== 0) fail(`${stagePath}.minAge`, "the first life stage must start at age 0");
    if (i > 0 && minAge <= minAges[i - 1]) fail(`${stagePath}.minAge`, "life stages must be in increasing age order");
    order.push(stageId);
    minAges.push(minAge);
  });
  const scopes = object(definition.scopes, `${path}.scopes`, DECISION_SCOPES);
  const scopeStart: Record<string, number> = {};
  for (const scope of DECISION_SCOPES) {
    const index = order.indexOf(scopes[scope] as string);
    if (index < 0) fail(`${path}.scopes.${scope}`, `unknown life stage '${String(scopes[scope])}'`);
    scopeStart[scope] = index;
  }
  return { order, scopeStart, minAges };
}

export interface StagedEventContext {
  /** Interrupts are selected outside the time-frame lanes; a child's medical care needs others to decide. */
  interrupt?: "medical" | "collection";
}

/** Checks one event's `stages`, `scope` and `dependent` against the world's rules. */
export function validateStagedEvent(event: DataObject, path: string, rules: StageRules | undefined, context: StagedEventContext, tools: LifeStageValidationTools): void {
  const { fail, array, string, id, object, condition, effects, integer } = tools;
  const staged = ["stages", "scope", "dependent"].filter(field => Object.hasOwn(event, field));
  if (!rules) {
    if (staged.length) fail(`${path}.${staged[0]}`, "requires world.lifeStages");
    return;
  }
  const trigger = event.trigger as DataObject;
  const decision = event.mode !== "automatic";
  let stageIndexes: number[] | undefined;
  if (Object.hasOwn(event, "stages")) {
    stageIndexes = array(event.stages, `${path}.stages`, 1, rules.order.length).map((value, i) => {
      const stageId = id(value, `${path}.stages[${i}]`);
      const index = rules.order.indexOf(stageId);
      if (index < 0) fail(`${path}.stages[${i}]`, `unknown life stage '${stageId}'`);
      return index;
    });
    if (new Set(stageIndexes).size !== stageIndexes.length) fail(`${path}.stages`, "duplicate life stage");
  } else if (!context.interrupt && trigger.type !== "year") {
    fail(`${path}.stages`, "random and age events must declare stages (their time frame)");
  }
  if (stageIndexes && trigger.type === "age") {
    const at = trigger.at as number;
    const stageOfAge = rules.minAges.reduce((found, minAge, index) => at >= minAge ? index : found, 0);
    if (!stageIndexes.includes(stageOfAge)) fail(`${path}.stages`, `trigger age ${at} is outside the event's stages`);
  }
  if (Object.hasOwn(event, "scope")) {
    if (!decision) fail(`${path}.scope`, "automatic events have no decision scope");
    if (!DECISION_SCOPES.includes(event.scope as never)) fail(`${path}.scope`, `expected one of ${DECISION_SCOPES.join(", ")}`);
  }
  const first = rules.scopeStart[(event.scope as string | undefined) ?? "personal"];
  if (Object.hasOwn(event, "dependent")) {
    if (!decision) fail(`${path}.dependent`, "automatic events already resolve without a choice");
    const dependent = object(event.dependent, `${path}.dependent`, ["text", "responses"]);
    string(dependent.text, `${path}.dependent.text`);
    const responses = array(dependent.responses, `${path}.dependent.responses`, 1, 32);
    const seen = new Set<string>();
    responses.forEach((entry, i) => {
      const responsePath = `${path}.dependent.responses[${i}]`;
      const response = object(entry, responsePath, ["id", "text", "when", "weight", "effects"], ["id", "text", "effects"]);
      const responseId = id(response.id, `${responsePath}.id`);
      if (seen.has(responseId)) fail(`${responsePath}.id`, `duplicate response '${responseId}'`);
      seen.add(responseId);
      string(response.text, `${responsePath}.text`);
      if (Object.hasOwn(response, "when")) condition(response.when, `${responsePath}.when`);
      if (Object.hasOwn(response, "weight")) integer(response.weight, `${responsePath}.weight`, 1, 1_000_000);
      effects(response.effects, `${responsePath}.effects`);
    });
    if (Object.hasOwn(responses[responses.length - 1] as DataObject, "when")) {
      fail(`${path}.dependent.responses`, "the last response must have no condition (the fallback)");
    }
  } else if (decision) {
    const reachable = stageIndexes ? stageIndexes.some(index => index >= first) : true;
    if (!reachable) fail(path, "this decision can never be decided by the player in its stages; add dependent responses");
    if (context.interrupt === "medical" && first > 0) fail(`${path}.dependent`, "a medical interrupt that younger players cannot decide needs dependent responses");
  }
}
