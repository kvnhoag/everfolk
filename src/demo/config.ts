/**
 * Starting balance for `alexandria-demo-1`. Each track owns and tunes its own section; the world build
 * copies this into `world.demo`. Targets (design §10): a normal year feeds four or five from one plot with
 * two adults and leaves a modest surplus; a failed flood without reserves leads to hunger.
 */
import type { AvailabilityConfig, DemoDefinition } from "./types.ts";

export const DEMO_CONFIG: Omit<DemoDefinition, "availability"> = {
  timeline: {
    families: {
      flood: { windowYears: { min: 50, max: 100 }, episodes: { min: 2, max: 4 }, durationYears: { min: 1, max: 3 }, level: "low" },
      army: { windowYears: { min: 50, max: 100 }, episodes: { min: 1, max: 3 }, durationYears: { min: 2, max: 5 }, level: "recruiting" },
      road: { windowYears: { min: 50, max: 100 }, episodes: { min: 1, max: 3 }, durationYears: { min: 1, max: 3 }, level: "dangerous" },
    },
    roadPressureBps: 3000,
    highFloodBps: 800,
    warMinYears: 4,
    episodeGapYears: 1,
  },
  household: {
    // Normal year, two adults on two plots, farming 20: 1300 × 1.08 = 1404 grown, 280 rent, 840 eaten by
    // two adults and three young children → about 280 surplus. A low flood (45%) without reserves → hunger.
    startingGrain: 600, storeCapacity: 1500, plots: 2,
    yieldPerPlot: 650, flaxPerPlot: 120,
    floodFactorBps: { low: 4500, normal: 10000, high: 12000 },
    skillBonusBps: 40, oxBonusBps: 2500, rentBps: 2000,
    spoilageBps: 800, overCapacitySpoilageBps: 4000,
    adultRation: 240, childRationBps: 5000,
    animalFeed: { ox: 120, donkey: 60 },
    childHelpAge: 8, childWorkAge: 14, handOverAge: 20, parentsStopEatingAfterYears: 8,
    hungerHealthPer10Pct: 3, hungerHealthCap: 18,
    flaxPerLinen: 4,
    marriageGift: { item: "silver", quantity: 2 },
    spinBoltsPer100Labour: 10,
    dealerExtraCapacity: 1500,
    reckoningSpoilageCutBpsPerPoint: 50,
    reckoningSpoilageCutCapBps: 4000,
  },
  market: {
    start: {
      grower: { grain: 2000, cash: 400, flax: 40 },
      merchant: { grain: 3000, cash: 4000, goods: { silver: 20, gold: 4, silk: 6, linen: 20 }, flax: 40, animals: { ox: 3, donkey: 4 } },
      army: { grain: 2500, purse: 3000 },
    },
    growerPlots: 6,
    // Grain is quoted per measure in whole drachmas, so its base is 2 (not 1) to leave room for a spread.
    basePrice: { grain: 2, flax: 3, silver: 60, gold: 700, silk: 220, linen: 25, ox: 300, donkey: 120 },
    priceFloorBps: 5000, priceCeilingBps: 30000, spreadBps: 2500,
    targetGrainStock: 3000,
    armyDemand: { quiet: 600, recruiting: 1400, war: 2400 },
    transportCostBps: { safe: 0, uneasy: 1000, dangerous: 3000 },
    yearlyImports: { silver: 6, gold: 1, silk: 2, linen: 6 },
    importFactorBps: { safe: 10000, uneasy: 7000, dangerous: 3000 },
    royalAllocation: 2500,
    maxOrderQuantity: 5000,
    growerEating: 2400,
    armyReserve: 2500,
    armyPurseReserve: 1000,
    growerSpoilageBps: 800,
    growerReleaseBps: 6000,
    merchantMaxStockBps: 15000,
    goodsStockCap: { silver: 20, gold: 4, silk: 6, linen: 20 },
    armyPremiumBps: { quiet: 0, recruiting: 2500, war: 5000 },
    metalsPressureBps: { quiet: 0, recruiting: 2000, war: 5000 },
    silkPressureBps: { safe: 0, uneasy: 1500, dangerous: 4000 },
    cropPressureBps: { low: 2500, normal: 0, high: -2500 },
    maxAnimals: 3,
    minTradeAge: 12,
    fairTradeReputation: 1,
  },
  service: {
    wage: { quiet: 120, recruiting: 180, war: 260 },
    ration: 240,
    escortCooldownYears: 3,
    escortCargo: 800,
    roadLossBps: { safe: 300, uneasy: 2000, dangerous: 5000 },
    provisionsCost: 60,
    distinctionMinWarfare: 40,
  },
  works: {
    works: {
      well: { title: "A village well", cash: 150, grain: 100, progress: 2, reputation: 6 },
      granary: { title: "A village granary", cash: 300, grain: 300, progress: 3, reputation: 10 },
      school: { title: "A village school", cash: 400, grain: 100, progress: 3, reputation: 10 },
      "healing-house": { title: "A healing house at the shrine", cash: 450, grain: 150, progress: 3, reputation: 12 },
    },
    reputation: { initial: 20, min: 0, max: 100 },
    granarySpoilageCutBps: 5000,
    schoolDiscountBps: 5000,
    wellIllnessReliefBps: 2500,
    healingRecoveryBonusBps: 3000,
    completionStats: {
      well: { health: 3, bonds: 2 },
      granary: { bonds: 4 },
      school: { bonds: 3 },
      "healing-house": { health: 4, bonds: 2 },
    },
    opportunityReputation: { neighbours: 30, dispute: 40, envoy: 50 },
  },
  agents: {
    priceBandBps: 2000,
    maxWagePremiumBps: 5000,
    growerReleaseBps: { min: 2000, max: 9000 },
    offerQuantity: { min: 1, max: 2000 },
  },
};

/** Skills and legacy routes outside the demo's farming/soldier/learning slice. */
export const UNAVAILABLE_SKILLS = ["pottery", "carving", "sculpture", "philosophy", "astronomy", "astrology", "seamanship", "music"];
export const UNAVAILABLE_ROUTES = ["sculpture", "philosophy", "seafaring", "astronomy-calendar", "music-performance"];
export const PLAYABLE_JOBS = ["farmhand", "tenant-farmer", "grain-dealer", "soldier"];
export const FUTURE_PATHS: AvailabilityConfig["futurePaths"] = [
  { id: "generalship", title: "Officer and general", description: "Command units and campaigns.", prerequisites: "Distinguished soldier service" },
  { id: "kingship", title: "Court and kingship", description: "Royal succession and court politics." },
  { id: "civil-war", title: "Civil war campaigns", description: "Wars between rival successors." },
  { id: "raising-children", title: "Raising your children", description: "Choose a strict or kind upbringing and a direction: family farm, learning, the army or grandparents." },
  { id: "house", title: "Building your house", description: "Build and repair a home that improves health, marriage and storage." },
  { id: "crafts", title: "Crafts and workshops", description: "Pottery, carving and sculpture careers." },
  { id: "scholarship", title: "Philosophy and the sky", description: "Philosophy, astronomy and astrology careers." },
  { id: "sea", title: "Sailing and trade by sea", description: "Seafaring careers and voyages." },
];
