import type { Condition, Effect, WorldPack } from "../types.ts";
import type { FigurePathDefinition, FigurePathStage } from "./types.ts";
import type { VocationAction } from "../vocations/types.ts";
import { biographyFor } from "../../chain/catalog/figure-biographies.ts";
import { FIGURE_RANK_POLICY } from "../../chain/catalog/figure-ranks.ts";

/** Retained: figure paths on the unchanged lives-5 pack. Current births use LIVES_WORLD_VERSION (src/vocations/ids.ts). */
export const FIGURE_PATH_WORLD_VERSION = "alexandria-lives-6";
export const DEEP_FIGURE_PATH_WORLD_VERSION = "alexandria-figures-1";
const all = (...conditions: Condition[]): Condition => ({ type: "all", conditions });
const any = (...conditions: Condition[]): Condition => ({ type: "any", conditions });
const skill = (id: string, value: number): Condition => ({ type: "skill", skill: id, op: "gte", value });
const cap = (node: string): Condition => ({ type: "capability", node });
const year = (op: "gte" | "lte", value: number): Condition => ({ type: "year", op, value });
const earned = (achievement: string): Condition => ({ type: "accomplishment", achievement });
const absent = (achievement: string): Condition => ({ type: "not", condition: earned(achievement) });
const workCount = (action: string, count: number): Condition => ({ type: "vocation", action, count });
type Project = { title: string; traditionTitle: string; work: string; description: string; gate: Condition; inputs: Record<string, number>; fee: number; pay: number };
type Spec = {
  id: string; name: string; summary: string; from: number; to?: number; location: string; circle?: boolean;
  primary: string; supports: string[]; entry: Condition;
  stages: [Project, Project, Project];
  capstone: { work: string; description: string; gate: Condition; inputs: Record<string, number>; fee: number };
};
const project = (title: string, traditionTitle: string, work: string, description: string, gate: Condition, inputs: Record<string, number>, fee = 4, pay = 8): Project =>
  ({ title, traditionTitle, work, description, gate, inputs, fee, pay });

/** Dates and activities are authored access windows, not evidence of a real player's historical meeting. */
const specs: Spec[] = [
  {
    id: "alexander", name: "Alexander the Great", from: -332, to: -331, location: "Egypt, then the Macedonian campaign train",
    summary: "Enter through campaign service while Alexander is in Egypt. Logistics, command and a completed strategic operation matter; an age-28 General appointment is not an entry requirement.",
    primary: "warfare", supports: ["oratory", "reckoning"], entry: any(skill("warfare", 16), cap("T2")),
    stages: [
      project("Campaign Provisioner", "Reader of Macedonian Supply Records", "Account for and deliver a season of campaign stores", "A delivered, itemised supply assignment is a contribution; merely joining the army is not.", any(skill("warfare", 24), cap("T3")), { grain: 20, papyrus: 1 }, 2, 8),
      project("Campaign Staff Officer", "Macedonian Campaign Analyst", "Prepare and execute a season of coordinated campaign orders", "Repeated staff work must reconcile provisions, routes and the agreed operational task.", all(skill("warfare", 40), skill("oratory", 24)), { grain: 40, papyrus: 2, ink: 1 }, 6, 16),
      project("Trusted Campaign Commander", "Custodian of Macedonian Campaign Methods", "Command and account for a funded field operation", "Sustained responsibility for real operations distinguishes a senior subordinate from an observer.", all(skill("warfare", 56), skill("oratory", 32)), { grain: 60, papyrus: 2, timber: 1 }, 16, 24),
    ],
    capstone: { work: "Complete a strategic campaign command and secure its settlement", description: "A separate funded campaign programme and strategic result support the figure-defining legacy. A title or royal birth alone does not.", gate: all(skill("warfare", 64), skill("oratory", 40)), inputs: { grain: 80, papyrus: 2, timber: 2 }, fee: 40 },
  },
  {
    id: "aristotle", name: "Aristotle", from: -335, to: -323, location: "The Lyceum in Athens",
    summary: "Start with argument and observation at the Lyceum, then build reviewed inquiry and teaching. Later work continues through the Aristotelian school and makes no claim of a dead teacher's personal endorsement.",
    primary: "philosophy", supports: ["literacy", "reckoning"], entry: cap("P2"),
    stages: [
      project("Lyceum Copyist", "Copyist of Aristotelian Arguments", "Copy an argument and retain its objections and observations", "An annotated comparison is useful work, rather than attendance at a lecture.", cap("P3"), { papyrus: 1, ink: 1 }, 3, 6),
      project("Lyceum Researcher", "Researcher in the Aristotelian Tradition", "Compare and revise a season of natural-history observations", "Two seasons connect claims to observations and preserve disagreements for review.", cap("PS6"), { papyrus: 2, ink: 1 }, 4, 12),
      project("Peripatetic Scholar", "Scholar of Aristotelian Inquiry", "Teach and independently review a sustained programme of inquiry", "The contribution joins research, criticism and teaching; tutoring a ruler is not a substitute.", all(cap("PS9"), skill("oratory", 40)), { papyrus: 3, ink: 2 }, 6, 18),
    ],
    capstone: { work: "Complete and teach a coherent body of independently checked inquiry", description: "The resulting body of inquiry and teaching, built on research mastery, earns the philosophical legacy. Post-322 work is explicitly a continuation of the school.", gate: all(cap("PS10"), skill("philosophy", 80), skill("literacy", 76)), inputs: { papyrus: 4, ink: 3 }, fee: 12 },
  },
  {
    id: "euclid", name: "Euclid", from: -300, location: "A geometrical teaching circle in Alexandria; a personal meeting is uncertain", circle: true,
    summary: "Join the geometrical tradition associated with the Elements around 300 BCE. The path rewards justified constructions and a coherent deductive collection, without inventing a Museum appointment or a precise death date.",
    primary: "reckoning", supports: ["literacy", "philosophy"], entry: all(cap("P4"), skill("reckoning", 32)),
    stages: [
      project("Geometrical Copyist", "Geometrical Copyist", "Copy constructions and justify each step from earlier results", "Careful copying includes the reasons behind the diagram, not merely a finished picture.", cap("PS6"), { papyrus: 1, ink: 1 }, 3, 8),
      project("Proof Checker", "Proof Checker", "Check independent demonstrations and reconcile disputed steps", "Two seasons of checking expose assumptions and repair errors before a demonstration is accepted.", cap("PS8"), { papyrus: 2, ink: 1 }, 5, 14),
      project("Geometer of the Teaching Circle", "Geometer of the Teaching Circle", "Organise and teach a connected sequence of demonstrations", "A deductive sequence must retain definitions, earlier results and independent review.", all(cap("PS9"), skill("reckoning", 72)), { papyrus: 3, ink: 2 }, 8, 20),
    ],
    capstone: { work: "Complete a reviewed deductive collection and teach its constructions", description: "An enduring organisation of demonstrated results supports Euclid's legacy; the route does not claim every theorem was first discovered by its compiler.", gate: all(cap("PS10"), skill("reckoning", 80), skill("literacy", 72)), inputs: { papyrus: 4, ink: 3 }, fee: 12 },
  },
  {
    id: "lysippos", name: "Lysippos", from: -330, to: -310, location: "A Greek bronze workshop following Lysippan practice",
    summary: "Develop measured models, portrait proportions and bronze workshop projects. Stone sculpture is useful training, but cannot alone establish Lysippos's distinctive bronze achievement.",
    primary: "sculpture", supports: ["craft", "carving"], entry: cap("A4"),
    stages: [
      project("Bronze Workshop Assistant", "Assistant in Lysippan Workshop Practice", "Prepare measured clay models and workshop supports", "A model records pose and proportions for the bronze workshop.", cap("AS5"), { clay: 2, timber: 1 }, 4, 10),
      project("Portrait Modeller", "Modeller of Lysippan Portraits", "Revise portrait proportions and complete paid bronze studies", "The work uses actual bronze and fuel; a stone figurine is not silently relabelled a bronze.", cap("AS7"), { bronze: 3, fuel: 2, clay: 1 }, 8, 20),
      project("Master of Lysippan Form", "Custodian of Lysippan Form", "Complete a substantial sequence of commissioned bronze figures", "Several seasons of models, casting work and revision form the senior workshop contribution.", all(cap("AS9"), skill("sculpture", 72)), { bronze: 6, fuel: 3, timber: 1 }, 12, 32),
    ],
    capstone: { work: "Complete and document an independently reviewed monumental bronze programme", description: "Sculptural mastery must be applied to real bronze projects and measured form. No literary treatise is invented for Lysippos.", gate: all(cap("AS10"), skill("sculpture", 80), skill("craft", 72)), inputs: { bronze: 8, fuel: 4, timber: 2 }, fee: 24 },
  },
  {
    id: "pytheas", name: "Pytheas of Massalia", from: -330, to: -325, location: "Massalia and an Atlantic expedition; the voyage is dated approximately",
    summary: "Prepare an expedition, collect navigational observations and deliver a checked voyage account. The route preserves uncertainty about the lost work and the identity of Thule.",
    primary: "seamanship", supports: ["astronomy", "reckoning"], entry: all(skill("seamanship", 16), skill("astronomy", 8)),
    stages: [
      project("Expedition Provisioner", "Reader of Massaliot Voyage Accounts", "Prepare and reconcile a season of expedition provisions", "Paid preparation and a working log are a genuine expedition contribution.", all(skill("seamanship", 24), skill("reckoning", 24)), { grain: 20, papyrus: 1, linen: 1 }, 6, 10),
      project("Navigation Observer", "Checker of Northern Navigation Accounts", "Keep and compare a season of navigation and sky observations", "Observations are compared across seasons rather than granting a discovery for one conversation.", all(skill("seamanship", 40), skill("astronomy", 32)), { grain: 20, papyrus: 2, ink: 1, linen: 1 }, 10, 18),
      project("Keeper of the Northern Voyage Log", "Custodian of Northern Voyage Evidence", "Revise and deliver a checked account of the expedition", "The substantial contribution is the retained, tested account and its safe delivery; it does not settle every later geographical identification.", all(skill("seamanship", 56), skill("astronomy", 48)), { papyrus: 3, ink: 2 }, 12, 24),
    ],
    capstone: { work: "Complete an independently checked navigation account and its teaching copies", description: "The navigational body of work earns an Epic legacy. It neither proves a particular identification of Thule nor promotes Pytheas to Legendary.", gate: all(skill("seamanship", 64), skill("astronomy", 56), skill("reckoning", 56)), inputs: { papyrus: 4, ink: 2 }, fee: 16 },
  },
  {
    id: "menander", name: "Menander", from: -321, to: -292, location: "The Athenian stage and a New Comedy rehearsal company",
    summary: "Write, revise, rehearse and stage comedy about human situations. Political office and scientific mastery do not substitute for dramatic achievement.",
    primary: "oratory", supports: ["literacy", "music"], entry: all(skill("literacy", 24), skill("oratory", 16)),
    stages: [
      project("Stage Copyist", "Copyist of New Comedy", "Copy and revise a scene for a working rehearsal", "A usable dramatic scene and rehearsal notes are the first contribution.", all(skill("literacy", 32), skill("oratory", 24)), { papyrus: 1, ink: 1 }, 3, 8),
      project("New Comedy Collaborator", "Collaborator in New Comedy", "Write, rehearse and revise a season of comic scenes", "The text must be tried in performance and revised through repeated work.", all(skill("literacy", 48), skill("oratory", 40)), { papyrus: 2, ink: 1, linen: 1 }, 6, 16),
      project("Dramatist of New Comedy", "Dramatist in Menander's Tradition", "Write and stage a sustained sequence of complete comedies", "Several seasons of completed writing and staging distinguish a dramatist from an eloquent speaker.", all(skill("literacy", 64), skill("oratory", 64)), { papyrus: 3, ink: 2, linen: 1 }, 10, 24),
    ],
    capstone: { work: "Complete an independent cycle of revised and publicly staged comedies", description: "A substantial dramatic body of work supports the Legendary legacy. Music may support rehearsal, but no unimplemented performance mastery is required.", gate: all(skill("literacy", 80), skill("oratory", 72)), inputs: { papyrus: 4, ink: 3, linen: 2 }, fee: 18 },
  },
  {
    id: "demetrius", name: "Demetrius the Besieger", from: -312, to: -304, location: "Eastern Mediterranean campaign workshops, then the siege of Rhodes",
    summary: "An authored service encounter after the Gaza campaign leaves enough years to prepare real siege works. Machinery and a negotiated settlement remain Epic; only successful alternate-history capture of Rhodes supports Legendary.",
    primary: "craft", supports: ["warfare", "reckoning"], entry: all(cap("A4"), skill("warfare", 24)),
    stages: [
      project("Siege Workshop Assistant", "Reader of Demetrian Siege Accounts", "Prepare and account for workshop tools and siege materials", "Early work establishes a real engineering contribution, without claiming a victory.", all(cap("AS5"), skill("warfare", 32)), { timber: 2, bronze: 1 }, 8, 12),
      project("Siege Engineer", "Analyst of Demetrian Siege Engineering", "Build, test and revise funded siege components", "Two seasons of construction and revision establish engineering responsibility.", all(cap("AS7"), skill("reckoning", 48)), { timber: 3, bronze: 2, fuel: 1 }, 16, 24),
      project("Director of Siege Works", "Custodian of Demetrian Siege Methods", "Direct and reconcile the deployment of substantial siege works", "Senior contribution requires delivered projects and operational accounting, not merely impressive plans.", all(cap("AS8"), skill("warfare", 56)), { timber: 4, bronze: 3, fuel: 2 }, 24, 32),
    ],
    capstone: { work: "Carry out and reconcile the siege programme's operational work", description: "The completed siege programme earns the Epic figure title. A separate one-shot Rhodes resolution can raise it only on actual alternate-history capture.", gate: all(cap("AS8"), skill("craft", 72), skill("warfare", 64)), inputs: { timber: 4, bronze: 3, fuel: 2 }, fee: 40 },
  },
  {
    id: "theophrastus", name: "Theophrastus", from: -335, to: -287, location: "The Lyceum and its comparative botanical work in Athens",
    summary: "Treat Aristotle's colleague and successor as an investigator in his own right. Comparative plant observations, seasons and a reviewed botanical account define the route.",
    primary: "philosophy", supports: ["farming", "literacy"], entry: cap("P4"),
    stages: [
      project("Plant Records Assistant", "Copyist of Peripatetic Plant Records", "Record plants, growing conditions and disagreements in identification", "A real comparative record starts the botanical contribution.", cap("PS5"), { papyrus: 1, ink: 1 }, 3, 8),
      project("Comparative Plant Investigator", "Investigator of Theophrastan Botany", "Compare and revise plant observations across growing seasons", "Repeated comparison matters more than merely collecting names.", all(cap("PS7"), skill("farming", 24)), { papyrus: 2, ink: 1 }, 5, 14),
      project("Peripatetic Botanical Scholar", "Scholar of Theophrastan Plant Inquiry", "Complete and teach a reviewed body of comparative plant inquiry", "A sustained botanical contribution reflects Theophrastus's independent research and school leadership.", all(cap("PS9"), skill("farming", 32)), { papyrus: 3, ink: 2 }, 8, 20),
    ],
    capstone: { work: "Complete a reviewed comparative botanical account across seasons", description: "The independent botanical account earns an Epic legacy under the strict agreed standard; it does not automatically become Legendary.", gate: all(cap("PS9"), skill("philosophy", 72), skill("literacy", 64), skill("farming", 32)), inputs: { papyrus: 4, ink: 3 }, fee: 12 },
  },
  {
    id: "zeno", name: "Zeno of Citium", from: -300, to: -262, location: "The Athenian Stoa and its ethical teaching",
    summary: "Develop argument, ethical inquiry and public teaching. Zeno remains Epic unless an independently functioning Stoic school is actually established through a separate funded programme.",
    primary: "philosophy", supports: ["oratory", "literacy"], entry: cap("P4"),
    stages: [
      project("Student of the Stoa", "Reader of Early Stoic Arguments", "Record and defend a reasoned ethical argument", "A defensible contribution goes beyond attendance or assent.", cap("PP5"), { papyrus: 1, ink: 1 }, 3, 6),
      project("Stoic Discussion Leader", "Teacher of Stoic Discussion", "Lead and revise a season of ethical discussion and teaching", "Repeated teaching must answer objections and preserve its reasons.", all(skill("philosophy", 56), skill("oratory", 40)), { papyrus: 2, ink: 1 }, 5, 12),
      project("Scholar of Stoic Ethics", "Custodian of Early Stoic Inquiry", "Sustain an independent programme of ethical inquiry and teaching", "An independent body of inquiry is a major contribution, while founding a school remains a separate outcome.", all(any(cap("PS9"), cap("PP9")), skill("oratory", 56)), { papyrus: 3, ink: 2 }, 8, 18),
    ],
    capstone: { work: "Complete and teach a coherent independent programme of Stoic ethics", description: "This body of ethical inquiry earns the Epic figure title. The working Legendary interpretation requires a functioning school, not an announcement.", gate: all(any(cap("PS9"), cap("PP9")), skill("philosophy", 72), skill("literacy", 64)), inputs: { papyrus: 4, ink: 3 }, fee: 12 },
  },
  {
    id: "ptolemy", name: "Ptolemy I Soter", from: -323, to: -283, location: "Egyptian administration and the emerging Ptolemaic court",
    summary: "Build audited administration, supply and political support before attempting a durable independent hereditary government. Becoming satrap, gaining wealth or reaching 305 BCE does not found a dynasty by itself.",
    primary: "reckoning", supports: ["oratory", "literacy"], entry: any(cap("T3"), cap("PP5")),
    stages: [
      project("Egyptian Administration Clerk", "Reader of Early Ptolemaic Accounts", "Reconcile a season of Egyptian supply and revenue records", "A completed account is useful work; holding an administrative title is insufficient.", any(cap("T4"), cap("PP6")), { grain: 20, papyrus: 1, ink: 1 }, 4, 10),
      project("Ptolemaic Supply Commissioner", "Investigator of Ptolemaic Administration", "Deliver and reconcile a season of funded public supply", "Two seasons connect administration to actual funded delivery.", any(cap("T7"), cap("PP7")), { grain: 40, papyrus: 2, ink: 1 }, 8, 18),
      project("Steward of Egyptian Government", "Custodian of Early Ptolemaic Statecraft", "Maintain an audited public programme and its political agreements", "A major contribution combines operating accounts with workable institutions and support.", all(any(cap("T9"), cap("PP9")), skill("oratory", 48)), { grain: 60, papyrus: 3, ink: 2 }, 12, 24),
    ],
    capstone: { work: "Consolidate and audit a sustained programme of Egyptian government", description: "Completed administration supports Ptolemy's Epic title. A separate successful founding outcome is required for the Ptolemaic dynasty and Legendary promotion.", gate: all(any(cap("T9"), cap("PP9")), skill("reckoning", 72), skill("oratory", 56)), inputs: { grain: 80, papyrus: 4, ink: 3 }, fee: 24 },
  },
  {
    id: "cleomenes", name: "Cleomenes of Naucratis", from: -332, to: -323, location: "Egyptian revenue offices and the grain administration",
    summary: "Develop actual grain accounts, deliveries and revenue oversight. Ancient accounts of Cleomenes are hostile; humane relief choices are authored alternatives, not a proven benevolent historical policy.",
    primary: "reckoning", supports: ["literacy", "oratory"], entry: cap("T2"),
    stages: [
      project("Revenue Records Assistant", "Reader of Cleomenian Revenue Records", "Reconcile a season of grain purchases, dues and closing stores", "A genuine balanced account starts the contribution.", cap("T4"), { grain: 20, papyrus: 1, ink: 1 }, 3, 8),
      project("Grain Supply Auditor", "Auditor of Macedonian Grain Administration", "Audit and deliver a season of funded grain supply", "Repeated delivery and accounting show impact beyond a wealthy balance sheet.", cap("T7"), { grain: 40, papyrus: 2, ink: 1 }, 6, 16),
      project("Steward of Egyptian Grain Accounts", "Custodian of Egyptian Revenue Evidence", "Reconcile a substantial grain-administration programme", "The senior contribution requires actual supply and public accounting; coercion is not silently praised as relief.", any(cap("T9"), cap("PP8")), { grain: 60, papyrus: 3, ink: 2 }, 10, 22),
    ],
    capstone: { work: "Complete an audited programme of revenue and grain administration", description: "The completed administrative body of work earns an Epic legacy. Wealth alone and invented benevolence do not qualify.", gate: all(any(cap("T9"), cap("PP8")), skill("reckoning", 72), skill("literacy", 48)), inputs: { grain: 80, papyrus: 4, ink: 2 }, fee: 20 },
  },
];

/** Build only a new revision; retained packs are never amended at load time. */
/**
 * Add the figure paths to a retained world. By default the revision follows the base: deep-1 → figures-1, lives-5 → lives-6.
 * Pass `version` to publish the same figure paths on another rules base (alexandria-lives-8 on the lives-7 rules).
 */
export function buildFigurePathWorld(base: WorldPack, version?: string): WorldPack {
  if ((!base.deepCapabilities && !base.capabilities) || !base.character || !base.vocations || !base.legacy || !base.demo) throw new Error("Figure paths require the completed deep-skill world.");
  if (base.figurePaths) throw new Error("Build figure paths from a retained world without figure-path metadata.");
  const world = structuredClone(base);
  world.version = version ?? (world.deepCapabilities ? DEEP_FIGURE_PATH_WORLD_VERSION : FIGURE_PATH_WORLD_VERSION);
  world.title = "Alexandria — Historical lives and earned legacies";
  world.description = "Develop real skills, contribute to historical work and earn titles through completed projects. Encounters, traditions and figure-defining achievements have distinct requirements.";
  world.figurePaths = [];
  // A sound comparison may find agreement. Keep this repair local to this revision.
  if (world.deepCapabilities) {
  const comparisonRule = world.deepCapabilities.rules.find(rule => rule.id === "P3");
  if (!comparisonRule || comparisonRule.proof.type !== "records") throw new Error("The retained research comparison rule is missing.");
  const { disagreementRecorded: _oldDisagreement, ...comparisonFacts } = comparisonRule.proof.match.facts ?? {};
  comparisonRule.proof.match.facts = { ...comparisonFacts, comparisonRecorded: true };
  comparisonRule.proofDescription = "Compare two actual records and record their agreement or disagreement in two distinct comparison records.";
  }
  world.sources ??= [];
  const def = world.vocations!;
  def.materials.bronze = { price: 18, stock: 240 };
  const addWork = (actionId: string, text: string, primary: string, supports: string[], when: Condition | undefined, fee: number, pay: number, inputs: Record<string, number> = {}, effects: Effect[] = [], minAge = 18) => {
    const action: VocationAction = { kind: "work", fee, pay, payer: primary === "philosophy" || primary === "literacy" || primary === "oratory" ? "school" : primary === "reckoning" ? "council" : "workshop", primary, supports, practice: false, ...(Object.keys(inputs).length ? { inputs } : {}) };
    def.actions[actionId] = action;
    const materialText = Object.entries(inputs).map(([item, quantity]) => `${quantity} ${item}`).join(", ");
    const priceText = `${fee ? `${fee} dr fee` : "no access fee"}${pay ? `, ${pay} dr paid` : ""}${materialText ? `; consumes ${materialText}` : ""}`;
    world.character!.activities.push({ id: `v-${actionId}`, text: `${text} (${priceText}; one work year)`, category: "career", minAge, usesYearlyActivity: true, ...(when ? { when } : {}), outcomes: [{ id: `v-${actionId}-done`, text: `${text}. The completed work, actual inputs and payment are recorded.`, weight: 1, effects: [{ type: "vocation", action: actionId }, { type: "stat", stat: "knowledge", delta: 1 }, ...effects] }] });
  };
  def.actions["fig-buy-bronze"] = { kind: "buy", item: "bronze", quantity: 4 };
  world.character!.activities.push({ id: "v-fig-buy-bronze", text: "Buy 4 bronze units for the workshop (72 dr)", category: "finance", minAge: 12, usesYearlyActivity: false, outcomes: [{ id: "v-fig-buy-bronze-done", text: "The supplier transfers four actual bronze units and retains the 72 dr payment.", weight: 1, effects: [{ type: "vocation", action: "fig-buy-bronze" }] }] });
  for (const spec of specs) {
    const biography = biographyFor(spec.id);
    const rankPolicy = FIGURE_RANK_POLICY.find(item => item.figureId === spec.id)!;
    const routeId = `figure-${spec.id}`, sourceId = `figure-source-${spec.id}`;
    const encounterAchievement = `fig-${spec.id}-encounter`, traditionAchievement = `fig-${spec.id}-tradition`;
    const capstoneAchievement = `fig-${spec.id}-capstone`;
    world.sources.push({ id: sourceId, title: biography.sources[0].title, url: biography.sources[0].url, publisher: "Historical biography source", kind: biography.sources[0].url.includes("getty") || biography.sources[0].url.includes("metmuseum") || biography.sources[0].url.includes("smb.museum") ? "museum" : "scholarship", period: biography.period, geography: spec.location, summary: biography.biography, limitations: "Dates and historical work support the setting. Player encounters, project budgets, exact ranks and title ceremonies are authored gameplay, not documented historical meetings or honours.", accessed: "2026-11-12" });
    const achievementIds: string[] = [];
    const addAchievement = (id: string, title: string, description: string, kind: "ordinary" | "prestige" | "ultimate" = "ordinary") => {
      achievementIds.push(id);
      world.legacy!.achievements.push({ id, routeId, title, description, kind, nameTemplate: `{name}: ${title}`, people: [], evidence: "historically-inspired", sourceIds: [sourceId] });
    };
    const contact = spec.to === undefined ? earned(encounterAchievement) : any(earned(encounterAchievement), earned(traditionAchievement));
    const notContact = spec.to === undefined ? absent(encounterAchievement) : all(absent(encounterAchievement), absent(traditionAchievement));
    const accessWindow = all(year("gte", spec.from), ...(spec.to === undefined ? [] : [year("lte", spec.to)]), notContact, spec.entry);
    addAchievement(encounterAchievement, spec.circle ? "Joined a geometrical teaching circle" : `Entered ${spec.name}'s working circle`, spec.circle ? "An authored route into Euclid's geometrical tradition around 300 BCE. A personal meeting with Euclid is not asserted." : `An authored encounter and working introduction at ${spec.location}. This is access to work, not a contribution rank or the figure's special title.`);
    addWork(`fig-${spec.id}-prepare`, `Prepare for ${spec.name}'s field through supervised practical study`, spec.primary, spec.supports, undefined, 2, 6, {}, [], 12);
    addWork(`fig-${spec.id}-encounter`, spec.circle ? "Join the geometrical teaching circle in Alexandria" : `Travel to and enter the working circle of ${spec.name}`, spec.primary, spec.supports, accessWindow, spec.location.includes("Athens") || spec.id === "lysippos" || spec.id === "pytheas" ? 20 : 8, 0, {}, [{ type: "accomplishment", achievement: encounterAchievement }]);
    let tradition: FigurePathDefinition["tradition"];
    if (spec.to !== undefined) {
      const fromYear = spec.to + 1;
      tradition = { fromYear, location: `Later schools, workshops and surviving accounts of ${spec.name}'s work`, activityId: `v-fig-${spec.id}-tradition`, achievementId: traditionAchievement };
      addAchievement(traditionAchievement, `Entered the tradition of ${spec.name}`, "The work is approached through a later school, workshop or historical account. This is not a posthumous personal meeting or endorsement.");
      addWork(`fig-${spec.id}-tradition`, `Study and join the continuing tradition of ${spec.name}`, spec.primary, spec.supports, all(year("gte", fromYear), notContact, spec.entry), 8, 0, {}, [{ type: "accomplishment", achievement: traditionAchievement }]);
    }
    const stages: FigurePathStage[] = [];
    const ranks = ["Uncommon", "Rare", "Epic"] as const;
    for (let index = 0; index < ranks.length; index++) {
      const rank = ranks[index], lower = rank.toLowerCase(), project = spec.stages[index], years = index + 1;
      const achievementId = `fig-${spec.id}-${lower}`, actionId = `fig-${spec.id}-work-${lower}`, activityId = `figure-${spec.id}-claim-${lower}`;
      const previous = index ? earned(stages[index - 1].achievementId) : contact;
      const requires = all(previous, contact, workCount(actionId, years), project.gate, absent(achievementId));
      addWork(actionId, project.work, spec.primary, spec.supports, all(previous, contact, project.gate, absent(achievementId)), project.fee, project.pay, project.inputs);
      addAchievement(achievementId, project.traditionTitle, `${project.description} The player-facing title depends on whether access was through direct contact or a later tradition.`, index === 0 ? "ordinary" : "prestige");
      world.character!.activities.push({ id: activityId, text: `Record the ${rank} contribution: ${project.title}`, category: "career", minAge: 18, usesYearlyActivity: false, when: requires, outcomes: [{ id: `${activityId}-accepted`, text: `${project.description} The completed projects are accepted as a ${rank} contribution; no principal figure title is granted by this association alone.`, weight: 1, effects: [{ type: "accomplishment", achievement: achievementId }] }] });
      stages.push({ rank, title: project.title, traditionTitle: project.traditionTitle, achievementId, activityId, workActionId: actionId, workYears: years, description: project.description, requires });
    }
    const capstoneAction = `fig-${spec.id}-capstone-work`, capstoneActivity = `figure-${spec.id}-claim-capstone`;
    const epic = stages[2].achievementId;
    addWork(capstoneAction, spec.capstone.work, spec.primary, spec.supports, all(earned(epic), spec.capstone.gate, absent(capstoneAchievement), ...(spec.id === "demetrius" ? [year("gte", -305), year("lte", -304)] : spec.id === "alexander" ? [year("lte", -323)] : [])), spec.capstone.fee, 0, spec.capstone.inputs);
    const campaignAttempt = `fig-${spec.id}-campaign-attempt`;
    const capstoneRequires = all(earned(epic), contact, workCount(capstoneAction, 2), spec.capstone.gate, absent(capstoneAchievement), ...(spec.id === "alexander" ? [earned(encounterAchievement), year("lte", -323), absent(campaignAttempt)] : []));
    if (spec.id === "alexander") addAchievement(campaignAttempt, "Strategic campaign resolved", "The completed strategic campaign has a recorded result. A failed operation earns no Alexander figure title and cannot be rerolled.", "prestige");
    const specialTitle = spec.id === "ptolemy" ? "Ptolemy I Soter" : spec.id === "zeno" ? "Zeno of Citium" : biography.title;
    addAchievement(capstoneAchievement, `Figure legacy: ${specialTitle}`, spec.capstone.description, "ultimate");
    world.character!.activities.push({ id: capstoneActivity, text: spec.id === "alexander" ? "Resolve the decisive campaign operation (success or failure; one attempt)" : `Submit the figure-defining work for ${specialTitle}`, category: "career", minAge: 18, usesYearlyActivity: false, when: capstoneRequires, outcomes: spec.id === "alexander" ? [
      { id: `${capstoneActivity}-accepted`, text: "The funded field operation secures its decisive objective and a workable strategic settlement. Your completed command and its actual result are recorded as a figure-defining campaign achievement.", weight: 3, effects: [{ type: "accomplishment", achievement: campaignAttempt }, { type: "accomplishment", achievement: capstoneAchievement }] },
      { id: `${capstoneActivity}-failed`, text: "The operation fails to secure its decisive objective. The campaign work and earlier contribution ranks remain recorded, but this result earns no Alexander figure title.", weight: 1, effects: [{ type: "accomplishment", achievement: campaignAttempt }] },
    ] : [{ id: `${capstoneActivity}-accepted`, text: `${spec.capstone.description} The completed work is entered into the figure-linked legacy record.`, weight: 1, effects: [{ type: "accomplishment", achievement: capstoneAchievement }] }] });
    const path: FigurePathDefinition = {
      id: spec.id, name: spec.name, summary: spec.summary, baseRank: rankPolicy.baseRank, maximumRank: rankPolicy.maximumRank,
      sources: biography.sources.map(source => ({ ...source })),
      encounter: { fromYear: spec.from, ...(spec.to === undefined ? {} : { toYear: spec.to }), location: spec.location, activityId: `v-fig-${spec.id}-encounter`, achievementId: encounterAchievement, ...(spec.circle ? { access: "circle" as const } : {}) },
      ...(tradition ? { tradition } : {}), stages,
      capstone: { title: specialTitle, achievementId: capstoneAchievement, activityId: capstoneActivity, description: spec.capstone.description, requires: capstoneRequires, ...(spec.id === "alexander" ? { attemptAchievementId: campaignAttempt } : {}) },
    };
    if (spec.id === "demetrius" || spec.id === "ptolemy" || spec.id === "zeno") {
      const promotionAchievement = `fig-${spec.id}-promotion`, attemptAchievement = `fig-${spec.id}-promotion-attempt`, activityId = `figure-${spec.id}-resolve-promotion`;
      const milestone = spec.id === "demetrius" ? "rhodes-captured" : spec.id === "ptolemy" ? "ptolemaic-dynasty-founded" : "stoic-school-established";
      const title = spec.id === "demetrius" ? "Demetrius, captor of Rhodes" : spec.id === "ptolemy" ? "Ptolemy I Soter, founder of the Ptolemaic dynasty" : "Zeno of Citium, founder of a Stoic school";
      const description = spec.id === "demetrius" ? "Resolve the funded assault on Rhodes. Capture is expressly alternate history; the historical negotiated settlement remains Epic." : spec.id === "ptolemy" ? "Resolve the establishment of independent hereditary government after funded administrative and continuity work. A royal claim or calendar date is not enough." : "Resolve the independently functioning Stoic school after three funded teaching years. The gate is the working interpretation of Zeno's possible Legendary case.";
      let extra: Condition = all(year("gte", -305), year("lte", -304));
      if (spec.id === "ptolemy" || spec.id === "zeno") {
        const years = spec.id === "ptolemy" ? 1 : 3, action = `fig-${spec.id}-promotion-work`;
        addWork(action, spec.id === "ptolemy" ? "Fund and carry out the independent government's founding and succession programme" : "Maintain a funded independent Stoic school and a continuing teaching programme", spec.primary, spec.supports, all(earned(capstoneAchievement), absent(attemptAchievement), year("gte", spec.id === "ptolemy" ? -305 : -300), ...(spec.id === "ptolemy" ? [year("lte", -304)] : [year("lte", -262)])), spec.id === "ptolemy" ? 120 : 20, 0, spec.id === "ptolemy" ? { papyrus: 4, ink: 3 } : { papyrus: 2, ink: 1 });
        extra = all(workCount(action, years), year("gte", spec.id === "ptolemy" ? -305 : -300), year("lte", spec.id === "ptolemy" ? -304 : -262), ...(spec.id === "zeno" ? [skill("philosophy", 80), skill("oratory", 64)] : []));
      }
      addAchievement(attemptAchievement, spec.id === "demetrius" ? "Rhodes campaign resolved" : spec.id === "ptolemy" ? "Dynastic founding resolved" : "Independent school founding resolved", "The founding or campaign attempt has a recorded outcome. An attempt or failed outcome does not award the Legendary milestone.", "prestige");
      addAchievement(promotionAchievement, title, description, "ultimate");
      const when = all(earned(capstoneAchievement), earned(encounterAchievement), absent(attemptAchievement), extra);
      world.character!.activities.push({ id: activityId, text: spec.id === "demetrius" ? "Resolve the Rhodes assault (alternate-history capture or historical settlement; one attempt)" : spec.id === "ptolemy" ? "Resolve the Ptolemaic dynasty's founding (success or failure; one attempt)" : "Resolve the independent Stoic school's establishment (success or failure; one attempt)", category: "career", minAge: 18, usesYearlyActivity: false, when, outcomes: [
        { id: `${activityId}-succeeded`, text: spec.id === "demetrius" ? "Alternate history: the funded siege operation captures Rhodes. The successful capture is recorded; this is not the historical negotiated settlement." : spec.id === "ptolemy" ? "The funded founding programme establishes an independent hereditary government with a working succession arrangement. The Ptolemaic dynasty is founded; no centuries of future rule are claimed as the player's work." : "The funded school maintains its teaching, students and independent programme. A functioning Stoic school has been established; this is more than announcing an intention.", weight: 3, effects: [{ type: "accomplishment", achievement: attemptAchievement }, { type: "accomplishment", achievement: promotionAchievement }] },
        { id: `${activityId}-failed`, text: spec.id === "demetrius" ? "The assault fails to capture Rhodes and ends in a negotiated settlement, as in the historical outcome. Engineering achievements remain recorded; the figure's rank stays Epic." : spec.id === "ptolemy" ? "The founding programme fails to secure the required independence and succession settlement. Administrative work remains recorded, but no Ptolemaic dynasty milestone or Legendary rank is awarded." : "The school fails to sustain an independent programme. Ethical work and teaching remain recorded, but a functioning-school milestone and Legendary rank are not awarded.", weight: 1, effects: [{ type: "accomplishment", achievement: attemptAchievement }] },
      ] });
      path.promotion = { achievementId: promotionAchievement, activityId, attemptAchievementId: attemptAchievement, milestone, title, alternateHistory: spec.id === "demetrius", ...(spec.id === "zeno" ? { provisional: true } : {}) };
    }
    world.figurePaths.push(path);
    world.legacy!.routes.push({ id: routeId, title: `${spec.name}: work and legacy`, description: spec.summary, skillIds: [...new Set([spec.primary, ...spec.supports])], jobIds: [], achievementIds, stages: [
      ...stages.map(stage => ({ title: `${stage.rank} contribution`, achievementIds: [stage.achievementId] })),
      { title: "Figure-defining work", achievementIds: [capstoneAchievement] },
      ...(path.promotion ? [{ title: "Conditional Legendary outcome", achievementIds: [path.promotion.achievementId, `fig-${spec.id}-promotion-attempt`] }] : []),
    ] });
    // Story decisions support development but never replace work counts or confer a figure title.
    world.events.push({
      id: `fig-story-${spec.id}-first-contribution`, title: `What makes useful work for ${spec.name}?`,
      text: `${spec.summary} The working circle asks you to retain the reasons, costs and revisions behind your contribution, rather than rely on the prestige of the name.`,
      trigger: { type: "random", weight: 3 }, maxOccurrences: 1, when: all(contact, absent(stages[1].achievementId)),
      evidence: "historically-inspired", sourceIds: [sourceId], choices: [
        { id: `fig-story-${spec.id}-retain`, text: "Keep a clear record and invite criticism", outcomes: [{ id: `fig-story-${spec.id}-retain-result`, text: "You improve the record and identify the next work that needs doing. The clearer notes give the next season of work a useful starting point.", weight: 1, effects: [{ type: "skill", skill: spec.primary, delta: 1 }, { type: "stat", stat: "knowledge", delta: 1 }] }] },
        { id: `fig-story-${spec.id}-share`, text: "Ask the other workers to compare their experience", outcomes: [{ id: `fig-story-${spec.id}-share-result`, text: "Comparing experience builds trust and exposes a point worth checking in your next actual work year.", weight: 1, effects: [{ type: "skill", skill: spec.supports[0], delta: 1 }, { type: "stat", stat: "bonds", delta: 1 }] }] },
      ],
    });
    world.events.push({
      id: `fig-story-${spec.id}-credit`, title: `Credit and responsibility in ${spec.name}'s tradition`,
      text: "Your completed contributions now attract attention. A collaborator asks which claims belong to the historical tradition, which results you actually delivered, and which uncertainties remain. A famous name does not settle those questions.",
      trigger: { type: "random", weight: 2 }, maxOccurrences: 1, when: earned(stages[1].achievementId),
      evidence: "historically-inspired", sourceIds: [sourceId], choices: [
        { id: `fig-story-${spec.id}-credit-workers`, text: "Credit the workers and state the limits of the evidence", outcomes: [{ id: `fig-story-${spec.id}-credit-workers-result`, text: "The record distinguishes your completed work from earlier achievements and uncertain claims. The collaborators can now see which result rests on which season of work.", weight: 1, effects: [{ type: "stat", stat: "bonds", delta: 2 }, { type: "skill", skill: spec.supports[1], delta: 1 }] }] },
        { id: `fig-story-${spec.id}-recheck`, text: "Recheck the result before presenting it", outcomes: [{ id: `fig-story-${spec.id}-recheck-result`, text: "You identify a weak claim and plan a more careful check. You leave a specific question for the next review.", weight: 1, effects: [{ type: "stat", stat: "knowledge", delta: 2 }, { type: "skill", skill: spec.primary, delta: 1 }] }] },
      ],
    });
  }
  if (world.lifeStages) {
    const firstWork = world.lifeStages.stages.findIndex(stage => stage.id === world.lifeStages!.scopes.work);
    for (const event of world.events) if (event.id.startsWith("fig-story-")) {
      event.stages = world.lifeStages.stages.slice(Math.max(0, firstWork)).map(stage => stage.id);
      event.scope = "work";
    }
  }
  return world;
}
