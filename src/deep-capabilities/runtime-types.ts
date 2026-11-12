export interface CapabilityWorkState {
  serviceProject?: { serviceId: string; completedYears: number; workYears: number; escrow: number; payer: "workshop" | "school" | "council"; paidInputs: boolean; fee: number };

  farmPlan?: { age: number; mode: string; sowing: "ordinary" | "dense" | "conservative"; maintainChannels: boolean; planRecorded: boolean; seedDebited?: boolean; grainSeed?: number; flaxSeed?: number; fullSeedAllocation?: boolean; maintenancePaid?: boolean; integratedPlan?: boolean };
  farmWorkAge?: number;
  reserveOverrideAge?: number;
  storeExtended?: boolean;
  storeUpkeepPaidAge?: number;
  storeUpkeepMissedAge?: number;
  farmSettlement?: { age: number; year: number; flood: string; openingGrain: number; harvestGrain: number; rentGrain: number; purchasedGrain: number; peopleFed: number; animalFed: number; spoilage: number; labour: number; labourRecorded?: boolean; grainAfterConsumption: number };
  assessment?: { node: string; id: string; registeredYear: number; evidenceIds: string[] };
  commission?: { id: string; item: string; quantity: number; minQuality: number; deadlineAge: number; payment: number; escrow: number; acceptedYear: number };
  tradeAcquisitionCost?: Record<string, number>;
  tradeAcquisitionQuantity?: Record<string, number>;
  lastTradeYear?: number;
}
