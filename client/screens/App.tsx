import type { RankedPlay } from "../hooks/useGame.ts";
import { findLifeEvent } from "../models/life-event-lookup.ts";
import InfluenceMarkerTag from "../components/InfluenceMarkerTag.tsx";
import { influenceMarker } from "../models/influence-marker.ts";
import EconomyPanels, { type ComparisonSide, type EconomyTabId } from "../demo/EconomyPanels.tsx";
import ResourceBar from "../demo/ResourceBar.tsx";
import type { TradeItem } from "../../src/demo/contracts.ts";
import LifeChoiceBoard from "../components/LifeChoiceBoard.tsx";
import EventNotificationStack from "../components/EventNotificationStack.tsx";
import GameMusicPlayer from "../components/GameMusicPlayer.tsx";
import { activityGate, demoScreen, freePlayIntro, occupationBadge } from "../demo/screen.ts";
import WikiLibrary from "../components/WikiLibrary.tsx";
import "../styles/creator-tokens.css";
import "../styles/creator-system.css";
import "../styles/interface-refinements.css";
import { storehouseRows } from "../demo/storehouse-model.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { lifeStageView, formatYear } from "../../src/index.ts";
import type { LifeState, JournalEntry, WorldPack } from "../../src/types.ts";
import type { WorldRoute } from "../../server/content.ts";
import type { EventVisuals } from "../models/scene-model.ts";
import type { ArchivedLife } from "../types/session.ts";
import { engineForLife, exportLife, loadAnyLife, sampleEngine } from "../lib/world-session.ts";
import { useGame } from "../hooks/useGame.ts";
import { useLegacyGallery } from "../hooks/useLegacyGallery.ts";
import PaperScene from "../components/PaperScene.tsx";
import CharacterPanel from "../components/CharacterPanel.tsx";
import BirthRollPopover from "../components/BirthRollPopover.tsx";
import MainMenu from "./MainMenu.tsx";
import DecisionDialog from "../components/DecisionDialog.tsx";
import LifeEventFeed from "../components/LifeEventFeed.tsx";
import LifeOverview from "../components/LifeOverview.tsx";
import LifeMoment from "../components/LifeMoment.tsx";
import LifeYearRail from "../components/LifeYearRail.tsx";
import { buildImportantLifeEvents } from "../models/important-life-events.ts";
import { eventNotificationLifeKey, MAX_EVENT_NOTIFICATIONS, NOTIFICATION_DURATION_MS } from "../models/event-notifications.ts";
import { readSeenEventNotifications, rememberSeenEventNotifications } from "../state/event-notification-store.ts";
import { readEverfolkStorage } from "../lib/brand-storage.ts";
import HouseholdSummary from "../components/HouseholdSummary.tsx";
import LifeHealthPanel from "../components/LifeHealthPanel.tsx";
import { MoneylenderNotice } from "../components/MoneylenderPanel.tsx";
import { getLoanSummary, loanDeadlineWarning } from "../models/loan-summary.ts";
import { activityLoanOffer, isBorrowChoice } from "../models/loan-access.ts";
import LoanOfferDialog from "../components/LoanOfferDialog.tsx";
import type { LoanRequest } from "../components/LoanOfferDialog.tsx";
import LoanDeadlineDialog from "../components/LoanDeadlineDialog.tsx";
import YearlyFocus from "../components/YearlyFocus.tsx";
import { formatMoney } from "../models/wealth.ts";
import { formatWealthStanding, getWealthComparison } from "../models/wealth-comparison.ts";
import PixelIcon from "../components/PixelIcon.tsx";
import PixelPortrait from "../components/PixelPortrait.tsx";
import EverfolkWordmark from "../components/EverfolkWordmark.tsx";
import FreePlayBoosterModal from "../chain/FreePlayBoosterModal.tsx";
import { displayProse } from "../models/display-prose.ts";
import { modelNote, sourceScope, sourceSummary } from "../models/source-copy.ts";
import CompactSkillPanel from "../components/CompactSkillPanel.tsx";
import SkillTree from "../components/SkillTree.tsx";
import WorldMap from "../components/WorldMap.tsx";
import { supportsLocationMap } from "../models/location-map.ts";
import LegacyGallery, { CurrentLegacySummary } from "../components/LegacyGallery.tsx";
import { legacyLifeKey } from "../storage/legacy-store.ts";
import { choiceProgressFeedback } from "../models/compact-skill.ts";
import type { ProgressFeedback } from "../models/compact-skill.ts";
import { personText, resolvePartner } from "../../src/people.ts";
import { romanticPartnerLabel } from "../models/relationship-labels.ts";
import { worldBeginning, worldPlace } from "../models/world-era.ts";
import "../styles/birth-intro.css";
import "../styles/life-dashboard.css";
import "../styles/life-info-sidebar.css";
import "../styles/pixel-theme.css";
import "../styles/everfolk-ui.css";
import "../styles/storybook-theme.css";
import "../styles/readable-type.css";
import "../styles/printed-folktale.css";
import { journalKind } from "../models/journal-kind.ts";
import "../styles/save-recovery.css";

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
  if (entry.type === "event") return findLifeEvent(world, entry.id)?.sourceIds ?? [];
  if (entry.type === "ending") return world.endings.find(item => item.id === entry.id)?.sourceIds ?? [];
  return [];
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

export type AppPanel = "world" | "chronicle" | "sources" | "archive" | "legacy" | "about" | "character" | "wiki" | "map" | null;
export type CharacterSection = "career" | "wealth" | "children" | "skills" | "relationships";

function App({ onChooseWorld, onNewLife, onImportedLife, worldPickerOpen = false, startFresh = false, startFreshFrom, eventVisuals, ranked, initialPanel = null, initialCharacterSection = "career", deferInitialDecision = false, demoComparison = null }: { onChooseWorld?: () => void; onNewLife?: (previous: LifeState) => void; onImportedLife?: (life: LifeState) => void; worldPickerOpen?: boolean; startFresh?: boolean; startFreshFrom?: LifeState; worldRoutes?: WorldRoute[]; eventVisuals?: EventVisuals; ranked?: RankedPlay; initialPanel?: AppPanel; initialCharacterSection?: CharacterSection; deferInitialDecision?: boolean; demoComparison?: { withDeed: ComparisonSide; withoutDeed: ComparisonSide } | null }) {
  const [panel, setPanel] = useState<AppPanel>(initialPanel);
  const [characterSection, setCharacterSection] = useState<CharacterSection>(initialCharacterSection);
  const [restartOpen, setRestartOpen] = useState(false);
  // A ranked life opens straight into play; free play starts at the main menu.
  const [menuOpen, setMenuOpen] = useState(!ranked);
  const [birthPopoverOpen, setBirthPopoverOpen] = useState(startFresh);
  const [readingPause, setReadingPause] = useState(false);
  const [deferredDecision, setDeferredDecision] = useState<string | null>(() => {
    const initial = ranked?.initial ?? startFreshFrom;
    return deferInitialDecision && initial?.phase === "choice" ? `${initial.seed}:${initial.age}:${initial.pendingEventId}` : null;
  });
  const [requestedDecision, setRequestedDecision] = useState<string | null>(null);
  const [loanRequest, setLoanRequest] = useState<LoanRequest | null>(null);
  const [loanWarningOpen, setLoanWarningOpen] = useState(false);
  const [freePlayBoosterOpen, setFreePlayBoosterOpen] = useState(false);
  const loanWarningsSeen = useRef(new Set<string>());
  const game = useGame({ isOverlayOpen: readingPause || menuOpen || panel !== null || restartOpen || worldPickerOpen || birthPopoverOpen || loanRequest !== null || loanWarningOpen, startFresh, startFreshFrom, ranked });
  const { life } = game;
  const decisionKey = life.phase === "choice" ? `${life.seed}:${life.age}:${life.pendingEventId}` : null;
  const menuLifeRef = useRef<string | null>(null);
  const lifeEngine = engineForLife(life);
  const world = lifeEngine.world;
  const demoView = useMemo(() => demoScreen(world, life), [world, life]);
  const intro = freePlayIntro(world);
  const wealthComparison = useMemo(() => getWealthComparison(world, life), [world, life]);
  const place = worldPlace(world, life.year);
  const birthplace = worldPlace(world, world.startYear);
  const characterName = life.character?.name ?? "Damon";
  const displayName = game.hasRevealedStats ? characterName : "Your life";
  const deathCause = world.character?.deathCauses.find(item => item.id === life.deathCauseId);
  const [downloadError, setDownloadError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [selectedTradeItem, setSelectedTradeItem] = useState<{ item: TradeItem; seq: number } | null>(null);
  const [selectedEconomyTab, setSelectedEconomyTab] = useState<{ tab: EconomyTabId; seq: number } | null>(null);
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
  const decisionEvent = findLifeEvent(world, life.pendingEventId);
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
  const dashboardVisible = game.hasBegun && !menuOpen && !panel && !restartOpen && !worldPickerOpen && !birthPopoverOpen && !loanRequest && !loanWarningOpen;
  const decisionOpen = Boolean(dashboardVisible && !readingPause && decisionEvent && decisionKey !== deferredDecision && !game.autoDecisions && (game.isPlaying || decisionKey === requestedDecision));

  useEffect(() => {
    if (!game.isPlaying) {
      setReadingPause(false);
      setRequestedDecision(null);
    }
  }, [game.isPlaying]);

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
  const hasFamilySection = Boolean(life.character?.family?.length || life.age >= 12 || life.character?.children?.length);
  const stageTitle = lifeStageView(world, life.age)?.title;
  const [progressFeedback, setProgressFeedback] = useState<(ProgressFeedback & { lifeKey: string }) | null>(null);
  const progressNotification = useRef({ createdAt: 0, eventCount: 0 });
  const importantEventCount = useMemo(() => buildImportantLifeEvents(life, world).reduce((count, year) => count + year.events.length, 0), [life, world]);
  const previousProgressLife = useRef(life);
  const { legacyEntries, legacyNotice } = useLegacyGallery(life, world, game.archivedLives);
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
    if (!repaymentWarning || readingPause || !game.isPlaying || !game.hasBegun || menuOpen || panel || restartOpen || worldPickerOpen || birthPopoverOpen || loanRequest || life.phase !== "ready") return;
    const key = repaymentWarning.key;
    if (loanWarningsSeen.current.has(key)) return;
    try { if (readEverfolkStorage(window.sessionStorage, `everfolk:loan-warning:${key}`) === "seen") return; } catch { /* An in-memory reminder still works. */ }
    setLoanWarningOpen(true);
  }, [repaymentWarning?.key, readingPause, game.isPlaying, game.hasBegun, menuOpen, panel, restartOpen, worldPickerOpen, birthPopoverOpen, loanRequest, life.phase]);

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
    if (previous.worldFingerprint !== life.worldFingerprint || previous.seed !== life.seed || life.commands.length < previous.commands.length) { setProgressFeedback(null); return; }
    const feedback = choiceProgressFeedback(previous, life, world);
    if (feedback) {
      const lifeKey = eventNotificationLifeKey(life);
      const seen = new Set(readSeenEventNotifications(lifeKey));
      const accomplishments = feedback.accomplishments.filter(record => !seen.has(`accomplishment:${record.id}`));
      progressNotification.current = { createdAt: Date.now(), eventCount: importantEventCount };
      setProgressFeedback({ ...feedback, accomplishments, lifeKey });
    }
  }, [life, world, importantEventCount]);

  useEffect(() => {
    if (progressFeedback?.accomplishments.length) {
      rememberSeenEventNotifications(progressFeedback.lifeKey, progressFeedback.accomplishments.map(record => `accomplishment:${record.id}`));
    }
  }, [progressFeedback]);

  useEffect(() => {
    if (!progressFeedback) return;
    const { createdAt, eventCount } = progressNotification.current;
    const remainingMs = NOTIFICATION_DURATION_MS - (Date.now() - createdAt);
    if (importantEventCount - eventCount >= MAX_EVENT_NOTIFICATIONS || remainingMs <= 0) {
      setProgressFeedback(null);
      return;
    }
    const timer = window.setTimeout(() => setProgressFeedback(null), remainingMs);
    return () => window.clearTimeout(timer);
  }, [importantEventCount, progressFeedback]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (restartOpen || panel) {
      if (dialog && !dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  }, [panel, restartOpen]);

  useEffect(() => {
    const identity = `${life.worldFingerprint}:${life.seed}`;
    if (menuLifeRef.current === identity) return;
    const firstVisit = menuLifeRef.current === null;
    menuLifeRef.current = identity;
    setReadingPause(false);
    if (!firstVisit) setDeferredDecision(null);
    setRequestedDecision(null);
    // Keep the experience chooser and wallet accessible on arrival. A requested new free life still opens its roll.
    setBirthPopoverOpen(!ranked && (!firstVisit || startFresh) && !game.hasBegun && life.phase !== "ended");
    setMenuOpen(!ranked);
  }, [life.worldFingerprint, life.seed]);

  useEffect(() => {
    if (game.hasBegun && !menuOpen && !panel && !restartOpen && !birthPopoverOpen && (isBirthSituation || life.phase === "ended")) {
      sceneRef.current?.focus({ preventScroll: true });
    }
  }, [game.hasBegun, menuOpen, life.pendingEventId, life.phase, isBirthSituation, panel, restartOpen, birthPopoverOpen]);

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
    const gate = activityGate(world, activity, Boolean(activity && activityLoanOffer(world, life, activity)), Boolean(activity && activity.available && isBorrowChoice(activity)));
    if (gate.action === "ignore" || !activity) return;
    if (gate.action === "blocked") { game.setNotice(gate.reason); return; }
    if (gate.action === "loan") setLoanRequest({ kind: activityLoanOffer(world, life, activity) ? "fund-activity" : "activity", id, snapshot: life });
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
    {game.unreadableSave !== null && <aside className="save-recovery" role="alert">
      <strong>Your previous save is protected</strong>
      <p>This version could not open it. You can try the game in memory; the original save will stay unchanged until you choose to replace it.</p>
      <div><button type="button" onClick={() => downloadLife(game.unreadableSave!, "everfolk-protected-save.json")}>Download original save</button><button type="button" onClick={game.resetUnreadableSave}>Replace protected save with this life</button></div>
    </aside>}
    {menuOpen && <MainMenu life={life} world={world} rankedLife={Boolean(ranked)} hasBegun={game.hasBegun} hasRevealedStats={game.hasRevealedStats} onBegin={beginFromMenu} onContinue={continueFromMenu} onWorlds={onChooseWorld} onPastLives={() => setPanel("archive")} onLegacy={() => setPanel("legacy")} onSources={() => setPanel("sources")} notice={game.notice || downloadError} active={!panel && !restartOpen && !birthPopoverOpen && !worldPickerOpen} />}
    <div className="everfolk-game" hidden={menuOpen}>
    <a className="skip-link" href="#life-scene">Skip to your life</a>
    <header className="site-header">
      <a className="brand" href="#" aria-label="Everfolk main menu" onClick={e => { e.preventDefault(); openMainMenu(); }}>
        <EverfolkWordmark />
      </a>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={!panel ? "nav-link active" : "nav-link"} onClick={closeDialog}><span className="small-dot" />Your life</button>
        <button className={panel === "character" ? "nav-link active" : "nav-link"} disabled={!game.hasRevealedStats} onClick={() => { setCharacterSection("career"); setPanel("character"); }}>Character</button>
        <button className={panel === "character" && characterSection === "skills" ? "nav-link active" : "nav-link"} onClick={() => { setCharacterSection("skills"); setPanel("character"); }}>Skill tree</button>
        <button className={panel === "world" ? "nav-link active" : "nav-link"} onClick={() => setPanel("world")}>Wiki</button>
        {supportsLocationMap(world) && <button className={panel === "map" ? "nav-link active" : "nav-link"} onClick={() => setPanel("map")}>Map</button>}
        <button className={panel === "archive" ? "nav-link active" : "nav-link"} onClick={() => setPanel("archive")}>Past lives</button>
        <button className={panel === "legacy" ? "nav-link active" : "nav-link"} onClick={() => setPanel("legacy")}>Legacy</button>
        <button className={panel === "sources" ? "nav-link active" : "nav-link"} onClick={() => setPanel("sources")}>Sources</button>
        {onChooseWorld && <button className="nav-link" onClick={onChooseWorld}>Worlds</button>}
        <a className="nav-link" href="#weave">Weave Mode</a>
      </nav>
      <div className="header-right-cluster">
        <GameMusicPlayer />
        <div className={`save-indicator ${game.saveStatus === "unavailable" ? "save-warning" : ""}`} role="status">
          <Icon name={game.saveStatus === "saved" ? "check" : "feather"} size={15} />
          <span>{game.saveStatus === "saved" ? "Saved" : game.saveStatus === "saving" ? "Saving…" : "Save unavailable"}</span>
        </div>
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
        <div className="life-session-age">Age <strong>{life.age}</strong>{stageTitle && <span className="life-session-stage"> · {stageTitle}</span>}</div><div className="life-session-year">{formatYear(life.year)} · {supportsLocationMap(world) ? <button type="button" className="location-map-open" aria-label={`Open location map: ${place}, Egypt`} onClick={() => setPanel("map")}><Icon name="pin" size={13} />{place}</button> : place}</div>
        <div className="playback-bar life-clock">
          <div className="playback-label"><span className={`status-dot ${game.isClockRunning ? "running" : ""}`} /><span role="timer" aria-live="off">{readingPause ? "Reading pause" : life.phase === "choice" ? game.autoDecisions ? game.isPlaying ? "Auto choosing…" : "Auto mode paused" : "Decision waiting" : life.phase === "ended" ? "Life complete" : game.isClockRunning ? `Next year in ${(game.clockRemainingMs / 1000).toFixed(1)}s` : "Paused"}</span></div>
          <div className="playback-controls"><button className={`play-button session-play ${game.isPlaying ? "selected" : ""}`} aria-label={game.isPlaying ? "Pause automatic progression" : "Play automatic progression"} aria-pressed={game.isPlaying} disabled={life.phase === "ended"} onClick={() => { if (game.isPlaying) game.pauseLife(); else continueWithReadingPause(); }}><Icon name={game.isPlaying ? "pause" : "play"} size={14} /><span>{game.isPlaying ? "Pause" : "Resume"}</span></button>{([1, 2, 4, 8, 12, 16] as const).map(speed => <button key={speed} className={`speed-button ${speed > 8 ? "advanced-speed " : ""}${game.speed === speed ? "selected" : ""}`} aria-label={`Playback speed ${speed} times`} aria-pressed={game.speed === speed} onClick={() => game.setSpeed(speed)}>{speed}×</button>)}</div>
          <button className="text-button turning-point-button" ref={decisionButtonRef} disabled={life.phase !== "ready" && life.phase !== "choice"} onClick={() => { setReadingPause(false); if (life.phase === "choice") { game.setAutoDecisions(false); setDeferredDecision(null); setRequestedDecision(decisionKey); } else game.nextTurningPoint(); }}>{life.phase === "choice" ? "Open decision" : "Next decision"} <Icon name="arrow" size={15} /></button>
          <div className="session-desktop-actions"><button type="button" className={`session-auto${game.autoDecisions ? " is-on" : ""}`} aria-pressed={game.autoDecisions} disabled={life.phase === "ended"} onClick={() => game.setAutoDecisions(value => !value)}>Auto mode</button><button className="session-manage" onClick={() => { setCharacterSection(hasFamilySection ? "children" : "skills"); setPanel("character"); }}>{hasFamilySection ? "Family & life" : "Character & skills"}</button><button className="session-manage" onClick={() => { setCharacterSection("wealth"); setPanel("character"); }}>Spend</button></div>
          <details ref={playbackMenuRef} className="session-more"><summary aria-label="More controls">⋯</summary><div className="session-more-options"><button type="button" aria-pressed={game.autoDecisions} disabled={life.phase === "ended"} onClick={() => { game.setAutoDecisions(value => !value); if (playbackMenuRef.current) playbackMenuRef.current.open = false; }}>Auto mode {game.autoDecisions ? "on" : "off"}</button><button onClick={() => { if (playbackMenuRef.current) playbackMenuRef.current.open = false; setCharacterSection(hasFamilySection ? "children" : "skills"); setPanel("character"); }}>{hasFamilySection ? "Family & life" : "Character & skills"}</button><button onClick={() => { if (playbackMenuRef.current) playbackMenuRef.current.open = false; setCharacterSection("wealth"); setPanel("character"); }}>Spend</button>{([12, 16] as const).map(speed => <button key={speed} type="button" aria-label={`Playback speed ${speed} times`} aria-pressed={game.speed === speed} onClick={() => { game.setSpeed(speed); if (playbackMenuRef.current) playbackMenuRef.current.open = false; }}>{speed}× speed</button>)}</div></details>
          {life.phase === "ready" && <div className="year-clock-track" role="progressbar" aria-label="Progress to the next year" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(game.clockProgress * 100)}><span style={{ width: `${game.clockProgress * 100}%` }} /></div>}
        </div>
      </section>}

      {game.hasBegun && <LifeYearRail life={life} />}
      {game.hasBegun && demoView && <ResourceBar rows={storehouseRows(world, life)} screen={demoView} cashText={life.economy ? formatMoney(life.economy.cash, world) : "0"} onPlan={flaxPlots => game.runDemo({ type: "plan", flaxPlots })} onSelectTradeItem={item => setSelectedTradeItem(prev => ({ item, seq: (prev?.seq ?? 0) + 1 }))} />}
      {dashboardVisible && demoView && <EventNotificationStack life={life} world={world} decisionEvent={decisionDisplayEvent} demoView={demoView} onOpenDecision={() => { setReadingPause(false); game.setAutoDecisions(false); setDeferredDecision(null); setRequestedDecision(decisionKey); }} onOpenChronicle={openChronicle} onOpenPeopleTab={demoView ? () => setSelectedEconomyTab(prev => ({ tab: "people", seq: (prev?.seq ?? 0) + 1 })) : undefined} />}

      <div className={`life-layout ${!game.hasBegun ? "life-layout-birth" : demoView ? "life-layout-weave" : "life-layout-classic"} ${isDead ? "life-has-ended" : ""}`}>
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
              <button className="stat-wealth-open" type="button" disabled={!game.hasRevealedStats} aria-label="Open total wealth and society comparison" title="Total wealth is cash + possessions − debt. Society percentile currently compares your wealth with the game's starting households." onClick={() => { setCharacterSection("wealth"); setPanel("character"); }}>
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
        {game.hasBegun && <LifeOverview life={life} world={world} onOpenWealth={() => { setCharacterSection("wealth"); setPanel("character"); }} />}
        {game.hasBegun && <div className="life-info-sidebar dashboard-skills"><CompactSkillPanel life={life} world={world} activities={activities} onOpenWiki={() => setPanel("wiki")} /></div>}
        {game.hasBegun && <LifeHealthPanel life={life} world={world} onActivity={requestActivity} />}
        {game.hasBegun && <MoneylenderNotice life={life} world={world} onManage={() => { setCharacterSection("wealth"); setPanel("character"); }} />}
        {game.hasBegun && demoView && <aside className="life-support-grid" aria-label="Household and life records">
          <HouseholdSummary life={life} world={world} activities={activities} onActivity={requestActivity} onOpenCharacter={() => { setCharacterSection(hasFamilySection ? "children" : "skills"); setPanel("character"); }} onOpenRelationships={() => { setCharacterSection("relationships"); setPanel("character"); }} onOpenPeopleTab={demoView ? () => setSelectedEconomyTab(prev => ({ tab: "people", seq: (prev?.seq ?? 0) + 1 })) : undefined} />
          <div className="life-support-records">
            {Boolean(life.accomplishments?.length) && <details className="compact-life-record compact-legacy-record"><summary><span>Works &amp; deeds</span><span className="life-record-count">View accomplishments <span aria-hidden="true">+</span></span></summary><CurrentLegacySummary life={life} world={world} onOpenGallery={() => setPanel("legacy")} /></details>}
            <details className="chronicle-preview compact-life-record life-record-panel" open><summary><span className="life-record-title"><Icon name="feather" size={18} />Life record</span><span className="life-record-count">{life.age + 1} {life.age === 0 ? "year" : "years"} recorded <span aria-hidden="true">+</span></span></summary><div className="life-record-toolbar"><p className="chronicle-description">Newest first</p><button className="text-button" onClick={openChronicle}>Full chronicle <Icon name="arrow" size={15} /></button></div><LifeEventFeed life={life} world={world} /></details>
          </div>
        </aside>}
        </div>

        <section className="story-column" aria-label="Your life">
          {!game.hasBegun ? <section className="birth-record birth-intro-record" aria-labelledby="birth-title">
            <div className="birth-intro-art"><img src="/assets/pixel/scenes/birth.svg" alt="Pixel illustration of a newborn and caregiver" /></div>
            <h2 id="birth-title">{game.hasRevealedStats ? `${characterName} is born.` : "A new life begins."}</h2>
            <p>{game.hasRevealedStats ? displayProse(origin.text) : `A new life on Egypt's coast.`}</p>
            <dl className="birth-facts"><div><dt>PLACE</dt><dd>{birthplace}, Egypt</dd></div><div><dt>BORN</dt><dd>{formatYear(world.startYear)}</dd></div><div><dt>HOUSEHOLD</dt><dd>{game.hasRevealedStats ? origin.title : "Not revealed yet"}</dd></div></dl>
            {game.hasRevealedStats && <SourceLinks ids={origin.sourceIds} />}
            <div className="birth-actions"><button className="primary-button" onClick={() => setBirthPopoverOpen(true)}>Start a new life <Icon name="arrow" size={20} /></button><button className="text-button" onClick={() => setPanel("sources")}>History &amp; sources <Icon name="book" size={15} /></button></div>
            <p className="birth-note">A year takes 25 seconds at 1×.</p>
          </section> : <>
            {demoView ? <>
            <LifeChoiceBoard
              life={life}
              world={world}
              activities={activities}
              focusId={game.focusId}
              onAdvance={() => {
                setReadingPause(false);
                game.advance();
              }}
              onOpenChronicle={openChronicle}
              onFocusChange={game.setFocus}
              onActivity={requestActivity}
              onOpenPeopleTab={demoView ? () => setSelectedEconomyTab(prev => ({ tab: "people", seq: (prev?.seq ?? 0) + 1 })) : undefined}
            />
            {demoView && <EconomyPanels screen={demoView} life={life} world={world} activities={activities} cashText={life.economy ? formatMoney(life.economy.cash, world) : "0"} autoPlay={game.autoDecisions} comparison={demoComparison} externalTradeItem={selectedTradeItem} externalTab={selectedEconomyTab} onAutoPlay={game.setAutoDecisions} onTrade={order => game.runDemo(order)} onPlan={flaxPlots => game.runDemo({ type: "plan", flaxPlots })} onDelegate={agent => game.runDemo({ type: "delegate", agent })}
              onActivity={requestActivity} onOpenCharacterSection={sec => { setCharacterSection(sec); setPanel("character"); }} training={activities.filter(item => ["train-farming", "train-craft", "train-warfare", "train-reckoning"].includes(item.id)).map(item => ({ id: item.id, label: item.text, reason: item.available ? null : item.reason ?? "Locked" }))}
              onOccupation={jobId => { const activity = activities.find(item => item.category === "career" && item.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job === jobId))); if (activity) requestActivity(activity.id); }} occupations={(world.character?.jobs ?? []).filter(job => job.id === "farmhand" || job.id === "tenant-farmer" || job.id === "grain-dealer" || job.id === "soldier").map(job => { const badge = occupationBadge(world, job.id, life.character?.jobId === job.id, activities.some(item => item.available && item.outcomes.some(effect => effect.effects.some(e => e.type === "job" && e.job === job.id)))); return { id: job.id, label: job.title, unavailable: badge.label === "Unavailable", reason: badge.detail }; })} />}
            </> : <>
            {life.phase === "choice" && <div className="decision-waiting" role="status"><span>{readingPause && game.isPlaying ? "Reading pause." : game.autoDecisions ? game.isPlaying ? "Auto mode is choosing." : "Auto mode is paused." : "A decision is waiting."}</span><button ref={decisionButtonRef} type="button" onClick={() => { setReadingPause(false); game.setAutoDecisions(false); setDeferredDecision(null); setRequestedDecision(decisionKey); }}>Open decision</button></div>}
            <LifeChoiceBoard
              life={life}
              world={world}
              activities={activities}
              focusId={game.focusId}
              onAdvance={() => {
                setReadingPause(false);
                game.advance();
              }}
              onOpenChronicle={openChronicle}
              onFocusChange={game.setFocus}
              onActivity={requestActivity}
            />
            <aside className="life-support-grid" aria-label="Household and life records">
              <HouseholdSummary life={life} world={world} activities={activities} onActivity={requestActivity} onOpenCharacter={() => { setCharacterSection("children"); setPanel("character"); }} onOpenRelationships={() => { setCharacterSection("relationships"); setPanel("character"); }} />
              <div className="life-support-records">
                {Boolean(life.accomplishments?.length) && <details className="compact-life-record compact-legacy-record"><summary><span>Works &amp; deeds</span><span className="life-record-count">View accomplishments <span aria-hidden="true">+</span></span></summary><CurrentLegacySummary life={life} world={world} onOpenGallery={() => setPanel("legacy")} /></details>}
                <details className="chronicle-preview compact-life-record life-record-panel" open><summary><span className="life-record-title"><Icon name="feather" size={18} />Life record</span><span className="life-record-count">{life.age + 1} {life.age === 0 ? "year" : "years"} recorded <span aria-hidden="true">+</span></span></summary><div className="life-record-toolbar"><p className="chronicle-description">Newest first</p><button className="text-button" onClick={openChronicle}>Full chronicle <Icon name="arrow" size={15} /></button></div><LifeEventFeed life={life} world={world} /></details>
              </div>
            </aside>
            </>}
            {progressFeedback && progressFeedback.accomplishments.length > 0 && <section className="choice-progress-feedback" aria-label="Accomplishments after your choice" role="status" key={progressFeedback.key}>
              <header><strong>After your choice</strong><button type="button" aria-label="Dismiss progress update" onClick={() => setProgressFeedback(null)}>×</button></header>
              {progressFeedback.accomplishments.map(record => <p key={record.id}><strong>{record.name}</strong> · {record.title}</p>)}
            </section>}
            {life.phase === "ended" && <section className="decision-area streamlined-decision is-ended" aria-label="Life summary">
              <div className="choice-list">
                  <div className="memorial-summary"><span className="eyebrow">{characterName.toLocaleUpperCase()} OF ALEXANDRIA</span>{deathCause && <p className="memorial-cause"><span>CAUSE OF DEATH</span><strong>{deathCause.title}</strong></p>}{life.deathCauseContext && <p className="death-context"><strong>{life.deathCauseKind === "condition" ? "Health history" : "What led to it"}</strong>{displayProse(life.deathCauseContext)}</p>}<p className="memorial-dates">{formatYear(world.startYear)} <span>—</span> {formatYear(life.year)}</p><strong>{yearsLived(life.age)}</strong>{!deathCause && <p>{ending?.kind === "chapter" ? displayProse(ending.text) : life.age === 0 ? "You died before your first birthday." : life.age < 18 ? "You died before reaching adulthood." : life.flags.parent ? "Your children and household are listed in the character record." : "Read the chronicle to review this life."}</p>}</div>
                  <button className="primary-button" onClick={openChronicle}>Read your life’s chronicle <Icon name="book" size={19} /></button>
                  {!ranked && <button className="secondary-button freeplay-booster-trigger" type="button" onClick={() => setFreePlayBoosterOpen(true)}>Open booster pack preview <Icon name="sun" size={18} /></button>}
                  {!ranked && <button className="text-button" onClick={() => setRestartOpen(true)}>Begin another life <Icon name="arrow" size={17} /></button>}
                  <SourceLinks ids={ending?.sourceIds} />
              </div>
            </section>}
          </>}
        </section>
      </div>
      {(game.notice || downloadError) && <div className="notice" role="status"><Icon name="feather" size={16} /><span>{downloadError || game.notice}</span><button aria-label="Dismiss notification" onClick={() => { game.setNotice(""); setDownloadError(""); }}><Icon name="close" size={15} /></button></div>}
    </main>

    <footer className="site-footer">
      <span><EverfolkWordmark /> · {place} · <small>Weaving Fates</small></span>
      <div className="site-footer-links">
        <a href="#weave">Weave Mode</a>
        <span className="footer-dot">·</span>
        <a href="#figures">Figures</a>
        <span className="footer-dot">·</span>
        <a href="#market">Market</a>
        <span className="footer-dot">·</span>
        <a href="#mine">My lives</a>
        <span className="footer-dot">·</span>
        <button onClick={() => setPanel("sources")}>History &amp; sources</button>
        <span className="footer-dot">·</span>
        <button onClick={() => setPanel("about")}>About this world</button>
      </div>
    </footer>
    </div>
    {!game.hasBegun && <BirthRollPopover key={`${life.worldFingerprint}:${life.seed}`} open={birthPopoverOpen} life={life} world={world} revealed={game.hasRevealedStats} onReveal={game.revealStats} onChooseAvatar={game.chooseAvatar} onReborn={game.restart} onClose={() => { setBirthPopoverOpen(false); setMenuOpen(true); }} onContinue={beginWithReadingPause} />}
    {decisionDisplayEvent && <DecisionDialog open={decisionOpen} event={decisionDisplayEvent} life={life} world={world} choices={choices} returnFocusRef={decisionButtonRef} demoView={demoView} isLoanDecision={Boolean(isLoanDecision)} isLoanOffer={Boolean(isLoanOffer)} loanBalanceText={loanSummary ? `Balance owed: ${formatMoney(loanSummary.balance, world)}` : loanOfferTerms || null} onChoose={selectChoice} onSetAside={() => setDeferredDecision(decisionKey)} onEnableAuto={() => { game.setAutoDecisions(true); game.setPlaying(true); }} riskPreview={demoView?.convoy ? { knownCosts: demoView.convoy.knownCosts, routes: demoView.convoy.routes, chance: "Expected loss " + demoView.convoy.expectedLossBps / 100 + "%." } : null} />}
    <dialog ref={dialogRef} className={`detail-dialog ${panel === "sources" ? "sources-dialog" : panel === "legacy" ? "legacy-dialog" : panel === "wiki" ? "skill-wiki-dialog" : panel === "map" ? "location-map-dialog" : panel === "character" ? "character-dialog" : ""}`} onCancel={e => { e.preventDefault(); closeDialog(); }} onClick={e => { if (e.target === e.currentTarget) closeDialog(); }} aria-labelledby="dialog-title">
      <div className="dialog-content"><button className="dialog-close" aria-label="Close panel" onClick={closeDialog}><Icon name="close" /></button><input ref={importRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Import a saved life" onChange={e => { void importFile(e.target.files?.[0]); }} />
        {(dialogError || downloadError) && <p className="dialog-error" role="alert">{dialogError || downloadError}</p>}
        {restartOpen ? <>
          <p className="eyebrow">NEW LIFE</p><h2 id="dialog-title">Start a new life?</h2>
          <p>Your current life will be replaced by a new birth. Completed lives remain in this browser’s past-lives archive. You can download the current life first.</p>
          {(world.character?.playerNames?.length ?? 0) > 1 && world.origins.length > 1 && <p>A new name, household and starting stats will be rolled.</p>}
          <div className="dialog-actions"><button className="secondary-button" onClick={() => downloadLife()}><Icon name="download" size={18} /> Download current life</button><button className="primary-button" onClick={() => { game.setPlaying(false); closeDialog(); if (onNewLife) onNewLife(life); else game.restart(); }}>Begin another life <Icon name="arrow" /></button></div>
        </> : panel === "character" ? <>
          <p className="eyebrow">CHARACTER</p><h2 id="dialog-title">{characterName}</h2>
          <CharacterPanel key={characterSection} life={life} world={world} onActivity={requestActivity} onMarketOrder={game.orderMarket} onCancelMarketOrder={game.cancelMarketOrder} initialSection={characterSection} />
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
          {chronicleNameKnown && chronicleWealthComparison && chronicleLife.economy && <div className="wealth-summary-line"><p><strong>{chronicleLife.phase === "ended" ? chronicleEnding?.kind === "chapter" ? "Total wealth at record end" : "Total wealth at death" : "Total wealth"}:</strong> {formatMoney(chronicleWealthComparison.netWorth, chronicleWorld)} estimated net worth · {formatMoney(chronicleLife.economy.cash, chronicleWorld)} cash · {formatMoney(chronicleLife.economy.debt, chronicleWorld)} debt.</p><p><strong>Society percentile:</strong> {formatWealthStanding(chronicleWealthComparison.percentile)} · Median household wealth {formatMoney(chronicleWealthComparison.medianWealth, chronicleWorld)}. Game estimate currently using this world’s starting-household benchmark.</p></div>}
          {chronicleNameKnown ? <LifeJournal life={chronicleLife} /> : <p>Your starting stats are still being revealed. Return to your life to finish the reveal.</p>}
          <button className="secondary-button" onClick={() => downloadLife(exportLife(chronicleLife), `everfolk-${chronicleName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "character"}-life-age-${chronicleLife.age}.json`)}><Icon name="download" size={18} /> Download this life</button>
        </> : panel === "legacy" ? <>
          <p className="eyebrow">ACROSS YOUR LIVES</p><h2 id="dialog-title">Works &amp; deeds</h2>
          <LegacyGallery entries={legacyEntries.filter(entry => entry.lifeKey === legacyLifeKey(life))} currentLifeKey={legacyLifeKey(life)} storageNotice={legacyNotice} />
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
          <p className="eyebrow">THE ANCIENT MEDITERRANEAN</p><h2 id="dialog-title">Wiki</h2><h3>{world.title}</h3><WikiLibrary world={world} onSkills={() => setPanel("wiki")} /><img className="dialog-scene" src="/assets/pixel/worlds/alexandria.svg" alt="Pixel illustration of an imagined ancient Egyptian coastal harbor" />
          <p>{worldBeginning(world)}</p><p>{intro ?? "You can work at the harbor, learn a trade or study writing. Choose a job, meet a partner and decide whether to have children."}</p>
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
    <FreePlayBoosterModal open={freePlayBoosterOpen} life={life} world={world} onClose={() => setFreePlayBoosterOpen(false)} />
  </>;
}

export default App;
