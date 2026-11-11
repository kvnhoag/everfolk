import { useEffect, useMemo, useRef, useState } from "react";
import { formatYear } from "../src/index.ts";
import type { LifeState, JournalEntry, WorldPack } from "../src/types.ts";
import type { WorldRoute } from "../server/content.ts";
import type { EventVisuals } from "./scene-model.ts";
import type { RankedPlay } from "./useGame.ts";
import type { ArchivedLife } from "./session.ts";
import { engineForLife, exportLife, loadAnyLife, sampleEngine } from "./session.ts";
import { useGame } from "./useGame.ts";
import PaperScene from "./PaperScene.tsx";
import CharacterPanel from "./CharacterPanel.tsx";
import BirthRollPopover from "./BirthRollPopover.tsx";
import PauseScreen from "./PauseScreen.tsx";
import MainMenu from "./MainMenu.tsx";
import DecisionDialog from "./DecisionDialog.tsx";
import LifeEventFeed from "./LifeEventFeed.tsx";
import InfluenceMarkerTag from "./InfluenceMarkerTag.tsx";
import { influenceMarker } from "./influence-marker.ts";
import LifeOverview from "./LifeOverview.tsx";
import LifeMoment from "./LifeMoment.tsx";
import LifeYearRail from "./LifeYearRail.tsx";
import { readEverfolkStorage } from "./brand-storage.ts";
import HouseholdSummary from "./HouseholdSummary.tsx";
import LifeHealthPanel from "./LifeHealthPanel.tsx";
import { MoneylenderNotice } from "./MoneylenderPanel.tsx";
import { getLoanSummary, loanDeadlineWarning } from "./loan-summary.ts";
import { activityLoanOffer, isBorrowChoice } from "./loan-access.ts";
import LoanOfferDialog from "./LoanOfferDialog.tsx";
import type { LoanRequest } from "./LoanOfferDialog.tsx";
import LoanDeadlineDialog from "./LoanDeadlineDialog.tsx";
import YearlyFocus from "./YearlyFocus.tsx";
import { formatMoney } from "./wealth.ts";
import { formatWealthStanding, getWealthComparison } from "./wealth-comparison.ts";
import PixelIcon from "./PixelIcon.tsx";
import PixelPortrait from "./PixelPortrait.tsx";
import StorybookMark from "./StorybookMark.tsx";
import { displayProse } from "./display-prose.ts";
import { modelNote, sourceScope, sourceSummary } from "./source-copy.ts";
import CompactSkillPanel from "./CompactSkillPanel.tsx";
import SkillTree from "./SkillTree.tsx";
import WorldMap from "./WorldMap.tsx";
import { supportsLocationMap } from "./location-map.ts";
import LegacyGallery, { CurrentLegacySummary } from "./LegacyGallery.tsx";
import { collectLegacyEntries, legacyLifeKey, persistLegacyEntries, readLegacyEntries } from "./legacy-store.ts";
import type { LegacyEntry } from "./legacy-store.ts";
import { choiceProgressFeedback } from "./compact-skill.ts";
import type { ProgressFeedback } from "./compact-skill.ts";
import { personText, resolvePartner } from "../src/people.ts";
import { romanticPartnerLabel } from "./relationship-labels.ts";
import { worldBeginning, worldPlace } from "./world-era.ts";
import "./birth-intro.css";
import "./life-dashboard.css";
import "./life-info-sidebar.css";
import "./pixel-theme.css";
import "./everfolk-ui.css";
import "./storybook-theme.css";
import "./readable-type.css";
import "./creator-tokens.css";
import "./creator-system.css";

type IconName = "hourglass" | "arrow" | "sun" | "heart" | "book" | "coin" | "bonds" | "pin" | "feather" | "ship" | "home" | "check" | "pause" | "play" | "close" | "download" | "restart";

const LIFE_ENTRY_READING_MS = 4000;

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <PixelIcon name={name} size={size} />;
}

const statIcons: Record<string, IconName> = { health: "heart", knowledge: "book", wealth: "coin", bonds: "bonds" };

function lifeStage(age: number): string {
  if (age < 3) return "Infancy";
  if (age < 13) return "Childhood";
  if (age < 18) return "Youth";
  if (age < 40) return "Adulthood";
  if (age < 60) return "Middle years";
  return "Later life";
}

function yearsLived(age: number): string {
  return age === 0 ? "Less than one year" : `${age} ${age === 1 ? "year" : "years"}`;
}

function SourceLinks({ ids = [], world = sampleEngine.world }: { ids?: readonly string[]; world?: WorldPack }) {
  const sources = ids.map(id => world.sources?.find(source => source.id === id)).filter(source => source !== undefined);
  if (sources.length === 0) return null;
  return <div className="source-links">{sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>;
}

function journalSourceIds(entry: JournalEntry, world = sampleEngine.world): string[] {
  if (entry.type === "birth") return world.origins.find(item => item.id === entry.id)?.sourceIds ?? [];
  if (entry.type === "event") return world.events.find(item => item.id === entry.id)?.sourceIds ?? [];
  if (entry.type === "ending") return world.endings.find(item => item.id === entry.id)?.sourceIds ?? [];
  return [];
}

function journalKind(entry: JournalEntry, world = sampleEngine.world): string {
  if (entry.type === "choice") return "Selected";
  if (entry.type === "outcome") return "Outcome";
  if (entry.type === "activity") return "Activity";
  if (entry.type === "birth") return "Background";
  if (entry.type === "influence") return "Influence";
  if (entry.type === "ending") return world.endings.find(ending => ending.id === entry.id)?.kind === "chapter" ? "Record complete" : "Life ended";
  const event = world.events.find(item => item.id === entry.id);
  if (event?.rarity === "rare") return "Rare encounter";
  if (event?.id === "the-first-household") return "Birth";
  if (event?.trigger.type === "year") return "History";
  if (event?.mode === "automatic" && event.trigger.type === "age") return "Milestone";
  return event?.mode === "automatic" ? "Life event" : "Decision";
}

function LifeJournal({ life, newestFirst = false }: { life: LifeState; newestFirst?: boolean }) {
  const world = engineForLife(life).world;
  const years = useMemo(() => {
    const groups = new Map<number, { age: number; year: number; entries: JournalEntry[] }>();
    for (const entry of life.journal) {
      let group = groups.get(entry.age);
      if (!group) {
        group = { age: entry.age, year: entry.year, entries: [] };
        groups.set(entry.age, group);
      }
      // Birthday markers establish a year even when no narrative event occurred.
      if (entry.type !== "year") group.entries.push(entry);
    }
    const result = [...groups.values()];
    return newestFirst ? result.reverse() : result;
  }, [life.journal, newestFirst]);

  return <div className="life-timeline">
    {years.map(group => <section className="journal-year" key={group.age} aria-label={`${formatYear(group.year)}, age ${group.age}`}>
      <header className="journal-year-heading"><h3>{formatYear(group.year)}</h3><span>{group.age === 0 ? "Birth year" : `Age ${group.age}`}</span></header>
      {group.entries.length > 0 ? <ol className="journal-year-entries">
        {group.entries.map((entry, index) => {
          const marker = influenceMarker(entry, world);
          return <li className={`journal-row journal-${entry.type}${marker ? ` is-shaped is-${marker.material}` : ""}`} key={`${entry.type}-${entry.id}-${index}`}>
          <span className="journal-point" aria-hidden="true" /><div className="journal-copy"><span className="journal-kind">{journalKind(entry, world)}</span>{marker && <InfluenceMarkerTag marker={marker} />}<p>{displayProse(entry.text)}</p>
            {journalSourceIds(entry, world).length > 0 && <details className="journal-sources"><summary>Sources</summary><SourceLinks ids={journalSourceIds(entry, world)} world={world} /></details>}
          </div>
        </li>;
        })}
      </ol> : <p className="journal-quiet-year">This year passed without a recorded event.</p>}
    </section>)}
  </div>;
}

function App({ onChooseWorld, onNewLife, onImportedLife, worldPickerOpen = false, startFresh = false, startFreshFrom, eventVisuals, ranked }: { onChooseWorld?: () => void; onNewLife?: (previous: LifeState) => void; onImportedLife?: (life: LifeState) => void; worldPickerOpen?: boolean; startFresh?: boolean; startFreshFrom?: LifeState; worldRoutes?: WorldRoute[]; eventVisuals?: EventVisuals; ranked?: RankedPlay }) {
  const [panel, setPanel] = useState<"world" | "chronicle" | "sources" | "archive" | "legacy" | "about" | "character" | "wiki" | "map" | null>(null);
  const [characterSection, setCharacterSection] = useState<"career" | "wealth" | "children" | "skills">("career");
  const [restartOpen, setRestartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const [birthPopoverOpen, setBirthPopoverOpen] = useState(startFresh);
  const [readingPause, setReadingPause] = useState(false);
  const [deferredDecision, setDeferredDecision] = useState<string | null>(null);
  const [loanRequest, setLoanRequest] = useState<LoanRequest | null>(null);
  const [loanWarningOpen, setLoanWarningOpen] = useState(false);
  const loanWarningsSeen = useRef(new Set<string>());
  const game = useGame({ isOverlayOpen: readingPause || menuOpen || panel !== null || restartOpen || worldPickerOpen || birthPopoverOpen || loanRequest !== null || loanWarningOpen, startFresh, startFreshFrom, ranked });
  const { life } = game;
  const menuLifeRef = useRef<string | null>(null);
  const lifeEngine = engineForLife(life);
  const world = lifeEngine.world;
  const wealthComparison = useMemo(() => getWealthComparison(world, life), [world, life]);
  const place = worldPlace(world, life.year);
  const birthplace = worldPlace(world, world.startYear);
  const characterName = life.character?.name ?? "Damon";
  const displayName = game.hasRevealedStats ? characterName : "Your life";
  const deathCause = world.character?.deathCauses.find(item => item.id === life.deathCauseId);
  const [downloadError, setDownloadError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [viewedLife, setViewedLife] = useState<LifeState | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const playbackMenuRef = useRef<HTMLDetailsElement>(null);
  const decisionButtonRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const isBirthSituation = life.age === 0 && life.phase === "ready" && world.events.some(item => item.id === "the-first-household" && item.mode === "automatic");
  const ending = world.endings.find(item => item.id === life.endingId);
  const origin = world.origins.find(item => item.id === life.originId)!;
  const choices = lifeEngine.getChoices(life);
  const decisionEvent = world.events.find(event => event.id === life.pendingEventId);
  const loanSummary = getLoanSummary(world, life);
  const lender = world.economy?.moneylender;
  const loanOfferTerms = lender ? `Receive ${formatMoney(lender.principal, world)}. Repay ${formatMoney(lender.principal + lender.fee, world)} within ${lender.termYears} ${lender.termYears === 1 ? "year" : "years"}.` : "";
  const isLoanOffer = decisionEvent?.choices.some(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "loan" && effect.action === "borrow")));
  const isLoanDecision = decisionEvent && world.economy?.moneylender && Object.values(world.economy.moneylender.events).includes(decisionEvent.id);
  const contextualDecisionEvent = decisionEvent && world.health && decisionEvent.id === world.health.careDecision && life.health?.conditions.length
    ? { ...decisionEvent, text: `${life.health.conditions.map(condition => { const title = world.health!.conditions.find(item => item.id === condition.id)?.title; return title && condition.severe ? `Severe ${title.toLocaleLowerCase()}` : title; }).filter(Boolean).join(", ")}. ${decisionEvent.text}` }
    : decisionEvent && isLoanDecision && loanSummary ? { ...decisionEvent, text: `Remaining balance: ${formatMoney(loanSummary.balance, world)}. ${loanSummary.description} ${decisionEvent.text}` }
    : decisionEvent && isLoanOffer && lender ? { ...decisionEvent, text: `${loanOfferTerms} ${decisionEvent.text}` } : decisionEvent;
  const decisionDisplayEvent = contextualDecisionEvent ? { ...contextualDecisionEvent, title: personText(contextualDecisionEvent.title, world, life), text: personText(contextualDecisionEvent.text, world, life) } : undefined;
  const decisionKey = life.phase === "choice" ? `${life.seed}:${life.age}:${life.pendingEventId}` : null;
  const dashboardVisible = game.hasBegun && !menuOpen && !game.resumeScreenOpen && !panel && !restartOpen && !worldPickerOpen && !birthPopoverOpen && !loanRequest && !loanWarningOpen;
  const decisionOpen = Boolean(dashboardVisible && !readingPause && decisionEvent && decisionKey !== deferredDecision && !game.autoDecisions);

  useEffect(() => {
    // Count reading time only on the visible life page. An interruption starts
    // a fresh pause on return, and no timer survives a life change or unmount.
    if (!readingPause || !dashboardVisible || document.hidden) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setReadingPause(false);
    }, LIFE_ENTRY_READING_MS);
    return () => window.clearTimeout(timer);
  }, [readingPause, dashboardVisible, life.worldFingerprint, life.seed]);
  const chronicleLife = viewedLife ?? life;
  const chronicleName = chronicleLife.character?.name ?? "Damon";
  const chronicleNameKnown = viewedLife !== null || game.hasRevealedStats;
  const chronicleWorld = engineForLife(chronicleLife).world;
  const chronicleWealthComparison = useMemo(() => chronicleLife === life ? wealthComparison : getWealthComparison(chronicleWorld, chronicleLife), [chronicleLife, life, wealthComparison, chronicleWorld]);
  const chronicleCause = chronicleWorld.character?.deathCauses.find(item => item.id === chronicleLife.deathCauseId);
  const chronicleEnding = chronicleWorld.endings.find(item => item.id === chronicleLife.endingId);
  const stage = lifeStage(life.age);
  const isDead = life.phase === "ended" && ending?.kind === "death";
  const [progressFeedback, setProgressFeedback] = useState<ProgressFeedback | null>(null);
  const previousProgressLife = useRef(life);
  const [legacyEntries, setLegacyEntries] = useState<LegacyEntry[]>([]);
  const [legacyNotice, setLegacyNotice] = useState("");
  const activities = useMemo(() => lifeEngine.getActivities(life), [lifeEngine, life]);
  const repaymentWarning = loanDeadlineWarning(world, life);
  const requestedLoanChoice = loanRequest?.kind === "choice" ? choices.find(choice => choice.id === loanRequest.id)
    : activities.find(activity => activity.id === loanRequest?.id);

  useEffect(() => {
    if (loanRequest && loanRequest.snapshot !== life) setLoanRequest(null);
  }, [life, loanRequest]);

  useEffect(() => {
    if (!repaymentWarning) setLoanWarningOpen(false);
  }, [repaymentWarning?.key]);

  useEffect(() => {
    // Health and pending decisions keep priority. The clock waits as soon as
    // this reminder opens, including when Auto mode is enabled.
    if (!repaymentWarning || readingPause || !game.hasBegun || menuOpen || game.resumeScreenOpen || panel || restartOpen || worldPickerOpen || birthPopoverOpen || loanRequest || life.phase !== "ready") return;
    const key = repaymentWarning.key;
    if (loanWarningsSeen.current.has(key)) return;
    try { if (readEverfolkStorage(window.sessionStorage, `everfolk:loan-warning:${key}`) === "seen") return; } catch { /* An in-memory reminder still works. */ }
    setLoanWarningOpen(true);
  }, [repaymentWarning?.key, readingPause, game.hasBegun, menuOpen, game.resumeScreenOpen, panel, restartOpen, worldPickerOpen, birthPopoverOpen, loanRequest, life.phase]);

  function dismissLoanWarning() {
    if (repaymentWarning) {
      loanWarningsSeen.current.add(repaymentWarning.key);
      try { window.sessionStorage.setItem(`everfolk:loan-warning:${repaymentWarning.key}`, "seen"); } catch { /* Session memory is enough when storage is unavailable. */ }
    }
    setLoanWarningOpen(false);
  }

  useEffect(() => {
    const previous = previousProgressLife.current;
    previousProgressLife.current = life;
    if (previous.worldFingerprint !== life.worldFingerprint || previous.seed !== life.seed) { setProgressFeedback(null); return; }
    const feedback = choiceProgressFeedback(previous, life, world);
    if (feedback) setProgressFeedback(feedback);
  }, [life, world]);

  useEffect(() => {
    try {
      let entries = readLegacyEntries(window.localStorage);
      for (const archived of game.archivedLives) {
        try { const archivedLife = loadAnyLife(archived.save); entries = collectLegacyEntries(engineForLife(archivedLife).world, archivedLife, entries); }
        catch { /* An unavailable old pack must not hide this collection. */ }
      }
      entries = collectLegacyEntries(world, life, entries);
      setLegacyEntries(entries);
      persistLegacyEntries(window.localStorage, entries);
      setLegacyNotice("");
    } catch (error) {
      setLegacyEntries(previous => collectLegacyEntries(world, life, previous));
      setLegacyNotice(error instanceof Error ? error.message : "The legacy gallery could not be saved in this browser.");
    }
  }, [life, world, game.archivedLives]);

  useEffect(() => {
    const refresh = () => { try { setLegacyEntries(readLegacyEntries(window.localStorage)); } catch { /* Preserve the visible collection. */ } };
    window.addEventListener("everfolk:legacy-updated", refresh);
    return () => window.removeEventListener("everfolk:legacy-updated", refresh);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (restartOpen || panel && (menuOpen || !game.resumeScreenOpen)) {
      if (dialog && !dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  }, [panel, restartOpen, game.resumeScreenOpen, menuOpen]);

  useEffect(() => {
    const identity = `${life.worldFingerprint}:${life.seed}`;
    if (menuLifeRef.current === identity) return;
    menuLifeRef.current = identity;
    setReadingPause(false);
    setBirthPopoverOpen(!game.hasBegun && life.phase !== "ended");
    setMenuOpen(true);
  }, [life.worldFingerprint, life.seed]);

  useEffect(() => {
    if (game.hasBegun && !menuOpen && !game.resumeScreenOpen && !panel && !restartOpen && !birthPopoverOpen && (isBirthSituation || life.phase === "ended")) {
      sceneRef.current?.focus({ preventScroll: true });
    }
  }, [game.hasBegun, menuOpen, game.resumeScreenOpen, life.pendingEventId, life.phase, isBirthSituation, panel, restartOpen, birthPopoverOpen]);

  function openMainMenu() {
    game.pauseLife();
    closeDialog();
    setBirthPopoverOpen(false);
    setMenuOpen(true);
  }

  function continueFromMenu() {
    if (!game.hasBegun) { setBirthPopoverOpen(true); return; }
    setMenuOpen(false);
    if (life.phase !== "ended") continueWithReadingPause();
  }

  function continueWithReadingPause() {
    if (life.phase === "ended" || document.hidden) return;
    setReadingPause(true);
    game.continueLife();
  }

  function beginWithReadingPause() {
    if (!game.hasRevealedStats) return;
    setReadingPause(true);
    setBirthPopoverOpen(false);
    setMenuOpen(false);
    game.beginLife();
  }

  function beginFromMenu() {
    if (game.hasBegun) setRestartOpen(true);
    else setBirthPopoverOpen(true);
  }

  function closeDialog() {
    setPanel(null);
    setRestartOpen(false);
    setViewedLife(null);
    setDialogError("");
  }

  function openChronicle() {
    setViewedLife(null);
    setPanel("chronicle");
  }

  function downloadLife(saved?: string, filename?: string) {
    try {
      const blob = new Blob([saved ?? exportLife(life)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename ?? `everfolk-life-age-${life.age}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError("");
    } catch {
      setDownloadError("This life could not be exported. Please try again.");
    }
  }

  function selectChoice(id: string) {
    const choice = choices.find(choice => choice.id === id);
    if (choice && isBorrowChoice(choice)) setLoanRequest({ kind: "choice", id, snapshot: life });
    else game.choose(id);
  }

  function requestActivity(id: string) {
    const activity = activities.find(activity => activity.id === id);
    if (!activity) return;
    if (activityLoanOffer(world, life, activity)) setLoanRequest({ kind: "fund-activity", id, snapshot: life });
    else if (activity.available && isBorrowChoice(activity)) setLoanRequest({ kind: "activity", id, snapshot: life });
    else game.act(id);
  }

  function confirmLoan() {
    if (!loanRequest || loanRequest.snapshot !== life) { setLoanRequest(null); return; }
    const request = loanRequest;
    setLoanRequest(null);
    if (request.kind === "fund-activity") game.actWithLoan(request.id);
    else if (request.kind === "choice") game.choose(request.id);
    else game.act(request.id);
  }

  function readArchived(entry: ArchivedLife) {
    try {
      setViewedLife(loadAnyLife(entry.save));
      setDialogError("");
      setPanel("chronicle");
    } catch {
      setDialogError("This archived life belongs to different world content. Its original save can still be downloaded.");
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error("This save file is too large.");
      const imported = game.importLife(await file.text());
      if (imported) { onImportedLife?.(imported); closeDialog(); setBirthPopoverOpen(false); setMenuOpen(true); }
      else setDialogError("This save could not be opened. Please use a save from the current full-life world.");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "This save could not be imported.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return <>
    {menuOpen && <MainMenu life={life} world={world} hasBegun={game.hasBegun} hasRevealedStats={game.hasRevealedStats} onBegin={beginFromMenu} onContinue={continueFromMenu} onWorlds={onChooseWorld} onPastLives={() => setPanel("archive")} onLegacy={() => setPanel("legacy")} onSources={() => setPanel("sources")} notice={game.notice || downloadError} active={!panel && !restartOpen && !birthPopoverOpen && !worldPickerOpen} />}
    {!menuOpen && game.resumeScreenOpen && <PauseScreen life={life} world={world} onContinue={continueWithReadingPause} onReborn={() => { setPanel(null); setRestartOpen(true); }} onMainMenu={openMainMenu} />}
    <div className="everfolk-game" hidden={game.resumeScreenOpen || menuOpen}>
    <a className="skip-link" href="#life-scene">Skip to your life</a>
    <header className="site-header">
      <a className="brand" href="#" aria-label="Everfolk main menu" onClick={e => { e.preventDefault(); openMainMenu(); }}>
        <span className="brand-mark"><StorybookMark size={34} /></span>
        <span>Everfolk</span>
      </a>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={!panel ? "nav-link active" : "nav-link"} onClick={closeDialog}><span className="small-dot" />Your life</button>
        <button className={panel === "character" ? "nav-link active" : "nav-link"} disabled={!game.hasRevealedStats} onClick={() => { setCharacterSection("career"); setPanel("character"); }}>Character</button>
        <button className={panel === "world" ? "nav-link active" : "nav-link"} onClick={() => setPanel("world")}>The world</button>
        {supportsLocationMap(world) && <button className={panel === "map" ? "nav-link active" : "nav-link"} onClick={() => setPanel("map")}>Map</button>}
        <button className={panel === "chronicle" ? "nav-link active" : "nav-link"} onClick={openChronicle}>Chronicle</button>
        <button className={panel === "archive" ? "nav-link active" : "nav-link"} onClick={() => setPanel("archive")}>Past lives</button>
        <button className={panel === "legacy" ? "nav-link active" : "nav-link"} onClick={() => setPanel("legacy")}>Legacy</button>
        <button className={panel === "sources" ? "nav-link active" : "nav-link"} onClick={() => setPanel("sources")}>Sources</button>
        {onChooseWorld && <button className="nav-link" onClick={onChooseWorld}>Worlds</button>}
      </nav>
      <div className={`save-indicator ${game.saveStatus === "unavailable" ? "save-warning" : ""}`} role="status">
        <Icon name={game.saveStatus === "saved" ? "check" : "feather"} size={15} />
        <span>{game.saveStatus === "saved" ? "Saved" : game.saveStatus === "saving" ? "Saving…" : "Save unavailable"}</span>
      </div>
    </header>

    <main className={`page-shell${game.hasBegun ? " game-dashboard" : ""}`} id="life-scene">
      {!game.hasBegun && <section className="chapter-heading" aria-label="Current world">
        <div>
          <p className="eyebrow">WORLD · THE ANCIENT MEDITERRANEAN</p>
          <h1>{isDead ? "Life ended" : world.title}<span>.</span></h1>
          <p className="chapter-subtitle">{isDead ? "Your life story, from birth to death." : "Grow up, find work and build a life in ancient Egypt."}</p>
        </div>
        <div className="chapter-date" aria-label={`Current year ${formatYear(life.year)}`}><span className="date-label">{isDead ? "FINAL YEAR" : "CURRENT YEAR"}</span><span className="date-value">{Math.abs(life.year)} <small>{life.year < 0 ? "BCE" : "CE"}</small></span><p><Icon name="pin" size={14} /> {place}, Egypt</p></div>
      </section>}

      {game.hasBegun && <section className="life-session-bar" aria-label="Time controls">
        <div className="life-session-age">Age <strong>{life.age}</strong></div><div className="life-session-year">{formatYear(life.year)} · {supportsLocationMap(world) ? <button type="button" className="location-map-open" aria-label={`Open location map: ${place}, Egypt`} onClick={() => setPanel("map")}><Icon name="pin" size={13} />{place}</button> : place}</div>
        <div className="playback-bar life-clock">
          <div className="playback-label"><span className={`status-dot ${game.isClockRunning ? "running" : ""}`} /><span role="timer" aria-live="off">{readingPause ? "Reading pause" : life.phase === "choice" ? game.autoDecisions ? game.isPlaying ? "Auto choosing…" : "Auto mode paused" : "Decision waiting" : life.phase === "ended" ? "Life complete" : game.isClockRunning ? `Next year in ${(game.clockRemainingMs / 1000).toFixed(1)}s` : "Paused"}</span></div>
          <div className="playback-controls"><button className={`play-button session-play ${game.isPlaying ? "selected" : ""}`} aria-label={game.isPlaying ? "Pause automatic progression" : "Play automatic progression"} aria-pressed={game.isPlaying} disabled={life.phase === "ended"} onClick={() => { if (game.isPlaying) game.pauseLife(); else continueWithReadingPause(); }}><Icon name={game.isPlaying ? "pause" : "play"} size={14} /><span>{game.isPlaying ? "Pause" : "Resume"}</span></button>{([1, 2, 4, 8, 12, 16] as const).map(speed => <button key={speed} className={`speed-button ${speed > 8 ? "advanced-speed " : ""}${game.speed === speed ? "selected" : ""}`} aria-label={`Playback speed ${speed} times`} aria-pressed={game.speed === speed} onClick={() => game.setSpeed(speed)}>{speed}×</button>)}</div>
          <button className="text-button turning-point-button" disabled={life.phase !== "ready"} onClick={() => { setReadingPause(false); game.nextTurningPoint(); }}>Next decision <Icon name="arrow" size={15} /></button>
          <div className="session-desktop-actions"><button type="button" className={`session-auto${game.autoDecisions ? " is-on" : ""}`} aria-pressed={game.autoDecisions} disabled={life.phase === "ended"} onClick={() => game.setAutoDecisions(value => !value)}>Auto mode</button><button className="session-manage" onClick={() => { setCharacterSection("children"); setPanel("character"); }}>Family &amp; life</button><button className="session-manage" onClick={() => { setCharacterSection("wealth"); setPanel("character"); }}>Spend</button></div>
          <details ref={playbackMenuRef} className="session-more"><summary aria-label="More controls">⋯</summary><div className="session-more-options"><button type="button" aria-pressed={game.autoDecisions} disabled={life.phase === "ended"} onClick={() => { game.setAutoDecisions(value => !value); if (playbackMenuRef.current) playbackMenuRef.current.open = false; }}>Auto mode {game.autoDecisions ? "on" : "off"}</button><button onClick={() => { if (playbackMenuRef.current) playbackMenuRef.current.open = false; setCharacterSection("children"); setPanel("character"); }}>Family &amp; life</button><button onClick={() => { if (playbackMenuRef.current) playbackMenuRef.current.open = false; setCharacterSection("wealth"); setPanel("character"); }}>Spend</button>{([12, 16] as const).map(speed => <button key={speed} type="button" aria-label={`Playback speed ${speed} times`} aria-pressed={game.speed === speed} onClick={() => { game.setSpeed(speed); if (playbackMenuRef.current) playbackMenuRef.current.open = false; }}>{speed}× speed</button>)}</div></details>
          {life.phase === "ready" && <div className="year-clock-track" role="progressbar" aria-label="Progress to the next year" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(game.clockProgress * 100)}><span style={{ width: `${game.clockProgress * 100}%` }} /></div>}
        </div>
      </section>}

      <div className={`life-layout ${isDead ? "life-has-ended" : ""}`}>
        <div className="life-visual-column">
          {game.hasBegun && <div className="life-scene-frame" ref={sceneRef} tabIndex={-1} aria-label={life.phase === "ended" ? "Life summary" : "Your life now"}>
            <PaperScene life={life} compact dashboard eventVisuals={eventVisuals} paused={!game.isClockRunning} />
            <div className="life-scene-location"><span><Icon name="pin" size={13} />{place}, Egypt</span><span>{formatYear(life.year)}</span></div>
          </div>}
        <aside className="character-panel" aria-label="Your character">
          <div className="portrait-frame"><PixelPortrait age={life.age} name={displayName} seed={life.seed} sex={life.character?.sex} originId={life.originId} avatarVariant={life.character?.avatarVariant} /><span className="portrait-label">{isDead ? "DECEASED" : "YOUR LIFE"}</span></div>
          <h2>{displayName}</h2><p className="character-origin">Of {place}</p>
          <div className="age-line"><span>{isDead && life.age === 0 ? "Died in infancy" : <>Age <strong>{life.age}</strong></>}</span><span className="tiny-divider" /><span>{isDead ? "Life ended" : stage}</span></div>
          {!game.hasBegun && <div className="character-details">
            <div><span>BACKGROUND</span><p>{game.hasRevealedStats ? origin.title : "Not revealed yet"}</p></div>
            {life.age >= 16 && <div><span>OCCUPATION</span><p>{world.character?.jobs.find(job => job.id === life.character?.jobId)?.title ?? (life.flags.retired ? "Retired" : "Unemployed")}</p></div>}
            <div><span>HOUSEHOLD</span><p>{life.character?.partnerId ? `${resolvePartner(world, life, life.character.partnerId)?.name ?? "Your partner"} · ${romanticPartnerLabel(world, life) ?? life.character.relationshipStatus}` : "Your family home"}{life.character && life.character.children.length > 0 ? ` · ${life.character.children.length} ${life.character.children.length === 1 ? "child" : "children"}` : ""}</p></div>
            <div><span>BORN</span><p>{formatYear(world.startYear)}</p></div>
          </div>}
          {!game.hasBegun && <div className="stats" aria-label="Life attributes" aria-busy={!game.hasRevealedStats}>
            {Object.entries(world.stats).map(([id, definition]) => world.economy?.stat === id && life.economy ? <div className={`stat stat-${id} stat-financial`} key={id}>
              <button className="stat-wealth-open" type="button" disabled={!game.hasRevealedStats} aria-label="Open total wealth and society comparison" title="Total wealth is cash + possessions − debt. Society percentile compares your wealth with the game's starting households." onClick={() => { setCharacterSection("wealth"); setPanel("character"); }}>
                <div className="stat-heading"><span><Icon name="coin" size={16} />Total wealth</span><strong>{game.hasRevealedStats && wealthComparison ? formatMoney(wealthComparison.netWorth, world) : "—"}</strong></div>
                <span className="stat-wealth-percentile"><span>Society percentile</span><strong>{game.hasRevealedStats && wealthComparison ? formatWealthStanding(wealthComparison.percentile) : "—"}</strong></span>
                <span className="stat-wealth-cash"><span>{game.hasRevealedStats ? `Cash ${formatMoney(life.economy.cash, world)}` : "Money not yet revealed"}</span><span aria-hidden="true">Details ↗</span></span>
              </button>
            </div> : <div className={`stat stat-${id}`} key={id}>
              <div className="stat-heading"><span><Icon name={statIcons[id] ?? "sun"} size={16} />{definition.label}</span><strong key={life.stats[id]}>{game.hasRevealedStats ? <>{Number(life.stats[id].toFixed(1))}<small> / {definition.max}</small></> : "—"}</strong></div>
              <div className="stat-track" role={game.hasRevealedStats ? "meter" : undefined} aria-label={game.hasRevealedStats ? definition.label : `${definition.label} not yet revealed`} aria-valuemin={game.hasRevealedStats ? definition.min : undefined} aria-valuemax={game.hasRevealedStats ? definition.max : undefined} aria-valuenow={game.hasRevealedStats ? life.stats[id] : undefined}><span style={{ width: game.hasRevealedStats ? `${(life.stats[id] - definition.min) / (definition.max - definition.min) * 100}%` : "0%" }} /></div>
            </div>)}
          </div>}
          <button className="secondary-button character-open" disabled={!game.hasRevealedStats} onClick={() => { setCharacterSection("career"); setPanel("character"); }}>Character <Icon name="arrow" size={16} /></button>
          {!ranked && <button className="text-button another-life" onClick={() => setRestartOpen(true)}><Icon name="restart" size={15} /> Begin another life</button>}
        </aside>
        </div>

        <section className="story-column" aria-label="Your life">
          {game.hasBegun && <LifeOverview life={life} world={world} onOpenWealth={() => { setCharacterSection("wealth"); setPanel("character"); }} />}
          {game.hasBegun && <div className="life-info-sidebar dashboard-skills"><CompactSkillPanel life={life} world={world} activities={activities} onOpenWiki={() => setPanel("wiki")} /></div>}
          {game.hasBegun && <LifeHealthPanel life={life} world={world} onActivity={requestActivity} />}
          {game.hasBegun && <MoneylenderNotice life={life} world={world} onManage={() => { setCharacterSection("wealth"); setPanel("character"); }} />}

          {!game.hasBegun ? <section className="birth-record birth-intro-record" aria-labelledby="birth-title">
            <div className="birth-intro-art"><img src="/assets/pixel/scenes/birth.svg" alt="Pixel illustration of a newborn and caregiver" /></div>
            <h2 id="birth-title">{game.hasRevealedStats ? `${characterName} is born.` : "A new life begins."}</h2>
            <p>{game.hasRevealedStats ? displayProse(origin.text) : `A new life on Egypt's coast.`}</p>
            <dl className="birth-facts"><div><dt>PLACE</dt><dd>{birthplace}, Egypt</dd></div><div><dt>BORN</dt><dd>{formatYear(world.startYear)}</dd></div><div><dt>HOUSEHOLD</dt><dd>{game.hasRevealedStats ? origin.title : "Not revealed yet"}</dd></div></dl>
            {game.hasRevealedStats && <SourceLinks ids={origin.sourceIds} />}
            <div className="birth-actions"><button className="primary-button" onClick={() => setBirthPopoverOpen(true)}>Start a new life <Icon name="arrow" size={20} /></button><button className="text-button" onClick={() => setPanel("sources")}>History &amp; sources <Icon name="book" size={15} /></button></div>
            <p className="birth-note">A year takes 25 seconds at 1×.</p>
          </section> : <>
            {life.phase === "choice" && <div className="decision-waiting" role="status"><span>{readingPause ? "Reading pause." : game.autoDecisions ? game.isPlaying ? "Auto mode is choosing." : "Auto mode is paused." : "A decision is waiting."}</span><button ref={decisionButtonRef} type="button" onClick={() => { setReadingPause(false); game.setAutoDecisions(false); setDeferredDecision(null); }}>Open decision</button></div>}
            {life.phase === "ready" && <LifeMoment life={life} world={world} onAdvance={() => { setReadingPause(false); game.advance(); }} onOpenChronicle={openChronicle} />}
            <YearlyFocus life={life} world={world} focusId={game.focusId} onChange={game.setFocus} />
            {progressFeedback && progressFeedback.accomplishments.length > 0 && <section className="choice-progress-feedback" aria-label="Accomplishments after your choice" role="status" key={progressFeedback.key}>
              <header><strong>After your choice</strong><button type="button" aria-label="Dismiss progress update" onClick={() => setProgressFeedback(null)}>×</button></header>
              {progressFeedback.accomplishments.map(record => <p key={record.id}><strong>{record.name}</strong> · {record.title}</p>)}
            </section>}
            {life.phase === "ended" && <section className="decision-area streamlined-decision is-ended" aria-label="Life summary">
              <div className="choice-list">
                  <div className="memorial-summary"><span className="eyebrow">{characterName.toLocaleUpperCase()} OF ALEXANDRIA</span>{deathCause && <p className="memorial-cause"><span>CAUSE OF DEATH</span><strong>{deathCause.title}</strong></p>}{life.deathCauseContext && <p className="death-context"><strong>{life.deathCauseKind === "condition" ? "Health history" : "What led to it"}</strong>{displayProse(life.deathCauseContext)}</p>}<p className="memorial-dates">{formatYear(world.startYear)} <span>—</span> {formatYear(life.year)}</p><strong>{yearsLived(life.age)}</strong>{!deathCause && <p>{ending?.kind === "chapter" ? displayProse(ending.text) : life.age === 0 ? "You died before your first birthday." : life.age < 18 ? "You died before reaching adulthood." : life.flags.parent ? "Your children and household are listed in the character record." : "Read the chronicle to review this life."}</p>}</div>
                  <button className="primary-button" onClick={openChronicle}>Read your life’s chronicle <Icon name="book" size={19} /></button>
                  {!ranked && <button className="text-button" onClick={() => setRestartOpen(true)}>Begin another life <Icon name="arrow" size={17} /></button>}
                  <SourceLinks ids={ending?.sourceIds} />
              </div>
            </section>}
          </>}
        </section>
      </div>
      {game.hasBegun && <LifeYearRail life={life} onOpenChronicle={openChronicle} />}
      {game.hasBegun && <aside className="life-support-grid" aria-label="Household and life records">
        <HouseholdSummary life={life} world={world} onOpenCharacter={() => { setCharacterSection("children"); setPanel("character"); }} />
        <div className="life-support-records">
          <details className="compact-life-record compact-legacy-record"><summary><span>Works &amp; deeds</span><span className="life-record-count">View accomplishments <span aria-hidden="true">+</span></span></summary><CurrentLegacySummary life={life} world={world} onOpenGallery={() => setPanel("legacy")} /></details>
          <details className="chronicle-preview compact-life-record"><summary><span>Life record</span><span className="life-record-count">{life.age + 1} {life.age === 0 ? "year" : "years"} recorded <span aria-hidden="true">+</span></span></summary><header className="life-record-heading"><div className="chronicle-heading"><h2 id="life-timeline-title"><Icon name="feather" size={20} />Life record</h2><button className="text-button" onClick={openChronicle}>Full chronicle <Icon name="arrow" size={15} /></button></div><p className="chronicle-description">Newest first</p></header><LifeEventFeed life={life} world={world} /></details>
        </div>
      </aside>}
      {(game.notice || downloadError) && <div className="notice" role="status"><Icon name="feather" size={16} /><span>{downloadError || game.notice}</span><button aria-label="Dismiss notification" onClick={() => { game.setNotice(""); setDownloadError(""); }}><Icon name="close" size={15} /></button></div>}
    </main>

    <footer className="site-footer"><span><StorybookMark size={19} /> Everfolk · {place}</span><div><button onClick={() => setPanel("sources")}>History &amp; sources</button><span className="footer-dot">·</span><button onClick={() => setPanel("about")}>About this world</button></div></footer>
    </div>
    {!game.hasBegun && <BirthRollPopover key={`${life.worldFingerprint}:${life.seed}`} open={birthPopoverOpen} life={life} world={world} revealed={game.hasRevealedStats} onReveal={game.revealStats} onChooseAvatar={game.chooseAvatar} onReborn={game.restart} onClose={() => { setBirthPopoverOpen(false); setMenuOpen(true); }} onContinue={beginWithReadingPause} />}
    {decisionDisplayEvent && <DecisionDialog open={decisionOpen} event={decisionDisplayEvent} life={life} world={world} choices={choices} returnFocusRef={decisionButtonRef} onChoose={selectChoice} onSetAside={() => setDeferredDecision(decisionKey)} onEnableAuto={() => { game.setAutoDecisions(true); game.setPlaying(true); }} />}
    <dialog ref={dialogRef} className={`detail-dialog ${panel === "sources" ? "sources-dialog" : panel === "legacy" ? "legacy-dialog" : panel === "wiki" ? "skill-wiki-dialog" : panel === "map" ? "location-map-dialog" : ""}`} onCancel={e => { e.preventDefault(); closeDialog(); }} onClick={e => { if (e.target === e.currentTarget) closeDialog(); }} aria-labelledby="dialog-title">
      <div className="dialog-content"><button className="dialog-close" aria-label="Close panel" onClick={closeDialog}><Icon name="close" /></button><input ref={importRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Import a saved life" onChange={e => { void importFile(e.target.files?.[0]); }} />
        {(dialogError || downloadError) && <p className="dialog-error" role="alert">{dialogError || downloadError}</p>}
        {restartOpen ? <>
          <p className="eyebrow">NEW LIFE</p><h2 id="dialog-title">Start a new life?</h2>
          <p>Your current life will be replaced by a new birth. Completed lives remain in this browser’s past-lives archive. You can download the current life first.</p>
          {(world.character?.playerNames?.length ?? 0) > 1 && world.origins.length > 1 && <p>A new name, household and starting stats will be rolled.</p>}
          <div className="dialog-actions"><button className="secondary-button" onClick={() => downloadLife()}><Icon name="download" size={18} /> Download current life</button><button className="primary-button" onClick={() => { game.setPlaying(false); closeDialog(); if (onNewLife) onNewLife(life); else game.restart(); }}>Begin another life <Icon name="arrow" /></button></div>
        </> : panel === "character" ? <>
          <p className="eyebrow">CHARACTER</p><h2 id="dialog-title">{characterName}</h2>
          <CharacterPanel key={characterSection} life={life} world={world} onActivity={requestActivity} initialSection={characterSection} />
        </> : panel === "wiki" ? <>
          <p className="eyebrow">SKILL REFERENCE</p><h2 id="dialog-title">Skill wiki</h2>
          <SkillTree life={life} world={world} activities={activities} onActivity={requestActivity} initialView="wiki" />
        </> : panel === "map" ? <>
          <p className="eyebrow">YOUR SURROUNDINGS</p><h2 id="dialog-title">Your place in Egypt</h2>
          <WorldMap life={life} world={world} />
        </> : panel === "chronicle" ? <>
          <p className="eyebrow">{chronicleNameKnown ? chronicleName.toLocaleUpperCase() : "CHRONICLE"}</p><h2 id="dialog-title">Life history</h2>
          <p className="dialog-subtitle">{chronicleLife.phase === "ended" ? `${formatYear(chronicleWorld.startYear)} — ${formatYear(chronicleLife.year)} · ${yearsLived(chronicleLife.age)}` : "Your life record, grouped by year."}</p>
          {chronicleLife.deathCauseContext && <p><strong>{chronicleLife.deathCauseKind === "condition" ? "Health history:" : "What led to it:"}</strong> {displayProse(chronicleLife.deathCauseContext)}</p>}{chronicleCause ? <p><strong>Cause of death: {chronicleCause.title}.</strong> {displayProse(chronicleCause.text)}</p> : chronicleEnding && <p>{displayProse(chronicleEnding.text)}</p>}
          {chronicleNameKnown && chronicleWealthComparison && chronicleLife.economy && <div className="wealth-summary-line"><p><strong>{chronicleLife.phase === "ended" ? chronicleEnding?.kind === "chapter" ? "Total wealth at record end" : "Total wealth at death" : "Total wealth"}:</strong> {formatMoney(chronicleWealthComparison.netWorth, chronicleWorld)} estimated net worth · {formatMoney(chronicleLife.economy.cash, chronicleWorld)} cash · {formatMoney(chronicleLife.economy.debt, chronicleWorld)} debt.</p><p><strong>Society percentile:</strong> {formatWealthStanding(chronicleWealthComparison.percentile)} · Median household wealth {formatMoney(chronicleWealthComparison.medianWealth, chronicleWorld)}. Game estimate against this world’s fixed starting-household benchmark.</p></div>}
          {chronicleNameKnown ? <LifeJournal life={chronicleLife} /> : <p>Your starting stats are still being revealed. Return to your life to finish the reveal.</p>}
          <button className="secondary-button" onClick={() => downloadLife(exportLife(chronicleLife), `everfolk-${chronicleName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "character"}-life-age-${chronicleLife.age}.json`)}><Icon name="download" size={18} /> Download this life</button>
        </> : panel === "legacy" ? <>
          <p className="eyebrow">ACROSS YOUR LIVES</p><h2 id="dialog-title">Works &amp; deeds</h2>
          <LegacyGallery entries={legacyEntries} currentLifeKey={legacyLifeKey(life)} storageNotice={legacyNotice} />
        </> : panel === "archive" ? <>
          <p className="eyebrow">SAVED LIVES</p><h2 id="dialog-title">Past lives</h2>
          <p>Up to ten completed lives are kept here, newest first. Download a save to keep a copy outside this browser.</p>
          <div className="past-lives">{game.archivedLives.length === 0 ? <p className="empty-archive">No completed lives yet.</p> : game.archivedLives.map(entry => <article className="archived-life" key={entry.id}><span className="eyebrow">{formatYear(entry.birthYear)} — {formatYear(entry.year)}</span><h3>{entry.endingTitle}</h3><p>{yearsLived(entry.age)}</p><div><button className="text-button" onClick={() => readArchived(entry)}>Read this life <Icon name="book" size={15} /></button><button className="text-button" onClick={() => downloadLife(entry.save, `everfolk-past-life-age-${entry.age}.json`)}>Download <Icon name="download" size={15} /></button></div></article>)}</div>
          <button className="secondary-button" onClick={() => importRef.current?.click()}><Icon name="book" size={18} /> Import a saved life</button>
        </> : panel === "sources" ? <>
          <p className="eyebrow">HISTORY &amp; FICTION</p><h2 id="dialog-title">Historical sources</h2>
          <p>The sources below cover historical dates and daily life. {game.hasRevealedStats ? characterName : "Your character"} and their accomplishments are fictional. Prices, rewards and event probabilities are set for the game.</p>
          <section className="mortality-source-note"><h3>How a life can end</h3><p>{modelNote(world.health?.description ?? world.mortality?.description ?? "Death rates are set for the game. They are not measured rates for ancient Alexandria.")}</p><SourceLinks ids={world.health?.sourceIds ?? world.mortality?.sourceIds} />{world.character && <p>{modelNote(world.character.deathCauseDescription)}</p>}</section>
          <div className="evidence-key"><span>Documented history</span><span>Historical context · fictional story</span><span>Fictional personal story</span></div>
          <div className="sources-list">{world.sources?.map(source => <article key={source.id} id={`source-${source.id}`}><span className="eyebrow">{source.kind} · {source.publisher}</span><h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></h3><p className="source-period">{source.period} · {source.geography}</p><p>{sourceSummary(source.summary)}</p><p className="source-limits"><strong>Scope:</strong> {sourceScope(source.limitations)}</p></article>)}</div>
        </> : panel === "world" ? <>
          <p className="eyebrow">THE ANCIENT MEDITERRANEAN</p><h2 id="dialog-title">{world.title}</h2><img className="dialog-scene" src="/assets/pixel/worlds/alexandria.svg" alt="Pixel illustration of an imagined ancient Egyptian coastal harbor" />
          <p>{worldBeginning(world)}</p><p>You can work at the harbor, learn a trade or study writing. Choose a job, meet a partner and decide whether to have children.</p>
          <dl className="world-facts"><div><dt>BIRTHPLACE</dt><dd>{birthplace}, Egypt</dd></div><div><dt>BIRTH YEAR</dt><dd>{formatYear(world.startYear)}</dd></div><div><dt>YOUR BEGINNING</dt><dd>At birth</dd></div><div><dt>YOUR ENDING</dt><dd>A completed life</dd></div></dl>
          <p className="fine-print">The dates and setting draw on historical sources. Your character is fictional, and the artwork imagines the city. Sources labels evidence from other periods and places.</p><button className="secondary-button" onClick={() => setPanel("sources")}>Read the sources <Icon name="book" size={17} /></button>
        </> : <>
          <p className="eyebrow">EVERFOLK</p><h2 id="dialog-title">About Everfolk</h2>
          <p>Begin at birth and play through a life. The clock runs between decisions and pauses while you choose. You can pause it, change the speed or skip ahead to the next decision.</p><p>{world.health?.mortalityCalibration ? "Childhood has easier health rules. From age 18, serious-illness frequency follows the historical comparison model. Illness is recorded before it can be fatal. Health, care and family support affect recovery. Sources explains how the model works." : world.health ? "Illnesses and injuries are recorded before they can be fatal. Care and close family can help you recover. Risky choices can kill you. The probabilities are game rules; Sources explains their historical basis." : "You can die young. The death rates estimate risks for the game; they are not measured rates for Ptolemaic Alexandria. See Sources for the data and each event’s historical basis."}</p><p>Your game saves in this browser when storage is available. The archive holds up to ten completed lives. Download a save to keep a copy, or import one to resume it.</p>
          <div className="dialog-actions"><button className="secondary-button" onClick={() => importRef.current?.click()}>Import a saved life <Icon name="book" size={17} /></button><button className="primary-button" onClick={closeDialog}>Return to your life <Icon name="arrow" /></button></div><p className="fine-print">The artwork shows imagined settings.</p>
        </>}
      </div>
    </dialog>
    {loanRequest && loanRequest.snapshot === life && requestedLoanChoice && <LoanOfferDialog request={loanRequest} choice={requestedLoanChoice} life={life} world={world} onCancel={() => setLoanRequest(null)} onConfirm={confirmLoan} />}
    <LoanDeadlineDialog open={loanWarningOpen && Boolean(repaymentWarning)} life={life} world={world} onDismiss={dismissLoanWarning} onManage={() => { dismissLoanWarning(); setCharacterSection("wealth"); setPanel("character"); }} />
  </>;
}

export default App;
