// Separate funding lanes keep the historical undertakings and their dates intact.
// Household money pays for privileged lessons and service; personal cash remains
// the currency of the common-life versions. Apply only to a newly built pack.
const audiences = ["royal", "aristocrat"];

function needsFunding(value) {
  if (!value || typeof value !== "object") return false;
  if (value.type === "cash" && (value.delta < 0 || value.value > 0)) return true;
  if (value.type === "stat" && value.stat === "wealth" && (value.delta < 0 || value.value > 0)) return true;
  return Object.values(value).some(needsFunding);
}

/** Convert every nested monetary rule, including outcome weight conditions. */
function funded(value, audience, unitsPerPoint) {
  if (Array.isArray(value)) return value.map(item => funded(item, audience, unitsPerPoint));
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, funded(item, audience, unitsPerPoint)]));
  const wealth = result.type === "stat" && result.stat === "wealth";
  if (result.type === "cash" || wealth) {
    result.type = audience;
    result.metric = "treasury";
    if (wealth) {
      delete result.stat;
      if (result.value !== undefined) result.value *= unitsPerPoint;
      if (result.delta !== undefined) result.delta *= unitsPerPoint;
    }
  }
  return result;
}

function namespaceOutcomes(item, audience) {
  for (const outcome of item.outcomes ?? []) outcome.id = `${audience}-${outcome.id}`;
  if (item.opportunity) item.opportunity.outcomeIds = item.opportunity.outcomeIds.map(id => `${audience}-${id}`);
}

function householdCopy(original, audience, unitsPerPoint) {
  const copy = funded(original, audience, unitsPerPoint);
  copy.id = `${audience}-${original.id}`;
  copy.audience = audience;
  if (copy.exclusiveGroup) copy.exclusiveGroup = `${audience}-${copy.exclusiveGroup}`;
  namespaceOutcomes(copy, audience);
  for (const choice of copy.choices ?? []) {
    choice.id = `${audience}-${choice.id}`;
    namespaceOutcomes(choice, audience);
  }
  return copy;
}

export function applyHouseholdTitleBridges(world) {
  const unitsPerPoint = world.economy?.unitsPerPoint;
  if (!Number.isFinite(unitsPerPoint) || unitsPerPoint <= 0) throw new Error("Household title bridges require a positive currency scale.");
  const shared = item => item.audience === undefined || item.audience === "common";
  const training = world.character.activities.filter(item => item.category === "training" && shared(item) && needsFunding(item));
  const historical = world.events.filter(item => item.id.startsWith("historical-") && shared(item));
  const activityIds = new Set(world.character.activities.map(item => item.id));
  const eventIds = new Set(world.events.map(item => item.id));
  for (const audience of audiences) {
    for (const activity of training) {
      const copy = householdCopy(activity, audience, unitsPerPoint);
      if (activityIds.has(copy.id)) throw new Error(`Duplicate household training bridge: ${copy.id}`);
      world.character.activities.push(copy);
      activityIds.add(copy.id);
    }
    for (const event of historical) {
      const copy = householdCopy(event, audience, unitsPerPoint);
      if (eventIds.has(copy.id)) throw new Error(`Duplicate household historical bridge: ${copy.id}`);
      world.events.push(copy);
      eventIds.add(copy.id);
    }
  }
  // Each life can encounter one funding lane, with the same achievement and
  // decline flags throughout its historical path. Do not rename these gates.
  for (const item of [...training, ...historical]) item.audience = "common";
  return world;
}
