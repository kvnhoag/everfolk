import type { Condition, Effect, LifeState, StatDefinition, WorldPack } from "../../src/types.ts";
import { applyStatDelta, skillEffectDelta } from "../../src/progression.ts";
import { buildLifeEvents } from "./life-events.ts";
import type { LifeEventYear } from "./life-events.ts";

const DEMO_IMPORTANT_EVENTS = new Set([
  "household-hunger", "household-ox-died", "household-donkey-died", "household-hand-over", "household-parents-gone",
  "army-ration-shortfall", "army-wage-shortfall", "convoy-assigned", "convoy-contract", "convoy-withdrawn",
  "convoy-loss", "convoy-delivered", "convoy-pay-shortfall", "offer-settled",
]);

const WORLD_STORY_FLAGS = new Set(["experienced-war", "alexander-in-egypt", "alexandria-founded", "ptolemy-governs-egypt", "ptolemy-king"]);

/** Flags matter when they change future eligibility, odds, or route progression. */
function flagReaders(world: WorldPack) {
  const readers = new Map<string, Set<string>>();
  const add = (flag: string, value: boolean, owner: string) => {
    const key = `${flag}:${value}`;
    const owners = readers.get(key) ?? new Set<string>();
    owners.add(owner); readers.set(key, owners);
  };
  const condition = (value: Condition | undefined, owner: string, inverted = false): void => {
    if (!value) return;
    if (value.type === "flag") add(value.flag, inverted ? !value.value : value.value, owner);
    else if (value.type === "all" || value.type === "any") value.conditions.forEach(child => condition(child, owner, inverted));
    else if (value.type === "not") condition(value.condition, owner, !inverted);
  };
  for (const source of [...world.events, ...(world.character?.activities ?? [])]) {
    condition(source.when, source.id);
    const choices = "choices" in source ? source.choices : [source];
    for (const choice of choices) {
      condition(choice.when, source.id);
      for (const outcome of choice.outcomes) {
        for (const modifier of outcome.weightModifiers ?? []) condition(modifier.when, source.id);
        for (const effect of outcome.effects) if (effect.type === "skill") {
          for (const modifier of effect.gainModifiers ?? []) add(modifier.flag, true, source.id);
        }
      }
    }
  }
  for (const route of world.legacy?.routes ?? []) if (route.earlyInterestFlag) add(route.earlyInterestFlag, true, `route:${route.id}`);
  for (const ending of world.endings) condition(ending.when, `ending:${ending.id}`);
  return readers;
}

/**
 * A presentation filter over completed facts, without replaying the engine.
 * Numeric notices require a reliably known before/after value. Random birth
 * rolls and unrecorded annual changes remain unknown rather than guessed.
 */
export function buildImportantLifeEvents(life: LifeState, world: WorldPack): LifeEventYear[] {
  const years = buildLifeEvents(life, world);
  const important = new Set<string>();
  const suppressed = new Set<number>();
  const events = new Map(world.events.map(event => [event.id, event]));
  const activities = new Map(world.character?.activities.map(activity => [activity.id, activity]) ?? []);
  const jobs = new Map(world.character?.jobs.map(job => [job.id, job]) ?? []);
  const outcomes = new Map<string, { owner: string; effects: readonly Effect[] }>();
  for (const event of world.events) for (const choice of event.choices) for (const outcome of choice.outcomes) outcomes.set(outcome.id, { owner: event.id, effects: outcome.effects });
  for (const activity of activities.values()) for (const outcome of activity.outcomes) outcomes.set(outcome.id, { owner: activity.id, effects: outcome.effects });
  const readers = flagReaders(world);
  const origin = world.origins.find(item => item.id === life.originId);
  const flags = Object.fromEntries(Object.entries(world.flags).map(([id, definition]) => [id, definition.initial]));
  const stats = new Map<string, number | undefined>(Object.entries(world.stats).map(([id, definition]) => {
    const range = origin?.statRanges?.[id] ?? definition.initialRange;
    return [id, range ? range.min === range.max ? range.min : undefined : definition.initial];
  }));
  const skills = new Map<string, number | undefined>(Object.entries(world.character?.skills ?? {}).map(([id, definition]) => [id, definition.initial]));
  const roles = new Set<string>();
  const assets = new Map<string, number>();
  const known = new Set<string>();
  let job: string | null = null, partner: string | null = null, status = "single";
  let loanBalance = 0;
  const keyAt = (index: number) => { const entry = life.journal[index]; return `${entry.age}-${index}-${entry.type}-${entry.id}`; };
  const sourceAt = (index: number) => {
    const entry = life.journal[index];
    if (entry.type === "outcome") return outcomes.get(entry.id);
    const event = entry.type === "event" ? events.get(entry.id) : undefined;
    if (event?.mode === "automatic") return { owner: event.id, effects: event.effects ?? [] };
    return undefined;
  };
  const boundary = (index: number) => {
    const entry = life.journal[index];
    return entry.type === "birth" || entry.type === "year" || entry.type === "choice" || entry.type === "outcome" ||
      entry.type === "event" && events.has(entry.id) || entry.type === "activity" && activities.has(entry.id);
  };
  function apply(effects: readonly Effect[], owner: string, generated: readonly number[] = []): boolean {
    const beforeFlags = { ...flags }, beforeStats = new Map(stats), beforeSkills = new Map(skills);
    const beforeJob = job, beforePartner = partner, beforeStatus = status;
    const assetState = () => JSON.stringify([...assets].filter(([, quantity]) => quantity !== 0).sort());
    const beforeRoles = [...roles].sort().join("|"), beforeAssets = assetState();
    const beforeKnown = known.size;
    let verifiedFact = false, money = 0, directMoney = false, ended = false;
    const has = (id: string) => generated.some(index => life.journal[index].id === id);
    for (const effect of effects) {
      if (effect.type === "end") { ended = true; break; }
      if (effect.type === "flag") flags[effect.flag] = effect.value;
      else if (effect.type === "job") job = effect.job;
      else if (effect.type === "relationship") { partner = effect.partner; status = effect.status; }
      else if (effect.type === "end-courtship") { partner = null; status = "single"; }
      else if (effect.type === "divorce") { partner = null; status = "divorced"; }
      else if (effect.type === "social-role") {
        const key = `${effect.partner}:${effect.role}`;
        if (effect.active) roles.add(key); else roles.delete(key);
      } else if (effect.type === "introduce" && has(`met-${effect.partner}`)) known.add(effect.partner);
      else if (effect.type === "asset") assets.set(effect.asset, (assets.get(effect.asset) ?? 0) + effect.delta);
      else if (effect.type === "accomplishment" && has(`earned-${effect.achievement}`)) verifiedFact = true;
      else if (effect.type === "child" && generated.some(index => /^child-\d+$/.test(life.journal[index].id))) verifiedFact = true;
      else if (effect.type === "condition" && has(`health-onset-${effect.condition}`)) verifiedFact = true;
      else if (effect.type === "loan") {
        const terms = world.economy?.moneylender;
        const recorded = generated.some(index => life.journal[index].id.startsWith("moneylender-loan-"));
        if (terms && effect.action === "borrow") { loanBalance = terms.principal + terms.fee; verifiedFact ||= recorded; }
        else if (terms && effect.action === "extend") { loanBalance += terms.extensionFee; verifiedFact ||= recorded; }
        else if (effect.action === "repay") {
          const paid = Math.min(loanBalance, effect.amount ?? loanBalance);
          loanBalance -= paid;
          verifiedFact ||= recorded && paid > 0 && (loanBalance === 0 || paid >= 10);
        }
      }
      else if (effect.type === "mastery") {
        const values = effect.target === "stat" ? stats : skills;
        const definition = effect.target === "stat" ? world.stats[effect.id] : world.character?.skills[effect.id];
        if (definition) {
          const before = values.get(effect.id);
          if (before !== undefined && before < definition.max) verifiedFact = true;
          values.set(effect.id, definition.max);
        }
      } else if (effect.type === "cash") { money += effect.delta; directMoney ||= effect.delta !== 0; }
      else if (effect.type === "debt") { money -= effect.delta; directMoney ||= effect.delta !== 0; }
      else if (effect.type === "stat" && world.economy?.stat === effect.stat) money += effect.delta * world.economy.unitsPerPoint;
      else if (effect.type === "stat" || effect.type === "skill") {
        const id = effect.type === "stat" ? effect.stat : effect.skill;
        const values = effect.type === "stat" ? stats : skills;
        const definition = effect.type === "stat" ? world.stats[id] : world.character?.skills[id];
        const before = values.get(id);
        if (definition && before !== undefined) values.set(id, applyStatDelta(definition, before, effect.type === "skill" ? skillEffectDelta(effect, flags) : effect.delta));
      }
    }
    // The final ending carries the consequence; don't duplicate it with its source.
    if (ended) return false;
    const numeric = (before: Map<string, number | undefined>, after: Map<string, number | undefined>, definitions: Record<string, StatDefinition>) =>
      [...before].some(([id, value]) => value !== undefined && after.get(id) !== undefined && definitions[id] &&
        Math.abs(after.get(id)! - value) >= (definitions[id].max - definitions[id].min) * .1 && after.get(id) !== value);
    const story = Object.entries(flags).some(([id, value]) => value !== beforeFlags[id] &&
      (WORLD_STORY_FLAGS.has(id) || [...(readers.get(`${id}:${value}`) ?? [])].some(reader => reader !== owner)));
    return verifiedFact || job !== beforeJob || partner !== beforePartner || status !== beforeStatus ||
      [...roles].sort().join("|") !== beforeRoles || assetState() !== beforeAssets || known.size !== beforeKnown || story ||
      Boolean(world.economy && !["training", "career"].includes(activities.get(owner)?.category ?? "") &&
        Math.abs(money) >= (directMoney ? 10 : Math.max(10, 10 * world.economy.unitsPerPoint))) ||
      numeric(beforeStats, stats, world.stats) || numeric(beforeSkills, skills, world.character?.skills ?? {});
  }

  life.journal.forEach((entry, index) => {
    if (entry.type === "birth") { apply(origin?.effects ?? [], "birth"); return; }
    if (entry.type === "year") {
      apply(world.yearlyEffects, "annual");
      // Conditional annual changes are not journaled individually. Invalidate
      // affected numbers, instead of inventing whether a condition matched.
      for (const rule of world.yearlyRules ?? []) for (const effect of rule.effects) {
        if (effect.type === "stat") stats.set(effect.stat, undefined);
        if (effect.type === "skill") skills.set(effect.skill, undefined);
      }
      if (world.health) stats.set(world.health.stat, undefined);
      if (world.knowledge) stats.set(world.knowledge.stat, undefined);
      return;
    }
    if (entry.type === "activity" && jobs.has(entry.id)) { apply(jobs.get(entry.id)!.yearlyEffects, "annual"); return; }
    const source = sourceAt(index);
    if (source) {
      const generated: number[] = [];
      for (let next = index + 1; next < life.journal.length && !boundary(next); next++) generated.push(next);
      const consequential = apply(source.effects, source.owner, generated);
      if (consequential) {
        important.add(keyAt(index));
      }
      for (const generatedIndex of generated) {
        const generatedId = life.journal[generatedIndex].id;
        const represented = source.effects.some(effect =>
          effect.type === "loan" && generatedId.startsWith("moneylender-loan-") ||
          consequential && (effect.type === "child" && /^child-\d+$/.test(generatedId) ||
            effect.type === "introduce" && generatedId === `met-${effect.partner}` ||
            effect.type === "accomplishment" && generatedId === `earned-${effect.achievement}` ||
            effect.type === "condition" && generatedId === `health-onset-${effect.condition}`));
        if (represented) suppressed.add(generatedIndex);
      }
      return;
    }
    if (suppressed.has(index)) return;
    if (entry.type === "ending" || entry.type === "influence") { important.add(keyAt(index)); return; }
    // These are recorded consequences from the vocation economy. Routine harvests,
    // spending, prices and work-in-progress stay available in the full record.
    if (world.demo && entry.type === "event" && (DEMO_IMPORTANT_EVENTS.has(entry.id) ||
        /^work-.+-built$/.test(entry.id) || /^year-(?:flood|army|road)-/.test(entry.id))) {
      important.add(keyAt(index)); return;
    }
    if (entry.type === "event") {
      if (entry.id.startsWith("health-onset-")) {
        const id = entry.id.slice("health-onset-".length);
        if (life.journal[index + 1]?.id !== `health-severe-onset-${id}`) important.add(keyAt(index));
      } else if (entry.id.startsWith("health-severe-onset-") || entry.id.startsWith("health-recovery-") || entry.id.startsWith("relationship-distance-")) important.add(keyAt(index));
      else if (entry.id.startsWith("health-severe-deterioration-") && life.journal[index + 1]?.type !== "ending") important.add(keyAt(index));
    } else if (entry.type === "activity" && (/^child-\d+$/.test(entry.id) || entry.id.startsWith("earned-") || entry.id.startsWith("met-") || entry.id.startsWith("moneylender-loan-"))) important.add(keyAt(index));
  });
  return years.map(year => ({ ...year, events: year.events.filter(event => important.has(event.key)) }));
}
