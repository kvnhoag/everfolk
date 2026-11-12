import { initialCapabilities, applyCapability, settleCapabilities } from "./capabilities/engine.ts";
import { initialVocations, applyVocation } from "./vocations/engine.ts";
import type {
  ActivityAvailability, Choice, Command, Condition, Effect, InfluenceCommand, InfluenceSource, JournalEntry,
  LifeEngine, LifeEvent, LifeState, MarketOrderRequest, SaveFile, WorldPack,
} from "./types.ts";
import { influenceCatalog, influenceDeltas, influenceMeasure, parseInfluenceCommand, scaleInfluenceEffects } from "./influence.ts";
import { validateWorld } from "./validate.ts";
import { canonicalJson, contentFingerprint, nextRandom, seedToUint32 } from "./random.ts";
import { formatYear, yearAtAge } from "./calendar.ts";
import { activityPartnerIds, activityReason, characterEffectReason, initialCharacter } from "./character.ts";
import { MILITARY_QUALIFICATIONS } from "./capabilities/military.ts";
import { applyEconomyEffect, financeActivityReason, initialEconomy, syncEconomyStat, yearlyAssetIncome, repayDebtAutomatically, getNetWorth } from "./economy.ts";
import { loanCollectionEventId } from "./loans.ts";
import { placeMarketOrder, cancelMarketOrder as cancelOrder, settleMarketYear } from "./market.ts";
import { initialKnowledge, recordKnowledgePractice, progressKnowledge } from "./knowledge.ts";
import { applyStatDelta, skillEffectDelta } from "./progression.ts";
import { initialHealth, addHealthCondition, provideHealthCare, progressHealth, developHealthIncident } from "./health.ts";
import { initialRelationships, introduceRelationship, addChildRelationship, applyCloseness, applySocialRole, advanceRelationships, relationshipSupport } from "./relationships.ts";

import { matchesCondition } from "./conditions.ts";
import { outcomeWeight } from "./outcomes.ts";
import { randomEventWeights } from "./event-variety.ts";
import { awardAccomplishment, legacyText } from "./legacy.ts";
import { encounterPerson, initializeIdentity, personText, visiblePersonChoice } from "./people.ts";
import { initializeFamily } from "./family.ts";
export { matchesCondition } from "./conditions.ts";
import type { DemoCommand } from "./demo/types.ts";
import { demoContext, initialDemo } from "./demo/state.ts";
import { settleDemoYear, openDemoYear } from "./demo/settle.ts";
import { applyDemoEffect } from "./demo/effects.ts";
import { DEMO_COMMAND_TYPES, parseDemoCommand } from "./demo/commands.ts";
import { executeTrade } from "./demo/market.ts";
import { applyPlan } from "./demo/household.ts";
import { applyAgentCommand, assignAgents, delegate } from "./demo/agents.ts";
import { isUnavailable } from "./demo/availability.ts";
import { takeItem } from "./capabilities/inventory.ts";
import { decidedByOthers, inTimeFrame, lifeStageAt } from "./life-stages/index.ts";
import { TIERS } from "./paths/types.ts";
import type { FieldId, PathsState } from "./paths/types.ts";
import { drawFromAccount, recordSuccessor } from "./paths/index.ts";
import { advanceDistrict, affinityJournalId, farmEdgeHealth, refreshNeeds, applyStartingMaterials, changeAffinity, closeStage, eventFieldWeight, fadeAffinity, initialPaths, meetPractitioner, moveDistrict, practiceGain } from "./paths/index.ts";

const MAX_COMMANDS = 50_000;
const MAX_SAVE_LENGTH = 8_000_000;

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
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
    ...(state.accomplishments ? { accomplishments: [...state.accomplishments] } : {}),
    ...(state.activeInfluences ? { activeInfluences: [...state.activeInfluences] } : {}),
    ...(state.queuedInfluences ? { queuedInfluences: [...state.queuedInfluences] } : {}),
    ...(state.economy ? { economy: { ...state.economy, assets: { ...state.economy.assets }, ...(state.economy.loan ? { loan: { ...state.economy.loan } } : {}),
      ...(state.economy.market ? { market: { ...state.economy.market, orders: state.economy.market.orders.map(order => ({ ...order })),
        ...(state.economy.market.history ? { history: [...state.economy.market.history] } : {}) } } : {}) } } : {}),
    ...(state.health ? { health: { ...state.health, conditions: state.health.conditions.map(item => ({ ...item })) } } : {}),
    ...(state.knowledge ? { knowledge: { ...state.knowledge } } : {}),
    ...(state.capabilities ? { capabilities: structuredClone(state.capabilities) } : {}),
    ...(state.paths ? { paths: structuredClone(state.paths) } : {}),
    ...(state.stageRecords ? { stageRecords: structuredClone(state.stageRecords) } : {}),
    ...(state.vocations ? { vocations: structuredClone(state.vocations) } : {}),
    ...(state.demo ? { demo: structuredClone(state.demo) } : {}),
    ...(state.character ? { character: {
      ...state.character, skills: { ...state.character.skills },
      children: state.character.children.map(child => ({ ...child })),
      lastActivityAges: { ...state.character.lastActivityAges },
      ...(state.character.knownPartnerIds ? { knownPartnerIds: [...state.character.knownPartnerIds] } : {}),
      ...(state.character.people ? { people: Object.fromEntries(Object.entries(state.character.people).map(([id, person]) => [id, { ...person }])) } : {}),
      ...(state.character.family ? { family: state.character.family.map(member => ({ ...member })) } : {}),
      ...(state.character.datedPartnerIds ? { datedPartnerIds: [...state.character.datedPartnerIds] } : {}),
      ...(state.character.relationships ? { relationships: {
        partners: Object.fromEntries(Object.entries(state.character.relationships.partners).map(([id, tie]) => [id, { ...tie, ...(tie.roles ? { roles: [...tie.roles] } : {}) }])),
        children: Object.fromEntries(Object.entries(state.character.relationships.children).map(([id, tie]) => [id, { ...tie }])),
      } } : {}),
    } } : {}),
  };
}

/** Detached telemetry for record projections; never persisted in saves. */
export interface JournalObserver { onChange(index: number, changes: Readonly<Record<string, number>>): void }

export function createEngine(input: unknown, observer?: JournalObserver): LifeEngine {
  validateWorld(input);
  // Own a detached immutable pack so the caller cannot change rules mid-life.
  const world: WorldPack = freeze(structuredClone(input));
  const fingerprint = contentFingerprint(world);
  function observedValues(state: LifeState): Record<string, number> {
    const result = { ...state.stats };
    if (world.economy && state.economy) result[world.economy.stat] = getNetWorth(world, state);
    for (const [id, value] of Object.entries(state.character?.skills ?? {})) result[`skill:${id}`] = value;
    return result;
  }
  function report(state: LifeState, index: number, before: Record<string, number> | undefined): void {
    if (!observer || !before || !state.journal[index]) return;
    const deltas = Object.fromEntries(Object.entries(observedValues(state)).map(([id, value]) => [id, value - (before[id] ?? 0)]).filter(([, delta]) => delta !== 0));
    if (Object.keys(deltas).length) observer.onChange(index, Object.freeze(deltas));
  }
  function recorded(state: LifeState, index: number | (() => number), action: () => void): void {
    const before = observer ? observedValues(state) : undefined;
    action();
    report(state, typeof index === "number" ? index : index(), before);
  }
  // Catalog events join every lane, but stay ineligible until activated.
  const influences = influenceCatalog(world);
  const allEvents = influences.events;
  const eventById = new Map(allEvents.map(event => [event.id, event]));
  const randomStoryById = new Map(allEvents.filter(event => event.trigger.type === "random" && event.rarity !== "rare" &&
    event.id !== world.health?.careDecision && !Object.values(world.economy?.moneylender?.events ?? {}).includes(event.id))
    .map(event => [event.id, event]));
  const endingById = new Map(world.endings.map(ending => [ending.id, ending]));
  const activityById = new Map(world.character?.activities.map(activity => [activity.id, activity]) ?? []);
  const rareEvents = allEvents.filter(event => event.rarity === "rare");
  const rareEventIds = new Set(rareEvents.map(event => event.id));
  const peoplePolicy = world.character?.encounterPacing;
  const peopleEvents = peoplePolicy ? allEvents.filter(event => event.mode !== "automatic" && event.rarity !== "rare" && event.trigger.type === "random" &&
    event.choices.some(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "introduce" || effect.type === "relationship" && effect.status === "courting" ||
      world.character?.socialRelationships && effect.type === "social-role" && effect.active)))) : [];
  const peopleEventIds = new Set(peopleEvents.map(event => event.id));
  const exclusiveGroups = new Map<string, LifeEvent[]>();
  for (const event of allEvents) if (event.exclusiveGroup) {
    const members = exclusiveGroups.get(event.exclusiveGroup) ?? [];
    members.push(event);
    exclusiveGroups.set(event.exclusiveGroup, members);
  }

  function pickRandomEvent(events: readonly LifeEvent[], state: LifeState): LifeEvent {
    // The opt-in branch leaves legacy draw counts and floating-point arithmetic
    // untouched. Recency comes from the existing journal, so saves need no cache.
    // Paths worlds: affinity raises a field's events (×1 without affinity, so draws are unchanged).
    const pull = (event: LifeEvent): number => eventFieldWeight(world, state, event);
    if (!world.eventPacing?.variety) return pick(events, event => (event.trigger.type === "random" ? event.trigger.weight : 0) * pull(event), state);
    const weights = randomEventWeights(events, randomStoryById, state, world.eventPacing.variety);
    return pick(events, event => weights.get(event.id)! * pull(event), state);
  }

  function journal(state: LifeState, type: JournalEntry["type"], id: string, text: string, extra?: Pick<JournalEntry, "source" | "deltas">): void {
    state.journal.push({ type, id, text: personText(legacyText(world, state, text), world, state), age: state.age, year: state.year, ...extra });
  }

  function demoCtx(state: LifeState) {
    return demoContext(world, state, effects => apply(state, effects), (id, text) => journal(state, "event", id, text));
  }

  function finish(state: LifeState, id: string, explicitCause?: string, causeContext?: string, causeKind: "choice" | "condition" = "choice"): void {
    if (state.phase === "ended") return;
    if (world.paths) {
      // A death while the year settles can come before the finished stage was recorded.
      if (state.age > 0 && lifeStageAt(world, state.age - 1)?.id !== lifeStageAt(world, state.age)?.id) closeStage(world, state, state.age - 1, state.age - 1);
      closeStage(world, state, state.age, state.age);
    }
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
    const indices = new Map<string, number>();
    return {
      random: () => { const draw = nextRandom(state.rngState); state.rngState = draw.state; return draw.value; },
      matches: (condition: Condition | undefined) => matches(condition, state),
      journal: (id: string, text: string) => { indices.set(id, state.journal.length); journal(state, "event", id, text); },
      changes: observer ? (id: string, delta: number) => {
        const index = indices.get(id);
        if (index !== undefined && delta) observer.onChange(index, Object.freeze({ [world.health!.stat]: delta }));
      } : undefined,
      support: relationshipSupport(world, state),
    };
  }

  function syncCharacterFlags(state: LifeState): void {
    if (!state.character) return;
    if (Object.hasOwn(state.flags, "partnered")) state.flags.partnered = state.character.relationshipStatus === "married";
    if (Object.hasOwn(state.flags, "parent")) state.flags.parent = state.character.children.length > 0;
  }

  function apply(state: LifeState, effects: readonly Effect[], decisionContext?: string, provenance?: { sourceId: string; outcomeId: string }): void {
    for (const effect of effects) {
      const beforeLoanBalance = effect.type === "loan" ? state.economy?.loan?.balance ?? 0 : 0;
      if (applyEconomyEffect(world, state, effect)) {
        if (effect.type === "loan") {
          const currency = world.economy!.currency.short, loan = state.economy!.loan;
          if (effect.action === "borrow") journal(state, "activity", "moneylender-loan-borrowed", `You borrow ${world.economy!.moneylender!.principal} ${currency}. The total owed is ${loan!.balance} ${currency}, due at age ${loan!.dueAge} (${formatYear(yearAtAge(world.startYear, loan!.dueAge))}).`);
          else if (effect.action === "repay") journal(state, "activity", "moneylender-loan-payment", `You pay ${beforeLoanBalance - (loan?.balance ?? 0)} ${currency} toward the moneylender loan.${loan ? ` ${loan.balance} ${currency} remains.` : " The loan is fully repaid."}`);
          else journal(state, "activity", "moneylender-loan-extended", `The lender adds a fee of ${world.economy!.moneylender!.extensionFee} ${currency}. You now owe ${loan!.balance} ${currency}, due at age ${loan!.dueAge} (${formatYear(yearAtAge(world.startYear, loan!.dueAge))}).`);
        }
        continue;
      }
      const reason = characterEffectReason(world, state, effect, true);
      if (reason) throw new Error(`Character effect is unavailable: ${reason}`);
      switch (effect.type) {
        case "accomplishment": {
          if (!provenance) throw new Error("Accomplishments require an accepted decision or activity outcome.");
          if (isUnavailable(world.demo, "accomplishment", effect.achievement)) throw new Error("Character effect is unavailable: Not available in this demo.");
          const record = awardAccomplishment(world, state, effect.achievement, provenance.sourceId, provenance.outcomeId);
          if (record) journal(state, "activity", `earned-${record.achievementId}`, `Accomplishment: ${record.name}. ${record.description}`);
          break;
        }
        case "mastery": {
          if (effect.target === "stat") {
            state.stats[effect.id] = world.stats[effect.id].max;
            recordKnowledgePractice(world, state, effect);
          } else state.character!.skills[effect.id] = world.character!.skills[effect.id].max;
          break;
        }
        case "stat": {
          const definition = world.stats[effect.stat];
          state.stats[effect.stat] = applyStatDelta(definition, state.stats[effect.stat], effect.delta);
          recordKnowledgePractice(world, state, effect);
          break;
        }
        case "flag": state.flags[effect.flag] = effect.value; break;
        case "skill": {
          const definition = world.character!.skills[effect.skill];
          const gain = skillEffectDelta(effect, state.flags);
          // Paths worlds: practice grows faster in a field the life is drawn to.
          const delta = practiceGain(world, state, effect.skill, gain);
          state.character!.skills[effect.skill] = applyStatDelta(definition, state.character!.skills[effect.skill], delta);
          break;
        }
        case "job":
          if (effect.job && isUnavailable(world.demo, "job", effect.job)) throw new Error("Character effect is unavailable: Not available in this demo.");
          state.character!.jobId = effect.job; break;
        case "capability": {
          const previous = new Set(Object.keys(state.capabilities?.learned ?? {}));
          journal(state, "activity", `capability-work-${effect.node.toLowerCase()}`, applyCapability(world, state, effect.node));
          for (const id of Object.keys(state.capabilities?.learned ?? {})) if (!previous.has(id)) {
            const node = world.capabilities!.nodes.find(node => node.id === id)!;
            journal(state, "event", `capability-earned-${id.toLowerCase()}`, `Learned ${node.title}. ${node.reward}`);
          }
          syncEconomyStat(world, state);
          break;
        }
        case "affinity": {
          const text = changeAffinity(world, state, effect.field, effect.delta, effect.source);
          if (text) journal(state, "event", affinityJournalId(effect.field), text);
          break;
        }
        case "meet-practitioner": {
          const meeting = meetPractitioner(world, state, effect.field, effect.band);
          journal(state, "event", `paths-meet-${effect.field}`, meeting.text);
          apply(state, meeting.effects);
          break;
        }
        case "join-district": {
          const counts = [...state.paths!.people[effect.field]] as PathsState["people"][FieldId];
          counts[TIERS.indexOf(effect.tier)] += 1;
          state.paths!.people = { ...state.paths!.people, [effect.field]: counts };
          refreshNeeds(world, state);
          break;
        }
        case "introduce-field":
          if (!state.paths!.introductions.includes(effect.field)) state.paths!.introductions = [...state.paths!.introductions, effect.field];
          break;
        case "use-material": {
          const held = state.vocations?.inventory[effect.item] ?? 0;
          if (held < effect.quantity) { journal(state, "activity", `paths-use-${effect.item}`, `There is not enough ${effect.item} left to use.`); break; }
          takeItem(state, effect.item, effect.quantity);
          journal(state, "activity", `paths-use-${effect.item}`, `${effect.quantity} ${effect.item} used: ${effect.cause}.`);
          break;
        }
        case "account-pay": {
          const paid = drawFromAccount(state, effect.account, effect.amount);
          if (paid > 0) {
            apply(state, [{ type: "cash", delta: paid }]);
            journal(state, "activity", `paths-pay-${effect.account}`, `You are paid ${paid} ${world.economy?.currency.short ?? "dr"}: ${effect.cause}.`);
          } else journal(state, "activity", `paths-pay-${effect.account}`, `The payer's chest could not cover the fee (${effect.cause}), so nothing was paid.`);
          break;
        }
        case "successor":
          journal(state, "event", `paths-successor-${effect.field}`, recordSuccessor(state, effect.field, effect.relation, effect.cause));
          break;
        case "move-district":
          journal(state, "event", "paths-move", moveDistrict(world, state, effect.district, effect.reason));
          break;
        case "vocation":
          journal(state, "activity", `vocation-${effect.action}`, applyVocation(world, state, effect.action));
          if (world.demo?.startingResources) syncEconomyStat(world, state);
          break;
        case "demo":
          if (!world.demo || !state.demo) throw new Error("Demo effects need a demo world.");
          applyDemoEffect(demoCtx(state), effect.effect);
          if (world.demo.startingResources) syncEconomyStat(world, state);
          break;
        case "condition": addHealthCondition(world, state, effect.condition, decisionContext, healthHooks(state)); break;
        case "care": provideHealthCare(world, state, effect.amount); break;
        case "closeness": applyCloseness(world, state, effect); break;
        case "social-role": applySocialRole(world, state, effect); break;
        case "relationship":
          state.character!.partnerId = effect.partner;
          state.character!.relationshipStatus = effect.status;
          if (world.character?.proceduralPartners) {
            state.character!.datedPartnerIds ??= [];
            if (!state.character!.datedPartnerIds.includes(effect.partner)) state.character!.datedPartnerIds.push(effect.partner);
          }
          break;
        case "introduce": {
          const character = state.character!;
          character.knownPartnerIds ??= [];
          if (!character.knownPartnerIds.includes(effect.partner)) {
            const generated = encounterPerson(world, state, effect.partner);
            character.knownPartnerIds.push(effect.partner);
            const person = generated ?? world.character!.partners.find(partner => partner.id === effect.partner)!;
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

  /** Demo worlds: a choice that would grant unavailable content cannot be taken. */
  function grantsUnavailable(choice: Choice): boolean {
    return Boolean(world.demo) && choice.outcomes.some(outcome => outcome.effects.some(effect =>
      effect.type === "job" && effect.job !== null && isUnavailable(world.demo, "job", effect.job) ||
      effect.type === "accomplishment" && isUnavailable(world.demo, "accomplishment", effect.achievement)));
  }

  function choicesFor(event: LifeEvent, state: LifeState): Choice[] {
    return event.choices.filter(choice => matches(choice.when, state) && !grantsUnavailable(choice) && !refusedAppointment(choice, state) &&
      (!choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "loan")) || !financeActivityReason(world, state, choice)));
  }

  /** Attribute-atlas worlds: a military appointment the army would refuse is not offered (older packs are unaffected). */
  function refusedAppointment(choice: Choice, state: LifeState): boolean {
    if (world.capabilities?.version !== 2) return false;
    return choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job !== null && effect.job in MILITARY_QUALIFICATIONS &&
      characterEffectReason(world, state, effect, true) !== undefined));
  }

  function eligible(event: LifeEvent, state: LifeState): boolean {
    if (influences.inactive(event.id, state)) return false;
    // Medical decisions are interrupts from the health lifecycle, never an
    // unrelated random story or a repeat after care was already chosen.
    if (world.health?.careDecision === event.id) return false;
    if (world.economy?.moneylender && Object.values(world.economy.moneylender.events).includes(event.id)) return false;
    if (event.exclusiveGroup && exclusiveGroups.get(event.exclusiveGroup)!.some(member => (state.eventCounts[member.id] ?? 0) > 0)) return false;
    if ((state.eventCounts[event.id] ?? 0) >= (event.maxOccurrences ?? 1)) return false;
    if (!inTimeFrame(world, event, state.age)) return false;
    // In staged worlds a decision outside the player's scope is resolved by others, or does not happen.
    const byOthers = decidedByOthers(world, event, state.age);
    if (byOthers && !event.dependent) return false;
    if (!matches(event.when, state) || (event.mode !== "automatic" && !byOthers && choicesFor(event, state).length === 0)) return false;
    switch (event.trigger.type) {
      case "age": return state.age >= event.trigger.at;
      case "year": {
        // Only a recurring dated event names a cooldown; older packs have none, so their dated events are unchanged.
        const lastAge = event.cooldownYears === undefined ? undefined : state.lastEventAge[event.id];
        return state.year >= event.trigger.at && (lastAge === undefined || state.age - lastAge >= event.cooldownYears!);
      }
      case "random": {
        const lastAge = state.lastEventAge[event.id];
        return lastAge === undefined || state.age - lastAge >= (event.cooldownYears ?? 1);
      }
    }
  }

  /** A fired catalog event's entry carries its source, so impact is countable from the journal. */
  function recordEvent(state: LifeState, event: LifeEvent, source = influences.activatedSource(event.id, state), text = event.text): void {
    // A fresh-year decision is consumed when it fires, so it cannot reopen in the same year.
    const demoGate = event.when?.type === "all"
      ? event.when.conditions.find(item => item.type === "demo" && item.condition.kind === "year")
      : event.when;
    const yearGate = demoGate?.type === "demo" && demoGate.condition.kind === "year" ? demoGate.condition : undefined;
    if (state.demo && yearGate?.kind === "year" && yearGate.fresh) {
      state.demo.year.fresh = state.demo.year.fresh.filter(family => family !== yearGate.family);
    }
    state.eventCounts[event.id] = (state.eventCounts[event.id] ?? 0) + 1;
    state.lastEventAge[event.id] = state.age;
    if (world.economy?.market) syncEconomyStat(world, state);
    journal(state, "event", event.id, `${event.title}: ${text}`, source ? { source } : undefined);
  }

  function scheduledAlternative(first: LifeEvent, state: LifeState): LifeEvent {
    if (!first.exclusiveGroup) return first;
    return pick(exclusiveGroups.get(first.exclusiveGroup)!.filter(event => eligible(event, state)), () => 1, state);
  }

  function offer(state: LifeState, event: LifeEvent, advancePacing = true, source?: InfluenceSource): void {
    recordEvent(state, event, source);
    state.pendingEventId = event.id;
    state.phase = "choice";
    if (world.eventPacing && advancePacing) {
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

  /** Staged worlds: an event the player may not decide now resolves like an automatic one. */
  function automaticNow(event: LifeEvent, state: LifeState): boolean {
    return event.mode === "automatic" || decidedByOthers(world, event, state.age);
  }

  /** Others decide by their written rule; the player lives with the result, without a choice. */
  function dependentEvent(state: LifeState, event: LifeEvent, source?: InfluenceSource): void {
    const dependent = event.dependent!;
    recordEvent(state, event, source, dependent.text);
    // Conditional responses are the household's rules; unconditional ones apply when no rule matches.
    const ruled = dependent.responses.filter(item => item.when && matches(item.when, state));
    const pool = ruled.length ? ruled : dependent.responses.filter(item => !item.when);
    const response = pick(pool, item => item.weight ?? 1, state);
    journal(state, "outcome", response.id, response.text);
    recorded(state, state.journal.length - 1, () => apply(state, response.effects, `${event.title} — ${response.text}`, { sourceId: event.id, outcomeId: response.id }));
    checkEndings(state);
  }

  function automaticEvent(state: LifeState, event: LifeEvent, source?: InfluenceSource): void {
    if (event.mode !== "automatic" && decidedByOthers(world, event, state.age)) { dependentEvent(state, event, source); return; }
    recordEvent(state, event, source);
    recorded(state, state.journal.length - 1, () => apply(state, event.effects ?? []));
    checkEndings(state);
  }

  /** Applied influence events come next after the current decision, outside pacing and triggers. */
  function offerQueuedInfluence(state: LifeState): boolean {
    while (state.queuedInfluences && state.phase !== "ended") {
      const [queued, ...rest] = state.queuedInfluences;
      if (rest.length) state.queuedInfluences = rest;
      else delete state.queuedInfluences;
      const event = influences.entry(queued.entry).event!;
      if (!matches(event.when, state)) continue;
      if (automaticNow(event, state)) { if (event.mode === "automatic" || event.dependent) automaticEvent(state, event, queued.source); }
      else if (choicesFor(event, state).length) { offer(state, event, false, queued.source); return true; }
    }
    return false;
  }

  function offerMedicalDecision(state: LifeState): boolean {
    if (state.phase === "ended" || !world.health || !state.health?.needsCareDecision || !state.health.conditions.length) return false;
    state.health.needsCareDecision = false;
    const care = eventById.get(world.health.careDecision)!;
    // A child's care is arranged by the household; the life continues without a choice.
    if (decidedByOthers(world, care, state.age) && care.dependent) { automaticEvent(state, care); return false; }
    const previousChoiceAge = state.nextChoiceAge;
    offer(state, care);
    if (previousChoiceAge === undefined) delete state.nextChoiceAge;
    else state.nextChoiceAge = previousChoiceAge;
    return true;
  }

  function offerLoanCollection(state: LifeState): boolean {
    const id = loanCollectionEventId(world, state);
    if (!id) return false;
    const event = eventById.get(id)!;
    if (!choicesFor(event, state).length) throw new Error("A moneylender collection must have an available fallback choice.");
    state.economy!.loan!.lastCollectionAge = state.age;
    const previousChoiceAge = state.nextChoiceAge;
    offer(state, event);
    if (previousChoiceAge === undefined) delete state.nextChoiceAge;
    else state.nextChoiceAge = previousChoiceAge;
    return true;
  }

  function offerRareEncounter(state: LifeState): boolean {
    const policy = world.eventPacing?.rareEvents;
    if (!policy || policy.annualChance === 0) return false;
    for (let i = state.journal.length - 1; i >= 0; i--) {
      const entry = state.journal[i];
      if (entry.type !== "event" || !rareEventIds.has(entry.id)) continue;
      if (state.age - entry.age < policy.cooldownYears) return false;
      break;
    }
    const candidates = rareEvents.filter(event => eligible(event, state) && !automaticNow(event, state));
    if (candidates.length === 0) return false;
    if (policy.annualChance < 1) {
      const draw = nextRandom(state.rngState);
      state.rngState = draw.state;
      if (draw.value >= policy.annualChance) return false;
    }
    // Rare stories use their raw relative weights, so novelty penalties cannot
    // promote them into common events. The ordinary decision deadline survives.
    const event = pick(candidates, item => item.trigger.type === "random" ? item.trigger.weight : 0, state);
    offer(state, event, false);
    return true;
  }

  function offerPeopleEncounter(state: LifeState): boolean {
    if (!peoplePolicy || state.age < 18) return false;
    for (let index = state.journal.length - 1; index >= 0; index--) {
      const entry = state.journal[index];
      if (entry.type !== "event" || !peopleEventIds.has(entry.id)) continue;
      if (state.age - entry.age < peoplePolicy.cooldownYears) return false;
      break;
    }
    const candidates = peopleEvents.filter(event => eligible(event, state));
    const invitations = candidates.filter(event => choicesFor(event, state).some(choice => choice.outcomes.some(outcome =>
      outcome.effects.some(effect => effect.type === "relationship" && effect.status === "courting" ||
        world.character?.socialRelationships && effect.type === "social-role" && effect.active))));
    const meetings = candidates.filter(event => choicesFor(event, state).some(choice => choice.outcomes.some(outcome =>
      outcome.effects.some(effect => effect.type === "introduce"))));
    const pool = invitations.length ? invitations : meetings;
    if (!pool.length) return false;
    const chance = invitations.length ? peoplePolicy.dateChance : state.character?.knownPartnerIds?.length ? peoplePolicy.meetingChance : peoplePolicy.firstMeetingChance;
    if (chance === 0) return false;
    if (chance < 1) {
      const draw = nextRandom(state.rngState);
      state.rngState = draw.state;
      if (draw.value >= chance) return false;
    }
    offer(state, pickRandomEvent(pool, state));
    return true;
  }

  function resolvePacedEvents(state: LifeState, allowRandom: boolean): void {
    const drainAutomatic = (): boolean => {
      while (state.phase !== "ended") {
        const event = allEvents.find(candidate => automaticNow(candidate, state) &&
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
      const background = allEvents.filter(event => automaticNow(event, state) &&
        event.trigger.type === "random" && eligible(event, state));
      if (background.length > 0) {
        automaticEvent(state, pickRandomEvent(background, state));
        if (offerMedicalDecision(state)) return;
        if (drainAutomatic()) return;
      }
    }
    if (offerLoanCollection(state)) return;
    const decisionDue = state.age >= (state.nextChoiceAge ?? 0);
    if (world.eventPacing?.rareEvents) {
      const anchor = allEvents.find(event => !automaticNow(event, state) && event.trigger.type === "year" && eligible(event, state));
      if (anchor) { offer(state, anchor); return; }
      if (allowRandom && state.age > 0 && offerRareEncounter(state)) return;
    } else if (peoplePolicy) {
      // The new lane cannot promote a personal encounter ahead of dated history.
      const anchor = allEvents.find(event => !automaticNow(event, state) && event.trigger.type === "year" && eligible(event, state));
      if (anchor) { offer(state, anchor); return; }
    }
    // Fixed-year decisions are hard anchors. Personal age milestones wait for the
    // next decision slot; the initial household decision is the age-zero exception.
    const scheduled = allEvents.find(event => !automaticNow(event, state) &&
      event.trigger.type !== "random" && eligible(event, state) &&
      (event.trigger.type === "year" || decisionDue || (state.age === 0 && event.trigger.at === 0)));
    // Essential childhood milestones through sixteen keep their place even if
    // delayed. Later personal milestones share the adult encounter slots.
    if (scheduled?.trigger.type === "age" && scheduled.trigger.at <= 16) { offer(state, scheduledAlternative(scheduled, state)); return; }
    if (allowRandom && decisionDue && offerPeopleEncounter(state)) return;
    if (scheduled) { offer(state, scheduledAlternative(scheduled, state)); return; }
    if (allowRandom && state.age > 0 && decisionDue) {
      const decisions = allEvents.filter(event => !automaticNow(event, state) && event.rarity !== "rare" &&
        event.trigger.type === "random" && !peopleEventIds.has(event.id) && eligible(event, state));
      if (decisions.length > 0) {
        offer(state, pickRandomEvent(decisions, state));
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
    if (loanCollectionEventId(world, state)) {
      // A due contract drains historical/automatic entries before interrupting
      // personal decisions, including worlds without separate paced lanes.
      while (state.phase !== "ended") {
        const event = allEvents.find(candidate => automaticNow(candidate, state) && candidate.trigger.type !== "random" && eligible(candidate, state));
        if (!event) break;
        automaticEvent(state, event);
        if (offerMedicalDecision(state)) return;
      }
      if (state.phase === "ended") return;
      if (randomAvailable && state.age > 0) {
        const background = allEvents.filter(event => automaticNow(event, state) && event.trigger.type === "random" && eligible(event, state));
        if (background.length) {
          randomAvailable = false;
          automaticEvent(state, pick(background, candidate => candidate.trigger.type === "random" ? candidate.trigger.weight : 0, state));
          if (offerMedicalDecision(state)) return;
        }
      }
      if (offerLoanCollection(state)) return;
    }
    // Scheduled events queue in declaration order. Automatic entries drain without
    // inventing a player choice, and any scheduled activity takes this year's slot.
    while (state.phase !== "ended") {
      const scheduled = allEvents.find(event => event.trigger.type !== "random" && eligible(event, state));
      if (scheduled) {
        randomAvailable = false;
        if (automaticNow(scheduled, state)) { automaticEvent(state, scheduled); if (offerMedicalDecision(state)) return; continue; }
        offer(state, scheduledAlternative(scheduled, state));
        return;
      }
      if (randomAvailable) {
        randomAvailable = false;
        const random = allEvents.filter(event => event.trigger.type === "random" && event.rarity !== "rare" && eligible(event, state));
        if (random.length > 0) {
          const event = pick(random, candidate => candidate.trigger.type === "random" ? candidate.trigger.weight : 0, state);
          if (automaticNow(event, state)) { automaticEvent(state, event); if (offerMedicalDecision(state)) return; continue; }
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
      ...(world.capabilities ? { capabilities: initialCapabilities() } : {}),
      ...(world.vocations ? { vocations: initialVocations(world.vocations) } : {}),
      ...(world.character ? { character: initialCharacter(world)! } : {}),
      ...(world.health ? { health: initialHealth(world)! } : {}),
      ...(world.knowledge ? { knowledge: initialKnowledge(world)! } : {}),
      ...(world.legacy ? { accomplishments: [] } : {}),
    };
    if (world.relationships && state.character) state.character.relationships = initialRelationships(world)!;
    const origin = pick(world.origins, candidate => candidate.weight, state);
    state.originId = origin.id;
    for (const [id, definition] of Object.entries(world.stats)) {
      const range = origin.statRanges?.[id] ?? definition.initialRange;
      if (range) state.stats[id] = startingStat(range.min, range.max, state);
    }
    if (world.character?.identity) initializeIdentity(world, state);
    else if (world.character?.playerNames) state.character!.name = pick(world.character.playerNames, () => 1, state);
    initializeFamily(world, state);
    if (world.paths) state.paths = initialPaths(world, state);
    journal(state, "birth", origin.id, `${origin.title}: ${origin.text}`);
    apply(state, origin.effects);
    if (world.economy) {
      state.economy = initialEconomy(world, state)!;
      for (const asset of world.economy.assets) {
        const range = origin.assetRanges?.[asset.id] ?? asset.initialRange;
        if (range) state.economy.assets[asset.id] = startingStat(range.min, range.max, state);
      }
      if (world.economy.uncappedResources || world.economy.assets.some(asset => origin.assetRanges?.[asset.id] || asset.initialRange)) syncEconomyStat(world, state);
    }
    if (world.demo) {
      initialDemo(world, state, effects => apply(state, effects), (id, text) => journal(state, "event", id, text));
      if (world.demo.startingResources) syncEconomyStat(world, state);
    }
    if (world.paths && applyStartingMaterials(world, state) && world.demo?.startingResources) syncEconomyStat(world, state);
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
    recorded(next, next.journal.length, () => progressKnowledge(world, next, (id, text) => journal(next, "event", id, text)));
    const completedAge = next.age;
    next.age += 1;
    next.year = yearAtAge(world.startYear, next.age);
    journal(next, "year", `age-${next.age}`, `Age ${next.age}`);
    const marketYear = settleMarketYear(world, next, completedAge, (id, text) => journal(next, "activity", id, text));
    if (world.economy?.market) syncEconomyStat(world, next);
    const annualIncome = (): void => {
      if (next.phase !== "ended" && next.character?.jobId && next.vocations?.workedAge !== next.age - 1) {
        const job = world.character!.jobs.find(candidate => candidate.id === next.character!.jobId)!;
        if (marketYear.focused) journal(next, "activity", "work-set-aside-for-trade", `You set aside your ${job.title.toLowerCase()} work to focus on market trading this year. No job income or production is earned.`);
        else if (!job.production || marketYear.productionBatches > 0) {
          recorded(next, () => next.journal.length - 1, () => {
            apply(next, job.yearlyEffects);
            journal(next, "activity", job.id, `You continue your work as ${job.title.toLowerCase()}.`);
          });
        }
      }
      if (next.phase !== "ended") {
        const income = yearlyAssetIncome(world, next);
        if (income > 0) {
          recorded(next, () => next.journal.length - 1, () => {
            apply(next, [{ type: "cash", delta: income }]);
            journal(next, "activity", "asset-income", `Your assets bring in ${income} ${world.economy!.currency.short}.`);
          });
        }
      }
    };
    // Money-enabled years settle income before costs, avoiding bridge debt
    // created only by batching a whole year. Legacy worlds keep exact ordering.
    if (world.economy) annualIncome();
    if (world.demo && next.phase !== "ended") recorded(next, () => next.journal.length - 1, () => {
      settleDemoYear(demoCtx(next));
      if (world.demo!.startingResources) syncEconomyStat(world, next);
    });
    if (world.capabilities && next.phase !== "ended") {
      const previous = new Set(Object.keys(next.capabilities?.learned ?? {}));
      settleCapabilities(world, next, completedAge);
      for (const id of Object.keys(next.capabilities?.learned ?? {})) if (!previous.has(id)) {
        const node = world.capabilities.nodes.find(node => node.id === id)!;
        journal(next, "event", `capability-earned-${id.toLowerCase()}`, `Learned ${node.title}. ${node.reward}`);
      }
      syncEconomyStat(world, next);
    }
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
    // Paths worlds: a stage that just ended is recorded once its last year has settled.
    if (world.paths && next.phase !== "ended" && lifeStageAt(world, completedAge)?.id !== lifeStageAt(world, next.age)?.id) closeStage(world, next, completedAge, completedAge);
    if (world.demo && next.phase !== "ended") {
      openDemoYear(demoCtx(next));
      if (world.demo.startingResources) syncEconomyStat(world, next);
    }
    // The district moves with this year's conditions (war, flood) once they are known.
    if (world.paths && next.phase !== "ended") {
      // Village edge: a year in the home fields is healthier than travelling to work.
      const edgeHealth = farmEdgeHealth(world, next, completedAge);
      if (edgeHealth > 0) {
        apply(next, [{ type: "stat", stat: world.health?.stat ?? "health", delta: edgeHealth }]);
        journal(next, "activity", "farm-edge-health", "A year of work in your own fields, close to home, leaves you stronger.");
      }
      advanceDistrict(world, next); fadeAffinity(world, next);
    }
    checkEndings(next);
    resolveEvents(next, true);
    if (world.economy?.market) syncEconomyStat(world, next);
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
    const outcome = pick(choice.outcomes, candidate => outcomeWeight(world, next, candidate), next);
    journal(next, "outcome", outcome.id, outcome.text);
    recorded(next, next.journal.length - 1, () => apply(next, outcome.effects, `${choice.text} — ${outcome.text}`, { sourceId: event.id, outcomeId: outcome.id }));
    checkEndings(next);
    if (offerQueuedInfluence(next)) return;
    // Resolve other due scheduled events at this age, without generating extra random events.
    resolveEvents(next, false);
    if (world.economy?.market) syncEconomyStat(world, next);
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
    return freeze(choicesFor(eventById.get(state.pendingEventId!)!, state).map(choice => visiblePersonChoice(choice, world, state)));
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
      return { ...visiblePersonChoice(activity, world, state), available: reason === undefined, ...(reason ? { reason } : {}) };
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
    const outcome = pick(activity.outcomes, candidate => outcomeWeight(world, next, candidate), next);
    journal(next, "outcome", outcome.id, outcome.text);
    recorded(next, next.journal.length - 1, () => apply(next, outcome.effects, `${activity.text} — ${outcome.text}`, { sourceId: activity.id, outcomeId: outcome.id }));
    checkEndings(next);
    resolveEvents(next, false);
    if (world.economy?.market) syncEconomyStat(world, next);
  }

  function act(state: LifeState, activityId: string): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    actInto(next, activityId);
    return freeze(next);
  }

  function orderMarketInto(next: LifeState, request: MarketOrderRequest): void {
    assertPlayable(next);
    recorded(next, () => next.journal.length - 1, () => {
      placeMarketOrder(world, next, request);
      next.commands.push({ type: "market-order", side: request.side, asset: request.asset, quantity: request.quantity });
      const order = next.economy!.market!.orders.at(-1)!;
      const title = world.economy!.assets.find(item => item.id === request.asset)!.title.toLowerCase();
      journal(next, "activity", "market-order", `You contract to ${order.side} ${order.quantity} ${title} at ${order.unitPrice} ${world.economy!.currency.short} each. ${order.side === "buy" ? "Cash" : "Goods"} reserved; settlement at age ${order.settlesAtAge}.`);
      syncEconomyStat(world, next);
    });
    checkEndings(next);
    resolveEvents(next, false);
  }

  function orderMarket(state: LifeState, request: MarketOrderRequest): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    orderMarketInto(next, request);
    return freeze(next);
  }

  function cancelMarketOrderInto(next: LifeState, orderId: number): void {
    assertPlayable(next);
    recorded(next, () => next.journal.length - 1, () => {
      cancelOrder(world, next, orderId);
      next.commands.push({ type: "market-cancel", orderId });
      journal(next, "activity", "market-cancel", `You cancel market contract ${orderId}. Its reserved cash or goods are returned.`);
      syncEconomyStat(world, next);
    });
    checkEndings(next);
    resolveEvents(next, false);
  }

  function cancelMarketOrder(state: LifeState, orderId: number): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    cancelMarketOrderInto(next, orderId);
    return freeze(next);
  }

  function chooseAvatarInto(state: LifeState, variant: number): void {
    assertPlayable(state);
    const identity = world.character?.identity;
    if (!identity || !state.character) throw new Error("Avatar selection is unavailable in this world.");
    if (!Number.isInteger(variant) || variant < 0 || variant >= identity.avatarVariants) throw new Error("Unknown avatar variant.");
    // Ranked lives open with their influence activations; those do not begin the life.
    if (state.age !== 0 || state.commands.some(command => command.type !== "avatar" && command.type !== "influence")) throw new Error("Choose an avatar before beginning this life.");
    if (state.character.avatarVariant === variant) return;
    state.character.avatarVariant = variant;
    state.commands.push({ type: "avatar", variant });
  }

  function chooseAvatar(state: LifeState, variant: number): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    chooseAvatarInto(next, variant);
    return next.commands.length === state.commands.length ? state : freeze(next);
  }

  /** activate: the entry's event joins this life's pool. apply: scaled effects now, its event next. */
  function influenceInto(next: LifeState, input: unknown, where?: string): void {
    assertPlayable(next);
    const command = parseInfluenceCommand(input, where);
    const entry = influences.entry(command.entry);
    next.commands.push(command);
    const record = { entry: entry.id, source: command.source, power: command.power };
    if (command.mode === "activate") next.activeInfluences = [...next.activeInfluences ?? [], record];
    else {
      const index = next.journal.length, before = influenceMeasure(next);
      journal(next, "influence", entry.id, entry.label, { source: command.source, deltas: {} });
      recorded(next, index, () => apply(next, scaleInfluenceEffects(entry.effects ?? [], command.power), entry.label));
      next.journal[index] = { ...next.journal[index], deltas: influenceDeltas(before, influenceMeasure(next)) };
      checkEndings(next);
      if (entry.event && next.phase !== "ended") next.queuedInfluences = [...next.queuedInfluences ?? [], record];
    }
    // A pending decision stays pending; otherwise resolve as after an activity.
    if (next.phase === "ready" && !offerQueuedInfluence(next)) resolveEvents(next, false);
  }

  function influence(state: LifeState, command: InfluenceCommand): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    influenceInto(next, command);
    return freeze(next);
  }

  /** Runs an engine command for an auto-play agent; the agent command is the one recorded. */
  function runAsAgent(next: LifeState, inner: Command): void {
    const recordedLength = next.commands.length;
    if (inner.type === "advance") advanceInto(next);
    else if (inner.type === "choose") chooseInto(next, inner.choice);
    else if (inner.type === "act") actInto(next, inner.activity);
    else if (inner.type === "trade" || inner.type === "plan") demoInto(next, inner);
    else throw new Error("An agent cannot issue that command for the player.");
    next.commands.splice(recordedLength, 1);
  }

  function demoInto(next: LifeState, input: unknown, where = ""): void {
    assertPlayable(next);
    if (!world.demo || !next.demo) throw new Error("This world has no demo economy.");
    const command = parseDemoCommand(input, where);
    const ctx = demoCtx(next);
    next.commands.push(command);
    switch (command.type) {
      case "trade":
        if (next.phase !== "ready") throw new Error("Resolve the current decision first.");
        executeTrade(ctx, command); break;
      case "plan": applyPlan(ctx, command); break;
      case "assign-agents":
        if (next.age !== 0 || next.commands.some(c => c.type === "advance")) throw new Error("Agents are assigned before the first year.");
        assignAgents(ctx, command); break;
      case "delegate": delegate(ctx, command); break;
      case "agent":
        applyAgentCommand(ctx, command, inner => runAsAgent(next, inner.command)); break;
    }
    if (world.demo.startingResources) syncEconomyStat(world, next);
  }

  function demo(state: LifeState, command: DemoCommand): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    demoInto(next, command);
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
      } else if (command.type === "avatar" && typeof command.variant === "number" && Object.keys(command).length === 2) {
        const count = state.commands.length;
        chooseAvatarInto(state, command.variant);
        if (state.commands.length === count) throw new Error(`Invalid redundant avatar command at ${i}.`);
      } else if (command.type === "market-order" && Object.keys(command).length === 4 && typeof command.asset === "string" && typeof command.quantity === "number") {
        orderMarketInto(state, command);
      } else if (command.type === "market-cancel" && Object.keys(command).length === 2 && typeof command.orderId === "number") {
        cancelMarketOrderInto(state, command.orderId);
      } else if (command.type === "influence") influenceInto(state, command, ` at ${i}`);
      else if (DEMO_COMMAND_TYPES.has(command.type)) demoInto(state, command, ` at ${i}`);
      else throw new Error(`Invalid command at ${i}.`);
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

  return Object.freeze({ world, fingerprint, start, advance, choose, getChoices, getActivities, act, orderMarket, cancelMarketOrder, chooseAvatar, influence, demo, replay, save, load });
}
