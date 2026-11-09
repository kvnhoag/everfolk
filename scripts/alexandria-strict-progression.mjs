// Authored progression balance. These curves describe game rewards, not
// measured human ability, health, learning or social behaviour.
const curve = min => [
  { from: min, multiplier: 1 },
  { from: 40, multiplier: 0.5 },
  { from: 70, multiplier: 0.2 },
  { from: 90, multiplier: 0.05 },
];

export function applyStrictProgression(world) {
  for (const id of ["health", "knowledge", "bonds"]) world.stats[id].gainCurve = curve(world.stats[id].min);
  for (const definition of Object.values(world.character.skills)) definition.gainCurve = curve(definition.min);

  // Whole lesson rewards are smaller before their shared gain curve applies.
  // Secondary skill gains and small practical exercises remain unchanged.
  for (const activity of world.character.activities) {
    if (activity.category !== "training") continue;
    const primary = Object.entries(world.character.skills).find(([, definition]) => definition.trainingActivity === activity.id)?.[0];
    if (!primary) continue;
    for (const outcome of activity.outcomes) for (const effect of outcome.effects) {
      if (effect.type !== "skill" || effect.skill !== primary || effect.delta <= 0) continue;
      if (effect.delta >= 10) effect.delta = 6;
      else if (effect.delta === 8) effect.delta = 5;
    }
  }
  // These are short supervised practices, rather than another full year of
  // heavy labour. Permanent fatigue from each repeated lesson would turn the
  // longer learning curve into a lethal penalty alongside normal job wear.
  for (const id of ["train-craft", "train-carving", "train-sculpture"]) {
    const activity = world.character.activities.find(activity => activity.id === id);
    for (const outcome of activity.outcomes) outcome.effects = outcome.effects.filter(effect => !(effect.type === "stat" && effect.stat === "health" && effect.delta < 0));
  }
  for (const job of world.character.jobs) for (const effect of job.yearlyEffects) {
    if (effect.type !== "skill") continue;
    if (effect.delta === 4 || effect.delta === 3) effect.delta = 2;
    else if (effect.delta === 2) effect.delta = 1;
  }

  // Ordinary encounters remain in the record without permanently filling Bonds.
  for (const event of world.events) {
    if (event.mode === "automatic" && event.trigger.type === "random") {
      event.effects = (event.effects ?? []).filter(effect => !(effect.type === "stat" && effect.stat === "bonds" && effect.delta > 0));
    }
  }
  for (const choice of [...world.events.flatMap(event => event.choices), ...world.character.activities]) {
    for (const outcome of choice.outcomes) for (const effect of outcome.effects) {
      if (effect.type === "stat" && effect.stat === "bonds" && effect.delta >= 5) effect.delta = Math.floor(effect.delta / 2);
    }
  }
  const visit = world.character.activities.find(activity => activity.id === "visit-a-friend");
  for (const outcome of visit.outcomes) for (const effect of outcome.effects) {
    if (effect.type === "stat" && effect.stat === "bonds" && effect.delta === 4) effect.delta = 2;
  }
  world.yearlyRules.push({
    id: "close-ties-upkeep",
    when: { type: "all", conditions: [{ type: "age", op: "gte", value: 18 }, { type: "stat", stat: "bonds", op: "gte", value: 80 }] },
    effects: [{ type: "stat", stat: "bonds", delta: -0.5 }],
  });
  return world;
}
