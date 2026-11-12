/** The guided tour: which screen each step needs, what it points at, and what it says. */

export const TUTORIAL_STAGES = ["home", "new-life", "game", "web3", "finish"] as const;
export type TutorialStage = typeof TUTORIAL_STAGES[number];

export type TutorialCharacterSection = "career" | "skills" | "wealth" | "children";
export type TutorialChainHash = "#weave" | "#market" | "#figures" | "#mine";

/** A screen the tour can open through the app's own navigation. */
export type TutorialScreen =
  | { kind: "home" }
  | { kind: "new-life" }
  | { kind: "game" }
  | { kind: "character"; section: TutorialCharacterSection }
  | { kind: "chain"; hash: TutorialChainHash };

export interface TutorialStep {
  id: string;
  stage: TutorialStage;
  screen: TutorialScreen;
  title: string;
  body: string;
  /**
   * CSS selector alternatives, tried in order; the first one with visible matches is highlighted
   * (all of its matches together). Empty means a centered card.
   */
  targets: readonly string[];
  /** Shown instead of `body` when none of the targets is on screen yet. */
  missingBody?: string;
}

const HOME = { kind: "home" } as const;
const NEW_LIFE = { kind: "new-life" } as const;
const GAME = { kind: "game" } as const;

const HOME_STEPS: readonly TutorialStep[] = [
  { id: "welcome", stage: "home", screen: HOME, targets: [], title: "Welcome to Everfolk",
    body: "Live one life on Egypt's ancient coast, from birth to old age. This tour opens each screen for you. Use Next and Back, or the arrow keys." },
  { id: "begin", stage: "home", screen: HOME, targets: [".ef-home-primary"], title: "Begin or continue",
    body: "Begin your life rolls a new character. Once a life is under way, this button reads Continue your life. Your game saves in this browser." },
  { id: "weave-cta", stage: "home", screen: HOME, targets: [".ef-home-weave-cta"], title: "Weave Mode",
    body: "Weave Mode is the verified game: one life that counts, recorded on NEAR testnet. When it ends you can mint real NFTs from it." },
  { id: "header", stage: "home", screen: HOME, targets: [".ef-home-weave-links"], title: "One header everywhere",
    body: "Play, Weave Mode, Market, Figures and My lives sit at the top of every screen. The Tutorial button on the right reopens this tour." },
];

const NEW_LIFE_STEPS: readonly TutorialStep[] = [
  { id: "roll", stage: "new-life", screen: NEW_LIFE, targets: [".birth-roll-popover[open] .birth-popover-content"], title: "Roll a new life",
    body: "Every life starts with a roll: your background, name, Health, Knowledge, Total wealth, Bonds and starting resources such as grain. Reborn rolls again.",
    missingBody: "A new life starts with a roll of your background, stats and starting resources. Your current life is kept, so the tour carries on with it." },
  { id: "begin-life", stage: "new-life", screen: NEW_LIFE, targets: [".birth-roll-popover[open] .birth-popover-continue"], title: "Begin life",
    body: "When the roll settles, Begin life starts your story at age 0. Next will begin it for you.",
    missingBody: "Begin life starts a rolled character at age 0. Your life is already under way, so Next takes you back to it." },
];

const GAME_STEPS: readonly TutorialStep[] = [
  { id: "time-bar", stage: "game", screen: GAME, targets: [".life-session-bar"], title: "The time bar",
    body: "A year passes every few seconds. Pause or Resume, pick a speed from 1× to 16×, skip to the Next decision, or let Auto mode choose for you. The clock waits while this tour is open." },
  { id: "rail", stage: "game", screen: GAME, targets: [".life-year-rail"], title: "Your lifetime",
    body: "This rail marks the decades of your life, from birth onward. The marker moves as you age." },
  { id: "resources", stage: "game", screen: GAME, targets: [".aoe-resource-hud"], title: "Household resources",
    body: "Grain, cash, flax, linen, herd, fields and reputation at a glance, beside this year's flood, army and road. Inventory & Granary opens the full storehouse." },
  { id: "character", stage: "game", screen: GAME, targets: [".life-scene-frame, .character-panel"], title: "Your scene and character",
    body: "The scene follows your age and surroundings. The Character button opens a popup with your career, skills, wealth and family." },
  { id: "focus", stage: "game", screen: GAME, targets: [".yearly-focus"], title: "This year's focus",
    body: "This year's focus steers what you practise, such as Study, Farming or Friends. You can change it any time.",
    missingBody: "Once you are old enough, This year's focus appears here. It steers what you practise each year, such as Study, Farming or Friends." },
  { id: "wealth", stage: "game", screen: GAME, targets: [".overview-wealth"], title: "Wealth and rank",
    body: "Total wealth is cash plus possessions minus debt. The assets rank shows where your household stands among all households. Click it for details." },
  { id: "yearly-action", stage: "game", screen: GAME, targets: [".life-yearly-action-deck"], title: "Your yearly action",
    body: "Each year you get one personal action: time with people, training or work. Pick a card to spend it.",
    missingBody: "From age 6 you get one personal action each year: time with people, training or work. The box appears here at age 6." },
  { id: "command-deck", stage: "game", screen: GAME, targets: [".demo-economy .demo-deck-header"], title: "Household & Town command deck",
    body: "These tabs run your household: Market & Trade (trading opens at age 10), Farm & Granary, Career & Army, People & Town, and Works & Stewards." },
  { id: "notifications", stage: "game", screen: GAME, targets: [".event-notification-stack"], title: "Notifications",
    body: "Decisions, offers, new skills and life events appear at the right edge. Routine notices fade after 5 seconds; decisions wait for you.",
    missingBody: "Decisions, offers, new skills and life events appear at the right edge of the screen. Routine notices fade after 5 seconds; decisions wait for you." },
  { id: "decision", stage: "game", screen: GAME, targets: [".turning-point-button"], title: "Turning points",
    body: "Big choices pause the clock until you decide. Next decision skips ahead to the next one; when one is waiting, the button reads Open decision." },
  { id: "life-record", stage: "game", screen: GAME, targets: [".life-record-panel"], title: "Life record",
    body: "Every year's events are written in the Life record, newest first. Full chronicle opens the whole story." },
  { id: "skills", stage: "game", screen: { kind: "character", section: "skills" }, targets: [".character-dialog[open] [role='tabpanel']:not([hidden])", ".character-dialog[open] .dialog-content"], title: "The skill tree",
    body: "Skills are learned automatically from matching activities and jobs, so farming teaches farming. A Skill learned notice tells you when one is new, and the tree shows what it opens next." },
  { id: "character-tabs", stage: "game", screen: { kind: "character", section: "wealth" }, targets: [".character-dialog[open] .character-tabs", ".character-dialog[open] .dialog-content"], title: "Career, Wealth and Family",
    body: "These tabs cover your money and possessions, your family and, once you are old enough to work, your Career. Spend, change jobs or care for your household here." },
  { id: "ending", stage: "game", screen: GAME, targets: [".life-ending-banner"], title: "When a life ends",
    body: "The ending panel sums up your life. Open your pack shows the moments You could have gotten as cards; a free life mints nothing.",
    missingBody: "When your life ends, an ending panel sums it up. Open your pack shows the moments You could have gotten as cards. A free life mints nothing; Weave Mode keeps real NFTs." },
];

const WEB3_STEPS: readonly TutorialStep[] = [
  { id: "weave", stage: "web3", screen: { kind: "chain", hash: "#weave" }, targets: [".ranked-entry-intro", ".chain-screen[open] h1"], title: "Weave Mode",
    body: "One life that counts, with no rewinds, on NEAR testnet. Sign in with email or a wallet; when the life ends, open a pack and mint a card or a stage album." },
  { id: "market", stage: "web3", screen: { kind: "chain", hash: "#market" }, targets: [".chain-screen[open] .market .ef-market-card-grid", ".chain-screen[open] .ef-market-header"], title: "Market",
    body: "Buy lives other players kept. Each card shows the life, its price and its seller, and every sale pays the people who shaped it." },
  { id: "figures", stage: "web3", screen: { kind: "chain", hash: "#figures" }, targets: [".chain-screen[open] .figure-directory .ef-market-card-grid", ".chain-screen[open] .ef-market-header"], title: "Figures",
    body: "Historical figures shape the city of every Weave life. Open a record to see its owners and the path a life must follow to qualify." },
  { id: "mine", stage: "web3", screen: { kind: "chain", hash: "#mine" }, targets: [".chain-screen[open] .ef-market-header"], title: "My lives",
    body: "Your current Weave life, finished lives waiting to mint, and the NFTs you own. Sign in to see them." },
];

const FINISH_STEPS: readonly TutorialStep[] = [
  { id: "finish", stage: "finish", screen: GAME, targets: [".everfolk-game:not([hidden]) .tutorial-button"], title: "You're ready",
    body: "Your life is waiting where you left it. Reopen this tour any time with the Tutorial button." },
];

export const TUTORIAL_STEPS: readonly TutorialStep[] = [...HOME_STEPS, ...NEW_LIFE_STEPS, ...GAME_STEPS, ...WEB3_STEPS, ...FINISH_STEPS];
