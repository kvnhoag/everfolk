import type { LifeEngine, LifeState, WorldPack } from "../types.ts";
import { initializeFamily, familyMemberIsAlive } from "../family.ts";
import { nextRandom, seedToUint32 } from "../random.ts";
import { syncEconomyStat } from "../economy.ts";
import { addPressure, orderValue } from "../demo/market-depth.ts";
import { decidesScope } from "../life-stages/index.ts";
import {
  NPC_ROLES,
  NPC_RULES_VERSION,
  type NpcRole,
  type NpcPerson,
  type NpcSessionState,
  type NpcSessionCommand,
  type NpcActionOption,
  type NpcDecision,
  type NpcEvent,
  type NpcCommand,
} from "./types.ts";
import { NpcInputError, sessionCommand, object } from "./validation.ts";

const goals: Record<NpcRole, string> = {
  "caregiver-a": "Keep the household fed and preserve its seed.",
  "caregiver-b": "Build security and help the child learn.",
  mentor: "Teach a promising pupil without exhausting my own resources.",
  merchant: "Keep the shop solvent and retain a food reserve.",
  peer: "Improve my own prospects while keeping a valued friendship.",
};
const firstNames = [
  "Damon",
  "Thais",
  "Menedemos",
  "Berenike",
  "Sostratos",
  "Myrine",
  "Nikon",
  "Phile",
];
const activation: Record<NpcRole, number> = {
  "caregiver-a": 0,
  "caregiver-b": 0,
  mentor: 6,
  merchant: 12,
  peer: 3,
};
export function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function emit(
  state: NpcSessionState,
  actor: string,
  text: string,
  kind: NpcEvent["kind"] = "action",
) {
  state.events.push({
    sequence: state.events.length + 1,
    age: state.player.age,
    actor,
    text,
    kind,
  });
}
function person(state: NpcSessionState, id: string): NpcPerson {
  const npc = state.people[id];
  if (
    !npc ||
    npc.status !== "alive" ||
    !Object.values(state.slots).includes(id)
  )
    throw new NpcInputError("This NPC is no longer active.");
  return npc;
}
export function isHouseholdNpc(npc: NpcPerson): boolean {
  return npc.familyId === "family-mother" || npc.familyId === "family-father";
}
export function resources(state: NpcSessionState, npc: NpcPerson) {
  const life = state.player;
  if (isHouseholdNpc(npc))
    return {
      cash: life.economy!.cash,
      grain: life.demo!.household.grain,
      account: "household" as const,
    };
  if (npc.role === "merchant")
    return {
      cash: life.demo!.town.merchant.cash,
      grain: life.demo!.town.merchant.grain,
      account: "shop" as const,
    };
  return { cash: npc.cash, grain: npc.grain, account: "personal" as const };
}
function createPerson(
  state: NpcSessionState,
  role: NpcRole,
  index: number,
  replacement = false,
): NpcPerson {
  const draw = () => {
    const random = nextRandom(state.rng);
    state.rng = random.state;
    return random.value;
  };
  const relation =
    role === "caregiver-a"
      ? "mother"
      : role === "caregiver-b"
        ? "father"
        : undefined;
  const family =
    !replacement && relation
      ? state.player.character?.family?.find((p) => p.relation === relation)
      : undefined;
  const offset =
    family?.ageOffset ??
    (role === "peer" ? Math.floor(draw() * 3) : 22 + Math.floor(draw() * 20));
  const id = family?.id ?? `npc-${role}-${index}`;
  const npc: NpcPerson = {
    id,
    name: family?.name ?? firstNames[Math.floor(draw() * firstNames.length)],
    role,
    born: state.player.year - offset,
    ...(family ? { familyId: family.id } : {}),
    introduced: state.player.age >= activation[role],
    status: "alive",
    health: 60 + Math.floor(draw() * 25),
    skills: {
      strength: 10 + Math.floor(draw() * 20),
      endurance: 10 + Math.floor(draw() * 20),
      knowledge: role === "mentor" ? 50 : 10,
      trade: role === "merchant" ? 50 : 10,
    },
    cash: 0,
    grain: 0,
    relationship: family ? 65 : 25,
    goal: goals[role],
    memories: [],
    workedAge: null,
  };
  // Declared starting capital comes from the existing workshop, never a duplicated purse.
  if (!family && role !== "merchant") {
    const transfer = Math.min(60, state.player.vocations!.accounts.workshop);
    state.player.vocations!.accounts.workshop -= transfer;
    npc.cash = transfer;
    state.treasuryEndowments += transfer;
  }
  return npc;
}
export function createNpcState(
  world: WorldPack,
  seed: string,
  initialPlayer: LifeState,
): NpcSessionState {
  const player = structuredClone(initialPlayer);
  if (!player.character?.family)
    initializeFamily(
      { ...world, character: { ...world.character!, familyBackgrounds: true } },
      player,
    );
  if (!player.demo || !player.economy || !player.vocations || !player.character)
    throw new NpcInputError(
      "NPC sessions require a household and vocation world.",
    );
  const state: NpcSessionState = {
    rulesVersion: NPC_RULES_VERSION,
    seed,
    player,
    slots: {} as Record<NpcRole, string>,
    people: {},
    offers: [],
    events: [],
    commands: [],
    lastResolvedAge: null,
    rng: seedToUint32(`${seed}:npc-session-1`),
    treasuryEndowments: 0,
  };
  NPC_ROLES.forEach((role, index) => {
    const npc = createPerson(state, role, index);
    state.slots[role] = npc.id;
    state.people[npc.id] = npc;
    emit(
      state,
      npc.id,
      `${npc.name} joins the core cast as ${role}.`,
      "arrival",
    );
  });
  syncEconomyStat(world, state.player);
  return freeze(state);
}
function grainCost(state: NpcSessionState, quantity: number, world?: WorldPack): number {
  return world?.demo?.market.depth
    ? orderValue(world.demo, state.player.demo!, "grain", "buy", quantity).total
    : quantity * state.player.demo!.town.prices.grain.sell;
}
function studyCost(state: NpcSessionState, world?: WorldPack): number {
  return world?.demo?.market.depth ? grainCost(state, 2, world) : 4;
}
function recordGrainPurchase(world: WorldPack, state: NpcSessionState, quantity: number): void {
  if (world.demo?.market.depth) addPressure(state.player.demo!, "grain", "buy", quantity);
}
export function availableNpcActions(
  state: NpcSessionState,
  id: string,
  world?: WorldPack,
): NpcActionOption[] {
  const npc = person(state, id),
    life = state.player,
    r = resources(state, npc);
  if (!npc.introduced || npc.workedAge === life.age || life.phase !== "ready")
    return [];
  const actions: NpcActionOption[] = [
    {
      id: "rest",
      label: "Rest and recover",
      cost: "No money; uses this year's action.",
    },
  ];
  const add = (id: NpcActionOption["id"], label: string, cost: string) =>
    actions.push({ id, label, cost });
  if (!isHouseholdNpc(npc) && npc.role !== "merchant") {
    if (life.vocations!.accounts.workshop >= 24)
      add(
        "work",
        "Take paid workshop work",
        "24 dr transferred from workshop; 2 Health spent.",
      );
    if (npc.cash >= studyCost(state, world) && life.demo!.town.merchant.grain >= 2)
      add(
        "study",
        "Buy supplies and study",
        `${studyCost(state, world)} dr to shop; 2 shop grain consumed; +3 Knowledge.`,
      );
    add(
      "train",
      "Train physical skills",
      "2 Health spent; +3 Strength and Endurance.",
    );
    if (npc.role === "mentor" && npc.skills.knowledge >= 30)
      add(
        "offer-lesson",
        "Offer a literacy lesson",
        "8 dr if accepted; one annual teaching offer.",
      );
    if (npc.cash >= 6)
      add(
        "offer-gift",
        "Offer help to the household",
        "6 dr only if the player accepts.",
      );
  }
  if (isHouseholdNpc(npc) && life.age < 16) {
    add(
      "prepare-fields",
      "Keep all household plots in grain",
      "Uses the shared household plan; no free seed.",
    );
    if (
      life.economy!.cash >= grainCost(state, 10, world) &&
      life.demo!.town.merchant.grain >= 10
    )
      add(
        "buy-food",
        "Buy household food",
        "10 grain at the actual shop asking price, paid by the household.",
      );
  }
  if (npc.role === "merchant" && r.grain >= 20)
    add(
      "offer-grain",
      "Offer 10 grain to the player",
      `10 grain for ${grainCost(state, 10, world)} dr; requires acceptance.`,
    );
  return actions;
}
export function rulesDecision(
  state: NpcSessionState,
  id: string,
  source: NpcDecision["source"] = "rules",
  world?: WorldPack,
): NpcDecision {
  const npc = person(state, id),
    r = resources(state, npc),
    actions = availableNpcActions(state, id, world).map((a) => a.id);
  const desired =
    npc.health < 35
      ? "rest"
      : isHouseholdNpc(npc)
        ? r.grain < 300
          ? "buy-food"
          : "prepare-fields"
        : npc.role === "merchant"
          ? "offer-grain"
          : npc.role === "mentor" && r.cash >= 20
            ? "offer-lesson"
            : r.cash < 30
              ? "work"
              : npc.role === "peer"
                ? "train"
                : "study";
  const action = actions.includes(desired) ? desired : "rest";
  return {
    action,
    source,
    speech:
      action === "offer-grain"
        ? "I have grain to sell, but I need to keep some for my own household."
        : action === "offer-lesson"
          ? "I can give you a lesson this year. My time has a price."
          : action === "buy-food"
            ? "Food comes first. We will pay for what we need."
            : action === "work"
              ? "I need to earn enough to meet my own expenses."
              : "I am making preparations for the year ahead.",
  };
}
function applyDecision(
  world: WorldPack,
  state: NpcSessionState,
  id: string,
  decision: NpcDecision,
) {
  const npc = person(state, id),
    life = state.player;
  if (!availableNpcActions(state, id, world).some((a) => a.id === decision.action))
    throw new NpcInputError(
      `Action ${decision.action} is unavailable for this NPC.`,
    );
  const shop = life.demo!.town.merchant;
  switch (decision.action) {
    case "rest":
      npc.health = Math.min(100, npc.health + 4);
      break;
    case "work":
      life.vocations!.accounts.workshop -= 24;
      npc.cash += 24;
      npc.health = Math.max(0, npc.health - 2);
      break;
    case "study":
      npc.cash -= studyCost(state, world);
      shop.cash += studyCost(state, world);
      shop.grain -= 2;
      recordGrainPurchase(world, state, 2);
      npc.skills.knowledge = Math.min(100, npc.skills.knowledge + 3);
      break;
    case "train":
      npc.health = Math.max(0, npc.health - 2);
      npc.skills.strength = Math.min(100, npc.skills.strength + 3);
      npc.skills.endurance = Math.min(100, npc.skills.endurance + 3);
      break;
    case "prepare-fields":
      life.demo!.household.flaxPlots = 0;
      break;
    case "buy-food": {
      const cost = grainCost(state, 10, world);
      life.economy!.cash -= cost;
      shop.cash += cost;
      shop.grain -= 10;
      life.demo!.household.grain += 10;
      recordGrainPurchase(world, state, 10);
      break;
    }
    case "offer-grain":
    case "offer-lesson":
    case "offer-gift": {
      const kind =
        decision.action === "offer-grain"
          ? "grain"
          : decision.action === "offer-lesson"
            ? "lesson"
            : "gift";
      state.offers.push({
        id: `offer-${npc.id}-${life.age}`,
        npcId: id,
        kind,
        quantity: kind === "grain" ? 10 : kind === "gift" ? 6 : 1,
        price:
          kind === "grain"
            ? grainCost(state, 10, world)
            : kind === "lesson"
              ? 8
              : 0,
        expiresAge: life.age + 1,
      });
      break;
    }
  }
  npc.workedAge = life.age;
  npc.memories = [
    ...npc.memories,
    `At player age ${life.age}, I chose ${decision.action}.`,
  ].slice(-12);
  emit(state, id, `${npc.name}: ${decision.action} (${decision.source}).`);
  if (decision.speech) emit(state, id, decision.speech, "speech");
  syncEconomyStat(world, life);
}
export function settlePeople(state: NpcSessionState, previous: LifeState, world?: WorldPack) {
  emit(
    state,
    "world",
    `Year ${state.player.year}: ${state.player.demo!.year.flood} flood, ${state.player.demo!.year.road} roads, ${state.player.demo!.year.army} army conditions.`,
    "world",
  );
  for (const id of Object.values(state.slots)) {
    const npc = state.people[id];
    const flood = previous.demo!.year.flood,
      war = previous.demo!.year.army === "war";
    if (npc.familyId) {
      const family = state.player.character!.family?.find(
        (p) => p.id === npc.familyId,
      );
      if (family && !familyMemberIsAlive(family, state.player.age))
        npc.status = "dead";
      npc.health = Math.min(npc.health, state.player.stats.health);
    } else {
      if (npc.role === "merchant") {
        const amount = Math.min(10, state.player.demo!.town.merchant.grain);
        state.player.demo!.town.merchant.grain -= amount;
        if (amount < 10) npc.health -= 4;
      } else {
        const shop = state.player.demo!.town.merchant;
        const cost = grainCost(state, 10, world);
        if (npc.cash >= cost && shop.grain >= 10) {
          npc.cash -= cost;
          shop.cash += cost;
          shop.grain -= 10;
          if (world) recordGrainPurchase(world, state, 10);
        } else npc.health -= 4;
      }
      npc.health = Math.max(
        0,
        npc.health -
          (flood === "low" ? 2 : 0) -
          (war ? 2 : 0) -
          (state.player.year - npc.born >= 65 ? 2 : 0),
      );
      if (npc.health <= 0) npc.status = "dead";
    }
    if (!npc.introduced && state.player.age >= activation[npc.role]) {
      npc.introduced = true;
      emit(state, id, `You meet ${npc.name}, your ${npc.role}.`, "arrival");
    }
    if (npc.status === "dead") {
      emit(
        state,
        id,
        `${npc.name} has died. Their history is preserved.`,
        "departure",
      );
      const replacement = createPerson(
        state,
        npc.role,
        state.events.length,
        true,
      );
      state.people[replacement.id] = replacement;
      state.slots[npc.role] = replacement.id;
      emit(
        state,
        replacement.id,
        `${replacement.name}, a new ${replacement.role === "caregiver-a" || replacement.role === "caregiver-b" ? "family contact" : replacement.role}, enters your life.`,
        "arrival",
      );
    } else {
      npc.memories = [
        ...npc.memories,
        `Year ${state.player.year}: ${flood} flood; ${previous.demo!.year.army} army conditions.`,
      ].slice(-12);
    }
  }
  state.offers = state.offers.filter(
    (o) =>
      o.expiresAge >= state.player.age &&
      state.people[o.npcId]?.status === "alive",
  );
}
export function applyNpcAction(
  world: WorldPack,
  state: NpcSessionState,
  command: Exclude<NpcSessionCommand, { type: "player" }>,
): void {
  const life = state.player;
  if (state.rulesVersion !== NPC_RULES_VERSION)
    throw new NpcInputError("Unknown NPC session rules.");
  if (life.phase === "ended") throw new NpcInputError("This life has ended.");
  switch (command.type) {
    case "resolve": {
      if (life.phase !== "ready" || state.lastResolvedAge === life.age)
        throw new NpcInputError(
          "The NPC turn is unavailable or already resolved.",
        );
      const active = Object.values(state.slots).filter(
        (id) => availableNpcActions(state, id, world).length,
      );
      if (Object.keys(command.decisions).some((id) => !active.includes(id)))
        throw new NpcInputError("Decision targets an inactive NPC.");
      for (const role of NPC_ROLES) {
        const id = state.slots[role];
        if (!active.includes(id)) continue;
        const proposed =
          command.decisions[id] ?? rulesDecision(state, id, "fallback", world);
        const decision = availableNpcActions(state, id, world).some(
          (a) => a.id === proposed.action,
        )
          ? proposed
          : rulesDecision(state, id, "fallback", world);
        applyDecision(world, state, id, decision);
      }
      state.lastResolvedAge = life.age;
      break;
    }
    case "answer": {
      if (life.phase !== "ready")
        throw new NpcInputError("Resolve the current life decision first.");
      const offer = state.offers.find((o) => o.id === command.offerId);
      if (!offer || offer.expiresAge < life.age)
        throw new NpcInputError("Offer has expired.");
      const npc = person(state, offer.npcId);
      if (!npc.introduced) throw new NpcInputError("Meet this NPC first.");
      if (command.accept) {
        if (life.age < 12)
          throw new NpcInputError(
            "Personal paid offers become available at age 12.",
          );
        // Staged worlds: shared purchases are the household's decision until the household scope opens (16).
        if (offer.kind === "grain" && !decidesScope(world, "household", life.age))
          throw new NpcInputError("Your household still decides shared purchases for you.");
        if (life.economy!.cash < offer.price)
          throw new NpcInputError("The household cannot afford this offer.");
        if (offer.kind === "grain") {
          const shop = life.demo!.town.merchant;
          if (shop.grain < offer.quantity)
            throw new NpcInputError("The shop no longer holds that grain.");
          if (world.demo?.market.depth && grainCost(state, offer.quantity, world) !== offer.price)
            throw new NpcInputError("The grain quote has changed. Decline this offer and request a new one.");
          life.economy!.cash -= offer.price;
          shop.cash += offer.price;
          shop.grain -= offer.quantity;
          life.demo!.household.grain += offer.quantity;
          recordGrainPurchase(world, state, offer.quantity);
        }
        if (offer.kind === "lesson") {
          if (life.character!.lastActivityAge === life.age)
            throw new NpcInputError(
              "This year's major action is already used.",
            );
          life.economy!.cash -= offer.price;
          npc.cash += offer.price;
          life.character!.skills.literacy = Math.min(
            100,
            life.character!.skills.literacy + 2,
          );
          life.character!.lastActivityAge = life.age;
        }
        if (offer.kind === "gift") {
          if (npc.cash < offer.quantity)
            throw new NpcInputError("The NPC can no longer afford this gift.");
          npc.cash -= offer.quantity;
          life.economy!.cash += offer.quantity;
        }
        npc.relationship = Math.min(100, npc.relationship + 2);
      }
      state.offers = state.offers.filter((o) => o.id !== offer.id);
      emit(
        state,
        npc.id,
        `You ${command.accept ? "accepted" : "declined"} ${npc.name}'s ${offer.kind} offer.`,
        "offer",
      );
      break;
    }
    case "speak": {
      const npc = person(state, command.npcId);
      if (!npc.introduced)
        throw new NpcInputError("You have not met this person yet.");
      if (
        state.events.filter(
          (e) =>
            e.age === life.age && e.kind === "speech" && e.actor === "player",
        ).length >= 5
      )
        throw new NpcInputError("Conversation limit reached for this year.");
      emit(state, "player", command.text, "speech");
      emit(state, npc.id, command.reply, "speech");
      npc.memories = [...npc.memories, `Player said: ${command.text}`].slice(
        -12,
      );
      break;
    }
  }
  syncEconomyStat(world, state.player);
}

export function applyNpcCommand(
  world: WorldPack,
  state: NpcSessionState,
  command: NpcCommand,
): void {
  const input = object(command, ["type", "decisions", "offerId", "accept", "npcId", "text", "reply"], ["type"]);
  const fields = input.type === "npc-turn" ? ["type", "decisions"]
    : input.type === "npc-answer" ? ["type", "offerId", "accept"]
    : input.type === "npc-speech" ? ["type", "npcId", "text", "reply"] : null;
  if (!fields) throw new NpcInputError("Unknown NPC command.");
  object(command, fields);
  const sessionCmd: Exclude<NpcSessionCommand, { type: "player" }> =
    command.type === "npc-turn"
      ? { type: "resolve", decisions: command.decisions }
      : command.type === "npc-answer"
      ? { type: "answer", offerId: command.offerId, accept: command.accept }
      : { type: "speak", npcId: command.npcId, text: command.text, reply: command.reply };
  const parsed = sessionCommand(sessionCmd);
  if (parsed.type === "player") throw new NpcInputError("Expected an NPC command.");
  applyNpcAction(world, state, parsed);
}

export function stepLegacyNpcSimulation(
  engine: LifeEngine,
  input: NpcSessionState,
  raw: unknown,
): NpcSessionState {
  const command = sessionCommand(raw),
    state = structuredClone(input),
    life = state.player;
  if (state.rulesVersion !== NPC_RULES_VERSION)
    throw new NpcInputError("Unknown NPC session rules.");
  if (state.commands.length >= 10000)
    throw new NpcInputError("Session action limit reached.");
  if (life.phase === "ended") throw new NpcInputError("This life has ended.");
  if (command.type === "player") {
    const c = command.command;
    if (c.type === "advance") {
      if (state.lastResolvedAge !== life.age)
        throw new NpcInputError(
          "Resolve the NPC turn before advancing the year.",
        );
      state.player = structuredClone(engine.advance(life));
      settlePeople(state, life, engine.world);
    } else if (c.type === "choose") {
      state.player = structuredClone(engine.choose(life, c.choice));
    } else if (c.type === "act") {
      state.player = structuredClone(engine.act(life, c.activity));
    } else if (c.type === "avatar") {
      state.player = structuredClone(engine.chooseAvatar(life, c.variant));
    } else if (c.type === "market-order") {
      state.player = structuredClone(engine.orderMarket(life, c));
    } else if (c.type === "market-cancel") {
      state.player = structuredClone(engine.cancelMarketOrder(life, c.orderId));
    } else {
      state.player = structuredClone(engine.demo(life, c));
    }
    syncEconomyStat(engine.world, state.player);
  } else {
    applyNpcAction(engine.world, state, command);
  }
  state.commands.push(command);
  return freeze(state);
}
export function observeNpc(state: NpcSessionState, id: string, world?: WorldPack) {
  const npc = person(state, id);
  return {
    actor: {
      id: npc.id,
      name: npc.name,
      role: npc.role,
      age: state.player.year - npc.born,
      health: npc.health,
      skills: { ...npc.skills },
      goal: npc.goal,
      relationship: npc.relationship,
    },
    player: {
      name: state.player.character!.name ?? "Your companion",
      age: state.player.age,
      health: state.player.stats.health,
      occupation: state.player.character!.jobId ?? "none",
    },
    year: state.player.year,
    playerAge: state.player.age,
    conditions: {
      flood: state.player.demo!.year.flood,
      road: state.player.demo!.year.road,
      army: state.player.demo!.year.army,
    },
    resources: resources(state, npc),
    actions: availableNpcActions(state, id, world),
    memory: [...npc.memories],
    events: state.events
      .filter((e) => e.actor === npc.id || e.kind === "world")
      .slice(-10)
      .map(({ age, text, kind }) => ({ age, text, kind })),
  };
}
