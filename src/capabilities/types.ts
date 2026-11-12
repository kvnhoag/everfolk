/** Saved progression belongs to the immutable world in which a life began. */
export interface CapabilityNode {
  id: string; depth: number; title: string;
  branch: string; specialization: string | null;
  prerequisites: { all: string[] };
  minimumProficiency: Record<string, number>;
  minimumStats?: Record<string, number>;
  anyProficiency?: Record<string, number>[];
  /** Years of qualifying proof this world asks for; older packs use the catalog's count. */
  proofYears?: number;
  proof: string; reward: string;
}
export interface CapabilityEvidence {
  nodeId: string; age: number; year: number;
  kind: string;
  data: Record<string, number | string | boolean>;
}
export interface CapabilityState {
  learned: Record<string, { age: number; year: number }>;
  evidence: CapabilityEvidence[];
  workedAge?: number;
  /** Item cost traces are updated only by accepted purchases/production. */
  costBasis?: Record<string, { quantity: number; cost: number }>;
  reservedPayment?: number;
  /** Grain delivered to civic buyers is kept apart from merchant stock. */
  civicGrain?: number;
  military?: { service: { age: number; role: string; paid: number; wage: number; rations: number; ration: number; purseBefore: number; purseAfter: number; grainBefore: number; grainAfter: number }[] };
  /** An unfinished assessment counts active work years, not elapsed years. */
  project?: { nodeId: string; completedYears: number; startedAge: number;
    inputs?: Record<string, number>; fee?: number; payment?: number;
    payer?: "merchant" | "workshop" | "school" | "council";
    quality?: number; output?: string; quantity?: number;
    data?: Record<string, number | string | boolean>;
  };
  farm?: {
    actionAge: number; nodeId: string; seed: number; fee: number;
    mode?: string; reserve?: number; extension?: boolean;
    lastSettlementAge?: number; grainBefore?: number; flaxBefore?: number; cropGrain?: number; cropFlax?: number;
    consumed?: number; rationNeed?: number; fullRations?: boolean; debtBefore?: number; maintenancePaid?: number;
    seedFlax?: number; extensionPaid?: number; extensionMaintainedAge?: number; reserveYears?: number;
  };
}
export interface CapabilityDefinition {
  version: number;
  nodes: CapabilityNode[];
  /** alexandria-lives-7 and later: yearly practice and years worked in a job also prove the next step of their lane. */
  proofFromWork?: true;
}
export type CapabilityStatus = "learned" | "available" | "locked" | "unavailable";
export interface CapabilityNodeView {
  id: string; state: CapabilityStatus; reasons: string[];
  progress: { done: number; required: number };
  actionId: string | null; actionLabel: string;
  requirementText: string[];
}
export interface CapabilityView { enabled: boolean; nodes: CapabilityNodeView[] }
