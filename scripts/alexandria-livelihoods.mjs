// Livelihoods and prices below are authored game balance. They describe fictional
// households and market conditions, not reconstructed ancient prices or output.
const all = (...conditions) => ({ type: "all", conditions });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const asset = (asset, delta) => ({ type: "asset", asset, delta });
const trained = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const choice = (id, text, outcome, effects = []) => ({ id, text, outcomes: [{ id: `${id}-result`, text: outcome, weight: 1, effects }] });

const goods = [
  ["flax-thread", "Flax thread", 4, "Thread for weaving linen."],
  ["linen-cloth", "Linen cloth", 16, "Finished cloth ready for a market sale."],
  ["papyrus", "Papyrus sheets", 4, "Writing sheets consumed by copying and writing work."],
  ["ink", "Ink", 2, "Ink consumed with papyrus in written work."],
  ["written-copies", "Written copies", 15, "Completed written work ready for sale."],
  ["clay", "Clay", 3, "Prepared clay for pottery production."],
  ["pottery-goods", "Finished pottery", 14, "Finished vessels ready for sale."],
  ["timber", "Timber", 6, "Wood for carved goods and boat fittings."],
  ["wooden-goods", "Wooden goods", 19, "Finished carved fittings ready for sale."],
  ["stone", "Stone", 8, "Stone blanks for carved figures and reliefs."],
  ["carved-stone", "Carved stonework", 24, "Completed figures and reliefs ready for sale."],
  ["seed-grain", "Seed grain", 2, "Seed for a voluntarily chosen farming livelihood."],
  ["grain", "Grain", 6, "Harvested grain that can be sold at the market."],
  ["boat-fittings", "Boat fittings", 22, "Finished timber fittings for working boats."],
];

const familyRoutes = {
  "merchant-household": ["An introduction at the market", "A relative offers to show you how to compare quantities and arrange deliveries for the shop.", "Check a delivery with the family", "reckoning", [asset("linen-cloth", 1)]],
  "artisan-household": ["A place beside the pottery bench", "A relative puts aside prepared clay and offers to help you plan a small independent batch.", "Prepare your own pottery batch", "pottery", [asset("clay", 3)]],
  "harbor-household": ["The quay crew remembers your family", "Your relatives introduce you to a crew checking a timber delivery. You can practise the tally or make other plans.", "Check the crew's tally", "seamanship", [stat("wealth", 1)]],
  "fishing-household": ["A morning with the family nets", "Your relatives invite you to check repaired nets and help count the catch before the buyers arrive.", "Help with the catch and its account", "seamanship", [stat("wealth", 1)]],
  "bakery-household": ["The bakery's next order", "Your family needs someone to count supplies and check the morning orders. They offer you a paid task.", "Check the bakery orders", "reckoning", [stat("wealth", 1)]],
  "clerk-household": ["Sheets set aside for you", "A relative offers a few writing materials and time checking your first independent copies.", "Prepare an independent copy", "literacy", [asset("papyrus", 2), asset("ink", 2)]],
  "weaver-household": ["Thread for your own work", "Your relatives offer thread and advice on planning a batch of cloth. Taking up weaving remains your choice.", "Plan a batch with the family", "craft", [asset("flax-thread", 3)]],
  "delta-newcomers": ["A useful introduction from home", "A visiting relative knows a household looking for someone to check a coastal delivery.", "Take the introduction and check the load", "reckoning", [stat("wealth", 1)]],
  "royal-household": ["A smaller household account", "A relative asks you to compare the estate's recorded supplies with what remains in storage. Family connections offer a task rather than a promised career.", "Help check the household account", "literacy", [stat("wealth", 1)]],
  "estate-household": ["A choice about the family fields", "Your relatives offer seed for a small crop, or time learning how to check the estate accounts. You can pursue another livelihood.", "Learn the estate accounts", "reckoning", [stat("knowledge", 1)]],
  "temple-household": ["The household's supply record", "Your family offers writing materials and supervision for a short supply record. You can keep your own plans.", "Copy the supply record", "literacy", [asset("papyrus", 2), asset("ink", 2)]],
  "soldier-household": ["Equipment ready for inspection", "A relative asks for help inspecting worn straps and counting the pieces that need repair.", "Inspect the household equipment", "warfare", [stat("wealth", 1)]],
  "tenant-farming-household": ["The fields or a different livelihood", "Your relatives can help you begin a small crop with seed, or teach you to check the produce accounts. The family fields do not decide your occupation.", "Learn to check produce accounts", "reckoning", [stat("knowledge", 1)]],
  "domestic-service-household": ["A recommendation from the household", "Your relatives know a household offering a paid task checking supplies. You can accept the introduction or continue your own work.", "Check the household supplies", "reckoning", [stat("wealth", 1)]],
  "boatbuilder-household": ["Timber in the family workyard", "Your relatives put aside timber and offer advice on cutting fittings for a small working boat.", "Plan fittings with the family", "craft", [asset("timber", 3)]],
  "musician-household": ["An invitation through the family", "A relative invites you to rehearse a short part for a gathering. You can join the practice without making performance your occupation.", "Rehearse with your relatives", "music", [stat("bonds", 1)]],
};

export function applyLivelihoods(world) {
  world.version = "0.38.0";
  world.economy.assets.push(...goods.map(([id, title, value, description]) => ({ id, title, value, description, initialRange: { min: 0, max: 0 } })));

  const newJobs = [
    { id: "farmer", title: "Independent farmer", minAge: 14, description: "Choose to cultivate a small crop. Buy seed grain, harvest at the year end, and sell your grain through the market. Farming is optional for every background.", yearlyEffects: [skill("reckoning", 1)] },
    { id: "weaver", title: "Independent weaver", minAge: 14, requirements: { craft: 15 }, description: "Buy flax thread to weave cloth. More stocked thread and better tool handling support larger batches; sell the finished cloth through the market.", yearlyEffects: [skill("craft", 1)] },
    { id: "writer", title: "Independent writer", minAge: 16, requirements: { literacy: 30 }, description: "Buy papyrus and ink for written work. Completed copies become stock for sale rather than an automatic cash wage.", yearlyEffects: [skill("literacy", 1), stat("knowledge", 1)] },
    { id: "boatbuilder", title: "Boat-fittings maker", minAge: 16, requirements: { craft: 20, seamanship: 10 }, description: "Buy timber and make fittings for working boats. Stock and practical skill limit annual output; finished fittings must be sold.", yearlyEffects: [skill("craft", 1), skill("seamanship", 1)] },
    { id: "trader", title: "Market trader", minAge: 18, requirements: { reckoning: 10 }, description: "Earn from buying and selling goods through annual contracts. Trading has no guaranteed salary: stock, prices and completed sales determine your return.", yearlyEffects: [skill("reckoning", 1)] },
  ];
  world.character.jobs.push(...newJobs);
  for (const job of newJobs.filter(job => job.id !== "trader")) {
    world.character.activities.push({ ...choice(`work-${job.id}`, `Become ${job.id === "farmer" ? "an independent farmer" : `a ${job.title.toLowerCase()}`}`,
      `You choose work as ${job.title.toLowerCase()}. Buy the required materials through the market before the next annual settlement. Finished goods must be sold to earn cash.`, [{ type: "job", job: job.id }, { type: "flag", flag: "retired", value: false }]),
      category: "career", minAge: job.minAge, cooldownYears: 1,
      when: all({ type: "not", condition: { type: "job", job: job.id } }, ...Object.entries(job.requirements ?? {}).map(([id, value]) => trained(id, value))) });
  }
  world.character.activities.push({ ...choice("focus-market-trading", "Spend the year arranging market trade",
    "You compare quantities and prices, arrange deliveries and keep the trade accounts. Only completed market contracts create trading experience; this focus pays no wage.", [skill("reckoning", 2)]),
    category: "career", minAge: 14, cooldownYears: 1 });
  world.flags["trader-qualified"] = { label: "Experienced enough to make market trading a livelihood", initial: false };
  world.character.activities.push({ ...choice("work-trader", "Make market trading your occupation",
    "You make market trading your regular livelihood. You leave your former occupation and rely on completed sales for income; there is no trader's salary.", [{ type: "job", job: "trader" }, { type: "flag", flag: "retired", value: false }]),
    category: "career", minAge: 18, cooldownYears: 1,
    when: all({ type: "flag", flag: "trader-qualified", value: true }, trained("reckoning", 10), { type: "not", condition: { type: "job", job: "trader" } }) });
  world.events.push({ id: "market-trader-opening", title: "Known for your market trade", text: "Several years arranging deliveries and completing trades have made buyers and sellers familiar with your work. You can make trading your occupation, or keep your present livelihood.",
    trigger: { type: "random", weight: 3 }, when: all({ type: "flag", flag: "trader-qualified", value: true }, { type: "age", op: "gte", value: 18 }, trained("reckoning", 10), { type: "not", condition: { type: "job", job: "trader" } }),
    choices: [choice("accept-market-trader-opening", "Make trading your occupation", "You choose market trading as your livelihood. Your income now comes from completed sales, with no guaranteed salary.", [{ type: "job", job: "trader" }, { type: "flag", flag: "retired", value: false }]), choice("keep-current-livelihood", "Keep your current livelihood", "You keep your present work. You can still choose trading later through the occupation controls.")], evidence: "fictional", sourceIds: [] });

  const recipes = {
    farmer: [{ "seed-grain": 1 }, { grain: 3 }, "reckoning"],
    weaver: [{ "flax-thread": 2 }, { "linen-cloth": 1 }, "craft"],
    writer: [{ papyrus: 1, ink: 1 }, { "written-copies": 1 }, "literacy"],
    copyist: [{ papyrus: 1, ink: 1 }, { "written-copies": 1 }, "literacy"],
    "sky-table-calculator": [{ papyrus: 1, ink: 1 }, { "written-copies": 1 }, "astronomy"],
    potter: [{ clay: 2 }, { "pottery-goods": 1 }, "pottery"],
    "ceramic-decorator": [{ clay: 2 }, { "pottery-goods": 1 }, "pottery"],
    "pottery-workshop-lead": [{ clay: 2 }, { "pottery-goods": 1 }, "pottery"],
    "wood-carver": [{ timber: 1 }, { "wooden-goods": 1 }, "carving"],
    "carving-workshop-lead": [{ timber: 1 }, { "wooden-goods": 1 }, "carving"],
    sculptor: [{ stone: 1 }, { "carved-stone": 1 }, "sculpture"],
    "sculpture-workshop-lead": [{ stone: 1 }, { "carved-stone": 1 }, "sculpture"],
    boatbuilder: [{ timber: 2 }, { "boat-fittings": 1 }, "craft"],
  };
  for (const job of world.character.jobs) {
    if (!recipes[job.id]) continue;
    const [inputs, outputs, skill] = recipes[job.id];
    job.production = { inputs, outputs, baseBatches: job.id.endsWith("-lead") ? 4 : 2, skill, skillPerBatch: 20, maxBatches: job.id.endsWith("-lead") ? 12 : 8 };
    job.yearlyEffects = job.yearlyEffects.filter(effect => effect.type !== "cash" && !(effect.type === "stat" && effect.stat === "wealth"));
    if (!newJobs.includes(job)) job.description += " Buy materials through the market; annual production consumes stock and creates finished goods. Sell those goods to receive cash.";
    const entry = world.character.activities.find(activity => activity.id === `work-${job.id}`);
    if (entry) for (const outcome of entry.outcomes) {
      // Choosing a trade does not buy invisible supplies. All production inputs
      // are visible stock ordered separately through the market.
      outcome.effects = outcome.effects.filter(effect => !(effect.type === "stat" && effect.stat === "wealth" && effect.delta < 0));
      outcome.text = `You choose work as ${job.title.toLowerCase()}. Order the required materials through the market. Annual production uses your stock; sell the finished goods to receive cash.`;
    }
  }

  // Extra commissions also consume visible inputs. Training fees still include
  // supervised practice materials and do not produce saleable stock.
  const commissions = { "careful-copy": { papyrus: 1, ink: 1 }, "pottery-order": { clay: 3 }, "decorate-pottery-order": { clay: 3 }, "carve-door-fitting": { timber: 2 }, "sculpt-small-figure": { stone: 2 } };
  for (const [id, inputs] of Object.entries(commissions)) {
    const activity = world.character.activities.find(candidate => candidate.id === id);
    if (!activity) continue;
    activity.when = all(...(activity.when ? [activity.when] : []), ...Object.entries(inputs).map(([asset, value]) => ({ type: "asset", asset, op: "gte", value })));
    for (const outcome of activity.outcomes) {
      outcome.effects.unshift(...Object.entries(inputs).map(([id, count]) => asset(id, -count)));
      outcome.text += " The materials used are removed from your stock.";
    }
  }

  for (const origin of world.origins) {
    const route = familyRoutes[origin.id];
    if (!route) throw new Error(`Missing livelihood route for ${origin.id}`);
    const [title, text, action, skillId, reward] = route;
    const choices = [choice(`${origin.id}-adult-family-work`, action, "You spend time with your relatives, learn from their work and take the supplies or payment they offered.", [skill(skillId, 3), ...reward])];
    if (["tenant-farming-household", "estate-household"].includes(origin.id)) choices.push(choice(`${origin.id}-choose-farming`, "Choose farming and accept seed for a first crop", "You choose farming for yourself. Your relatives give you seed for the first crop. Later crops need purchased seed, and harvests must be sold through the market.", [{ type: "job", job: "farmer" }, asset("seed-grain", 3)]));
    choices.push(choice(`${origin.id}-adult-independent-path`, "Continue with your own plans", "Your relatives arrange other help. You keep your current work and plans, then visit the household later.", [stat("bonds", 1)]));
    world.events.push({ id: `background-${origin.id}-adult-livelihood`, title, text, trigger: { type: "age", at: 18 }, when: { type: "origin", origin: origin.id }, choices, evidence: "fictional", sourceIds: [] });
  }
  const startingInputs = { "artisan-household": { clay: 3 }, "weaver-household": { "flax-thread": 3 }, "clerk-household": { papyrus: 2, ink: 2 }, "temple-household": { papyrus: 1, ink: 1 }, "boatbuilder-household": { timber: 2 }, "merchant-household": { "linen-cloth": 1 } };
  for (const origin of world.origins) for (const [id, max] of Object.entries(startingInputs[origin.id] ?? {})) origin.assetRanges[id] = { min: 0, max };

  const reports = [
    ["market-poor-harvest", "Less grain reaches the market", "Traders report that a poor harvest has reduced the grain reaching the coast. Grain and seed offers rise while buyers seek alternative supplies.", { grain: 1.5, "seed-grain": 1.5 }],
    ["market-abundant-harvest", "Grain stores fill", "More grain arrives from the countryside. Sellers lower their offers as stores fill and buyers have more choice.", { grain: 0.75, "seed-grain": 0.75 }],
    ["market-delayed-ships", "Supply boats arrive late", "Several supply boats arrive late. Market sellers ask more for timber, papyrus and thread while those deliveries are missing.", { timber: 1.5, papyrus: 1.5, "flax-thread": 1.25 }],
    ["market-workshop-orders", "Buyers seek workshop goods", "Buyers place more orders with local workshops. Offers for finished cloth, pottery and carved goods rise.", { "linen-cloth": 1.25, "pottery-goods": 1.25, "wooden-goods": 1.25, "carved-stone": 1.25, "written-copies": 1.25 }],
  ];
  for (const [id, title, text] of reports) world.events.push({ id, title, text, trigger: { type: "random", weight: 1 }, when: { type: "age", op: "gte", value: 14 }, mode: "automatic", effects: [], choices: [], maxOccurrences: 12, cooldownYears: 6, evidence: "fictional", sourceIds: [] });
  world.events.push({ id: "farmer-checks-seed", title: "Seed set aside for the next crop", text: "You check the seed remaining after the last crop. Your next harvest depends on having seed in stock; you can order it at the market or choose another livelihood.", trigger: { type: "random", weight: 1 }, when: { type: "job", job: "farmer" }, mode: "automatic", effects: [skill("reckoning", 1)], choices: [], maxOccurrences: 12, cooldownYears: 5, evidence: "fictional", sourceIds: [] });
  world.economy.market = {
    minAge: 14, feePercent: 5, maxQuantity: 10000, maxOrders: 32,
    traderJob: "trader", traderYears: 3, traderFocusActivity: "focus-market-trading", goods: [...goods.map(([id]) => id), "tool-chest", "workshop-share"],
    shocks: [
      ...reports.map(([eventId, title, , priceMultipliers]) => ({ eventId, title, durationYears: 3, priceMultipliers })),
      { eventId: "classical-alexandria-founded", title: "Work begins on the new city", durationYears: 5, priceMultipliers: { timber: 1.25, stone: 1.25, "boat-fittings": 1.25 } },
      { eventId: "classical-scholarly-households", title: "More patrons support written work", durationYears: 5, priceMultipliers: { papyrus: 1.25, "written-copies": 1.5 } },
    ],
  };
  world.character.activities = world.character.activities.filter(activity => !world.economy.market.goods.some(id => activity.id === `buy-${id}` || activity.id === `sell-${id}`));
  world.economy.assets.find(asset => asset.id === "tool-chest").description = "Unlocks hinge, strap and fitting repairs at Tool handling 15. Buy or sell through an annual market contract.";
  world.economy.assets.find(asset => asset.id === "workshop-share").description = "Earn 10 drachmas each surviving year. Buy or sell through an annual market contract.";
  world.economy.description += " Annual market contracts lock the displayed unit price when ordered and conclude at the next year end. Production consumes purchased materials and creates saleable goods. Market offers respond to recorded game events; all prices, outputs and effects are authored game balance.";
}
