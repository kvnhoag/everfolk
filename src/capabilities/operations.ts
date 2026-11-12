import { CAPABILITY_SERVICE_CONTRACTS } from "./rewards.ts";
export interface DeepOperation {
  title: string; action: string; primary: string; supports: string[]; fee: number; pay: number;
  node?: string; kind: "work" | "exercise" | "farm" | "assessment" | "commission" | "plan" | "service";
  minor?: boolean; payer?: "workshop" | "school" | "council";
}
const op = (title: string, action: string, primary: string, supports: string[], node?: string, fee = 0, pay = 0, kind: DeepOperation["kind"] = "exercise"): DeepOperation => ({ title, action, primary, supports, fee, pay, kind, ...(node ? { node } : {}) });
export const CAPABILITY_OPERATIONS: Record<string, DeepOperation> = {
  "fieldwork": op("Work a supervised year on the household fields", "fieldwork", "farming", ["reckoning"], undefined, 0, 0, "farm"),
  "soil-preparation": op("Prepare soil and record the harvest plan", "soil-preparation", "farming", ["craft", "reckoning"], "F2", 0, 0, "farm"),
  "channel-maintenance": op("Maintain the channels (8 dr per plot)", "channel-maintenance", "farming", ["craft", "reckoning"], "F2", 0, 0, "farm"),
  "crop-care": op("Tend crops and record their condition", "crop-care", "farming", ["reckoning"], "FC5", 0, 0, "farm"),
  "integrated-plan": op("Carry out an integrated farm assessment year", "integrated-plan", "farming", ["craft", "reckoning"], "FC9", 0, 0, "farm"),
  "store-inspection": op("Pay for a store inspection and repair (8 dr)", "store-inspection", "farming", ["craft", "reckoning"], "FR6", 8, 0, "work"),
  "stock-reconciliation": op("Reconcile the year's purchases, use and closing stock", "stock-reconciliation", "reckoning", ["literacy"], undefined),
  "extend-store": op("Build the store extension (80 dr, 4 timber, 5 clay)", "extend-store", "farming", ["craft", "reckoning"], "FR7", 80, 0, "work"),
  "tool-practice": op("Practise safe hand tools with a workshop mentor (12 dr pay)", "tool-practice", "craft", ["carving", "reckoning"], undefined, 0, 12, "work"),
  "measurement-exercise": op("Measure and cut a marked exercise (2 dr)", "measurement-exercise", "craft", ["reckoning", "literacy"], "A1", 2),
  "prepare-textiles": op("Prepare paid textile materials (2 dr)", "prepare-textiles", "craft", ["reckoning"], "A2", 2, 0, "work"),
  "prepare-clay": op("Prepare paid clay and record the materials (2 dr)", "prepare-clay", "craft", ["pottery", "sculpture"], "A2", 2, 0, "work"),
  "prepare-wood-stone": op("Prepare paid wood and stone (2 dr)", "prepare-wood-stone", "craft", ["carving", "sculpture"], "A2", 2, 0, "work"),
  "wood-relief-practice": op("Carve a supervised wood-relief exercise (2 dr)", "wood-relief-practice", "craft", ["carving", "sculpture"], "A4", 2, 0, "work"),
  "project-budget": op("Reconcile the material and labour budget for a large work", "project-budget", "craft", ["reckoning", "literacy"], "AS7"),
  "guided-reading": op("Read with a tutor and record an evidence-based question (3 dr)", "guided-reading", "philosophy", ["literacy", "oratory"], undefined, 3),
  "argument-exercise": op("Present two reasons, a counterargument and a response (3 dr)", "argument-exercise", "philosophy", ["literacy", "oratory"], "P1", 3),
  "evidence-comparison": op("Compare two accounts and record their disagreement (3 dr)", "evidence-comparison", "philosophy", ["reckoning", "literacy"], "P2", 3),
  "reviewed-inquiry": op("Submit an inquiry for review of its evidence and method (4 dr)", "reviewed-inquiry", "philosophy", ["literacy", "reckoning"], "P3", 4),
  "public-dilemma": op("Discuss a public dilemma and explain its trade-offs", "public-dilemma", "philosophy", ["oratory", "literacy"], "P3"),
  "observation-project": op("Collect a distinct set of observations (3 dr)", "observation-project", "philosophy", ["reckoning", "literacy"], "P4", 3),
  "measurement-calculation": op("Calculate from recorded measurements and check the error (3 dr)", "measurement-calculation", "philosophy", ["reckoning", "literacy"], "PS5", 3),
  "test-explanation": op("Declare a prediction, then compare it with observations (4 dr)", "test-explanation", "philosophy", ["reckoning", "literacy"], "PS6", 4),
  "independent-check": op("Ask an ordinary reviewer to reproduce a recorded result (4 dr)", "independent-check", "philosophy", ["reckoning", "literacy"], "PS7", 4),
  "research-synthesis": op("Synthesize earlier records and independent checks (6 dr)", "research-synthesis", "philosophy", ["reckoning", "literacy"], "PS8", 6),
  "original-inquiry": op("Complete a year of the registered original inquiry (6 dr)", "original-inquiry", "philosophy", ["reckoning", "literacy"], "PS9", 6),
  "public-address": op("Address a local issue using recorded facts and a trade-off", "public-address", "philosophy", ["oratory", "literacy"], "P4"),
  "negotiate-agreement": op("Negotiate a funded, deliverable neighbourhood agreement", "negotiate-agreement", "philosophy", ["oratory", "reckoning"], "PP5"),
  "public-budget": op("Publish a funded public budget with receipts", "public-budget", "philosophy", ["reckoning", "literacy"], "PP6"),
  "public-service": op("Deliver a service within the recorded public budget", "public-service", "philosophy", ["oratory", "reckoning"], "PP6", 0, 12),
  "coalition-agreement": op("Fulfil an agreement between two local groups", "coalition-agreement", "philosophy", ["oratory", "literacy"], "PP7"),
  "policy-project": op("Implement and review a year of a district policy", "policy-project", "philosophy", ["oratory", "reckoning"], "PP8"),
  "cost-basket": op("Reconcile actual material purchases and fees", "cost-basket", "reckoning", ["literacy"], "T1"),
  "price-comparison": op("Record three actual quotes against acquisition costs", "price-comparison", "reckoning", ["literacy", "oratory"], "T2"),
  "supply-plan": op("Cost and deliver a supply plan from real stock", "supply-plan", "reckoning", ["literacy", "oratory"], "T4"),
  "delivery-order": op("Fulfil a funded fixed-price delivery order", "delivery-order", "reckoning", ["literacy", "oratory"], "T5"),
  "trading-year": op("Close a trading year with realized margin and reconciled stock", "trading-year", "reckoning", ["literacy", "oratory"], "T7"),
  "enterprise-contract": op("Deliver an enterprise contract with itemized costs", "enterprise-contract", "reckoning", ["literacy", "oratory"], "T8"),
  "reserve-override": { ...op("Authorise a sale below protected reserves this year", "reserve-override", "farming", [], "FR6", 0, 0, "plan"), minor: true },
  "plan-dense": { ...op("Use dense sowing for the next harvest", "plan-dense", "farming", [], "FC5", 0, 0, "plan"), minor: true },
  "plan-conservative": { ...op("Use conservative sowing for the next harvest", "plan-conservative", "farming", [], "FC9", 0, 0, "plan"), minor: true },
  "plan-ordinary": { ...op("Use ordinary sowing for the next harvest", "plan-ordinary", "farming", [], undefined, 0, 0, "plan"), minor: true },
};
for (const node of ["AT10", "AC10", "AS10", "PS10", "PP10", "T10"]) {
  const parent = node.replace("10", "9");
  for (const stage of ["register", "submit"]) CAPABILITY_OPERATIONS[`${stage}-${node}`] = { ...op(`${stage === "register" ? "Register" : "Submit"} the ${node} two-work-year assessment`, `${stage}-${node}`, node.startsWith("P") ? "philosophy" : node === "T10" ? "reckoning" : "craft", [], parent, 0, 0, "assessment"), minor: true };
}
for (const item of ["garment", "vessel", "stone-figure", "large-relief", "decorated-vessel"]) {
  CAPABILITY_OPERATIONS[`commission-${item}`] = { ...op(`Accept a funded ${item.replaceAll("-", " ")} commission`, `commission-${item}`, "craft", [], "A4", 0, 0, "commission"), minor: true };
}
CAPABILITY_OPERATIONS["deliver-commission"] = { ...op("Deliver the completed commission and collect its escrow", "deliver-commission", "craft", [], "A4", 0, 0, "commission"), minor: true };


for (const [id, contract] of Object.entries(CAPABILITY_SERVICE_CONTRACTS)) {
  const civic = contract.node.startsWith("PP");
  CAPABILITY_OPERATIONS[`service-${id}`] = {
    ...op(`Undertake ${id.replaceAll("-", " ")} service (${contract.workYears} work year${contract.workYears > 1 ? "s" : ""}; ${contract.pay} dr on completion)`, `service-${id}`, "philosophy", civic ? ["oratory", "reckoning"] : ["literacy", "reckoning"], contract.node, 0, 0, "service"),
    payer: civic ? "council" : "school",
  };
}
CAPABILITY_OPERATIONS["service-garment-repair"] = op("Complete a paid garment repair (24 dr; linen and thread)", "service-garment-repair", "craft", ["reckoning"], "AT10", 0, 0, "service");
CAPABILITY_OPERATIONS["service-restoration"] = op("Restore a commissioned sculpture (2 work years; 80 dr; stone and pigment)", "service-restoration", "craft", ["sculpture", "carving"], "AS10", 0, 0, "service");
