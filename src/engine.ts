import type {
  ActivityAvailability, Choice, Command, Comparison, Condition, Effect, JournalEntry,
  LifeEngine, LifeEvent, LifeState, SaveFile, WorldPack,
} from "./types.ts";
import { validateWorld } from "./validate.ts";
import { canonicalJson, contentFingerprint, nextRandom, seedToUint32 } from "./random.ts";
import { yearAtAge } from "./calendar.ts";
import { activityPartnerIds, activityReason, characterEffectReason, initialCharacter } from "./character.ts";
import { applyEconomyEffect, initialEconomy, yearlyAssetIncome, repayDebtAutomatically } from "./economy.ts";
import { initialKnowledge, recordKnowledgePractice, progressKnowledge } from "./knowledge.ts";
import { initialHealth, addHealthCondition, provideHealthCare, progressHealth, developHealthIncident } from "./health.ts";
import { initialRelationships, introduceRelationship, addChildRelationship, applyCloseness, advanceRelationships, relationshipSupport, relationshipOutcomeWeight } from "./relationships.ts";

const MAX_COMMANDS = 50_000;
const MAX_SAVE_LENGTH = 8_000_000;

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function compare(left: number, op: Comparison, right: number): boolean {
  switch (op) {
    case "eq": return left === right;
    case "ne": return left !== right;
    case "gt": return left > right;
    case "gte": return left >= right;
    case "lt": return left < right;
    case "lte": return left <= right;
  }
}

export function matchesCondition(condition: Condition | undefined, state: LifeState): boolean {
  if (!condition) return true;
  switch (condition.type) {
    case "cash": return state.economy !== undefined && compare(state.economy.cash, condition.op, condition.value);
    case "debt": return state.economy !== undefined && compare(state.economy.debt, condition.op, condition.value);
    case "asset": return state.economy !== undefined && compare(state.economy.assets[condition.asset] ?? 0, condition.op, condition.value);
    case "stat": return compare(state.stats[condition.stat], condition.op, condition.value);
    case "flag": return state.flags[condition.flag] === condition.value;
    case "age": return compare(state.age, condition.op, condition.value);
    case "year": return compare(state.year, condition.op, condition.value);
    case "origin": return state.originId === condition.origin;
    case "skill": return state.character !== undefined && compare(state.character.skills[condition.skill], condition.op, condition.value);
    case "job": return state.character !== undefined && state.character.jobId === condition.job;
    case "relationship": return state.character !== undefined && state.character.relationshipStatus === condition.status &&
      (condition.partner === undefined || state.character.partnerId === condition.partner);
    case "known-partner": return state.character?.knownPartnerIds?.includes(condition.partner) === true || state.character?.partnerId === condition.partner;
    case "children": return state.character !== undefined && compare(state.character.children.length, condition.op, condition.value);
    case "has-condition": return Boolean(state.health?.conditions.some(item => condition.condition === undefined || item.id === condition.condition));
    case "closeness": {
      const tie = state.character?.relationships?.partners[condition.partner ?? state.character.partnerId ?? ""];
      return tie !== undefined && compare(tie.closeness, condition.op, condition.value);
    }
    case "all": return condition.conditions.every(child => matchesCondition(child, state));
    case "any": return condition.conditions.some(child => matchesCondition(child, state));
    case "not": return !matchesCondition(condition.condition, state);
  }
}

const matches = matchesCondition;

function pick<T>(items: readonly T[], weight: (item: T) => number, state: LifeState): T {
  if (items.length === 0) throw new Error("Cannot select from an empty list.");
  if (items.length === 1) return items[0];
  const draw = nextRandom(state.rngState);
  state.rngState = draw.state;
  // Relative weights must retain their ratio even when all are subnormal floats.
  const maximum = items.reduce((largest, item) => Math.max(largest, weight(item)), 0);
  const weights = items.map(item => weight(item) / maximum);
  let remaining = draw.value * weights.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < items.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Inclusive integer sampling without rounding bias or unsafe span arithmetic. */
function startingStat(min: number, max: number, state: LifeState): number {
  if (min === max) return min;
  const width = BigInt(max) - BigInt(min) + 1n;
  const words = width <= 0x1_0000_0000n ? 1 : 2;
  const size = 1n << BigInt(words * 32);
  const limit = size - size % width;
  let draw: bigint;
  do {
    draw = 0n;
    for (let i = 0; i < words; i++) {
      const random = nextRandom(state.rngState);
      state.rngState = random.state;
      draw = (draw << 32n) | BigInt(random.value * 0x1_0000_0000);
    }
  } while (draw >= limit);
  return Number(BigInt(min) + draw % width);
}

function mutableSnapshot(state: LifeState): LifeState {
  // Historical entries are frozen and safe to share across public snapshots.
  return {
    ...state,
    stats: { ...state.stats }, flags: { ...state.flags },
    eventCounts: { ...state.eventCounts }, lastEventAge: { ...state.lastEventAge },
    journal: [...state.journal], commands: [...state.commands],
    ...(state.economy ? { economy: { ...state.economy, assets: { ...state.economy.assets } } } : {}),
    ...(state.health ? { health: { ...state.health, conditions: state.health.conditions.map(item => ({ ...item })) } } : {}),
    ...(state.knowledge ? { knowledge: { ...state.knowledge } } : {}),
    ...(state.character ? { character: {
      ...state.character, skills: { ...state.character.skills },
      children: state.character.children.map(child => ({ ...child })),
      lastActivityAges: { ...state.character.lastActivityAges },
      ...(state.character.knownPartnerIds ? { knownPartnerIds: [...state.character.knownPartnerIds] } : {}),
      ...(state.character.relationships ? { relationships: {
        partners: Object.fromEntries(Object.entries(state.character.relationships.partners).map(([id, tie]) => [id, { ...tie }])),
        children: Object.fromEntries(Object.entries(state.character.relationships.children).map(([id, tie]) => [id, { ...tie }])),
      } } : {}),
    } } : {}),
  };
}

export function createEngine(input: unknown): LifeEngine {
  validateWorld(input);
  // Own a detached immutable pack so the caller cannot change rules mid-life.
  const world: WorldPack = freeze(structuredClone(input));
  const fingerprint = contentFingerprint(world);
  const eventById = new Map(world.events.map(event => [event.id, event]));
  const endingById = new Map(world.endings.map(ending => [ending.id, ending]));
  const activityById = new Map(world.character?.activities.map(activity => [activity.id, activity]) ?? []);

  function journal(state: LifeState, type: JournalEntry["type"], id: string, text: string): void {
    state.journal.push({ type, id, text, age: state.age, year: state.year });
  }

  function finish(state: LifeState, id: string, explicitCause?: string, causeContext?: string, causeKind: "choice" | "condition" = "choice"): void {
    if (state.phase === "ended") return;
    const ending = endingById.get(id);
    if (!ending) throw new Error(`Unknown ending: ${id}`);
    let causeText = "";
    if (ending.kind === "death" && world.character) {
      // An authored consequence describes what actually happened. Conditions on
      // causes govern random attribution, not deliberate exposure to a hazard.
      const cause = explicitCause
        ? world.character.deathCauses.find(candidate => candidate.id === explicitCause)!
        : world.health ? undefined : pick(world.character.deathCauses.filter(cause => !cause.choiceOnly && matches(cause.when, state)), candidate => candidate.weight, state);
      if (!cause && world.health) throw new Error("A health-driven death requires a recorded condition or explicit cause.");
      if (cause) {
        state.deathCauseId = cause.id;
        causeText = ` Cause of death: ${cause.title}. ${cause.text}`;
      }
      if (explicitCause && causeContext) {
        state.deathCauseContext = causeContext;
        if (world.health) state.deathCauseKind = causeKind;
        causeText += causeKind === "condition" ? ` Health history: ${causeContext}` : ` Decision leading to death: ${causeContext}`;
      }
    }
    state.phase = "ended";
    state.endingId = id;
    state.pendingEventId = null;
    journal(state, "ending", id, `${ending.title}: ${ending.text}${causeText}`);
  }

  function healthHooks(state: LifeState) {
    return {
      random: () => { const draw = nextRandom(state.rngState); state.rngState = draw.state; return draw.value; },
      matches: (condition: Condition | undefined) => matches(condition, state),
      journal: (id: string, text: string) => journal(state, "event", id, text),
      support: relationshipSupport(world, state),
    };
  }

  function syncCharacterFlags(state: LifeState): void {
    if (!state.character) return;
    if (Object.hasOwn(state.flags, "partnered")) state.flags.partnered = state.character.relationshipStatus === "married";
    if (Object.hasOwn(state.flags, "parent")) state.flags.parent = state.character.children.length > 0;
  }

  function apply(state: LifeState, effects: readonly Effect[], decisionContext?: string): void {
    for (const effect of effects) {
      if (applyEconomyEffect(world, state, effect)) continue;
      const reason = characterEffectReason(world, state, effect, true);
      if (reason) throw new Error(`Character effect is unavailable: ${reason}`);
      switch (effect.type) {
        case "stat": {
          const definition = world.stats[effect.stat];
          state.stats[effect.stat] = Math.max(definition.min,
            Math.min(definition.max, state.stats[effect.stat] + effect.delta));
          recordKnowledgePractice(world, state, effect);
          break;
        }
        case "flag": state.flags[effect.flag] = effect.value; break;
        case "skill": {
          const definition = world.character!.skills[effect.skill];
          state.character!.skills[effect.skill] = Math.max(definition.min,
            Math.min(definition.max, state.character!.skills[effect.skill] + effect.delta));
          break;
        }
        case "job": state.character!.jobId = effect.job; break;
        case "condition": addHealthCondition(world, state, effect.condition, decisionContext, healthHooks(state)); break;
        case "care": provideHealthCare(world, state, effect.amount); break;
        case "closeness": applyCloseness(world, state, effect); break;
        case "relationship":
          state.character!.partnerId = effect.partner;
          state.character!.relationshipStatus = effect.status;
          break;
        case "introduce": {
          const character = state.character!;
          character.knownPartnerIds ??= [];
          if (!character.knownPartnerIds.includes(effect.partner)) {
            character.knownPartnerIds.push(effect.partner);
            const person = world.character!.partners.find(partner => partner.id === effect.partner)!;
            journal(state, "activity", `met-${person.id}`, `You meet ${person.name}.`);
          }
          introduceRelationship(world, state, effect.partner);
          break;
        }
        case "end-courtship":
          state.character!.partnerId = null;
          state.character!.relationshipStatus = "single";
          break;
        case "divorce":
          state.character!.partnerId = null;
          state.character!.relationshipStatus = "divorced";
          break;
        case "child": {
          const character = state.character!;
          const used = new Set(character.children.map(child => child.name));
          const names = world.character!.childNames.filter(name => !used.has(name));
          const name = names.length ? pick(names, () => 1, state) : `${world.character!.childNames[0]} ${character.children.length + 1}`;
          character.children.push({ id: `child-${character.children.length + 1}`, name, birthAge: state.age, otherParentId: character.partnerId! });
          addChildRelationship(world, state, `child-${character.children.length}`);
          journal(state, "activity", `child-${character.children.length}`, `${name} joins your family.`);
          break;
        }
        case "end": syncCharacterFlags(state); finish(state, effect.ending, effect.deathCause, decisionContext); return;
      }
    }
    syncCharacterFlags(state);
    if (world.health && state.phase !== "ended" && state.health?.conditions.length === 0 && state.stats[world.health.stat] <= world.health.criticalHealth) {
      addHealthCondition(world, state, world.health.declineCondition, "Your health has fallen to a critical level.", healthHooks(state));
    }
  }

  function checkEndings(state: LifeState): void {
    if (state.phase === "ended") return;
    const ending = world.endings.find(candidate => candidate.when && matches(candidate.when, state));
    if (ending) finish(state, ending.id);
    else if (state.age >= world.maxAge) finish(state, world.defaultEnding);
  }

  function choicesFor(event: LifeEvent, state: LifeState): Choice[] {
    return event.choices.filter(choice => matches(choice.when, state));
  }

  function eligible(event: LifeEvent, state: LifeState): boolean {
    // Medical decisions are interrupts from the health lifecycle, never an
    // unrelated random story or a repeat after care was already chosen.
    if (world.health?.careDecision === event.id) return false;
    if ((state.eventCounts[event.id] ?? 0) >= (event.maxOccurrences ?? 1)) return false;
    if (!matches(event.when, state) || (event.mode !== "automatic" && choicesFor(event, state).length === 0)) return false;
    switch (event.trigger.type) {
      case "age": return state.age >= event.trigger.at;
      case "year": return state.year >= event.trigger.at;
      case "random": {
        const lastAge = state.lastEventAge[event.id];
        return lastAge === undefined || state.age - lastAge >= (event.cooldownYears ?? 1);
      }
    }
  }

  function recordEvent(state: LifeState, event: LifeEvent): void {
    state.eventCounts[event.id] = (state.eventCounts[event.id] ?? 0) + 1;
    state.lastEventAge[event.id] = state.age;
    journal(state, "event", event.id, `${event.title}: ${event.text}`);
  }

  function offer(state: LifeState, event: LifeEvent): void {
    recordEvent(state, event);
    state.pendingEventId = event.id;
    state.phase = "choice";
    if (world.eventPacing) {
      const { minChoiceGapYears, maxChoiceGapYears } = world.eventPacing;
      let gap = minChoiceGapYears;
      if (maxChoiceGapYears > minChoiceGapYears) {
        const draw = nextRandom(state.rngState);
        state.rngState = draw.state;
        gap += Math.floor(draw.value * (maxChoiceGapYears - minChoiceGapYears + 1));
      }
      state.nextChoiceAge = state.age + gap;
    }
  }

  function automaticEvent(state: LifeState, event: LifeEvent): void {
    recordEvent(state, event);
    apply(state, event.effects ?? []);
    checkEndings(state);
  }

  function offerMedicalDecision(state: LifeState): boolean {
    if (state.phase === "ended" || !world.health || !state.health?.needsCareDecision || !state.health.conditions.length) return false;
    state.health.needsCareDecision = false;
    const previousChoiceAge = state.nextChoiceAge;
    offer(state, eventById.get(world.health.careDecision)!);
    if (previousChoiceAge === undefined) delete state.nextChoiceAge;
    else state.nextChoiceAge = previousChoiceAge;
    return true;
  }

  function resolvePacedEvents(state: LifeState, allowRandom: boolean): void {
    const drainAutomatic = (): boolean => {
      while (state.phase !== "ended") {
        const event = world.events.find(candidate => candidate.mode === "automatic" &&
          candidate.trigger.type !== "random" && eligible(candidate, state));
        if (!event) return false;
        automaticEvent(state, event);
        if (offerMedicalDecision(state)) return true;
      }
      return true;
    };
    // Dated history and age milestones never consume the annual background slot.
    // Resolve these before offering a decision so the whole year is available to UI.
    if (drainAutomatic()) return;
    if (allowRandom && state.age > 0) {
      const background = world.events.filter(event => event.mode === "automatic" &&
        event.trigger.type === "random" && eligible(event, state));
      if (background.length > 0) {
        automaticEvent(state, pick(background, event => event.trigger.type === "random" ? event.trigger.weight : 0, state));
        if (offerMedicalDecision(state)) return;
        if (drainAutomatic()) return;
      }
    }
    const decisionDue = state.age >= (state.nextChoiceAge ?? 0);
    // Fixed-year decisions are hard anchors. Personal age milestones wait for the
    // next decision slot; the initial household decision is the age-zero exception.
    const scheduled = world.events.find(event => event.mode !== "automatic" &&
      event.trigger.type !== "random" && eligible(event, state) &&
      (event.trigger.type === "year" || decisionDue || (state.age === 0 && event.trigger.at === 0)));
    if (scheduled) { offer(state, scheduled); return; }
    if (allowRandom && state.age > 0 && decisionDue) {
      const decisions = world.events.filter(event => event.mode !== "automatic" &&
        event.trigger.type === "random" && eligible(event, state));
      if (decisions.length > 0) {
        offer(state, pick(decisions, event => event.trigger.type === "random" ? event.trigger.weight : 0, state));
        return;
      }
    }
    state.phase = "ready";
    state.pendingEventId = null;
  }

  function resolveEvents(state: LifeState, allowRandom: boolean): void {
    if (offerMedicalDecision(state)) return;
    if (world.eventPacing) { resolvePacedEvents(state, allowRandom); return; }
    let randomAvailable = allowRandom;
    // Scheduled events queue in declaration order. Automatic entries drain without
    // inventing a player choice, and any scheduled activity takes this year's slot.
    while (state.phase !== "ended") {
      const scheduled = world.events.find(event => event.trigger.type !== "random" && eligible(event, state));
      if (scheduled) {
        randomAvailable = false;
        if (scheduled.mode === "automatic") { automaticEvent(state, scheduled); if (offerMedicalDecision(state)) return; continue; }
        offer(state, scheduled);
        return;
      }
      if (randomAvailable) {
        randomAvailable = false;
        const random = world.events.filter(event => event.trigger.type === "random" && eligible(event, state));
        if (random.length > 0) {
          const event = pick(random, candidate => candidate.trigger.type === "random" ? candidate.trigger.weight : 0, state);
          if (event.mode === "automatic") { automaticEvent(state, event); if (offerMedicalDecision(state)) return; continue; }
          offer(state, event);
          return;
        }
      }
      state.phase = "ready";
      state.pendingEventId = null;
      return;
    }
  }

  function mortalityCheck(state: LifeState): boolean {
    if (world.health) return false;
    if (!world.mortality) return false;
    const band = world.mortality.bands.find(candidate => state.age >= candidate.minAge && state.age <= candidate.maxAge);
    if (!band) throw new Error("The mortality model does not cover the current age.");
    const probability = band.annualProbability;
    if (probability === 0) return false;
    let died = probability === 1;
    if (!died) {
      const draw = nextRandom(state.rngState);
      state.rngState = draw.state;
      died = draw.value < probability;
    }
    if (died) finish(state, band.ending);
    return died;
  }

  function assertCompatible(state: LifeState): void {
    if (!state || state.schemaVersion !== 1 || state.worldId !== world.id ||
      state.worldVersion !== world.version || state.worldFingerprint !== fingerprint) {
      throw new Error("State belongs to a different world, content revision or engine schema.");
    }
    if (state.phase === "choice" && !eventById.has(state.pendingEventId ?? "")) {
      throw new Error("State has an unknown pending event.");
    }
  }

  function assertPlayable(state: LifeState): void {
    assertCompatible(state);
    if (state.phase === "ended") throw new Error("This life has ended.");
    if (state.commands.length >= MAX_COMMANDS) throw new Error("Life command limit reached.");
    if (world.character && !state.character) throw new Error("State is missing its character record.");
    if (world.economy && !state.economy) throw new Error("State is missing its economy record.");
    if (world.health && !state.health) throw new Error("State is missing its health record.");
    if (world.knowledge && !state.knowledge) throw new Error("State is missing its knowledge record.");
  }

  function start(seed: string): LifeState {
    if (typeof seed !== "string" || seed.length === 0 || seed.length > 256) {
      throw new Error("Seed must be a string of 1 to 256 characters.");
    }
    const state: LifeState = {
      schemaVersion: 1, worldId: world.id, worldVersion: world.version,
      worldFingerprint: fingerprint, seed, rngState: seedToUint32(seed),
      age: 0, year: world.startYear, originId: "",
      stats: Object.fromEntries(Object.entries(world.stats).map(([id, definition]) => [id, definition.initial])),
      flags: Object.fromEntries(Object.entries(world.flags).map(([id, definition]) => [id, definition.initial])),
      phase: "ready", pendingEventId: null, endingId: null,
      eventCounts: {}, lastEventAge: {}, journal: [], commands: [],
      ...(world.eventPacing ? { nextChoiceAge: world.eventPacing.minChoiceGapYears } : {}),
      ...(world.character ? { character: initialCharacter(world)! } : {}),
      ...(world.health ? { health: initialHealth(world)! } : {}),
      ...(world.knowledge ? { knowledge: initialKnowledge(world)! } : {}),
    };
    if (world.relationships && state.character) state.character.relationships = initialRelationships(world)!;
    const origin = pick(world.origins, candidate => candidate.weight, state);
    state.originId = origin.id;
    for (const [id, definition] of Object.entries(world.stats)) {
      const range = origin.statRanges?.[id] ?? definition.initialRange;
      if (range) state.stats[id] = startingStat(range.min, range.max, state);
    }
    if (world.character?.playerNames) state.character!.name = pick(world.character.playerNames, () => 1, state);
    journal(state, "birth", origin.id, `${origin.title}: ${origin.text}`);
    apply(state, origin.effects);
    if (world.economy) state.economy = initialEconomy(world, state)!;
    if (world.health && state.stats[world.health.stat] <= world.health.criticalHealth) addHealthCondition(world, state, world.health.declineCondition, "Your health starts at a critical level.", healthHooks(state));
    checkEndings(state);
    resolveEvents(state, true);
    return freeze(state);
  }

  function advanceInto(next: LifeState): void {
    assertPlayable(next);
    if (next.phase === "choice") throw new Error("Resolve the pending choice before advancing time.");
    next.commands.push({ type: "advance" });
    if (world.health) {
      const healthResult = progressHealth(world, next, healthHooks(next));
      if (healthResult.deathCause) {
        const deathEnding = next.age === 0 ? "death-in-infancy" : next.age < 15 ? "death-in-childhood" : next.age < 60 ? "death-in-adulthood" : "death-in-later-life";
        const ending = endingById.has(deathEnding) ? deathEnding : world.endings.find(item => item.kind === "death")!.id;
        finish(next, ending, healthResult.deathCause, healthResult.context, "condition");
        return;
      }
    }
    // The interval [age, age + 1) belongs to the current completed age. A death
    // before the first birthday is therefore recorded at age zero, not age one.
    if (mortalityCheck(next)) return;
    progressKnowledge(world, next, (id, text) => journal(next, "event", id, text));
    next.age += 1;
    next.year = yearAtAge(world.startYear, next.age);
    journal(next, "year", `age-${next.age}`, `Age ${next.age}`);
    const annualIncome = (): void => {
      if (next.phase !== "ended" && next.character?.jobId) {
        const job = world.character!.jobs.find(candidate => candidate.id === next.character!.jobId)!;
        apply(next, job.yearlyEffects);
        journal(next, "activity", job.id, `You continue your work as ${job.title.toLowerCase()}.`);
      }
      if (next.phase !== "ended") {
        const income = yearlyAssetIncome(world, next);
        if (income > 0) {
          apply(next, [{ type: "cash", delta: income }]);
          journal(next, "activity", "asset-income", `Your assets bring in ${income} ${world.economy!.currency.short}.`);
        }
      }
    };
    // Money-enabled years settle income before costs, avoiding bridge debt
    // created only by batching a whole year. Legacy worlds keep exact ordering.
    if (world.economy) annualIncome();
    apply(next, world.yearlyEffects);
    for (const rule of world.yearlyRules ?? []) {
      if (next.phase === "ended") break;
      if (matches(rule.when, next)) apply(next, rule.effects);
    }
    if (!world.economy) annualIncome();
    const repaid = repayDebtAutomatically(world, next);
    if (repaid > 0) journal(next, "activity", "auto-debt-payment", `You repay ${repaid} ${world.economy!.currency.short} of debt from the cash left after yearly expenses.`);
    if (world.relationships) advanceRelationships(world, next, (id, text) => journal(next, "event", id, text));
    if (world.health) developHealthIncident(world, next, healthHooks(next));
    checkEndings(next);
    resolveEvents(next, true);
  }

  function chooseInto(next: LifeState, choiceId: string): void {
    assertPlayable(next);
    if (next.phase !== "choice") throw new Error("There is no pending choice.");
    const event = eventById.get(next.pendingEventId!)!;
    const choice = choicesFor(event, next).find(candidate => candidate.id === choiceId);
    if (!choice) throw new Error(`Choice is unavailable: ${choiceId}`);
    next.commands.push({ type: "choose", choice: choiceId });
    next.phase = "ready";
    next.pendingEventId = null;
    journal(next, "choice", choice.id, choice.text);
    const outcome = pick(choice.outcomes, candidate => relationshipOutcomeWeight(world, next, candidate), next);
    journal(next, "outcome", outcome.id, outcome.text);
    apply(next, outcome.effects, `${choice.text} — ${outcome.text}`);
    checkEndings(next);
    // Resolve other due scheduled events at this age, without generating extra random events.
    resolveEvents(next, false);
  }

  function advance(state: LifeState): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    advanceInto(next);
    return freeze(next);
  }

  function choose(state: LifeState, choiceId: string): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    chooseInto(next, choiceId);
    return freeze(next);
  }

  function getChoices(state: LifeState): readonly Choice[] {
    assertCompatible(state);
    if (state.phase !== "choice") return Object.freeze([]);
    return Object.freeze(choicesFor(eventById.get(state.pendingEventId!)!, state));
  }

  function getActivities(state: LifeState): readonly ActivityAvailability[] {
    assertCompatible(state);
    return freeze((world.character?.activities ?? []).filter(activity => {
      if (!world.character?.requireIntroductions) return true;
      const known = state.character?.knownPartnerIds ?? [];
      const introduced = new Set(activity.outcomes.flatMap(outcome => outcome.effects.flatMap(effect => effect.type === "introduce" ? [effect.partner] : [])));
      if (activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "relationship" && !known.includes(effect.partner)))) return false;
      if (activityPartnerIds(activity).some(partner => !known.includes(partner) && !introduced.has(partner))) return false;
      const introduces = introduced.size > 0;
      return activity.category !== "relationship" || known.length > 0 || Boolean(state.character?.partnerId) || introduces;
    }).map(activity => {
      const reason = activityReason(world, state, activity, matches);
      return { ...activity, available: reason === undefined, ...(reason ? { reason } : {}) };
    }));
  }

  function actInto(next: LifeState, activityId: string): void {
    assertPlayable(next);
    const activity = activityById.get(activityId);
    if (!activity) throw new Error(`Unknown activity: ${activityId}`);
    const reason = activityReason(world, next, activity, matches);
    if (reason) throw new Error(`Activity is unavailable: ${reason}`);
    next.commands.push({ type: "act", activity: activityId });
    if (activity.usesYearlyActivity !== false) next.character!.lastActivityAge = next.age;
    next.character!.lastActivityAges[activityId] = next.age;
    journal(next, "activity", activity.id, activity.text);
    const outcome = pick(activity.outcomes, candidate => relationshipOutcomeWeight(world, next, candidate), next);
    journal(next, "outcome", outcome.id, outcome.text);
    apply(next, outcome.effects, `${activity.text} — ${outcome.text}`);
    checkEndings(next);
    resolveEvents(next, false);
  }

  function act(state: LifeState, activityId: string): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    actInto(next, activityId);
    return freeze(next);
  }

  function replay(seed: string, commands: readonly Command[]): LifeState {
    if (!Array.isArray(commands) || commands.length > MAX_COMMANDS) throw new Error("Invalid command history length.");
    // Reconstruct privately in one pass; only the final state escapes to callers.
    const state = structuredClone(start(seed));
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (!command || typeof command !== "object" || Array.isArray(command)) throw new Error(`Invalid command at ${i}.`);
      if (command.type === "advance" && Object.keys(command).length === 1) advanceInto(state);
      else if (command.type === "choose" && typeof command.choice === "string" && Object.keys(command).length === 2) {
        chooseInto(state, command.choice);
      } else if (command.type === "act" && typeof command.activity === "string" && Object.keys(command).length === 2) {
        actInto(state, command.activity);
      } else throw new Error(`Invalid command at ${i}.`);
    }
    return freeze(state);
  }

  function save(state: LifeState): string {
    assertCompatible(state);
    const reconstructed = replay(state.seed, state.commands);
    if (canonicalJson(reconstructed) !== canonicalJson(state)) throw new Error("State does not match its command history.");
    const saveFile: SaveFile = {
      schemaVersion: 1, worldId: world.id, worldVersion: world.version,
      worldFingerprint: fingerprint, seed: state.seed, commands: state.commands,
    };
    return JSON.stringify(saveFile);
  }

  function load(json: string): LifeState {
    if (typeof json !== "string" || json.length > MAX_SAVE_LENGTH) throw new Error("Invalid save length.");
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { throw new Error("Save is not valid JSON."); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Save must be an object.");
    const saveFile = parsed as SaveFile;
    assertCompatible(saveFile as LifeState);
    const fields = ["schemaVersion", "worldId", "worldVersion", "worldFingerprint", "seed", "commands"];
    if (Object.keys(saveFile).length !== fields.length || fields.some(field => !Object.hasOwn(saveFile, field))) {
      throw new Error("Save contains missing or unsupported fields.");
    }
    return replay(saveFile.seed, saveFile.commands);
  }

  return Object.freeze({ world, fingerprint, start, advance, choose, getChoices, getActivities, act, replay, save, load });
}
