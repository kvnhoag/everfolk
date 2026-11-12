import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { LifeState } from "../../src/types.ts";
import type { OnlinePlay } from "../types/online-play.ts";
import { archiveLife, createDifferentSampleLife, createSampleLife, persistBirthPresentation, persistBirthStatsReveal, newLifeSeed, persistLife } from "../mutations/lives.ts";
import { engineForLife, loadAnyLife } from "../lib/world-session.ts";
import { hasBirthStatsBeenRevealed, hasLifeBegun, readArchivedLives, readRawSavedLife, readSavedLife } from "../queries/lives.ts";
import type { ArchivedLife } from "../types/session.ts";
import { advanceToDecisionWithFocus, advanceYearWithFocus, focusActivity, normalizeYearlyFocus, selectAutomaticChoice, yearlyFocusStorageKey } from "../models/yearly-focus.ts";
import { persistYearlyFocus } from "../mutations/yearly-focus.ts";
import { readYearlyFocus } from "../queries/yearly-focus.ts";
import type { YearlyFocusId } from "../models/yearly-focus.ts";
import { canRunAutomaticDecision, canRunLifeClock, canUseLifeCommands, initialPauseState, updatePauseState } from "../models/pause-state.ts";
import type { PauseState } from "../models/pause-state.ts";
import { activityLoanOffer, borrowAndAct } from "../models/loan-access.ts";
import type { MarketOrderRequest } from "../types/market.ts";
import type { DemoCommand } from "../../src/demo/types.ts";
import "../demo/start.ts";
import { releaseOrder, sendDemoCommand } from "../demo/screen.ts";
import { isUnavailable } from "../../src/demo/availability.ts";

export type SaveStatus = "saving" | "saved" | "unavailable";
import { DEFAULT_PLAYBACK_SPEED, YEAR_DURATION_MS, type PlaybackSpeed } from "../models/playback.ts";
export type { PlaybackSpeed };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something interrupted this action. Please try again.";
}

function savedFocus(life: LifeState): YearlyFocusId {
  if (typeof window === "undefined") return "everyday";
  try { return readYearlyFocus(window.localStorage, life, engineForLife(life).world); }
  catch { return "everyday"; }
}

interface SessionState {
  life: LifeState;
  notice: string;
  hasBegun: boolean;
  hasRevealedStats: boolean;
  unreadableSave?: string | null;
}

function initialSession(startFresh = false, startFreshFrom?: LifeState): SessionState {
  try {
    if (!startFresh && typeof window !== "undefined") {
      const restored = readSavedLife(window.localStorage);
      if (restored) return {
        life: restored, notice: "",
        hasBegun: hasLifeBegun(window.localStorage, restored),
        hasRevealedStats: hasBirthStatsBeenRevealed(window.localStorage, restored),
        unreadableSave: null,
      };
      return { life: createSampleLife(newLifeSeed()), notice: "", hasBegun: false, hasRevealedStats: false, unreadableSave: null };
    }
    return { life: startFresh && startFreshFrom ? createDifferentSampleLife(startFreshFrom) : createSampleLife(), notice: "", hasBegun: false, hasRevealedStats: false, unreadableSave: null };
  } catch (error) {
    const raw = typeof window !== "undefined" ? readRawSavedLife(window.localStorage) : null;
    return { life: createSampleLife(), notice: `${message(error)} A fresh sample is ready.`, hasBegun: false, hasRevealedStats: false, unreadableSave: raw };
  }
}

/** Bridge React to one authoritative engine snapshot; UI pacing stays outside the core. */
/** A ranked life is played through its session: every new state is synced on chain before the player sees it. */
export interface RankedPlay {
  initial: LifeState;
  sync(next: LifeState): Promise<LifeState>;
  current(): LifeState;
  onSynced?(life: LifeState): void;
  /** Open straight onto the live dashboard (paused) without showing the resume screen first. */
  skipResumeScreen?: boolean;
}

/** Lock synchronously, before a second click or a clock callback can submit again. */
export function runOnlineAction(
  online: OnlinePlay,
  pending: { current: boolean },
  action: (play: OnlinePlay) => Promise<LifeState>,
  adopt: (life: LifeState, notice: string) => void,
  onPending: (pending: boolean) => void,
): Promise<void> | null {
  if (pending.current) return null;
  pending.current = true;
  onPending(true);
  return (async () => {
    try {
      const next = await action(online);
      adopt(next, "");
      online.onSynced?.(next);
    } catch (error) {
      // A request may have reached the server before its response was lost.
      adopt(online.current(), message(error));
    } finally {
      pending.current = false;
      onPending(false);
    }
  })();
}

/** Query focus availability locally; only the server may apply either command. */
export async function advanceOnlineYearWithFocus(online: OnlinePlay, life: LifeState, focusId: YearlyFocusId): Promise<LifeState> {
  if (life.phase !== "ready") return life;
  const engine = engineForLife(life);
  const activity = focusActivity(engine.world, normalizeYearlyFocus(focusId, engine.world));
  let next = life;
  if (activity && !isUnavailable(engine.world.demo, "activity", activity.id) && life.character?.lastActivityAge !== life.age &&
    engine.getActivities(life).some(candidate => candidate.id === activity.id && candidate.available)) {
    next = await online.dispatch({ type: "act", activity: activity.id });
  }
  // A focused activity may end the life or open a decision. NPC turns required
  // before an advance are resolved by dispatch, never by a local engine.advance.
  return next.phase === "ready" ? online.dispatch({ type: "advance" }) : next;
}

export function useGame({ isOverlayOpen: overlayFromApp = false, startFresh = false, startFreshFrom, ranked, online }: { isOverlayOpen?: boolean; startFresh?: boolean; startFreshFrom?: LifeState; ranked?: RankedPlay; online?: OnlinePlay } = {}) {
  const [syncing, setSyncing] = useState(false);
  const pendingRef = useRef(false);
  const isOverlayOpen = overlayFromApp || syncing;
  const rankedRef = useRef(ranked);
  rankedRef.current = ranked;
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const externalOnlineLifeRef = useRef(online?.initial);
  const [initial] = useState(() => online || ranked
    ? { life: (online ?? ranked)!.initial, notice: "", hasBegun: true, hasRevealedStats: true, unreadableSave: null }
    : initialSession(startFresh, startFreshFrom));
  const [unreadableSave, setUnreadableSave] = useState<string | null>(() => initial.unreadableSave ?? null);
  const unreadableSaveRef = useRef(unreadableSave);
  unreadableSaveRef.current = unreadableSave;
  const [life, setLife] = useState(initial.life);
  const lifeRef = useRef(life);
  const [focusSelection, setFocusSelection] = useState(() => ({ key: yearlyFocusStorageKey(initial.life), id: startFresh || online ? "everyday" as YearlyFocusId : savedFocus(initial.life) }));
  const focusId = focusSelection.key === yearlyFocusStorageKey(life) ? focusSelection.id : "everyday";
  const focusIdRef = useRef(focusId);
  focusIdRef.current = focusId;
  const [hasBegun, setHasBegun] = useState(initial.hasBegun);
  const hasBegunRef = useRef(hasBegun);
  hasBegunRef.current = hasBegun;
  const [hasRevealedStats, setHasRevealedStats] = useState(initial.hasRevealedStats);
  const [notice, setNotice] = useState(initial.notice);
  // Restored or interrupted lives stay readable with automatic time paused.
  const [pauseState, setPauseState] = useState(initialPauseState);
  const pauseStateRef = useRef(pauseState);
  const isPlaying = pauseState.playing;
  const playbackIntentRef = useRef(isPlaying);
  const clockAllowedRef = useRef(false);
  const [autoDecisions, setAutoDecisionsState] = useState(false);
  const autoIntentRef = useRef(false);
  const autoAllowedRef = useRef(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(DEFAULT_PLAYBACK_SPEED);
  const [clockElapsedMs, setClockElapsedMs] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(ranked || online ? "saved" : "saving");
  const [isVisible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [archivedLives, setArchivedLives] = useState<ArchivedLife[]>([]);
  const yearDurationMs = YEAR_DURATION_MS / speed;
  const pauseContext = { hasBegun, phase: life.phase };
  const isClockRunning = canRunLifeClock(pauseState, pauseContext, isVisible, isOverlayOpen);
  clockAllowedRef.current = isClockRunning;
  autoAllowedRef.current = canRunAutomaticDecision(pauseState, pauseContext, isVisible, isOverlayOpen, autoDecisions);

  const commitPauseState = useCallback((next: PauseState) => {
    pauseStateRef.current = next;
    playbackIntentRef.current = next.playing;
    if (!next.playing) {
      clockAllowedRef.current = false;
      autoAllowedRef.current = false;
    }
    setPauseState(next);
  }, []);

  const adoptOnlineState = useCallback((next: LifeState, notice = "") => {
    if (next.worldFingerprint !== lifeRef.current.worldFingerprint || next.seed !== lifeRef.current.seed) {
      setFocusSelection({ key: yearlyFocusStorageKey(next), id: "everyday" });
    }
    lifeRef.current = next;
    setLife(next);
    hasBegunRef.current = true;
    setHasBegun(true);
    setHasRevealedStats(true);
    setSaveStatus("saved");
    setNotice(notice);
    if (next.phase === "ended") commitPauseState(updatePauseState(pauseStateRef.current, { type: "ended" }, { hasBegun: true, phase: next.phase }));
  }, [commitPauseState]);

  const submitOnline = useCallback((action: (play: OnlinePlay) => Promise<LifeState>) => {
    const play = onlineRef.current;
    if (!play) return false;
    void runOnlineAction(play, pendingRef, action, adoptOnlineState, pending => {
      if (pending) {
        clockAllowedRef.current = false;
        autoAllowedRef.current = false;
        setSaveStatus("saving");
      }
      setSyncing(pending);
    });
    return true;
  }, [adoptOnlineState]);

  useEffect(() => {
    if (!online || pendingRef.current || online.initial === externalOnlineLifeRef.current) return;
    externalOnlineLifeRef.current = online.initial;
    adoptOnlineState(online.current());
  }, [online?.initial, syncing, adoptOnlineState]);

  const setFocus = useCallback((id: YearlyFocusId) => {
    if (lifeRef.current !== life || life.phase === "ended") return;
    const world = engineForLife(life).world;
    const next = normalizeYearlyFocus(id, world);
    const activity = focusActivity(world, next);
    if (activity && life.age < (activity.minAge ?? 0)) return;
    focusIdRef.current = next;
    setFocusSelection({ key: yearlyFocusStorageKey(life), id: next });
  }, [life]);

  const setAutoDecisions = useCallback((value: SetStateAction<boolean>) => {
    const next = typeof value === "function" ? value(autoIntentRef.current) : value;
    autoIntentRef.current = next;
    setAutoDecisionsState(next);
  }, []);

  const setPlaying = useCallback((value: SetStateAction<boolean>) => {
    const next = typeof value === "function" ? value(playbackIntentRef.current) : value;
    commitPauseState(updatePauseState(pauseStateRef.current, { type: "playback", playing: next }, { hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }));
  }, [commitPauseState]);

  const pauseLife = useCallback(() => {
    commitPauseState(updatePauseState(pauseStateRef.current, { type: "pause" }, { hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }));
  }, [commitPauseState]);

  const continueLife = useCallback(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    commitPauseState(updatePauseState(pauseStateRef.current, { type: "continue" }, { hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }));
    setNotice("");
  }, [commitPauseState]);

  const commit = useCallback((next: LifeState, fresh = false) => {
    const rankedPlay = rankedRef.current;
    if (rankedPlay && !fresh) {
      // Pause commands and the clock while key decisions draw and checkpoints post on chain.
      lifeRef.current = next;
      setSaveStatus("saving");
      setSyncing(true);
      void rankedPlay.sync(next).then(adopted => {
        lifeRef.current = adopted;
        setLife(adopted);
        setSaveStatus("saved");
        rankedPlay.onSynced?.(adopted);
        if (adopted.phase === "ended") commitPauseState(updatePauseState(pauseStateRef.current, { type: "ended" }, { hasBegun: hasBegunRef.current, phase: adopted.phase }));
      }, error => {
        const current = rankedPlay.current();
        lifeRef.current = current;
        setLife(current);
        setHasBegun(true);
        setHasRevealedStats(true);
        hasBegunRef.current = true;
        setSaveStatus("saved");
        setNotice(message(error));
      }).finally(() => setSyncing(false));
      return;
    }
    if (fresh || next.worldFingerprint !== lifeRef.current.worldFingerprint || next.seed !== lifeRef.current.seed) {
      setFocusSelection({ key: yearlyFocusStorageKey(next), id: fresh ? "everyday" : savedFocus(next) });
    }
    lifeRef.current = next;
    setLife(next);
    setSaveStatus("saving");
    if (next.phase === "ended" || fresh) commitPauseState(updatePauseState(pauseStateRef.current, { type: next.phase === "ended" ? "ended" : "fresh" }, { hasBegun: hasBegunRef.current, phase: next.phase }));
  }, [commitPauseState]);

  const choose = useCallback((choiceId: string) => {
    // Ignore an old rendered button after its snapshot has already been replaced.
    if (pendingRef.current || !canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    if (submitOnline(play => play.dispatch({ type: "choose", choice: choiceId }))) return;
    try {
      const current = life;
      const next = engineForLife(current).choose(current, choiceId);
      commit(next);
      setNotice("");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, hasBegun, life, submitOnline]);

  const act = useCallback((activityId: string) => {
    if (pendingRef.current || !canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    if (submitOnline(play => play.dispatch({ type: "act", activity: activityId }))) return;
    try {
      const current = life;
      const next = engineForLife(current).act(current, activityId);
      commit(next);
      setNotice("");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, hasBegun, life, submitOnline]);

  const actWithLoan = useCallback((activityId: string) => {
    if (pendingRef.current || !canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    if (submitOnline(async play => {
      const engine = engineForLife(life);
      const activity = engine.world.character?.activities.find(candidate => candidate.id === activityId);
      const offer = activity && activityLoanOffer(engine.world, life, activity);
      if (!offer) throw new Error("This activity cannot be funded by a moneylender loan right now. No loan was accepted.");
      const funded = await play.dispatch({ type: "act", activity: offer.borrowActivityId });
      if (!engineForLife(funded).getActivities(funded).some(candidate => candidate.id === activityId && candidate.available)) {
        throw new Error("The loan was accepted, but this activity is no longer available. Review your life before continuing.");
      }
      return play.dispatch({ type: "act", activity: activityId });
    })) return;
    try {
      // The player has confirmed the contract. Commit both ordinary commands
      // together, so a changed opportunity can never leave an unwanted loan.
      commit(borrowAndAct(engineForLife(life), life, activityId));
      setNotice("");
    } catch (error) { setNotice(message(error)); }
  }, [commit, life, submitOnline]);

  const orderMarket = useCallback((order: MarketOrderRequest) => {
    if (pendingRef.current || !canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    if (submitOnline(play => play.dispatch({ type: "market-order", ...order }))) return;
    try {
      commit(engineForLife(life).orderMarket(life, order));
      setNotice("");
    } catch (error) { setNotice(message(error)); }
  }, [commit, life, submitOnline]);

  const cancelMarketOrder = useCallback((orderId: number) => {
    if (pendingRef.current || !canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    if (submitOnline(play => play.dispatch({ type: "market-cancel", orderId }))) return;
    try {
      commit(engineForLife(life).cancelMarketOrder(life, orderId));
      setNotice("");
    } catch (error) { setNotice(message(error)); }
  }, [commit, life, submitOnline]);

  const advance = useCallback(() => {
    if (pendingRef.current || !canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    if (submitOnline(play => advanceOnlineYearWithFocus(play, life, focusIdRef.current))) return;
    try {
      commit(advanceYearWithFocus(engineForLife(life), life, focusIdRef.current));
      setNotice("");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, hasBegun, life, submitOnline]);

  const nextTurningPoint = useCallback(() => {
    if (pendingRef.current || !canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life || life.phase !== "ready") return;
    if (submitOnline(async play => {
      let next = life;
      const maxAge = engineForLife(life).world.maxAge;
      for (let years = 0; years <= maxAge; years++) {
        if (next.phase !== "ready") return next;
        next = await advanceOnlineYearWithFocus(play, next, focusIdRef.current);
        const loan = next.economy?.loan;
        if (loan && loan.balance > 0 && next.age >= loan.dueAge - 1) return next;
      }
      throw new Error("This life could not reach its next decision.");
    })) return;
    try {
      const next = advanceToDecisionWithFocus(engineForLife(life), life, focusIdRef.current);
      commit(next);
      setNotice("");
    } catch (error) { setNotice(message(error)); }
  }, [commit, hasBegun, life, submitOnline]);

  const revealStats = useCallback(() => {
    if (lifeRef.current !== life) return;
    setHasRevealedStats(true);
  }, [life]);

  const chooseAvatar = useCallback((variant: number) => {
    if (pendingRef.current || lifeRef.current !== life) return;
    if (submitOnline(play => play.dispatch({ type: "avatar", variant }))) return;
    if (hasBegunRef.current) return;
    try {
      commit(engineForLife(life).chooseAvatar(life, variant));
      setNotice("");
    } catch (error) { setNotice(message(error)); }
  }, [commit, life, submitOnline]);

  const beginLife = useCallback(() => {
    if (hasBegunRef.current || !hasRevealedStats || lifeRef.current !== life) return;
    hasBegunRef.current = true;
    setHasBegun(true);
    setPlaying(true);
    setNotice("");
  }, [hasRevealedStats, life, setPlaying]);

  const restart = useCallback(() => {
    if (onlineRef.current || rankedRef.current) return; // Authoritative lives are replaced only by their container.
    unreadableSaveRef.current = null;
    setUnreadableSave(null);
    setPlaying(false);
    setAutoDecisions(false);
    hasBegunRef.current = false;
    setHasBegun(false);
    setHasRevealedStats(false);
    commit(createSampleLife(newLifeSeed()), true);
    setNotice("");
  }, [commit, setPlaying, setAutoDecisions]);

  const importLife = useCallback((json: string) => {
    if (onlineRef.current) {
      setNotice("Saved lives cannot be imported into an active online life.");
      return false;
    }
    if (rankedRef.current) {
      setNotice("Free-play saves cannot be imported into an active ranked session.");
      return false;
    }
    try {
      const restored = loadAnyLife(json);
      unreadableSaveRef.current = null;
      setUnreadableSave(null);
      let begun = restored.commands.some(command => command.type !== "avatar") || restored.phase === "ended";
      if (!begun && typeof window !== "undefined") {
        try { begun = hasLifeBegun(window.localStorage, restored); }
        catch { /* Unmarked age-zero imports retain the normal birth introduction. */ }
      }
      let revealed = begun;
      try {
        if (!revealed && typeof window !== "undefined") revealed = hasBirthStatsBeenRevealed(window.localStorage, restored);
      } catch { /* Keep the stat reveal available when browser storage is blocked. */ }
      hasBegunRef.current = begun;
      commitPauseState(initialPauseState());
      setAutoDecisions(false);
      setHasBegun(begun);
      setHasRevealedStats(revealed);
      commit(restored);
      setNotice("The imported life is ready.");
      return restored;
    } catch (error) { setNotice(message(error)); return false; }
  }, [commit, commitPauseState, setAutoDecisions]);

  useEffect(() => {
    if (onlineRef.current) return;
    try { persistYearlyFocus(window.localStorage, life, focusId); }
    catch { /* A blocked preference store does not prevent playing this life. */ }
  }, [focusId, life.worldFingerprint, life.seed]);

  useEffect(() => {
    if (onlineRef.current) return;
    try { setArchivedLives(readArchivedLives(window.localStorage)); }
    catch (error) { setNotice(message(error)); }
  }, []);

  useEffect(() => {
    if (onlineRef.current || rankedRef.current) return; // Authoritative sessions keep their own saves.
    if (unreadableSaveRef.current !== null) return; // Includes malformed empty records.
    try {
      persistLife(window.localStorage, life);
      persistBirthPresentation(window.localStorage, life, hasBegun);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("unavailable");
      setNotice(message(error));
    }
  }, [hasBegun, life, unreadableSave]);

  useEffect(() => {
    if (onlineRef.current) return;
    if (unreadableSaveRef.current !== null) return;
    try { persistBirthStatsReveal(window.localStorage, life, hasRevealedStats); }
    catch (error) {
      setSaveStatus("unavailable");
      setNotice(message(error));
    }
  }, [hasRevealedStats, life, unreadableSave]);

  useEffect(() => {
    // Ranked lives are kept on chain and by their session; the past-lives shelf is for free play.
    if (life.phase !== "ended" || onlineRef.current || rankedRef.current) return;
    try { setArchivedLives(archiveLife(window.localStorage, life)); }
    catch (error) { setNotice(message(error)); }
  }, [life]);

  useEffect(() => {
    const updateVisibility = () => {
      if (document.hidden) pauseLife();
      setVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, [pauseLife]);

  useEffect(() => {
    // Holds and speed changes begin a fresh interval. No missed years catch up.
    setClockElapsedMs(0);
    if (!isClockRunning) return;
    const started = performance.now();
    const countdown = window.setInterval(() => {
      setClockElapsedMs(Math.min(yearDurationMs, performance.now() - started));
    }, Math.min(100, yearDurationMs / 10));
    const timer = window.setTimeout(() => {
      // A pause, overlay or state change can precede effect cleanup in the same turn.
      if (!document.hidden && clockAllowedRef.current && playbackIntentRef.current &&
        lifeRef.current === life && lifeRef.current.phase === "ready") {
        setClockElapsedMs(yearDurationMs);
        advance();
      }
    }, yearDurationMs);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(countdown);
    };
  }, [advance, isClockRunning, life, yearDurationMs]);

  useEffect(() => {
    if (!canRunAutomaticDecision(pauseState, { hasBegun, phase: life.phase }, isVisible, isOverlayOpen, autoDecisions)) return;
    const choice = selectAutomaticChoice(engineForLife(life).getChoices(life), engineForLife(life).world, life);
    if (!choice) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden && autoAllowedRef.current && autoIntentRef.current && playbackIntentRef.current && lifeRef.current === life && lifeRef.current.phase === "choice") choose(choice.id);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [autoDecisions, hasBegun, pauseState, isVisible, isOverlayOpen, life, choose]);

  const orderSlot = useRef(false);
  const runDemo = useCallback((command: DemoCommand): string | null => {
    if (pendingRef.current) return "That action is already being sent.";
    if (!canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return "Wait until this life can take a command.";
    if (submitOnline(play => play.dispatch(command))) return null;
    const result = sendDemoCommand(engineForLife(life), life, command, orderSlot);
    if (!result.sent) return result.reason;
    commit(result.life);
    setNotice("");
    return null;
  }, [commit, life, submitOnline]);

  useEffect(() => { releaseOrder(orderSlot); }, [life]);

  const resetUnreadableSave = useCallback(() => {
    if (onlineRef.current) return;
    unreadableSaveRef.current = null;
    setUnreadableSave(null);
  }, []);

  return {
    life,
    choose,
    act,
    runDemo,
    actWithLoan,
    orderMarket,
    cancelMarketOrder,
    advance,
    restart,
    hasBegun,
    hasRevealedStats,
    revealStats,
    chooseAvatar,
    beginLife,
    nextTurningPoint,
    focusId,
    setFocus,
    autoDecisions,
    setAutoDecisions,
    importLife,
    unreadableSave,
    resetUnreadableSave,
    archivedLives,
    isPlaying,
    pauseLife,
    continueLife,
    isClockRunning,
    clockRemainingMs: Math.max(0, yearDurationMs - clockElapsedMs),
    clockProgress: Math.min(1, clockElapsedMs / yearDurationMs),
    setPlaying,
    speed,
    setSpeed,
    notice,
    setNotice,
    saveStatus,
    isSyncing: syncing,
  };
}
