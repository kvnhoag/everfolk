// Fictional stocks and service orders, with authored prices and quantities.
// Salaried employers still supply ordinary work; these are optional independent orders.
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const stock = (asset, value = 1) => ({ type: "asset", asset, op: "gte", value });
const asset = (asset, delta) => ({ type: "asset", asset, delta });
const skill = (skill, delta = 1) => ({ type: "skill", skill, delta });

const extraGoods = [
  ["flour", "Flour", 3, "Food and farming", "Flour consumed by independent baking."],
  ["fuel", "Fuel bundles", 3, "Food and farming", "Fuel consumed in baking and optional kiln work."],
  ["bread", "Bread orders", 6, "Food and farming", "A settled order for a batch of bread. One unit represents an order, not bread stored fresh for a year."],
  ["netting", "Netting supplies", 4, "Fishing and shipping", "Replacement net sections used in a fishing season."],
  ["salt", "Salt", 2, "Fishing and shipping", "Salt consumed when preserving the catch."],
  ["preserved-fish", "Preserved fish", 10, "Fishing and shipping", "A portion of preserved catch ready for sale."],
  ["rope", "Rope", 4, "Fishing and shipping", "Rope used for securing cargo and repairing rigging."],
  ["sailcloth", "Sailcloth", 6, "Fishing and shipping", "Cloth consumed in optional rigging repairs."],
  ["pitch", "Pitch", 3, "Fishing and shipping", "Sealing material consumed in boat and rigging repairs."],
  ["transport-baskets", "Transport baskets", 5, "Fishing and shipping", "Baskets delivered with prepared cargo or estate supplies."],
  ["leather", "Leather straps", 5, "Military supplies", "Replacement straps consumed in equipment repairs."],
  ["bronze-fittings", "Bronze fittings", 7, "Military supplies", "Small replacement fittings consumed in equipment repairs."],
  ["wax-tablets", "Writing tablets", 12, "Writing and records", "Reusable working tablets for lesson notes and supply accounts."],
  ["oil", "Oil", 4, "Household and temple", "Oil consumed in household service orders and preparations for a gathering."],
  ["incense", "Incense", 5, "Household and temple", "Incense consumed in an optional preparation order for a temple gathering."],
  ["cleaning-cloths", "Cleaning cloths", 3, "Household and temple", "Cloths consumed while fulfilling a household service order."],
  ["musical-reeds", "Musical reeds", 3, "Music", "Replacement reeds consumed in a paid musical engagement."],
  ["instrument-strings", "Instrument strings", 4, "Music", "Replacement strings consumed in a paid musical engagement."],
  ["musical-instrument", "Musical instrument", 24, "Music", "A reusable instrument that opens independent paid musical engagements."],
];

const originResources = {
  "merchant-household": { "linen-cloth": 1, oil: 2, "transport-baskets": 1 },
  "artisan-household": { clay: 3, fuel: 2 },
  "harbor-household": { rope: 1, "transport-baskets": 1 },
  "fishing-household": { netting: 1, salt: 2 },
  "bakery-household": { flour: 3, fuel: 2 },
  "clerk-household": { papyrus: 2, ink: 2, "wax-tablets": 1 },
  "weaver-household": { "flax-thread": 3 },
  "delta-newcomers": { rope: 1, "transport-baskets": 1 },
  "royal-household": { "wax-tablets": 1, papyrus: 2, ink: 2 },
  "estate-household": { "wax-tablets": 1, "transport-baskets": 2 },
  "temple-household": { incense: 1, oil: 1, papyrus: 1 },
  "soldier-household": { leather: 1, "bronze-fittings": 1 },
  "tenant-farming-household": { "seed-grain": 2, "transport-baskets": 1 },
  "domestic-service-household": { "cleaning-cloths": 2, oil: 1 },
  "boatbuilder-household": { timber: 2, rope: 1, pitch: 1 },
  "musician-household": { "musical-reeds": 1, "instrument-strings": 1, "musical-instrument": 1 },
};

const jobResources = {
  apprentice: ["fuel", "tool-chest"],
  porter: ["rope", "transport-baskets"],
  clerk: ["wax-tablets", "papyrus", "ink"],
  sailor: ["rope", "sailcloth", "pitch"],
  shopkeeper: ["oil", "preserved-fish", "transport-baskets"],
  "philosophy-tutor": ["wax-tablets", "papyrus", "ink"],
  astrologer: ["wax-tablets", "papyrus", "ink"],
  soldier: ["leather", "bronze-fittings"],
  officer: ["leather", "bronze-fittings", "wax-tablets"],
  general: ["leather", "bronze-fittings", "wax-tablets"],
  "court-adviser": ["wax-tablets", "papyrus", "ink"],
  "patron-supported-reader": ["wax-tablets", "papyrus", "ink"],
  performer: ["musical-instrument", "musical-reeds", "instrument-strings"],
  trader: ["linen-cloth", "grain", "oil", "preserved-fish"],
  "household-worker": ["cleaning-cloths", "oil"],
};

const existingCategories = {
  "tool-chest": "Equipment and investments", "workshop-share": "Equipment and investments",
  "flax-thread": "Textiles", "linen-cloth": "Textiles", papyrus: "Writing and records", ink: "Writing and records", "written-copies": "Writing and records",
  clay: "Workshop materials", "pottery-goods": "Workshop materials", timber: "Workshop materials", "wooden-goods": "Workshop materials", stone: "Workshop materials", "carved-stone": "Workshop materials", "boat-fittings": "Fishing and shipping",
  "seed-grain": "Food and farming", grain: "Food and farming",
};

export function applyResourceVariety(world) {
  world.version = "0.39.0";
  const market = world.economy.market;
  for (const [id, title, value, category, description] of extraGoods) {
    world.economy.assets.push({ id, title, value, category, description, initialRange: { min: 0, max: 0 } });
    market.goods.push(id);
  }
  const definitions = new Map(world.economy.assets.map(item => [item.id, item]));
  for (const item of definitions.values()) {
    item.category ??= existingCategories[item.id];
    item.context = {};
  }
  const connect = (id, field, reference) => {
    const item = definitions.get(id);
    if (!item) throw new Error(`Unknown resource ${id}`);
    item.context[field] ??= [];
    if (!item.context[field].includes(reference)) item.context[field].push(reference);
  };

  const newJobs = [
    { id: "baker", title: "Independent baker", minAge: 14, requirements: { reckoning: 10 },
      description: "Buy flour and fuel to fulfil bread orders. Each annual batch consumes supplies and creates bread orders for sale through the market.",
      yearlyEffects: [skill("reckoning")], production: { inputs: { flour: 2, fuel: 1 }, outputs: { bread: 4 }, baseBatches: 2, skill: "reckoning", skillPerBatch: 20, maxBatches: 8 } },
    { id: "fisher", title: "Independent fisher", minAge: 14, requirements: { seamanship: 10 },
      description: "Buy replacement netting and salt for the fishing season. Annual batches use those supplies and create preserved catch for market sale.",
      yearlyEffects: [skill("seamanship")], production: { inputs: { netting: 1, salt: 1 }, outputs: { "preserved-fish": 2 }, baseBatches: 2, skill: "seamanship", skillPerBatch: 20, maxBatches: 8 } },
    { id: "household-worker", title: "Household worker", minAge: 14,
      description: "Earn wages through household service. Your employer supplies ordinary work; use your own cloths and oil for optional independent service orders.",
      yearlyEffects: [{ type: "cash", delta: 20 }, skill("reckoning")] },
  ];
  world.character.jobs.push(...newJobs);
  for (const job of newJobs) world.character.activities.push({
    id: `work-${job.id}`, text: `Become ${job.id === "baker" ? "an independent baker" : job.id === "fisher" ? "an independent fisher" : "a household worker"}`,
    category: "career", minAge: job.minAge, cooldownYears: 1,
    when: all({ type: "not", condition: { type: "job", job: job.id } }, ...Object.entries(job.requirements ?? {}).map(([skill, value]) => ({ type: "skill", skill, op: "gte", value }))),
    outcomes: [{ id: `work-${job.id}-accepted`, text: job.production ? "You choose this independent livelihood. Order the required supplies, then sell the completed goods through annual market contracts." : "You accept household service work. Wages cover ordinary service; independent orders use supplies that you purchase yourself.", weight: 1,
      effects: [{ type: "job", job: job.id }, { type: "flag", flag: "retired", value: false }] }],
  });

  const tasks = [
    { id: "prepare-workshop-firing", text: "Prepare a paid workshop firing", jobs: ["apprentice", "potter", "ceramic-decorator", "pottery-workshop-lead"], origins: ["artisan-household"], inputs: { fuel: 1 }, payment: 12, gains: [skill("craft")], result: "You use one fuel bundle to prepare the kiln and receive 12 drachmas for the completed preparation." },
    { id: "secure-cargo-load", text: "Secure an independent cargo load", jobs: ["porter", "sailor"], origins: ["harbor-household", "delta-newcomers"], inputs: { rope: 1, "transport-baskets": 1 }, payment: 24, gains: [skill("seamanship")], result: "You use rope and deliver a transport basket with the prepared load. The customer pays 24 drachmas." },
    { id: "repair-ship-rigging", text: "Take an independent rigging repair", jobs: ["sailor", "boatbuilder"], origins: ["boatbuilder-household"], inputs: { sailcloth: 1, rope: 1, pitch: 1 }, payment: 32, gains: [skill("craft"), skill("seamanship")], result: "You replace worn cloth and rope, use the sealing material and receive 32 drachmas for the finished repair." },
    { id: "repair-service-equipment", text: "Repair a set of service equipment", jobs: ["soldier", "officer", "general"], origins: ["soldier-household"], inputs: { leather: 1, "bronze-fittings": 1 }, payment: 26, gains: [skill("warfare")], result: "Replacement leather and fittings are used in the repair. You receive 26 drachmas for the completed equipment." },
    { id: "prepare-teaching-notes", text: "Prepare a paid set of lesson notes", jobs: ["clerk", "philosophy-tutor", "astrologer", "court-adviser", "patron-supported-reader", "sky-table-calculator"], origins: ["clerk-household", "royal-household"], inputs: { papyrus: 1, ink: 1 }, equipment: { "wax-tablets": 1 }, payment: 24, gains: [skill("literacy"), { type: "stat", stat: "knowledge", delta: 1 }], result: "You draft on your reusable tablet, then use papyrus and ink for the final notes. The customer pays 24 drachmas; you keep the tablet." },
    { id: "prepare-temple-gathering", text: "Prepare supplies for a temple gathering", jobs: [], origins: ["temple-household"], inputs: { incense: 1, oil: 1 }, payment: 20, gains: [{ type: "stat", stat: "bonds", delta: 1 }], result: "You use the incense and oil to fulfil the preparation order, and receive 20 drachmas for the supplies and work." },
    { id: "complete-household-service-order", text: "Complete an independent household service order", jobs: ["household-worker"], origins: ["domestic-service-household"], inputs: { "cleaning-cloths": 1, oil: 1 }, payment: 22, gains: [skill("reckoning")], result: "You use your cloths and oil to complete the agreed household work. The customer pays 22 drachmas." },
    { id: "perform-independent-engagement", text: "Play an independent musical engagement", jobs: ["performer"], origins: ["musician-household"], inputs: { "musical-reeds": 1, "instrument-strings": 1 }, equipment: { "musical-instrument": 1 }, payment: 24, gains: [skill("music"), { type: "stat", stat: "bonds", delta: 1 }], result: "You replace the reeds and strings used for the engagement and receive 24 drachmas. You keep your instrument for later performances." },
    { id: "fulfil-shop-parcel", text: "Fulfil a small shop parcel", jobs: ["shopkeeper", "trader"], origins: ["merchant-household"], inputs: { oil: 1, "preserved-fish": 1, "transport-baskets": 1 }, payment: 36, gains: [skill("reckoning")], result: "You pack oil and preserved fish from your own stock into a transport basket. The customer keeps the basket with the delivery and pays 36 drachmas for the parcel." },
    { id: "check-estate-supply-order", text: "Check and deliver an estate supply order", jobs: ["officer", "general", "court-adviser"], origins: ["estate-household", "tenant-farming-household"], inputs: { "transport-baskets": 1 }, equipment: { "wax-tablets": 1 }, payment: 18, gains: [skill("reckoning")], result: "You check the supply list on your reusable tablet and deliver a transport basket with the order. The completed task pays 18 drachmas." },
  ];
  for (const task of tasks) {
    const roles = [...task.jobs.map(job => ({ type: "job", job })),
      ...task.origins.map(origin => all({ type: "job", job: null }, { type: "origin", origin }))];
    world.character.activities.push({ id: task.id, text: task.text, category: "career", minAge: 14, cooldownYears: 1,
      when: all(any(...roles), ...Object.entries({ ...task.inputs, ...task.equipment }).map(([id, count]) => stock(id, count))),
      outcomes: [{ id: `${task.id}-completed`, text: task.result, weight: 1, effects: [...Object.entries(task.inputs).map(([id, count]) => asset(id, -count)), { type: "cash", delta: task.payment }, ...task.gains] }],
    });
    for (const id of Object.keys({ ...task.inputs, ...task.equipment })) connect(id, "activities", task.id);
  }

  for (const [job, ids] of Object.entries(jobResources)) for (const id of ids) connect(id, "jobs", job);
  for (const job of world.character.jobs) for (const id of Object.keys({ ...job.production?.inputs, ...job.production?.outputs })) connect(id, "jobs", job.id);
  for (const [originId, stocks] of Object.entries(originResources)) {
    const origin = world.origins.find(item => item.id === originId);
    if (!origin) throw new Error(`Unknown origin ${originId}`);
    for (const [id, max] of Object.entries(stocks)) {
      connect(id, "origins", originId);
      origin.assetRanges[id] = { min: 0, max };
    }
    const familyEvent = world.events.find(event => event.id === `background-${originId}-adult-livelihood`);
    const familyChoice = familyEvent.choices.find(item => item.id === `${originId}-adult-family-work`);
    const outcome = familyChoice.outcomes[0];
    outcome.effects = outcome.effects.filter(effect => effect.type !== "asset" && !(effect.type === "stat" && effect.stat === "wealth"));
    outcome.effects.push(...Object.keys(stocks).slice(0, 2).map(id => asset(id, 1)));
    outcome.text = "You help with the family's work, learn from your relatives and accept a few supplies for your own use. Your occupation remains your choice.";
  }
  const familySupplyText = {
    "bakery-household": ["Your relatives offer flour and fuel, and time planning a small bread order. You can use the supplies in your own work or continue your present plans.", "Plan a bread order with the family"],
    "temple-household": ["Your relatives are preparing a temple gathering. They offer oil and incense, and show you how to check the supplies. You can take up a preparation order or keep your own plans.", "Help prepare the gathering supplies"],
    "domestic-service-household": ["Your relatives offer cleaning cloths and oil, and an introduction to a household that sometimes places service orders. You can accept their help or continue your present work.", "Learn the household service routine"],
  };
  for (const [originId, [text, action]] of Object.entries(familySupplyText)) {
    const event = world.events.find(event => event.id === `background-${originId}-adult-livelihood`);
    event.text = text;
    event.choices.find(item => item.id === `${originId}-adult-family-work`).text = action;
  }
  const familyJobChoices = { "bakery-household": "baker", "fishing-household": "fisher", "domestic-service-household": "household-worker" };
  for (const [originId, jobId] of Object.entries(familyJobChoices)) {
    const event = world.events.find(event => event.id === `background-${originId}-adult-livelihood`);
    const job = newJobs.find(item => item.id === jobId);
    const materials = job.production?.inputs ?? { "cleaning-cloths": 1, oil: 1 };
    event.choices.splice(event.choices.length - 1, 0, { id: `${originId}-choose-${jobId}`, text: `Choose work as ${job.title.toLowerCase()}`,
      ...(job.requirements ? { when: all(...Object.entries(job.requirements).map(([skill, value]) => ({ type: "skill", skill, op: "gte", value }))) } : {}),
      outcomes: [{ id: `${originId}-choose-${jobId}-result`, text: "You choose this livelihood for yourself. Your relatives give you supplies for a first order; later work needs stock that you buy through the market.", weight: 1,
        effects: [{ type: "job", job: jobId }, ...Object.entries(materials).map(([id, count]) => asset(id, count * 2))] }],
    });
  }

  const extendShock = (eventId, changes) => Object.assign(market.shocks.find(shock => shock.eventId === eventId).priceMultipliers, changes);
  extendShock("market-poor-harvest", { flour: 1.5, bread: 1.25 });
  extendShock("market-abundant-harvest", { flour: 0.75, bread: 0.75 });
  extendShock("market-delayed-ships", { salt: 1.5, rope: 1.25, sailcloth: 1.25, pitch: 1.25, oil: 1.25 });
  extendShock("market-workshop-orders", { "bronze-fittings": 1.25, "musical-instrument": 1.25 });
  for (const item of definitions.values()) if (!Object.keys(item.context).length) delete item.context;
  world.economy.description += " Resources cover the household trades, service orders and independent livelihoods. Salaried employers provide ordinary work supplies; optional independent orders consume your own stock. Bread units represent fulfilment orders rather than fresh loaves stored between years.";
}
