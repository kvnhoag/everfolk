/**
 * Late life after mastery, for the free-play world only: a master's funded work, students and offices,
 * passing the craft on, and events of the era by career, dated on the game's calendar (negative = BCE).
 * Every payment is drawn from a finite account (a vocation account or the army purse) and the offer is
 * hidden when that account cannot fund it. Land is a household plot, never goods or cash.
 */
import type { Condition, Effect, LifeEvent } from "../../types.ts";
import { MILITARY_QUALIFICATIONS } from "../../capabilities/military.ts";
import { CHILD_FROM, CHILD_TO } from "../late-life.ts";
import type { AccountId, FieldId } from "../types.ts";
import { buildDecision } from "./needs.ts";

/** Calendar windows (year, negative = BCE). The Museum and Library were founded about 290-280 BCE under Ptolemy I and II. */
export const ERA = {
  museum: { from: -290, to: -275 },
  library: { from: -285, to: -270 },
  /** Cleruchs: soldiers settled on crown land, from Ptolemy I's reign as king. */
  cleruch: { from: -305, to: -260 },
  /** Crown and temple land held by lease, with rent in grain. */
  land: { from: -300, to: -250 },
  /** Royal licence over oil and linen, formalised under Ptolemy II. */
  monopoly: { from: -285, to: -240 },
  /** The lighthouse on Pharos island, built about 299-280 BCE. */
  pharos: { from: -297, to: -278 },
} as const;

const SKILL: Record<FieldId, string> = { farming: "farming", clothing: "craft", ceramics: "pottery", sculpture: "sculpture", research: "philosophy", civic: "oratory", trade: "reckoning", soldiering: "warfare" };
const STAGES = ["adulthood", "later-life"];
const ARMY_FLOOR = 1500;

const learned = (node: string): Condition => ({ type: "capability", node });
const flag = (name: string, value: boolean): Condition => ({ type: "flag", flag: name, value });
const funded = (account: AccountId, amount: number): Condition => ({ type: "account", account, op: "gte", value: account === "army" ? Math.max(amount, ARMY_FLOOR) : amount });
const between = ({ from, to }: { from: number; to: number }): Condition[] => [{ type: "year", op: "gte", value: from }, { type: "year", op: "lte", value: to }];
const all = (...conditions: Condition[]): Condition => ({ type: "all", conditions: conditions.flat() as Condition[] });
const pull = (field: FieldId, delta: number, source: string): Effect => ({ type: "affinity", field, delta, source });
const skill = (id: string, delta: number): Effect => ({ type: "skill", skill: id, delta });
const standing = (delta: number): Effect => ({ type: "demo", effect: { kind: "reputation", delta } } as Effect);
const bonds = (delta: number): Effect => ({ type: "stat", stat: "bonds", delta });
const pay = (account: AccountId, amount: number, cause: string): Effect => ({ type: "account-pay", account, amount, cause });
const demo = (effect: object): Effect => ({ type: "demo", effect } as Effect);

interface Master {
  prefix: string; field: FieldId; payer: AccountId; fee: number; people: string;
  commission: { text: string; result: string };
  students: { text: string; result: string };
  office: { title: string; text: string; result: string };
  successor: string;
}

const MASTERS: Master[] = [
  { prefix: "FC", field: "farming", payer: "merchant", fee: 60, people: "growers",
    commission: { text: "Grain dealers and an estate steward want someone who knows the soil to walk the fields before sowing and say which plots will bear. They will pay for the advice.", result: "You walk the plots with the steward and name the ones that will bear. The fee is counted out." },
    students: { text: "Families with land ask whether you would teach their sons your way of sowing for a season. They offer a fee.", result: "The boys follow you down the furrows until they can sow a straight line. Their families pay the fee." },
    office: { title: "Keeper of the channel shares", text: "The village asks you to keep the roll of channel shares and settle who clears which stretch. The post carries a small stipend.", result: "You keep the roll, and the channels are cleared on time. The stipend is paid." },
    successor: "Your plots have fed the household for years, and someone should know how you read them. You could teach the whole of it to one person." },
  { prefix: "FR", field: "farming", payer: "council", fee: 50, people: "growers",
    commission: { text: "The district keeps a common granary, and its keepers want a grower who can say how much to hold back against a low flood. They pay a fee for the reckoning.", result: "You count the stores against the worst floods you remember. The keepers pay for the reckoning." },
    students: { text: "Younger households ask you to show them how to keep stores through a lean year, and offer a fee.", result: "You show them the jars, the seals and the counting. They pay what they promised." },
    office: { title: "Keeper of the common granary", text: "The elders offer you the keys to the common granary. The post carries a small stipend from the common chest.", result: "You take the keys, and the granary is kept honestly. The stipend is paid." },
    successor: "You have kept your stores through floods that emptied others. You could pass the whole method to one person you trust." },
  { prefix: "AT", field: "clothing", payer: "workshop", fee: 60, people: "weavers",
    commission: { text: "A cloth merchant has an order too fine for his own looms. He will pay you to weave it and to show his weavers the pattern.", result: "You weave the order to the last thread and show the pattern. The merchant pays in full." },
    students: { text: "Two girls from the weavers' street are sent to learn at your loom, and their families will pay for it.", result: "The girls learn to set a warp and to see a fault in the cloth. Their families pay the fee." },
    office: { title: "Inspector of cloth", text: "The cloth merchants ask you to inspect every bolt before it is sold on. The post carries a stipend.", result: "You pass the good cloth and refuse the poor. The stipend is paid." },
    successor: "Your cloth is known by hand and by eye. Soon no one will weave quite like you, unless you teach one person all of it." },
  { prefix: "AC", field: "ceramics", payer: "workshop", fee: 70, people: "potters",
    commission: { text: "A workshop master is short of a steady hand for a large order of fine tableware. He will pay a master's fee for your wheel.", result: "You throw and fire the order, and not a vessel is lost. The workshop pays the fee." },
    students: { text: "Potters in the quarter send their boys to learn the wheel from you for a season, and pay for it.", result: "The boys centre their first clay before the season is out. Their fathers pay the fee." },
    office: { title: "Warden of the potters' quarter", text: "The potters ask you to hold the keys to the common kiln and to settle who fires when. The post carries a stipend.", result: "The kiln is fired in turn and no one complains. The stipend is paid." },
    successor: "Your vessels are copied, yet the copies lack something. You could teach one person the whole of the craft." },
  { prefix: "AS", field: "sculpture", payer: "workshop", fee: 90, people: "sculptors",
    commission: { text: "A temple builder wants a carved relief for a courtyard wall and will pay a master's fee for it.", result: "You carve the relief over the season and set it in its wall. The builder pays in full." },
    students: { text: "A carvers' yard sends its young hands to work under you for a season, and pays for the teaching.", result: "The young carvers learn to read the grain of the stone. The yard pays the fee." },
    office: { title: "Master of the yard", text: "The stone yard asks you to direct its carvers and judge their work. The post carries a stipend.", result: "You direct the yard, and its work is admired. The stipend is paid." },
    successor: "Your figures stand in places many pass each day. When your hands tire, someone should hold your tools." },
  { prefix: "PS", field: "research", payer: "school", fee: 80, people: "scholars",
    commission: { text: "A wealthy household asks you to cast a calendar for the year and check the steward's reckoning. The fee comes from the teaching fund.", result: "You cast the calendar and find the error in the reckoning. The fee is paid." },
    students: { text: "Families ask you to take their sons and teach them to reason and to observe. They offer fees.", result: "The students copy your notes and learn to question them. Their fees are paid." },
    office: { title: "Reader to the court", text: "Someone near the court asks you to read and answer questions for the household of the court each season. The post carries a stipend.", result: "You read, and you are questioned, and you answer. The stipend is paid." },
    successor: "Your method lives in your notes and in your habits. A student who learned both could carry it further than you can." },
  { prefix: "PP", field: "civic", payer: "council", fee: 60, people: "officials",
    commission: { text: "Two landholders cannot agree on a boundary, and the district asks you to settle it. The fee is paid from the common chest.", result: "You hear both sides and mark the boundary. The common chest pays your fee." },
    students: { text: "Young clerks ask you to teach them how to prepare a hearing and keep an honest record, and offer a fee.", result: "The clerks learn to set out a case so a stranger could follow it. They pay the fee." },
    office: { title: "Recorder of the district", text: "The district asks you to keep its record of disputes and decrees. The post carries a stipend.", result: "The record is kept, and no one can say a decree was lost. The stipend is paid." },
    successor: "People bring their disputes to you before any office. There is a way you hear them, and it could be taught." },
  { prefix: "T", field: "trade", payer: "merchant", fee: 80, people: "traders",
    commission: { text: "A trading house wants a reckoner it trusts to read the harbour and set prices for a season's cargoes. It will pay a fee.", result: "You read the harbour and set the prices, and the cargoes move. The house pays your fee." },
    students: { text: "Young porters and clerks ask to be taught how a price is set, and offer a fee.", result: "They learn to weigh, count and haggle without being cheated. They pay the fee." },
    office: { title: "Assessor of the harbour dues", text: "The harbour asks you to assess the dues on every cargo, fairly. The post carries a stipend.", result: "The dues are fair, and traders stop arguing. The stipend is paid." },
    successor: "Your word settles prices. You could teach one person how you reckon, so that the habit outlasts you." },
  { prefix: "M", field: "soldiering", payer: "army", fee: 70, people: "soldiers",
    commission: { text: "The officers ask a master to drill a company before the season's march. The fee is paid from the army purse.", result: "You drill the company until it moves as one. The army purse pays the fee." },
    students: { text: "Young soldiers are sent to learn from you for a season, and the army will pay for the teaching.", result: "The young soldiers learn to hold a line and to keep their heads. The army pays the fee." },
    office: { title: "Master of drill", text: "The garrison asks you to take charge of its drill ground. The post carries a stipend from the army purse.", result: "The drill ground is yours, and the company is steady. The stipend is paid." },
    successor: "Your drill is steady, and the soldiers know it. Someone could learn to keep the line the way you do." },
];

/** A master's funded commission, recurring at most three times, four years apart. Anchored: offered as soon as its cause holds. */
function commission(master: Master): LifeEvent {
  const { prefix, field } = master;
  return buildDecision({ id: `late-commission-${prefix.toLowerCase()}`, title: "Work for a master", ...master.commission, fields: [field], stages: STAGES, scope: "work", max: 3, cooldown: 4, anchor: true,
    when: all(learned(`${prefix}10`), funded(master.payer, master.fee)),
    choices: [
      { key: "accept", text: "Take the work", result: master.commission.result,
        effects: [pay(master.payer, master.fee, "a master's fee"), skill(SKILL[field], 1), standing(1), pull(field, 3, "a master's commission")] },
      { key: "decline", text: "You have no time this year", result: "You send word that your hands are full.", effects: [] },
    ] });
}

/** Students and their fees, drawn from the teaching fund. */
function students(master: Master): LifeEvent {
  const { prefix, field } = master, fee = 30;
  const account: AccountId = field === "soldiering" ? "army" : "school";
  return buildDecision({ id: `late-students-${prefix.toLowerCase()}`, title: "Students", ...master.students, fields: [field], stages: STAGES, scope: "work", max: 2, cooldown: 5, anchor: true,
    when: all(learned(`${prefix}10`), funded(account, fee)),
    choices: [
      { key: "teach", text: "Take them on for a season", result: master.students.result,
        effects: [pay(account, fee, "fees for teaching"), standing(1), bonds(1), pull(field, 5, `teaching other ${master.people}`)] },
      { key: "decline", text: "Keep to your own work", result: "You keep your season for your own work.", effects: [] },
    ] });
}

/** An office with a stipend, held once. */
function office(master: Master): LifeEvent {
  const { prefix, field } = master, stipend = 40, account: AccountId = field === "soldiering" ? "army" : "council";
  return buildDecision({ id: `late-office-${prefix.toLowerCase()}`, title: master.office.title, text: master.office.text, fields: [field], stages: STAGES, scope: "work", max: 1, anchor: true,
    when: all(learned(`${prefix}10`), { type: "age", op: "gte", value: 45 }, funded(account, stipend)),
    choices: [
      { key: "accept", text: "Accept the post", result: master.office.result,
        effects: [pay(account, stipend, `the stipend of ${master.office.title.toLowerCase()}`), standing(2), bonds(1), pull(field, 8, `holding office among other ${master.people}`)] },
      { key: "decline", text: "Decline and keep working", result: "You send your thanks and keep to your own work.", effects: [] },
    ] });
}

/** Training a child or an apprentice as successor; recorded on the life, once someone carries the craft. */
function successor(master: Master): LifeEvent {
  const { prefix, field } = master;
  const carried = `passed-on-${field}`;
  const record = (relation: "child" | "apprentice"): Effect[] => [
    { type: "successor", field, relation, cause: `taught the ${master.people}' craft` },
    skill(SKILL[field], 1), standing(2), pull(field, 5, `passing the craft to a ${relation}`), { type: "flag", flag: carried, value: true },
  ];
  return buildDecision({ id: `late-successor-${prefix.toLowerCase()}`, title: "Who will carry it on", text: master.successor, fields: [field], stages: STAGES, scope: "work", max: 2, cooldown: 5, anchor: true,
    when: all(learned(`${prefix}10`), { type: "age", op: "gte", value: 50 }, flag(carried, false)),
    choices: [
      { key: "child", text: "Teach it to a child of yours", when: { type: "child-age", min: CHILD_FROM, max: CHILD_TO },
        result: "You teach a little each season, and the child learns to do it your way and then a little better.", effects: record("child") },
      { key: "apprentice", text: "Take an apprentice and teach them everything", result: "You teach all of it, the parts you never wrote down as well. Someone will carry the craft on.", effects: record("apprentice") },
      { key: "keep", text: "It is not yet time", result: "You keep your craft to yourself for now.", effects: [] },
    ] });
}

interface Era {
  id: string; title: string; text: string; fields: FieldId[]; when: Condition; scope?: "work" | "household";
  max?: number; cooldown?: number;
  accept: { text: string; result: string; effects: Effect[] };
  decline: { text: string; result: string; effects?: Effect[] };
}

const era = (spec: Era): LifeEvent => buildDecision({ id: spec.id, title: spec.title, text: spec.text, fields: spec.fields, stages: STAGES, scope: spec.scope ?? "work",
  when: spec.when, max: spec.max ?? 1, cooldown: spec.cooldown ?? 4, anchor: true,
  choices: [{ key: "accept", ...spec.accept }, { key: "decline", text: spec.decline.text, result: spec.decline.result, effects: spec.decline.effects ?? [] }] });

const SERVING: Condition = { type: "any", conditions: [{ type: "job", job: "soldier" }, { type: "job", job: "officer" }, { type: "job", job: "general" }] };
const plots = (op: "lte" | "gte", value: number): Condition => ({ type: "demo", condition: { kind: "plots", op, value } } as Condition);
const grain = (value: number): Condition => ({ type: "demo", condition: { kind: "item", item: "grain", op: "gte", value } } as Condition);
const heads: Condition = { type: "demo", condition: { kind: "head-of-plot", value: true } } as Condition;

const ERAS: Era[] = [
  { id: "era-museum-scholar", title: "A place at the Museum", fields: ["research"], max: 1,
    text: "The king is gathering scholars into a new house of the Muses beside the palace, to be kept at his expense. Word reaches you that those known for careful work are being asked.",
    when: all(learned("PS8"), ...between(ERA.museum), funded("council", 90)),
    accept: { text: "Take a place among them", result: "You are given a seat, a table and a stipend, and you sit with scholars from other lands.",
      effects: [pay("council", 90, "a stipend from the royal house of the Muses"), skill("philosophy", 2), standing(2), pull("research", 10, "the king's gathering of scholars")] },
    decline: { text: "Stay with your own work", result: "You send thanks and keep to your own table." } },
  { id: "era-museum-steward", title: "Stewards for the new house", fields: ["civic"], max: 1,
    text: "The new house of the Muses and the great collection of books need people who can keep accounts, receive supplies and answer the king's questions. Officials of good name are being asked.",
    when: all(learned("PP8"), ...between(ERA.museum), funded("council", 70)),
    accept: { text: "Serve as a steward", result: "You keep the accounts of a house that is only now taking shape, and you are paid from the royal chest.",
      effects: [pay("council", 70, "a steward's pay from the royal house"), skill("oratory", 1), standing(2), pull("civic", 10, "serving the royal house")] },
    decline: { text: "Stay in your district", result: "You send thanks and keep your own office." } },
  { id: "era-library-copyists", title: "Copyists for the great collection", fields: ["research", "civic"], max: 2, cooldown: 4,
    text: "The king wants the books of every land gathered and copied. The collection is paying for careful hands that can read and copy without error.",
    when: all({ type: "any", conditions: [learned("PS5"), learned("PP5")] }, ...between(ERA.library), funded("school", 40)),
    accept: { text: "Take up the copying", result: "You copy a roll through the season without a slip, and the keeper pays from the collection's fund.",
      effects: [pay("school", 40, "copying for the great collection"), skill("literacy", 2), standing(1), pull("research", 5, "copying for the great collection")] },
    decline: { text: "Not this season", result: "You leave the copying to others." } },
  { id: "era-cleruch-serving", title: "Land for those who serve", fields: ["soldiering"], scope: "household", max: 1,
    text: "The king is settling serving soldiers on crown land: a plot to hold while they stay on the rolls, in place of coin they would be owed. Your name is on the list.",
    when: all(SERVING, ...between(ERA.cleruch), plots("lte", 3), flag("cleruch-allotment", false)),
    accept: { text: "Take the allotment for the household", result: "A scribe walks you to the boundary stones. The household now holds one more plot, and owes the crown your service for it.",
      effects: [demo({ kind: "plot", delta: 1, cause: "a cleruch's allotment of crown land" }), { type: "flag", flag: "cleruch-allotment", value: true }, standing(1), pull("soldiering", 5, "an allotment for serving soldiers")] },
    decline: { text: "Wait for a posting", result: "You tell the scribe you would rather wait.", effects: [] } },
  { id: "era-cleruch-veteran", title: "Land for a veteran", fields: ["soldiering"], scope: "household", max: 1,
    text: "Men who served and were discharged are being given crown land to settle on, so that the king can call on them again. The scribes have your service on their rolls.",
    when: all({ type: "any", conditions: [flag("army-service", true), learned(MILITARY_QUALIFICATIONS.officer)] }, { type: "not", condition: SERVING }, ...between(ERA.cleruch),
      plots("lte", 3), flag("cleruch-allotment", false), { type: "age", op: "gte", value: 35 }),
    accept: { text: "Accept a veteran's allotment", result: "You are shown your plot and the stones that bound it. The household now holds one more plot, and the crown may call on you again.",
      effects: [demo({ kind: "plot", delta: 1, cause: "a veteran's allotment of crown land" }), { type: "flag", flag: "cleruch-allotment", value: true }, standing(1), pull("soldiering", 5, "a veteran's allotment")] },
    decline: { text: "Stay as you are", result: "You thank the scribe and stay where you are." } },
  { id: "era-royal-land-lease", title: "Crown land to lease", fields: ["farming"], scope: "household", max: 1,
    text: "A royal scribe is measuring crown land along the channel and offering it on lease to growers who can work it. The rent is a share of the harvest, and the first season's seed is to be repaid in grain.",
    when: all(learned("FC5"), ...between(ERA.land), heads, plots("lte", 3), grain(250), flag("crown-lease", false)),
    accept: { text: "Lease a plot and give the first grain", result: "You sign the lease and hand over the first grain into the royal granary. The household has another plot to sow.",
      effects: [demo({ kind: "plot", delta: 1, cause: "a lease of crown land" }), demo({ kind: "grain-to", to: "crown", quantity: 120, cause: "the first season's seed repaid to the crown" }),
        { type: "flag", flag: "crown-lease", value: true }, pull("farming", 5, "leasing crown land")] },
    decline: { text: "You have enough land to work", result: "You tell the scribe you have all the land you can work." } },
  { id: "era-royal-rent-due", title: "The crown's share is due", fields: ["farming"], scope: "household", max: 3, cooldown: 5,
    text: "The scribe comes to count the harvest of the crown plot. The crown's share is a measure of grain, due before the next sowing.",
    when: all(flag("crown-lease", true), ...between(ERA.land), heads, grain(100)),
    accept: { text: "Pay the crown its share in grain", result: "The scribe counts the grain into the royal granary and marks it paid.",
      effects: [demo({ kind: "grain-to", to: "crown", quantity: 80, cause: "the crown's share of the harvest" }), standing(1)] },
    decline: { text: "Plead a poor year and ask to wait", result: "The scribe writes down the arrears, and the neighbours notice who asked to wait.", effects: [standing(-2), bonds(-1)] } },
  { id: "era-temple-land-lease", title: "Temple land to farm", fields: ["farming"], scope: "household", max: 1,
    text: "The temple steward has strips of the god's land lying idle. Tenants pay a share of the harvest to the god's store, and are expected to help on festival days.",
    when: all(learned("FR5"), ...between(ERA.land), heads, plots("lte", 3), grain(200), flag("temple-lease", false)),
    accept: { text: "Take a strip and give the god's share", result: "You agree to the share and to the festival days. The household has another plot to sow.",
      effects: [demo({ kind: "plot", delta: 1, cause: "a lease of temple land" }), demo({ kind: "grain-to", to: "temple", quantity: 60, cause: "the god's share on taking a temple lease" }),
        { type: "flag", flag: "temple-lease", value: true }, bonds(1), pull("farming", 5, "farming temple land")] },
    decline: { text: "Leave it to others", result: "You say that you have land enough." } },
  { id: "era-royal-linen", title: "Linen under the royal licence", fields: ["clothing"], max: 3, cooldown: 4,
    text: "The crown has put linen weaving under licence: only licensed looms may sell it, and the royal workshop buys what it needs at a fixed price. A licence-holder asks you to weave for him.",
    when: all(learned("AT5"), ...between(ERA.monopoly), funded("workshop", 60)),
    accept: { text: "Weave under the licence", result: "You weave the royal order at the fixed price. It is less than a free sale might fetch, but it is certain.",
      effects: [pay("workshop", 60, "the royal workshop's fixed price for linen"), skill("craft", 2), standing(1), pull("clothing", 3, "weaving under the royal licence")] },
    decline: { text: "Keep to private customers", result: "You keep to the customers who ask for you by name." } },
  { id: "era-royal-oil", title: "Jars for the royal oil", fields: ["ceramics"], max: 3, cooldown: 4,
    text: "Oil is now pressed under the crown's licence and sold at the crown's price. The licensed presses need many sound jars and will pay for them.",
    when: all(learned("AC5"), ...between(ERA.monopoly), funded("workshop", 70)),
    accept: { text: "Make jars for the presses", result: "You fire a long line of identical jars and the press-keeper pays the set price.",
      effects: [pay("workshop", 70, "the licensed presses' price for oil jars"), skill("pottery", 2), standing(1), pull("ceramics", 3, "jars for the royal oil")] },
    decline: { text: "Keep to finer work", result: "You keep to your own finer work." } },
  { id: "era-pharos-stone", title: "Stone for the great lighthouse", fields: ["sculpture"], max: 2, cooldown: 4,
    text: "On the island of Pharos the king's builders are raising a great lighthouse for the harbour. They need carvers for the blocks and the figures on its tiers.",
    when: all(learned("AS5"), ...between(ERA.pharos), funded("council", 90)),
    accept: { text: "Carve for the lighthouse", result: "You carve blocks and a figure for the island, and the royal builders pay you from the works' account.",
      effects: [pay("council", 90, "carving for the lighthouse on Pharos"), skill("sculpture", 2), standing(2), pull("sculpture", 5, "carving for the lighthouse")] },
    decline: { text: "Not for the island", result: "You stay in your own yard." } },
  { id: "era-royal-licence-trade", title: "Agents for the licensed trades", fields: ["trade"], max: 3, cooldown: 4,
    text: "Oil and linen are now sold under the crown's licence, and each licensed seller must reckon the crown's share. The houses want agents who can keep those accounts straight.",
    when: all(learned("T5"), ...between(ERA.monopoly), funded("merchant", 80)),
    accept: { text: "Act as an agent for a licensed house", result: "You keep the crown's share apart from the house's, to the last measure, and the house pays you well.",
      effects: [pay("merchant", 80, "an agent's fee from a licensed house"), skill("reckoning", 2), standing(1), pull("trade", 3, "reckoning the crown's share")] },
    decline: { text: "Stay with your own trade", result: "You stay with your own dealings." } },
];

/** Flags these events set, for the world's flag list. */
export function lateLifeFlags(): Record<string, { label: string; initial: false }> {
  const flags: Record<string, string> = {
    "cleruch-allotment": "Holds a cleruch's allotment of crown land", "crown-lease": "Leases crown land", "temple-lease": "Leases temple land",
  };
  for (const master of MASTERS) flags[`passed-on-${master.field}`] = `Passed the ${master.field} craft on`;
  return Object.fromEntries(Object.entries(flags).map(([id, label]) => [id, { label, initial: false as const }]));
}

export function lateLifeEvents(): LifeEvent[] {
  // Dated events come first: an anchor is offered in list order, and an era window is short.
  return [...ERAS.map(era), ...MASTERS.flatMap(master => [commission(master), students(master), office(master), successor(master)])];
}
