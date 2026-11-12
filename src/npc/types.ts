import type { Command, LifeState } from "../types.ts";
export const NPC_RULES_VERSION = "npc-session-1";
export const NPC_ROLES = [
  "caregiver-a",
  "caregiver-b",
  "mentor",
  "merchant",
  "peer",
] as const;
export type NpcRole = (typeof NPC_ROLES)[number];
export type NpcAction =
  | "rest"
  | "work"
  | "study"
  | "train"
  | "prepare-fields"
  | "buy-food"
  | "offer-lesson"
  | "offer-grain"
  | "offer-gift";
export interface NpcPerson {
  id: string;
  name: string;
  role: NpcRole;
  born: number;
  familyId?: string;
  introduced: boolean;
  status: "alive" | "dead" | "departed";
  health: number;
  skills: {
    strength: number;
    endurance: number;
    knowledge: number;
    trade: number;
  };
  cash: number;
  grain: number;
  relationship: number;
  goal: string;
  memories: string[];
  workedAge: number | null;
}
export interface NpcOffer {
  id: string;
  npcId: string;
  kind: "lesson" | "grain" | "gift";
  price: number;
  quantity: number;
  expiresAge: number;
}
export interface NpcDecision {
  action: NpcAction;
  speech: string;
  source: "rules" | "llm" | "external" | "fallback";
}
export interface NpcEvent {
  sequence: number;
  age: number;
  actor: string;
  text: string;
  kind: "action" | "speech" | "world" | "arrival" | "departure" | "offer";
}
export type PlayerCommand = Extract<
  Command,
  { type: "advance" | "choose" | "act" }
>;
export type NpcSessionCommand =
  | { type: "player"; command: PlayerCommand }
  | { type: "resolve"; decisions: Record<string, NpcDecision> }
  | { type: "answer"; offerId: string; accept: boolean }
  | { type: "speak"; npcId: string; text: string; reply: string };
export interface NpcSessionState {
  rulesVersion: typeof NPC_RULES_VERSION;
  seed: string;
  player: LifeState;
  slots: Record<NpcRole, string>;
  people: Record<string, NpcPerson>;
  offers: NpcOffer[];
  events: NpcEvent[];
  commands: NpcSessionCommand[];
  lastResolvedAge: number | null;
  rng: number;
  treasuryEndowments: number;
}
export interface NpcActionOption {
  id: NpcAction;
  label: string;
  cost: string;
}
export interface NpcObservation {
  actor: {
    id: string;
    name: string;
    role: NpcRole;
    age: number;
    health: number;
    skills: NpcPerson["skills"];
    goal: string;
    relationship: number;
  };
  player: { name: string; age: number; health: number; occupation: string };
  year: number;
  playerAge: number;
  conditions: { flood: string; road: string; army: string };
  resources: {
    cash: number;
    grain: number;
    account: "household" | "shop" | "personal";
  };
  actions: NpcActionOption[];
  memory: string[];
  events: Pick<NpcEvent, "age" | "text" | "kind">[];
}
