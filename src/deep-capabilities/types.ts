/** Engine-authored successful receipts, never claims copied from client flags. */
export type CapabilityEvidenceKind = "work" | "production" | "harvest" | "exercise" | "contract" | "assessment" | "trade" | "reconciliation";
export type CapabilityFact = string | number | boolean;
export interface CapabilityEvidence {
  id: string;
  year: number;
  kind: CapabilityEvidenceKind;
  action: string;
  successful: boolean;
  facts: Record<string, CapabilityFact>;
  references?: string[];
  group?: string;
}
export interface LearnedCapability { year: number; evidenceIds: string[] }
export interface CapabilityState { learned: Record<string, LearnedCapability>; evidence: CapabilityEvidence[] }
export type CapabilityFactTest = CapabilityFact | { gte?: number; lte?: number; eq?: CapabilityFact; oneOf?: CapabilityFact[] };
export interface CapabilityEvidenceTest {
  kind?: CapabilityEvidenceKind;
  actions?: string[];
  facts?: Record<string, CapabilityFactTest>;
  balances?: { available: string; required: { fact: string; bps?: number }[] }[];
  references?: {
    minimum: number;
    allMatch?: CapabilityEvidenceTest;
    sum?: { fact: string; minimum: number };
    distinctYears?: number;
    distinctBy?: string;
    minimumDistinct?: number;
    matching?: CapabilityEvidenceTest;
    minimumMatching?: number;
  };
}
export type CapabilityProof =
  | { type: "all"; proofs: CapabilityProof[] }
  | { type: "any"; proofs: CapabilityProof[] }
  | { type: "records"; match: CapabilityEvidenceTest; count: number; distinctYears?: number; distinctBy?: string; minimumDistinct?: number; consecutiveYears?: number; afterNode?: string; sum?: { fact: string; minimum: number } }
  | { type: "context"; field: "reputation"; minimum: number };
export interface CapabilityRule {
  id: string;
  depth: number;
  title: string;
  branch: string;
  specialization: string | null;
  prerequisites: { all: string[] };
  minimumProficiency: Record<string, number>;
  anyProficiency?: Record<string, number>[];
  proof: CapabilityProof;
  proofDescription: string;
  rewardDescription: string;
}
export interface CapabilityProgress {
  learned: boolean;
  eligible: boolean;
  missingParents: string[];
  missingSkills: Record<string, { current: number; required: number }>;
  missingAlternatives: boolean;
  proofSatisfied: boolean;
  evidenceIds: string[];
}
export interface CapabilityEvaluationInput {
  skills: Readonly<Record<string, number>>;
  stats?: Readonly<Record<string, number>>;
  reputation?: number;
  year: number;
  state: CapabilityState;
  rules?: readonly CapabilityRule[];
}
export interface CapabilityEvaluation { state: CapabilityState; newlyLearned: string[]; progress: Record<string, CapabilityProgress> }
