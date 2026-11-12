import type { CapabilityNode } from "./types.ts";
import { CAPABILITY_NODES } from "./catalog.ts";

export const ATTRIBUTE_BRANCHES = ["Physique", "Knowledge", "Handmade", "Trade"] as const;
const branchNames:Record<string,string>={Farming:"Physique",Artisan:"Handmade",Philosophy:"Knowledge"};
export const attributeBranch = (branch: string): string => branchNames[branch] ?? branch;
const node = (id: string, depth: number, title: string, parents: string[], proficiency: Record<string, number>, proof: string, reward: string, minimumStats?: Record<string, number>): CapabilityNode => ({
  id, depth, title, branch: "Physique", specialization: id.startsWith("M") ? "Military practice" : "Conditioning",
  prerequisites: { all: parents }, minimumProficiency: proficiency, proof, reward, ...(minimumStats ? { minimumStats } : {}),
});
export const CROSSOVER_NODES: readonly CapabilityNode[] = [
  node("B2", 2, "Strength conditioning", ["F1"], { strength: 8 }, "Complete 2 distinct years of controlled lifting and load handling, paying the exercise access fee.", "Develop Strength through physical work. Health remains a separate current condition."),
  node("B3", 3, "Sustained effort", ["B2"], { strength: 12, endurance: 16 }, "Complete 2 distinct years of paced endurance work with recovery and paid access.", "Combine physical preparation with basic Knowledge to begin military foundations."),
  node("M4", 4, "Drill and equipment", ["B3", "P1"], { strength: 16, endurance: 16, warfare: 8, literacy: 8 }, "Complete 2 pre-service drill years. Demonstrate equipment handling and comprehension of orders while medically fit.", "Qualify for Soldier enlistment at age 18. A career appointment is a separate action.", { health: 45, knowledge: 8 }),
  node("M5", 5, "Formation discipline", ["M4"], { warfare: 24, endurance: 24 }, "Complete 2 active drill years while serving. Each proof settles only after a funded, fully rationed service year.", "Develop formation skills and open more demanding field exercises.", { health: 45 }),
  node("M6", 6, "Field supply accounts", ["M5"], { warfare: 32, reckoning: 20, literacy: 16 }, "Complete 2 service work years reconciling the army's actual wage and ration accounts.", "Learn to account for finite army stores and payments; employer funds remain outside personal cash.", { health: 45 }),
  node("M7", 7, "Small-unit coordination", ["M6"], { warfare: 40, oratory: 24, strength: 24, endurance: 32 }, "Complete 2 active unit exercises with settled service accounts and full rations.", "Qualify for Officer opportunities after at least 2 proved service years.", { health: 45 }),
  node("M8", 8, "Tactical reasoning", ["M7", "P4"], { warfare: 48, oratory: 28, reckoning: 24 }, "As an Officer, complete 2 tactical work years, joining reasoned inquiry with reconciled service evidence.", "Open advanced command preparation through Knowledge and practical military experience.", { health: 45, knowledge: 16 }),
  node("M9", 9, "Campaign planning", ["M8"], { warfare: 60, literacy: 32, oratory: 32 }, "As an Officer, complete 2 planning work years with itemized paid materials and actual army accounts.", "Prepare a registered strategic-command assessment; learning does not automatically grant rank.", { health: 45, knowledge: 20 }),
  node("M10", 10, "Strategic command", ["M9"], { warfare: 72, oratory: 40, strength: 40, endurance: 48 }, "Complete a registered assessment across 2 active Officer work years. Reconcile materials, wages and rations in both years; retain at least 5 proved service years.", "Qualify for General opportunities at age 28. Appointment still requires an available command and recorded service.", { health: 50, knowledge: 24 }),
];
export const ATTRIBUTE_NODES: readonly CapabilityNode[] = [
  ...CAPABILITY_NODES.map(original => ({ ...original, branch: attributeBranch(original.branch),
    ...(original.id === "F1" ? { title: "Physical work", proof: "Complete 1 fieldwork year with an actual seeded harvest. This work also develops Strength and Endurance.", reward: "Open physical conditioning and cultivation. Strength and Endurance improve through actual farm work; Health is a separate condition." } : {}),
  })), ...CROSSOVER_NODES,
].sort((a,b) => a.depth - b.depth || a.id.localeCompare(b.id));
export const capabilityCatalog = (version: number) => version === 2 ? ATTRIBUTE_NODES : CAPABILITY_NODES;
