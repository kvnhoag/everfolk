import { displayProse } from "./display-prose.ts";
import type { CharacterActivity, Effect, EvidenceKind, JournalEntry, LifeEvent, LifeState, Outcome, WorldPack } from "../src/types.ts";
import { ALEXANDRIA_VARIETY_VISUALS } from "./alexandria-variety-visuals.ts";
import { personText } from "../src/people.ts";
import currentWorld from "../worlds/alexandria-sample.json" with { type: "json" };

export const SCENE_IDS = ["birth", "childhood", "learning", "work", "sea", "family", "later-life", "memorial", "rest", "history-war", "history-city", "music"] as const;
export type SceneId = typeof SCENE_IDS[number];
export const MOTION_IDS = ["cradle", "play", "write", "work", "sail", "gather", "reflect", "still", "rest", "unrest", "city"] as const;
export type MotionId = typeof MOTION_IDS[number];
export interface EventVisual { scene: SceneId; motion: MotionId; caption?: string }
export type EventVisuals = Record<string, EventVisual>;
export const DEFAULT_MOTIONS: Record<SceneId, MotionId> = {
  birth: "cradle", childhood: "play", learning: "write", work: "work", sea: "sail", family: "gather",
  "later-life": "reflect", memorial: "still", rest: "rest", "history-war": "unrest", "history-city": "city", music: "gather",
};

export const sceneOptions = [
  { value: "birth", label: "Birth and care" }, { value: "childhood", label: "Childhood" },
  { value: "learning", label: "Learning and writing" }, { value: "work", label: "Work and craft" },
  { value: "sea", label: "Life at sea" }, { value: "family", label: "Family and company" },
  { value: "later-life", label: "Later life" }, { value: "memorial", label: "Remembrance" },
  { value: "rest", label: "Rest and illness" }, { value: "history-war", label: "War and disruption" },
  { value: "history-city", label: "The changing city" },
  { value: "music", label: "Music and performance" },
] satisfies { value: SceneId; label: string }[];
export const motionOptions = [
  { value: "cradle", label: "Gentle cradle" }, { value: "play", label: "Play and discovery" },
  { value: "write", label: "Writing" }, { value: "work", label: "Working" },
  { value: "sail", label: "Sailing and waves" }, { value: "gather", label: "Company" },
  { value: "reflect", label: "Quiet reflection" }, { value: "still", label: "Still" },
  { value: "rest", label: "Resting" }, { value: "unrest", label: "Unsettled city" }, { value: "city", label: "City life" },
] satisfies { value: MotionId; label: string }[];

export const sceneDefinitions: Record<SceneId, { file: string; title: string; caption: string; alt: string; defaultMotion: MotionId }> = {
  birth: { file: "birth", title: "A newborn at home.", caption: "Your household takes care of you.", alt: "Pixel artwork of a newborn and caregiver in an ancient Egyptian household", defaultMotion: "cradle" },
  childhood: { file: "childhood", title: "Playing in the courtyard.", caption: "You play with other children near home.", alt: "Pixel artwork of children in an ancient coastal courtyard", defaultMotion: "play" },
  learning: { file: "learning", title: "Something to learn.", caption: "There is time to watch, practise and ask a question.", alt: "Pixel artwork of a young learner with a teacher and tablet", defaultMotion: "write" },
  work: { file: "work", title: "At work.", caption: "You work, run errands and help with daily tasks.", alt: "Pixel artwork of a craft worker at a workbench", defaultMotion: "work" },
  sea: { file: "sea", title: "Aboard a merchant ship.", caption: "You work with the crew and travel between ports.", alt: "Pixel artwork of a sailor aboard an ancient merchant ship", defaultMotion: "sail" },
  family: { file: "family", title: "At home with family.", caption: "You eat, talk and do chores together.", alt: "Pixel artwork of an ancient household sharing company", defaultMotion: "gather" },
  "later-life": { file: "later-life", title: "Later life.", caption: "You spend time at home and visit people you know.", alt: "Pixel artwork of an older person in familiar company", defaultMotion: "reflect" },
  memorial: { file: "memorial", title: "Life ended.", caption: "The cause of death and life record are shown below.", alt: "Quiet pixel memorial still life with an olive branch and lamp", defaultMotion: "still" },
  rest: { file: "rest", title: "Time to rest.", caption: "You take a break while someone helps with the chores.", alt: "Pixel artwork of a quiet resting place and household care", defaultMotion: "rest" },
  "history-war": { file: "history-war", title: "A city unsettled.", caption: "Events beyond your household are changing the city around you.", alt: "Pixel artwork of an ancient harbor unsettled by war, without graphic violence", defaultMotion: "unrest" },
  "history-city": { file: "history-city", title: "The city around you.", caption: "Work, neighbors and changing arrangements fill the streets.", alt: "Pixel artwork of an ancient Alexandrian street and changing civic life", defaultMotion: "city" },
  music: { file: "music", title: "Music in the courtyard.", caption: "You practise an agreed repertoire and perform with other musicians.", alt: "Pixel artwork of a musician playing a lyre for a small courtyard audience", defaultMotion: "gather" },
};

const visual = (scene: SceneId, motion = DEFAULT_MOTIONS[scene]): EventVisual => ({ scene, motion });

/** Authored event IDs, not text matching, connect the shipped stories to their art. */
const ALL_ALEXANDRIA_EVENT_VISUALS: EventVisuals = Object.fromEntries([
  ...Object.entries(ALEXANDRIA_VARIETY_VISUALS),
  ...["sculpture", "philosophy", "seafaring", "military", "commerce", "astronomy-calendar", "music-performance"].flatMap(route => {
    const scene: SceneId = route === "sculpture" ? "work" : route === "philosophy" || route === "astronomy-calendar" ? "learning" : route === "seafaring" ? "sea" : route === "music-performance" ? "music" : "history-city";
    // Military callbacks may occur under Roman rule; they depict remembered
    // service/account work rather than inventing a renewed royal campaign.
    return ["prestige", "callback-1", "callback-2"].map(suffix => [`legacy-${route}-${suffix}`, visual(scene, route === "military" ? "gather" : DEFAULT_MOTIONS[scene])]);
  }),
  ["legacy-shared-cargo", visual("history-city", "work")],
  ["legacy-performance-passage", visual("sea", "sail")],
  ["credit-opportunity-sculpture", visual("work", "work")],
  ["credit-opportunity-philosophy", visual("learning", "write")],
  ["credit-opportunity-seafaring", visual("sea", "sail")],
  // Private equipment practice does not depict a battle or royal appointment.
  ["credit-opportunity-military", visual("history-city", "work")],
  ["credit-opportunity-commerce", visual("learning", "write")],
  ["credit-opportunity-astronomy-calendar", visual("learning", "write")],
  ["credit-opportunity-music-performance", visual("music", "gather")],
  ...["clay-animals", "echo-rhythm", "window-shadow", "cloth-loop", "shared-steps", "floating-reed", "unequal-portions", "puppet-voices"].map(id => [`child-route-care-${id}`, visual("childhood")]),
  ...["pattern-repair", "two-explanations", "cord-and-names", "ordered-figures", "counter-exchange", "shadow-marks", "missing-phrase", "measuring-cord"].map(id => [`child-route-learning-${id}`, visual("learning")]),
  ...["puppet-frame", "unequal-tasks", "vessel-packing"].map(id => [`child-route-training-${id}`, visual("work")]),
  ["child-route-training-two-day-lists", visual("learning")],
  ["child-route-wages-rehearsal-messages", visual("music")],
  ...["delivery-receipt", "bench-measures", "competing-records"].map(id => [`child-route-wages-${id}`, visual("work")]),
  ["child-route-work-ensemble-repertoire", visual("music")],
  ["child-route-work-merchant-and-crew", visual("history-city")],
  ["child-route-work-copy-explained", visual("learning")],
  ["child-route-work-checked-pattern", visual("work")],
  ...["unequal-sandals", "thread-shadow", "silent-entrance", "folded-reply", "reed-bridge", "pitcher-echo", "opposite-view", "waiting-hand", "false-bottom", "familiar-refrain", "long-cord", "old-correction"].map(id => [`child-memory-ambient-${id}`, visual("childhood")]),
  ...["sculpture", "philosophy", "seafaring", "military", "commerce", "astronomy-calendar", "music-performance"].map(route => [`early-interest-recalled-${route}`, visual(route === "sculpture" ? "work" : route === "seafaring" ? "sea" : route === "music-performance" ? "music" : route === "philosophy" || route === "astronomy-calendar" ? "learning" : "history-city")]),
  ...["rare-abduction", "rare-scaffold-collapse"].map(id => [id, visual("history-city", "unrest")]),
  ["rare-mistaken-cargo-theft", visual("history-city", "gather")],
  ["rare-lost-valuables", visual("history-city", "city")],
  ["rare-patron-test", visual("history-city", "gather")],
  ["rare-sailor-rescue", visual("sea", "sail")],
  ["rare-masterwork", visual("work", "work")],
  ["rare-applied-mastery", visual("work", "gather")],
  ...["rare-scholarly-mastery", "rare-knowledge-breakthrough"].map(id => [id, visual("learning", "write")]),
  ["rare-community-recognition", visual("history-city", "gather")],
  ...["early-care-market-morning", "early-care-visitors", "early-care-restless-afternoon"].map(id => [id, visual("childhood", "play")]),
  ...["early-learning-shop-marks", "early-learning-model-boat", "early-learning-clay-scrap"].map(id => [id, visual("childhood", "work")]),
  ...["early-training-merchants-list", "early-work-reader-introduction"].map(id => [id, visual("learning", "write")]),
  ...["early-training-repair-yard", "early-training-potters-bench", "early-wages-shop-help", "early-wages-kiln-order", "early-wages-quay-delivery", "early-work-workshop-orders"].map(id => [id, visual("work", "work")]),
  ["early-work-harbor-crew", visual("history-city", "gather")],
  ...["familiar-song", "cloth-knot", "patch-of-light", "visitor-hands", "painted-door", "loose-laces", "stone-row", "friend-keeps-turn", "familiar-order", "new-shortcut", "spare-offcut", "count-again", "merchant-parcel", "pottery-offcut", "quay-packed-rope", "fishing-float", "bakery-flour", "clerk-sheets", "weaving-thread", "delta-word"].map(id => [`early-year-${id}`, visual("childhood", "play")]),
  // Background scenes at four and nine keep children at home or learning safely.
  ...["background-merchant-household-childhood", "background-artisan-household-childhood", "background-harbor-household-childhood", "background-fishing-household-childhood", "background-bakery-household-childhood", "background-clerk-household-childhood", "background-weaver-household-childhood", "background-delta-newcomers-childhood"].map(id => [id, visual("childhood", "play")]),
  ...["background-artisan-household-practice", "background-harbor-household-practice", "background-fishing-household-practice", "background-bakery-household-practice", "background-weaver-household-practice", "background-delta-newcomers-practice"].map(id => [id, visual("childhood", "work")]),
  ...["background-merchant-household-practice", "background-clerk-household-practice"].map(id => [id, visual("learning", "write")]),
  // A family contact's offer does not imply the player has a spouse or children.
  ...["background-merchant-household-opportunity", "background-artisan-household-opportunity", "background-harbor-household-opportunity", "background-fishing-household-opportunity", "background-bakery-household-opportunity", "background-clerk-household-opportunity", "background-weaver-household-opportunity", "background-delta-newcomers-opportunity"].map(id => [id, visual("history-city", "gather")]),
  // Meeting someone is an everyday encounter. An invitation does not depict
  // marriage, a shared household or parenthood as already accepted.
  ...["harbor", "market", "well", "festival", "garden", "neighbors"].map(id => [`meet-person-${id}`, visual("history-city", "gather")]),
  ...["workshop", "linen", "bakery", "pottery"].map(id => [`meet-person-${id}`, visual("work", "gather")]),
  ...["copies", "library", "accounts"].map(id => [`meet-person-${id}`, visual("learning", "gather")]),
  ["meet-person-music", visual("music", "gather")],
  ["meet-person-boat", visual("sea", "gather")],
  ["meet-person-drill", visual("history-city", "work")],
  ...["harbor", "market", "workshop", "linen", "copies", "bakery", "well", "festival", "library", "music", "boat", "drill", "garden", "accounts", "pottery", "neighbors"].map(id => [`date-person-${id}`, visual("history-city", "gather")]),
  // A proposed venture is a discussion of shared work, not an accepted job,
  // marriage, military appointment or guaranteed return.
  ...["harbor", "market", "well", "festival", "drill", "neighbors"].map(id => [`business-proposal-person-${id}`, visual("history-city", "work")]),
  ...["workshop", "linen", "bakery", "garden", "pottery"].map(id => [`business-proposal-person-${id}`, visual("work", "work")]),
  ...["copies", "library", "accounts"].map(id => [`business-proposal-person-${id}`, visual("learning", "write")]),
  ["business-proposal-person-music", visual("music", "gather")],
  ["business-proposal-person-boat", visual("sea", "gather")],
  ...["specialist-kiln-load", "specialist-carved-repair", "specialist-sculpture-detail"].map(id => [id, visual("work")]),
  ...["specialist-philosophy-objection", "specialist-sky-record", "specialist-conflicting-charts", "specialist-dendera-chart"].map(id => [id, visual("learning")]),
  ...["royal-campaign-muster", "royal-garrison-reorganisation"].map(id => [id, visual("history-war")]),
  ...["royal-officer-first-orders", "royal-general-supply-order", "royal-grain-order-carried-out", "royal-service-transition"].map(id => [id, visual("history-city")]),
  ["career-petition-opening", visual("learning", "write")],
  ["career-reader-opening", visual("learning", "write")],
  ["career-unit-supply-opening", visual("history-city", "work")],
  ["career-workshop-opening", visual("work")],
  ["lender-offer", visual("history-city", "gather")],
  ["lender-payment-due", visual("learning", "write")],
  ...["lender-threat", "lender-confrontation"].map(id => [id, visual("history-city", "unrest")]),
  ...["small-spilled-porridge", "small-new-blanket", "small-noisy-visitor", "child-chipped-cup", "child-missing-goat", "child-market-change", "child-rooftop-pigeons", "child-a-lost-coin", "child-a-clay-toy"].map(id => [id, visual("childhood")]),
  ...["youth-borrowed-tablet", "youth-an-old-tool"].map(id => [id, visual("learning")]),
  ...["youth-bakery-queue", "youth-cart-wheel", "youth-a-paid-errand", "adult-bread-price", "adult-cloudy-water", "adult-misplaced-tools", "adult-harbor-queue", "adult-a-market-space", "adult-a-noisy-neighbor", "adult-robbers-in-a-lane", "adult-water-from-a-dirty-jar"].map(id => [id, visual("history-city")]),
  ...["adult-roof-leak", "middle-loose-hinge", "middle-new-measures", "middle-late-payment"].map(id => [id, visual("work")]),
  ...["later-mended-sandals", "later-borrowed-stool", "later-misplaced-key", "later-temple-visit", "later-a-roof-repair", "later-a-shared-chore"].map(id => [id, visual("later-life")]),
  ["adult-a-rough-crossing", visual("sea")], ["adult-a-warehouse-fire", visual("history-city", "unrest")],
  ...["caesar-in-alexandria", "water-and-war"].map(id => [id, visual("history-war")]),
  // News of a battle does not establish fighting in the player's own streets.
  ...["news-of-actium", "roman-rule", "after-the-transition", "the-shape-of-the-city", "an-unreliable-season", "a-place-on-the-manifest", "path-familiar-streets", "adult-an-unhurried-hour"].map(id => [id, visual("history-city")]),
  ["the-first-household", visual("birth")],
  ...["first-steps", "a-child-in-the-courtyard", "small-familiar-voices", "small-doorway", "small-household-rhythm", "small-new-words", "small-shared-shade", "small-returning-faces", "child-neighborhood-paths", "child-found-treasure", "child-shared-laughter", "child-beyond-the-corner", "child-a-friend-needs-help", "child-the-spare-afternoon"].map(id => [id, visual("childhood")]),
  ...["the-first-letters", "a-place-to-learn", "the-unfamiliar-page", "the-uneven-accounts", "a-trade-to-pass-on", "a-letter-from-a-friend", "youth-learning-patience", "youth-someone-to-ask", "path-a-careful-line"].map(id => [id, visual("learning")]),
  ...["the-first-wages", "the-neighbors-request", "a-different-kind-of-work", "youth-stronger-hands", "youth-a-trusted-errand", "youth-questions-about-work", "youth-the-extra-task", "adult-work-and-return", "adult-a-repaired-belonging", "adult-the-busy-season", "adult-someone-remembers", "middle-familiar-work", "adult-the-loaned-tool", "adult-an-extra-payment", "adult-the-unfamiliar-method"].map(id => [id, visual("work")]),
  ...["child-useful-hands", "child-watching-work"].map(id => [id, visual("childhood", "work")]),
  ...["letters-across-the-water", "path-a-port-remembered"].map(id => [id, visual("sea")]),
  // Household possibilities are shown as company in the city until a child is actually present.
  ...["room-for-one-more", "a-shared-household", "a-younger-friend", "youth-evening-conversation", "youth-changing-friendships", "adult-shared-meal", "middle-household-rearranged", "middle-an-old-acquaintance", "family-shared-routines", "adult-an-invitation", "relationship-strain"].map(id => [id, visual("history-city", "gather")]),
  ...["a-new-generation", "care-between-generations", "family-a-child-growing"].map(id => [id, visual("family")]),
  ...["the-cost-of-rest", "an-unwell-week", "middle-a-slower-morning", "a-quiet-room", "medical-care-needed"].map(id => [id, visual("rest")]),
  ...["the-weight-of-years", "stepping-back", "putting-things-in-order", "what-you-will-keep", "the-people-who-return", "the-small-pleasures", "names-remembered", "a-later-season", "an-extraordinary-age", "middle-a-younger-voice", "middle-the-long-view", "later-company-at-the-door", "later-familiar-things", "later-a-helpful-hand", "later-news-from-outside", "later-an-old-story", "later-the-light-changes", "later-a-question-of-energy", "later-a-memory-to-share", "later-a-small-outing", "later-the-useful-belonging"].map(id => [id, visual("later-life")]),
]);

// Keep the earlier authored assignments for archived lives while exposing an
// exact current-world map to the editor and completeness checks.
const expandedHouseholdOrigins = ["royal-household", "estate-household", "temple-household", "soldier-household", "tenant-farming-household", "domestic-service-household", "boatbuilder-household", "musician-household"];
Object.assign(ALL_ALEXANDRIA_EVENT_VISUALS, Object.fromEntries(expandedHouseholdOrigins.flatMap(origin => [
  [`background-${origin}-childhood`, visual("childhood", "play")],
  [`background-${origin}-practice`, visual(origin === "musician-household" ? "music" : ["royal-household", "estate-household", "temple-household"].includes(origin) ? "learning" : "childhood", origin === "musician-household" ? "gather" : ["royal-household", "estate-household", "temple-household"].includes(origin) ? "write" : "work")],
  [`background-${origin}-opportunity`, visual("history-city", "gather")],
])));
Object.assign(ALL_ALEXANDRIA_EVENT_VISUALS, Object.fromEntries([
  ["household-royal-patronage-changes", visual("history-city", "reflect")],
  ...["classical-persian-reconquest", "classical-alexander-accession", "classical-alexander-crossing", "classical-alexander-egypt", "classical-alexandria-founded", "classical-alexander-death", "classical-aristotle-death", "classical-ptolemy-kingship", "classical-pharos-completed"].map(id => [id, visual("history-city")]),
  ...["classical-euclid-teaching", "classical-scholarly-households", "classical-euclid-demonstration"].map(id => [id, visual("learning")]),
  ["classical-aristotle-journey", visual("sea")],
  ["classical-alexander-shore-work", visual("work")],
  ["classical-succession-guard", visual("history-war")],
  ["classical-garrison-account", visual("history-city", "work")],
]));
export const ALEXANDRIA_EVENT_VISUALS: EventVisuals = Object.fromEntries(currentWorld.events.map(event => {
  const assignment = ALL_ALEXANDRIA_EVENT_VISUALS[event.id];
  if (!assignment) throw new Error(`Missing authored visual for ${event.id}`);
  return [event.id, assignment];
}));

function factsVisual(effects: readonly Effect[]): EventVisual | undefined {
  const facts = effects.filter(effect => effect.type === "flag");
  if (facts.some(effect => effect.flag === "parent" && effect.value)) return visual("family");
  if (facts.some(effect => effect.flag === "sailed" && effect.value)) return visual("sea");
  if (facts.some(effect => (effect.flag === "studied" || effect.flag === "literate") && effect.value)) return visual("learning");
  if (facts.some(effect => effect.flag === "retired" && effect.value)) return visual("later-life");
  if (facts.some(effect => effect.flag === "stayed" && effect.value)) return visual("work");
  if (facts.some(effect => effect.flag === "partnered" && effect.value)) return visual("history-city", "gather");
  if (facts.some(effect => effect.flag === "apprenticed" && effect.value)) return visual("work");
  return undefined;
}

function effectsVisual(effects: readonly Effect[]): EventVisual | undefined {
  if (effects.some(effect => effect.type === "care" || effect.type === "condition")) return visual("rest");
  const fact = factsVisual(effects);
  if (fact) return fact;
  if (effects.some(effect => effect.type === "stat" && effect.stat === "health" && effect.delta < 0)) return visual("rest");
  if (effects.some(effect => effect.type === "stat" && effect.stat === "knowledge" && effect.delta > 0)) return visual("learning");
  if (effects.some(effect => effect.type === "stat" && effect.stat === "wealth" && effect.delta > 0)) return visual("work");
  if (effects.some(effect => effect.type === "stat" && effect.stat === "bonds" && effect.delta > 0)) return visual("history-city", "gather");
  return undefined;
}

/** Default used by the editor before a life exists; explicit sidecars override it. */
export function defaultEventVisual(event: LifeEvent): EventVisual {
  if (event.id === "medical-care-needed") return visual("rest");
  // Retained fixed-name worlds keep their original meeting artwork, outside
  // the current pack's complete authored map.
  if (["meet-demetria", "meet-thais", "meet-berenike", "meet-tyche"].includes(event.id)) return visual("history-city", "gather");
  const authored = ALL_ALEXANDRIA_EVENT_VISUALS[event.id];
  if (authored) return { ...authored };
  if (event.trigger.type === "year" && event.evidence === "documented-history") return visual("history-city");
  if (event.mode === "automatic") return effectsVisual(event.effects ?? []) ?? visual("history-city");
  // An unchosen route is a possibility, so do not depict one branch as completed.
  const outcomes = event.choices.flatMap(choice => choice.outcomes);
  const hasRoute = outcomes.some(outcome => outcome.effects.some(effect => effect.type === "flag" && effect.value && ["parent", "sailed", "studied", "partnered", "stayed"].includes(effect.flag)));
  if (hasRoute) return visual("history-city");
  return effectsVisual(outcomes.flatMap(outcome => outcome.effects)) ?? visual("history-city");
}

export type SceneKind = "pending" | "outcome" | "event" | "history" | "birth" | "ending" | "record" | "fallback";
export interface SceneContext extends EventVisual {
  id: string;
  key: string;
  title: string;
  caption: string;
  alt: string;
  eventId?: string;
  kind: SceneKind;
  rarity?: "rare";
  evidence?: EvidenceKind;
  sourceIds?: string[];
}

/** Keep automatic events separate from decisions the player can make. */
export function sceneContextLabel(context: Pick<SceneContext, "kind" | "eventId" | "rarity">): string {
  if (context.eventId === "the-first-household") return "Birth";
  if (context.rarity === "rare" && context.kind === "pending") return "Rare encounter";
  const labels: Record<SceneKind, string> = {
    pending: "Decision", outcome: "Outcome", event: "Life event",
    history: "World event", birth: "Background", ending: "Cause of death", record: "Record complete", fallback: "Daily life",
  };
  return labels[context.kind];
}

function ageVisual(life: LifeState): EventVisual {
  if (life.age === 0) return visual("birth");
  if (life.age < 12) return visual("childhood");
  if (life.age >= 60 || life.flags.retired) return visual("later-life");
  if (life.character) {
    if (life.character.jobId === "sailor") return visual("sea");
    if (life.character.jobId === "performer") return visual("music");
    if (["clerk", "copyist", "philosophy-tutor", "sky-table-calculator", "astrologer"].includes(life.character.jobId ?? "")) return visual("learning");
    if (["soldier", "officer", "general", "court-adviser"].includes(life.character.jobId ?? "")) return visual("history-city");
    if (life.character.jobId) return visual("work");
    if (life.age < 18) return visual("learning");
    return life.character.children.length ? visual("family") : visual("history-city");
  }
  if (life.age < 18) return visual("learning");
  if (life.flags.sailed) return visual("sea");
  if (life.flags.studied) return visual("learning");
  if (life.flags.parent) return visual("family");
  return visual("work");
}

function outcomeVisual(event: LifeEvent, outcome: Outcome, life: LifeState): EventVisual {
  // Illness remains a care scene even after accepting help improves health.
  if (event.id === "an-unwell-week" || event.id === "the-cost-of-rest" || event.id === "medical-care-needed") return visual("rest");
  if (event.id === "a-shared-household" && !life.flags.partnered) return visual("history-city", "reflect");
  if (event.id === "the-first-letters" && outcome.effects.some(effect => effect.type === "flag" && effect.flag === "apprenticed" && effect.value)) return visual("childhood", "work");
  const selected = factsVisual(outcome.effects);
  if (selected) {
    if (selected.scene === "family" && !life.flags.parent) return visual("history-city", "gather");
    if (selected.scene === "sea" && !life.flags.sailed) return ageVisual(life);
    return selected;
  }
  const branches: Record<string, EventVisual> = {
    "rare-patron-copy-result": visual("learning", "write"),
    "rare-patron-fitting-result": visual("work", "work"),
    "rare-patron-pot-result": visual("work", "work"),
    "fire-rescue-success": visual("rest"), "fire-rescue-injury": visual("rest"),
    "rough-crossing-paid": visual("sea"), "robbers-driven-off": visual("rest"),
    "dirty-water-illness": visual("rest"), "dirty-water-no-illness": visual("history-city"),
    "write-home-result": visual("learning"), "learn-port-result": visual("sea"),
    "share-skill-result": visual("learning"), "check-carefully-result": visual("learning"),
    "seek-mediator-result": visual("history-city", "gather"), "walk-away-result": visual("rest"),
    "continue-light-work-result": visual("work"), "write-arrangements-result": visual("later-life", "write"),
    "gather-letters-result": visual("later-life", "write"), "send-reply-result": visual("learning"),
    "keep-message-result": visual("history-city", "reflect"), "child-help-friend-result": visual("childhood", "gather"),
    "child-explain-task-result": visual("childhood", "work"), "child-watch-work-result": visual("childhood", "work"),
    "child-find-company-result": visual("childhood", "play"), "adult-make-time-result": life.flags.parent ? visual("family") : visual("history-city", "gather"),
    "later-record-memory-result": visual("later-life", "write"),
  };
  if (branches[outcome.id]) return branches[outcome.id];
  if (!ALEXANDRIA_EVENT_VISUALS[event.id]) return effectsVisual(outcome.effects) ?? ageVisual(life);
  const base = defaultEventVisual(event);
  if (base.scene === "family" && event.id !== "care-between-generations" && !life.flags.parent) return visual("history-city", "gather");
  return base;
}

function makeContext(id: string, kind: SceneKind, assignment: EventVisual, title: string, caption: string, event?: LifeEvent): SceneContext {
  return { id, key: id, kind, ...assignment, title, caption: assignment.caption ?? caption, alt: sceneDefinitions[assignment.scene].alt,
    ...(event ? { eventId: event.id, evidence: event.evidence, sourceIds: event.sourceIds, ...(event.rarity ? { rarity: event.rarity } : {}) } : {}) };
}

/** Presentation-only: read the accepted journal without consuming randomness or changing a life. */
export function resolveLifeScenes(life: LifeState, world: WorldPack, eventVisuals: EventVisuals = {}): SceneContext[] {
  const authored = (context: SceneContext): SceneContext => ({
    ...context,
    title: displayProse(personText(context.title, world, life)),
    caption: displayProse(personText(context.caption, world, life)),
  });
  if (life.phase === "ended") {
    const ending = world.endings.find(item => item.id === life.endingId);
    const cause = world.character?.deathCauses.find(item => item.id === life.deathCauseId);
    if (ending?.kind === "chapter") return [authored(makeContext(`record-${life.age}-${life.endingId}`, "record", visual("history-city", "still"), ending.title, ending.text))];
    return [authored(makeContext(`ending-${life.age}-${life.endingId}`, "ending", visual("memorial"), cause?.title ?? ending?.title ?? "A life remembered.", cause?.text ?? ending?.text ?? sceneDefinitions.memorial.caption))];
  }
  const result: SceneContext[] = [];
  const events = new Map(world.events.map(event => [event.id, event]));
  const pending = life.phase === "choice" ? events.get(life.pendingEventId ?? "") : undefined;
  if (pending) result.push(makeContext(`pending-${life.age}-${pending.id}`, "pending", eventVisuals[pending.id] ?? defaultEventVisual(pending), pending.title, pending.text, pending));

  const current: { entry: JournalEntry; index: number }[] = [];
  life.journal.forEach((entry, index) => { if (entry.age === life.age && entry.year === life.year) current.push({ entry, index }); });
  const outcomes: SceneContext[] = [];
  const automatic: SceneContext[] = [];
  for (const { entry, index } of current) {
    if (entry.type === "outcome") {
      let event: LifeEvent | undefined;
      let activity: CharacterActivity | undefined;
      for (let previous = index - 1; previous >= 0; previous--) {
        const candidate = life.journal[previous];
        if (candidate.age !== life.age || candidate.year !== life.year) break;
        if (candidate.type === "activity") {
          activity = world.character?.activities.find(item => item.id === candidate.id);
          if (activity) break;
        }
        if (candidate.type === "event") { event = events.get(candidate.id); break; }
      }
      if (activity) {
        const outcome = activity.outcomes.find(item => item.id === entry.id);
        const activityScenes: EventVisuals = {
          "rest-for-recovery": visual("rest"), "seek-a-healer": visual("rest"), "ask-household-care": visual("rest"),
          "take-a-rest-day": visual("rest"), "take-an-easy-walk": visual("history-city", "reflect"),
          "visit-a-friend": visual("history-city", "gather"), "take-market-errands": visual("work"),
          "mend-household-sandals": visual("work"), "help-count-stock": visual("learning"),
          "cook-a-shared-meal": visual("family"), "clean-the-water-jars": visual("work"),
          "take-day-cargo-work": visual("work"), "join-an-evening-song": visual("history-city", "gather"),
          "take-night-cargo-work": visual("work"), "swim-offshore": visual("sea"),
          "train-warfare": visual("work"), "drill-a-unit": visual("work"), "organise-war-supplies": visual("history-war"),
          "train-music": visual("music"), "work-performer": visual("music"), "complete-paid-engagement": visual("music"),
          "complete-cargo-voyage": visual("sea"), "complete-service-assignment": visual("history-city", "work"),
          "fulfil-significant-order": visual("history-city", "work"), "copy-a-sky-table": visual("learning", "write"),
        };
        const craftPractice = outcome?.effects.some(effect => effect.type === "skill" && ["craft", "pottery", "carving", "sculpture"].includes(effect.skill));
        const scholarlyPractice = outcome?.effects.some(effect => effect.type === "skill" && ["philosophy", "astronomy", "astrology", "oratory"].includes(effect.skill));
        const jobChange = outcome?.effects.find(effect => effect.type === "job");
        const specialJob = jobChange?.type === "job" ? jobChange.job : null;
        const assignment = outcome?.id === "night-cargo-injury" ? visual("rest") : activityScenes[activity.id] ?? (outcome?.effects.some(effect => effect.type === "child") ? visual("family")
          : ["soldier", "officer", "general", "court-adviser"].includes(specialJob ?? "") ? visual("history-city")
          : ["philosophy-tutor", "sky-table-calculator", "astrologer"].includes(specialJob ?? "") ? visual("learning")
          : craftPractice ? visual("work")
          : scholarlyPractice ? visual("learning")
          : activity.category === "training" ? visual("learning")
          : activity.category === "career" ? visual("work")
          : activity.category === "family" && life.flags.parent ? visual("family") : visual("history-city", "gather"));
        outcomes.push(makeContext(`activity-${life.age}-${index}-${activity.id}`, "outcome", assignment, activity.text, entry.text));
      }
      const outcome = event?.choices.flatMap(choice => choice.outcomes).find(item => item.id === entry.id);
      if (event && outcome) outcomes.push(makeContext(`outcome-${life.age}-${index}-${event.id}`, "outcome", eventVisuals[event.id] ?? outcomeVisual(event, outcome, life), event.title, entry.text, event));
    }
    if (entry.type === "event") {
      const event = events.get(entry.id);
      if (event?.mode === "automatic") {
        // A family reminder describes a possibility, not an accepted marriage
        // or birth. Keep its artwork consistent with actual relationships.
        let assignment = defaultEventVisual(event);
        if (event.id === "a-shared-household" && !life.flags.partnered) assignment = visual("history-city", "reflect");
        if (event.id === "a-new-generation" && !life.flags.parent) assignment = visual("history-city", "gather");
        automatic.push(makeContext(`event-${life.age}-${index}-${event.id}`, event.trigger.type === "year" ? "history" : "event", eventVisuals[event.id] ?? assignment, event.title, event.text, event));
      }
    }
  }
  result.push(...outcomes.reverse(), ...automatic.reverse());
  if (life.age === 0) {
    const origin = world.origins.find(item => item.id === life.originId);
    result.push(makeContext(`birth-${life.originId}`, "birth", visual("birth"), origin?.title ?? sceneDefinitions.birth.title, origin?.text ?? sceneDefinitions.birth.caption));
  }
  if (result.length === 0) {
    const assignment = ageVisual(life);
    const scene = sceneDefinitions[assignment.scene];
    result.push(makeContext(`year-${life.age}`, "fallback", assignment, scene.title, scene.caption));
  }
  return result.map(authored);
}
