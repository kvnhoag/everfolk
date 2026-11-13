/** Contextual tutorial copy: one short hint per section of the game, shown when that section matters. */

export const TUTORIAL_HINT_IDS = [
  "welcome", "home-begin", "home-weave", "home-header",
  "roll",
  "time-bar", "decision", "ending", "rail", "resources", "planting", "scene", "focus", "wealth", "life-record", "yearly-action", "command-deck", "market", "notifications",
  "character", "skills",
  "weave", "nft-market", "figures", "mine",
  "about",
] as const;
export type TutorialHintId = typeof TUTORIAL_HINT_IDS[number];

export interface TutorialHint {
  id: TutorialHintId;
  title: string;
  body: string;
  /** One line for the section's "?" tooltip. Absent when the section has no "?" button. */
  help?: string;
  /** CSS selector alternatives, tried in order; the first with visible matches is highlighted. Empty: a centered card. */
  targets: readonly string[];
  /** Shown instead of `body` when the section is not drawn at the moment. */
  missingBody?: string;
}

const CHAIN = ".chain-screen[open]";

/** In the order the sections appear on screen, so Back and Next read top to bottom. */
export const TUTORIAL_HINTS: readonly TutorialHint[] = [
  { id: "welcome", targets: [], title: "Welcome to Everfolk",
    body: "Live one life on Egypt's ancient coast, from birth to old age. Short tips appear as each part of the game opens up, and every section has a small “?” button that explains it. To explore on your own, turn tips off below and new sections will just glow." },
  { id: "home-begin", targets: [".ef-home-primary"], title: "Begin or continue",
    body: "Begin your life rolls a new character. Once a life is under way, this button reads Continue your life. Your game saves in this browser." },
  { id: "home-weave", targets: [".ef-home-weave-cta"], title: "Weave Mode",
    body: "Weave Mode is the verified game: one life that counts, recorded on NEAR testnet. When it ends you can mint real NFTs from it." },
  { id: "home-header", targets: [".ef-home-weave-links"], title: "One header everywhere",
    body: "Play, Weave Mode, Market, Figures and My lives sit at the top of every screen. The Tutorial button on the right shows the tips for the screen you are on." },
  { id: "roll", targets: [".birth-roll-popover[open] .birth-popover-content"], title: "Roll a new life",
    body: "Every life starts with a roll: your background, name, Health, Knowledge, Total wealth, Bonds and starting resources such as grain. Reborn rolls again, and Begin life starts your story at age 0." },
  { id: "time-bar", targets: [".life-session-bar"], title: "The time bar",
    help: "Pause, change speed, skip to the next decision or turn on Auto mode.",
    body: "A year passes every few seconds. Pause or Resume, pick a speed from 1× to 16×, skip to the Next decision, or let Auto mode choose for you. Tips never pause the game." },
  { id: "decision", targets: [".life-decision-dialog[open] .decision-dialog-content, .life-decision-dialog[open]", ".turning-point-button"], title: "Turning points",
    body: "Big choices pause the clock until you decide. When one is waiting, Next decision reads Open decision; Auto mode can choose for you." },
  { id: "ending", targets: [".life-ending-banner"], title: "When a life ends",
    help: "Your life's summary, its legacy pack and what to do next.",
    body: "The ending panel sums up your life. A life that reaches 18 earns a pack of 1 to 5 cards, more with titles. Open your pack, tear the seal and save cards to your Legacy; a free life mints nothing, while Weave Mode keeps real NFTs." },
  { id: "rail", targets: [".life-year-rail"], title: "Your lifetime",
    help: "The decades of your life; the marker moves as you age.",
    body: "This rail marks the decades of your life, from birth onward. The marker moves as you age." },
  { id: "resources", targets: [".aoe-resource-hud"], title: "Household resources",
    help: "Your household's grain, cash, goods and standing, with this year's conditions.",
    body: "Grain, cash, flax, linen, herd, fields and reputation at a glance, beside this year's flood, army and road. Inventory & Granary shows what came in and went out last year, and what the coming year will bring." },
  { id: "planting", targets: [".aoe-planting-row", ".aoe-inventory-toggle"], title: "Plan your fields each year",
    help: "Split your fields between grain and flax before the harvest.",
    body: "Open Inventory & Granary and use Plan your fields: grain plots feed the household and pay the rent, flax plots grow flax to spin into linen and sell. Pick the split and press Set planting; it counts for the next harvest. A reminder glows here once a year." },
  { id: "scene", targets: [".life-scene-frame, .everfolk-game .character-panel"], title: "Your scene and character",
    help: "Where you are now; the Character button opens career, skills, wealth and family.",
    body: "The scene follows your age and surroundings. The Character button opens a popup with your career, skills, wealth and family." },
  { id: "focus", targets: [".yearly-focus"], title: "This year's focus",
    help: "What you practise each year. Change it any time.",
    body: "Pick one button, such as Study, Farming or Friends, and each year your yearly action is spent on it for you, so its skills grow without a click. Everyday life leaves the action to you. Locked focuses show the age they open." },
  { id: "wealth", targets: [".life-overview"], title: "Wealth and rank",
    help: "Total wealth and where your household ranks. Click it for details.",
    body: "Total wealth is cash plus possessions minus debt. The assets rank shows where your household stands among all households; click it for details." },
  { id: "life-record", targets: [".life-record-panel"], title: "Life record",
    help: "Every year's events, newest first.",
    body: "Every year's events are written in the Life record, newest first. Full chronicle opens the whole story." },
  { id: "yearly-action", targets: [".life-yearly-action-deck"], title: "Your yearly action",
    help: "One personal action a year: people, training or work.",
    body: "From age 6 you get one action each year. Choose a tab (people, training or work), then press Do on a card: training and work grow the skills shown on it, people raise your bonds. If you leave it, your focus uses it.",
    missingBody: "From age 6 you get one action each year: time with people, training or work. The box returns once this year's decision is made." },
  { id: "command-deck", targets: [".demo-economy .demo-deck-header"], title: "Household & Town command deck",
    help: "Your household's market, farm, career, people and works.",
    body: "These tabs run your household: Market & Trade, Farm & Granary, Career & Army, People & Town, and Works & Stewards." },
  { id: "market", targets: [".demo-economy section[aria-label='Grain market']:not([hidden])", ".demo-economy .demo-deck-tabs"], title: "Market & Trade is open",
    help: "Trade grain and goods once a year. This is not the NFT Market.",
    body: "You are old enough to trade. Market & Trade allows one visit a year to buy or sell grain and goods; keep enough grain for the household." },
  { id: "notifications", targets: [".event-notification-stack"], title: "Notifications",
    body: "Decisions, offers, new skills and life events appear at the right edge. Notices are text only and fade after 3 seconds; decisions and offers wait for you. The Life record keeps everything.",
    missingBody: "Decisions, offers, new skills and life events appear at the right edge of the screen. Notices fade after 3 seconds; decisions and offers wait for you." },
  { id: "character", targets: [".character-dialog[open] .character-tabs", ".character-dialog[open] .dialog-content"], title: "Career, Wealth and Family",
    help: "Your career, skills, money, possessions and family.",
    body: "These tabs cover your money and possessions, your family and, once you are old enough to work, your Career. Spend, change jobs or care for your household here." },
  { id: "skills", targets: [".character-dialog[open] [role='tabpanel']:not([hidden]) .capability-tree, .character-dialog[open] [role='tabpanel']:not([hidden]) .deep-capability-tree", ".character-dialog[open] [role='tabpanel']:not([hidden])", "[data-tutorial='skill-tree']"], title: "The skill tree",
    help: "Skills you have learned and what each one opens next.",
    body: "Skills are learned automatically from matching activities and jobs, so farming teaches farming. A Skill learned notice tells you when one is new; the Skill tree tab shows what it opens next." },
  { id: "weave", targets: [`${CHAIN} .ranked-entry-intro`, `${CHAIN} h1`], title: "Weave Mode",
    help: "One verified life on NEAR testnet that can mint real NFTs.",
    body: "One life that counts, with no rewinds, on NEAR testnet. Sign in with email or a wallet; when the life ends, open a pack and mint a card or a stage album." },
  { id: "nft-market", targets: [`${CHAIN} .ef-market-header`], title: "Market",
    help: "Buy lives other players kept.",
    body: "Buy lives other players kept. Each card shows the life, its price and its seller, and every sale pays the people who shaped it." },
  { id: "figures", targets: [`${CHAIN} .ef-market-header`], title: "Figures",
    help: "Historical figures who shape every Weave life.",
    body: "Historical figures shape the city of every Weave life. Open a record to see its owners and the path a life must follow to qualify." },
  { id: "mine", targets: [`${CHAIN} .ef-market-header`], title: "My lives",
    help: "Your Weave life, lives waiting to mint, and your NFTs.",
    body: "Your current Weave life, finished lives waiting to mint, and the NFTs you own. Sign in to see them." },
  { id: "about", targets: [], title: "Tips as you play",
    body: "Tips appear as each part of the game opens up. Every section has a small “?” button that explains it; click it to read its tip again." },
];

/** Sections that carry a small "?" button. */
export const SECTION_HELP_HINTS: readonly TutorialHintId[] = [
  "time-bar", "rail", "resources", "planting", "scene", "focus", "wealth", "yearly-action", "command-deck", "market", "life-record", "ending",
  "skills", "character", "weave", "nft-market", "figures", "mine",
];

const BY_ID = new Map<string, TutorialHint>(TUTORIAL_HINTS.map(hint => [hint.id, hint]));

export function isTutorialHintId(value: unknown): value is TutorialHintId {
  return typeof value === "string" && BY_ID.has(value);
}

export function tutorialHint(id: string | null | undefined): TutorialHint | undefined {
  return id ? BY_ID.get(id) : undefined;
}
