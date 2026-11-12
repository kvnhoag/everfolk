const wholeResource = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

/** Pure reward rules for deep-1. Quotes reserve no stock, pay no money and consume no action. */
export function capabilityRewards(learned: Iterable<string>) {
  const nodes = new Set(learned), has = (id: string) => nodes.has(id);
  const highest = (prefix: string, start = 5) => { for (let n = 10; n >= start; n--) if (has(`${prefix}${n}`)) return n; return 0; };
  const clothingDepth = highest("AT"), ceramicDepth = highest("AC"), sculptureDepth = highest("AS");
  const independent = has("A4"), starters = has("A3");
  const quality = (depth: number) => depth >= 10 ? 5 : depth >= 9 ? 4 : depth >= 6 ? 3 : depth >= 5 ? 2 : starters ? 1 : 0;
  const eligibleCareers = [
    ...(has("FC10") ? ["master-cultivator"] : []), ...(has("FR10") ? ["master-household-farmer"] : []),
    ...(has("AT10") ? ["master-tailor"] : []), ...(has("AC10") ? ["master-potter"] : []), ...(has("AS10") ? ["master-sculptor"] : []),
    ...(has("P4") ? ["philosophy-tutor"] : []), ...(has("PS10") ? ["scientist"] : []), ...(has("PP10") ? ["politician"] : []),
    ...(has("T10") ? ["merchant", "trading-house-manager"] : []),
  ];
  return {
    learned: [...nodes],
    farm: {
      ordinaryCultivation: has("F1"), seedReserve: has("F2"), soilPreparation: has("F3S"), maintainedChannels: has("F3W"),
      productionPreview: has("F4"), denseSowing: has("FC5"), cropCare: has("FC6"), mixedCrop: has("FC8"),
      conservativeSowing: has("FC9"), integratedPlan: has("FC10"), maintenancePerPlot: 8,
      maintainedLowFloodBps: has("FC7") ? 6000 : has("F3W") ? 5500 : 4500,
      spoilageReductionBps: has("FR10") ? 3500 : has("FR9") ? 3000 : has("FR8") ? 2500 : has("FR5") ? 1500 : 0,
      protectedReserve: has("FR6"), autoSurplus: has("FR8"), contingencyPurchase: has("FR9"), twoYearReserve: has("FR10"),
      storeExtension: has("FR7") ? { capacity: 500, fee: 80, inputs: { timber: 4, clay: 5 }, workYears: 1, upkeep: 4, householdLimit: 1 } : null,
    },
    artisan: {
      hiredPractice: has("A1"), introductoryFee: 2, measuredEstimates: has("A2"), supervisedStarters: starters,
      independentProduction: independent, inspection: independent,
      clothing: { qualityCap: quality(clothingDepth), batchCap: clothingDepth >= 10 ? 12 : clothingDepth >= 9 ? 10 : clothingDepth >= 8 ? 8 : clothingDepth >= 7 ? 6 : clothingDepth >= 5 ? 4 : independent ? 2 : starters ? 1 : 0,
        dyed: has("AT6"), ceremonial: has("AT9"), clothFactorBps: has("AT8") ? 8750 : 10000, commissions: has("AT7"), repairs: has("AT10") },
      ceramics: { qualityCap: quality(ceramicDepth), batchCap: ceramicDepth >= 10 ? 16 : ceramicDepth >= 9 ? 14 : ceramicDepth >= 8 ? 12 : ceramicDepth >= 7 ? 10 : ceramicDepth >= 6 ? 8 : ceramicDepth >= 5 ? 6 : independent ? 4 : starters ? 1 : 0,
        controlledFiring: has("AC6"), decorated: has("AC7"), efficientKiln: has("AC8"), matchedSets: has("AC9"), largeCommissions: has("AC10") },
      sculpture: { qualityCap: sculptureDepth >= 10 ? 5 : sculptureDepth >= 9 ? 4 : sculptureDepth >= 7 ? 3 : sculptureDepth >= 5 ? 2 : starters ? 1 : 0,
        smallBatchCap: independent || sculptureDepth >= 5 ? 2 : starters ? 1 : 0, relief: has("AS5"), stone: has("AS6"), bust: has("AS7"), largeRelief: has("AS8"), monumental: has("AS9"), restoration: has("AS10") },
    },
    philosophy: { guidedPractice: has("P1"), debate: has("P2"), evidenceComparison: has("P3"), specializations: has("P4"), researchDepth: highest("PS"), civicDepth: highest("PP") },
    trade: { ledger: has("T1"), costBasis: has("T2"), targetPrices: has("T3"), stockTargets: has("T4"), productionPlans: has("T5"), counteroffers: has("T6"), scheduledDelivery: has("T7"), repeatPlans: has("T8"), supplyContracts: has("T9"), integratedPlans: has("T10") },
    eligibleCareers,
  };
}
export type CapabilityRewards = ReturnType<typeof capabilityRewards>;
export interface ProductionRecipe { inputs: Record<string, number>; output: string; outputQuantity: number; fee: number; workYears: number; baseAsk: number }
export interface ProductionOptions { quantity?: number; recipeId?: string; inspected?: boolean; controlledFiring?: boolean }
export interface ProductionQuote { allowed: boolean; reason?: string; quantity: number; inputs: Record<string, number>; fee: number; workYears: number; qualityCap: number; batchCap: number; qualityBonus: number; supervised: boolean; baseAsk: number; annualActions: 1 }

/** quantity means output units, not batches; e.g. the thread recipe produces multiples of four. */
export function quoteCapabilityProduction(profile: CapabilityRewards, recipe: ProductionRecipe, options: ProductionOptions = {}): ProductionQuote {
  const id = options.recipeId ?? (recipe.output === "relief" ? "small-relief" : recipe.output);
  const quantity = options.quantity ?? recipe.outputQuantity;
  const clothing = id.includes("garment"), ceramic = id.includes("vessel"), intermediate = id === "thread" || id === "linen";
  const shape = clothing ? profile.artisan.clothing : ceramic ? profile.artisan.ceramics : profile.artisan.sculpture;
  const supervised = !profile.artisan.independentProduction && ["garment", "vessel", "clay-model"].includes(id);
  const batchCap = intermediate ? 10 : clothing || ceramic ? (shape as typeof profile.artisan.clothing).batchCap : ["bust", "large-relief", "monument"].includes(id) ? 1 : profile.artisan.sculpture.smallBatchCap;
  const quote: ProductionQuote = { allowed: true, quantity, inputs: {}, fee: recipe.fee, workYears: recipe.workYears, qualityCap: intermediate ? 1 : shape.qualityCap, batchCap, qualityBonus: 0, supervised, baseAsk: recipe.baseAsk, annualActions: 1 };
  const reject = (reason: string) => ({ ...quote, allowed: false, reason });
  if (![recipe.fee, recipe.baseAsk, ...Object.values(recipe.inputs)].every(wholeResource) || !Number.isSafeInteger(recipe.workYears) || recipe.workYears < 1) return reject("Recipes require finite whole materials, fees and work years.");
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(recipe.outputQuantity) || recipe.outputQuantity <= 0 || quantity % recipe.outputQuantity !== 0) return reject("Choose a positive whole number of complete recipe outputs.");
  if (!profile.artisan.supervisedStarters) return reject("Learn material preparation before using production templates.");
  if (quantity > batchCap) return reject(`The learned batch limit is ${batchCap} output units.`);
  if (id === "dyed-garment" && !profile.artisan.clothing.dyed) return reject("Learn patterns and dyes first.");
  if (id === "ceremonial-garment" && !profile.artisan.clothing.ceremonial) return reject("Learn fine finishing first.");
  if (id === "decorated-vessel" && !profile.artisan.ceramics.decorated) return reject("Learn form and decoration first.");
  const sculptureGate: Record<string, boolean> = { "small-relief": profile.artisan.sculpture.relief, "stone-figure": profile.artisan.sculpture.stone, bust: profile.artisan.sculpture.bust, "large-relief": profile.artisan.sculpture.largeRelief, monument: profile.artisan.sculpture.monumental };
  if (id in sculptureGate && !sculptureGate[id]) return reject("Learn the capability for this sculpture project first.");
  if (options.inspected && !profile.artisan.inspection) return reject("Independent production unlocks paid inspection.");
  if (options.controlledFiring && (!ceramic || !profile.artisan.ceramics.controlledFiring)) return reject("Controlled firing is not available for this work.");
  const batches = quantity / recipe.outputQuantity;
  quote.inputs = Object.fromEntries(Object.entries(recipe.inputs).map(([item, units]) => [item, Math.ceil(units * batches)]));
  if (clothing && quantity >= 4 && profile.artisan.clothing.clothFactorBps < 10000) {
    for (const item of ["linen", "cloth"]) if (quote.inputs[item]) quote.inputs[item] = Math.ceil(quote.inputs[item] * 7 / 8);
  }
  if (ceramic && profile.artisan.ceramics.efficientKiln) quote.inputs.fuel = Math.ceil(quantity / 2);
  if (id === "decorated-vessel") quote.inputs.pigment = Math.ceil(quantity / 4);
  if (id === "dyed-garment") { quote.inputs.pigment = quantity; quote.qualityBonus += 1; quote.baseAsk = 130; }
  if (options.controlledFiring) { quote.inputs.fuel = (quote.inputs.fuel ?? 0) + Math.ceil(quantity / 4); quote.qualityBonus += 1; }
  if (options.inspected) { quote.fee += 3; quote.qualityBonus += 1; }
  if (supervised) { quote.fee += 2; quote.qualityCap = 1; }
  if (![quote.fee, ...Object.values(quote.inputs)].every(wholeResource)) return reject("The production quote exceeds bounded whole resources.");
  return quote;
}

export interface FarmPlanOptions { flood: "low" | "normal" | "high"; crop: "grain" | "flax"; plots: number; mode?: "none" | "fieldwork" | "soil-preparation" | "crop-care" | "channel-maintenance" | "integrated"; sowing?: "ordinary" | "dense" | "conservative"; baseFloodBps: number }
/** Sowing methods are exclusive; active work bonuses are annual, never permanent. */
export function quoteFarmCapabilityPlan(profile: CapabilityRewards, options: FarmPlanOptions) {
  const { farm } = profile, mode = options.mode ?? "none", sowing = options.sowing ?? "ordinary";
  const quote = { allowed: true, reason: undefined as string | undefined, grainSeed: options.crop === "grain" ? options.plots * (sowing === "dense" ? 20 : 10) : 0, flaxSeed: options.crop === "flax" ? options.plots * 2 : 0, fee: 0, annualActions: mode === "none" ? 0 : 1, floodFactorBps: options.baseFloodBps, bonusBps: 0 };
  const reject = (reason: string) => ({ ...quote, allowed: false, reason });
  if (!wholeResource(options.plots) || !wholeResource(options.baseFloodBps) || ![quote.grainSeed, quote.flaxSeed, options.plots * farm.maintenancePerPlot].every(wholeResource)) return reject("Plots, seed, fees and flood factors must be bounded nonnegative whole numbers.");
  // Unbonused supervised/hired fieldwork is the entry proof for F1, so it is available before learning F1.
  if (mode === "soil-preparation" && !farm.soilPreparation) return reject("Learn soil knowledge first.");
  if (mode === "crop-care" && !farm.cropCare) return reject("Learn crop care first.");
  if (mode === "channel-maintenance" && !farm.maintainedChannels) return reject("Learn water management first.");
  if (mode === "integrated" && !farm.integratedPlan) return reject("Learn integrated cultivation before combining annual work.");
  if (sowing === "dense" && !farm.denseSowing) return reject("Learn sowing methods first.");
  if (sowing === "conservative" && !farm.conservativeSowing) return reject("Learn yield reliability first.");
  if (mode === "soil-preparation") quote.bonusBps += 500;
  if (mode === "crop-care" || mode === "integrated") quote.bonusBps += 800;
  if (mode === "channel-maintenance" || mode === "integrated") {
    quote.fee += farm.maintenancePerPlot * options.plots;
    if (options.flood === "low") quote.floodFactorBps = Math.max(quote.floodFactorBps, farm.maintainedLowFloodBps);
  }
  if (sowing === "dense" && options.flood !== "low") quote.bonusBps += 600;
  if (sowing === "conservative") quote.bonusBps += options.flood === "low" ? 1500 : -500;
  if (options.crop === "flax" && farm.mixedCrop) quote.bonusBps += 500;
  quote.bonusBps = Math.min(2000, quote.bonusBps);
  return quote;
}

/** Only call for in-capacity grain; over-capacity spoilage is deliberately unaffected. */
export function capabilitySpoilageBps(profile: CapabilityRewards, configuredBaseBps: number, priorRateBps = configuredBaseBps): number {
  if (!Number.isFinite(configuredBaseBps) || !Number.isFinite(priorRateBps) || configuredBaseBps < 0 || priorRateBps < 0) throw new Error("Spoilage rates must be nonnegative finite values.");
  const base = Math.min(10000, configuredBaseBps), prior = Math.min(base, priorRateBps);
  return Math.max(Math.ceil(base / 4), Math.round(prior * (10000 - profile.farm.spoilageReductionBps) / 10000));
}

export const CAPABILITY_SERVICE_CONTRACTS = {
  "guided-study": { node: "P1", pay: 0, fee: 2, inputs: { papyrus: 1, ink: 1 }, workYears: 1, reputation: 0 },
  observation: { node: "PS5", pay: 20, fee: 0, inputs: { papyrus: 1, ink: 1 }, workYears: 1, reputation: 0 },
  survey: { node: "PS6", pay: 40, fee: 5, inputs: { papyrus: 2, ink: 1 }, workYears: 1, reputation: 0 },
  investigation: { node: "PS7", pay: 60, fee: 5, inputs: { papyrus: 2, ink: 2 }, workYears: 1, reputation: 0 },
  "reviewed-method": { node: "PS8", pay: 90, fee: 10, inputs: { papyrus: 2, ink: 2 }, workYears: 1, reputation: 0 },
  treatise: { node: "PS9", pay: 180, fee: 10, inputs: { papyrus: 4, ink: 3 }, workYears: 2, reputation: 0 },
  hearing: { node: "PP5", pay: 20, fee: 0, inputs: { papyrus: 1, ink: 1 }, workYears: 1, reputation: 2 },
  mediation: { node: "PP6", pay: 40, fee: 0, inputs: { papyrus: 1, ink: 1 }, workYears: 1, reputation: 3 },
  "public-accounts": { node: "PP7", pay: 60, fee: 0, inputs: { papyrus: 2, ink: 1 }, workYears: 1, reputation: 4 },
  coalition: { node: "PP8", pay: 90, fee: 0, inputs: { papyrus: 2, ink: 2 }, workYears: 1, reputation: 4 },
  policy: { node: "PP9", pay: 180, fee: 0, inputs: { papyrus: 4, ink: 3 }, workYears: 2, reputation: 5 },
} as const;
export type CapabilityServiceId = keyof typeof CAPABILITY_SERVICE_CONTRACTS;
export function quoteCapabilityService(profile: CapabilityRewards, id: CapabilityServiceId, resources: { cash: number; inventory: Record<string, number>; payerBudget: number }) {
  const contract = CAPABILITY_SERVICE_CONTRACTS[id];
  const validResources = [resources.cash, resources.payerBudget, ...Object.keys(contract.inputs).map(item => resources.inventory[item] ?? 0)].every(wholeResource);
  const reason = !validResources ? "Service resources must be finite nonnegative whole quantities." : !profile.learned.includes(contract.node) ? `Requires ${contract.node}.` : resources.cash < contract.fee ? "Insufficient cash for the quoted fees." : resources.payerBudget < contract.pay ? "The payer cannot reserve the quoted payment." : Object.entries(contract.inputs).some(([item, quantity]) => (resources.inventory[item] ?? 0) < quantity) ? "Supply the quoted materials first." : undefined;
  return { ...contract, inputs: { ...contract.inputs }, allowed: !reason, reason, reservePayment: contract.pay, paidOnCompletion: true, annualActions: contract.workYears };
}

export interface TradePlanOptions { side: "buy" | "sell"; quantity: number; referencePrice: number; counteroffer?: number; cash: number; stock: number; buyerBudget: number; maxQuantity: number; visitsRemaining: number; workAvailable: boolean; scheduled?: boolean; itemLines?: number; npcMinimumPrice?: number; npcMaximumPrice?: number }
/** Ordinary market access remains available before T1. Negotiation/delivery never bypass budgets or visits. */
export function quoteCapabilityTrade(profile: CapabilityRewards, options: TradePlanOptions) {
  const price = options.counteroffer ?? options.referencePrice, haulage = options.scheduled ? 12 : 0;
  const quote = { allowed: true, reason: undefined as string | undefined, quantity: options.quantity, price, haulage, cashCost: (options.side === "buy" ? price * options.quantity : 0) + haulage, visitsUsed: 1, annualActions: options.scheduled ? 1 : 0 };
  const reject = (reason: string) => ({ ...quote, allowed: false, reason });
  if (![options.quantity, options.referencePrice, price, options.cash, options.stock, options.buyerBudget, options.maxQuantity].every(Number.isSafeInteger) || options.quantity <= 0 || options.referencePrice <= 0 || price <= 0 || Math.min(options.cash, options.stock, options.buyerBudget, options.maxQuantity) < 0) return reject("Trade quantities, prices and budgets must be bounded whole numbers.");
  if (!Number.isSafeInteger(price * options.quantity) || !Number.isSafeInteger(quote.cashCost) || !wholeResource(options.visitsRemaining) || [options.npcMinimumPrice, options.npcMaximumPrice].some(value => value !== undefined && !wholeResource(value))) return reject("The complete trade quote and acceptance bounds must be finite whole numbers.");
  if (options.visitsRemaining < 1) return reject("The annual market visit is already used.");
  if (options.quantity > Math.min(options.stock, options.maxQuantity)) return reject("The quoted stock or carrier limit is insufficient.");
  if (options.counteroffer !== undefined) {
    if (!profile.trade.counteroffers) return reject("Learn negotiated supply before making counteroffers.");
    const low = Math.max(Math.ceil(options.referencePrice * 0.9), options.npcMinimumPrice ?? 0), high = Math.min(Math.floor(options.referencePrice * 1.1), options.npcMaximumPrice ?? Infinity);
    if (price < low || price > high) return reject("The counteroffer lies outside the posted acceptance bounds.");
  }
  if (options.scheduled && !profile.trade.scheduledDelivery) return reject("Learn delivery logistics first.");
  if (options.scheduled && (!options.workAvailable || !Number.isSafeInteger(options.itemLines ?? 1) || (options.itemLines ?? 1) < 1 || (options.itemLines ?? 1) > 2)) return reject("A delivery needs the annual work action and at most two item lines.");
  if (options.cash < quote.cashCost) return reject("This plan exceeds available working cash.");
  if (options.side === "sell" && options.buyerBudget < price * options.quantity) return reject("The buyer cannot pay the quoted amount.");
  return quote;
}
