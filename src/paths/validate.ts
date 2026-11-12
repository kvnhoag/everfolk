/** Validation for the opt-in `world.paths` block and event field tags. */
import type { LifeStageValidationTools } from "../life-stages/validate.ts";
import { FIELD_IDS, TIERS } from "./types.ts";

type DataObject = Record<string, unknown>;

export interface PathsValidationTools extends LifeStageValidationTools {
  skills: Set<string>;
  jobs: Set<string>;
  origins: Set<string>;
}

const BPS_MAX = 100_000;

function validateField(value: unknown, path: string, tools: PathsValidationTools): void {
  const { object, string, array, fail } = tools;
  const field = object(value, path, ["title", "practitioner", "skills", "jobs", "specializations"]);
  string(field.title, `${path}.title`, 100);
  string(field.practitioner, `${path}.practitioner`, 100);
  array(field.skills, `${path}.skills`, 1, 16).forEach((skill, i) => {
    if (!tools.skills.has(skill as string)) fail(`${path}.skills[${i}]`, `unknown skill '${String(skill)}'`);
  });
  array(field.jobs, `${path}.jobs`, 0, 32).forEach((job, i) => {
    if (!tools.jobs.has(job as string)) fail(`${path}.jobs[${i}]`, `unknown job '${String(job)}'`);
  });
  array(field.specializations, `${path}.specializations`, 0, 8).forEach((name, i) => string(name, `${path}.specializations[${i}]`, 100));
}

function validateDistrict(value: unknown, path: string, tools: PathsValidationTools, claimed: Map<string, string>, districtId: string): void {
  const { object, string, array, integer, fail } = tools;
  const district = object(value, path, ["title", "origins", "profile"]);
  string(district.title, `${path}.title`, 100);
  array(district.origins, `${path}.origins`, 0, 32).forEach((origin, i) => {
    if (!tools.origins.has(origin as string)) fail(`${path}.origins[${i}]`, `unknown origin '${String(origin)}'`);
    if (claimed.has(origin as string)) fail(`${path}.origins[${i}]`, `origin '${String(origin)}' starts in more than one district`);
    claimed.set(origin as string, districtId);
  });
  const profile = object(district.profile, `${path}.profile`, FIELD_IDS);
  for (const field of FIELD_IDS) {
    const entry = object(profile[field], `${path}.profile.${field}`, ["demand", "people"]);
    integer(entry.demand, `${path}.profile.${field}.demand`, 0, 10_000);
    const people = array(entry.people, `${path}.profile.${field}.people`, TIERS.length, TIERS.length);
    people.forEach((count, i) => integer(count, `${path}.profile.${field}.people[${i}]`, 0, 10_000));
  }
}

function validateByOrigin(value: unknown, path: string, tools: PathsValidationTools, entry: (value: unknown, path: string) => void): void {
  const map = tools.object(value, path);
  for (const [origin, inner] of Object.entries(map)) {
    if (!tools.origins.has(origin)) tools.fail(`${path}.${origin}`, `unknown origin '${origin}'`);
    entry(inner, `${path}.${origin}`);
  }
}

export function validatePathsDefinition(value: unknown, hasLifeStages: boolean, tools: PathsValidationTools): void {
  const { object, integer, id, fail } = tools;
  const path = "world.paths";
  if (!hasLifeStages) fail(path, "requires world.lifeStages");
  const paths = object(value, path, ["fields", "districts", "pay", "startingMaterials", "originAffinity"], ["fields", "districts", "pay"]);
  const fields = object(paths.fields, `${path}.fields`, FIELD_IDS);
  for (const field of FIELD_IDS) validateField(fields[field], `${path}.fields.${field}`, tools);
  const districts = object(paths.districts, `${path}.districts`);
  const ids = Object.keys(districts);
  if (ids.length === 0) fail(`${path}.districts`, "expected at least one district");
  const claimed = new Map<string, string>();
  for (const districtId of ids) {
    id(districtId, `${path}.districts.${districtId}`);
    validateDistrict(districts[districtId], `${path}.districts.${districtId}`, tools, claimed, districtId);
  }
  const pay = object(paths.pay, `${path}.pay`, ["minBps", "maxBps", "scarceBps", "crowdedBps"]);
  const minBps = integer(pay.minBps, `${path}.pay.minBps`, 1, BPS_MAX);
  const maxBps = integer(pay.maxBps, `${path}.pay.maxBps`, 1, BPS_MAX);
  if (minBps > 10_000 || maxBps < 10_000) fail(`${path}.pay.minBps`, "minBps must be at most 10000 and maxBps at least 10000");
  const crowded = integer(pay.crowdedBps, `${path}.pay.crowdedBps`, minBps, maxBps);
  const scarce = integer(pay.scarceBps, `${path}.pay.scarceBps`, minBps, maxBps);
  if (crowded >= scarce) fail(`${path}.pay.crowdedBps`, "crowdedBps must be below scarceBps");
  if (Object.hasOwn(paths, "startingMaterials")) validateByOrigin(paths.startingMaterials, `${path}.startingMaterials`, tools, (inner, innerPath) => {
    for (const [item, amount] of Object.entries(object(inner, innerPath))) integer(amount, `${innerPath}.${item}`, 0, 10_000);
  });
  if (Object.hasOwn(paths, "originAffinity")) validateByOrigin(paths.originAffinity, `${path}.originAffinity`, tools, (inner, innerPath) => {
    for (const [field, amount] of Object.entries(object(inner, innerPath, FIELD_IDS, []))) integer(amount, `${innerPath}.${field}`, 0, 100);
  });
}

/** An event's `fields` tags must name known fields, and need a paths world. */
export function validateEventFields(event: DataObject, path: string, hasPaths: boolean, tools: LifeStageValidationTools): void {
  if (!Object.hasOwn(event, "fields")) return;
  if (!hasPaths) tools.fail(`${path}.fields`, "requires world.paths");
  const fields = tools.array(event.fields, `${path}.fields`, 1, FIELD_IDS.length);
  fields.forEach((field, i) => {
    if (!FIELD_IDS.includes(field as never)) tools.fail(`${path}.fields[${i}]`, `unknown field '${String(field)}'`);
  });
  if (new Set(fields).size !== fields.length) tools.fail(`${path}.fields`, "duplicate field");
}
