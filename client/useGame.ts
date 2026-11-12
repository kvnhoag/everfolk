import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { LifeState } from "../src/types.ts";
import { archiveLife, createDifferentSampleLife, createSampleLife, engineForLife, hasBirthStatsBeenRevealed, hasLifeBegun, loadAnyLife, persistBirthPresentation, persistBirthStatsReveal, newLifeSeed, persistLife, readArchivedLives, readSavedLife } from "./session.ts";
import type { ArchivedLife } from "./session.ts";
import { advanceToDecisionWithFocus, advanceYearWithFocus, focusActivity, normalizeYearlyFocus, persistYearlyFocus, readYearlyFocus, selectAutomaticChoice, yearlyFocusStorageKey } from "./yearly-focus.ts";
import type { YearlyFocusId } from "./yearly-focus.ts";
import { canRunAutomaticDecision, canRunLifeClock, canUseLifeCommands, initialPauseState, updatePauseState } from "./pause-state.ts";
import type { PauseState } from "./pause-state.ts";
import { createPlaybackClock, playbackYearKey } from "./playback-clock.ts";
import { borrowAndAct } from "./loan-access.ts";
import type { DemoCommand } from "../src/demo/types.ts";
import "./demo/start.ts";
import { releaseOrder, sendDemoCommand } from "./demo/screen.ts";

export type SaveStatus = "saving" | "saved" | "unavailable";
export type PlaybackSpeed = 1 | 2 | 4 | 8 | 12 | 16;
const YEAR_DURATION_MS = 25_000;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something interrupted this action. Please try again.";
}

function savedFocus(life: LifeState): YearlyFocusId {
  if (typeof window === "undefined") return "everyday";
  try { return readYearlyFocus(window.localStorage, life, engineForLife(life).world); }
  catch { return "everyday"; }
}

function initialSession(startFresh = false, startFreshFrom?: LifeState): { life: LifeState; notice: string; hasBegun: boolean; hasRevealedStats: boolean } {
  try {
    if (!startFresh && typeof window !== "undefined") {
      const restored = readSavedLife(window.localStorage);
      if (restored) return {
        life: restored, notice: "",
        hasBegun: hasLifeBegun(window.localStorage, restored),
        hasRevealedStats: hasBirthStatsBeenRevealed(window.localStorage, restored),
      };
      return { life: createSampleLife(newLifeSeed()), notice: "", hasBegun: false, hasRevealedStats: false };
    }
    return { life: startFresh && startFreshFrom ? createDifferentSampleLife(startFreshFrom) : createSampleLife(), notice: "", hasBegun: false, hasRevealedStats: false };
  } catch (error) {
    return { life: createSampleLife(), notice: `${message(error)} A fresh sample is ready.`, hasBegun: false, hasRevealedStats: false };
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

export function useGame({ isOverlayOpen: overlayFromApp = false, startFresh = false, startFreshFrom, ranked }: { isOverlayOpen?: boolean; startFresh?: boolean; startFreshFrom?: LifeState; ranked?: RankedPlay } = {}) {
  const [syncing, setSyncing] = useState(false);
  const isOverlayOpen = overlayFromApp || syncing;
  const rankedRef = useRef(ranked);
  rankedRef.current = ranked;
  const [initial] = useState(() => ranked
    ? { life: ranked.initial, notice: "", hasBegun: true, hasRevealedStats: true }
    : initialSession(startFresh, startFreshFrom));
  const [life, setLife] = useState(initial.life);
  const lifeRef = useRef(life);
  const [focusSelection, setFocusSelection] = useState(() => ({ key: yearlyFocusStorageKey(initial.life), id: startFresh ? "everyday" as YearlyFocusId : savedFocus(initial.life) }));
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
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [yearClock] = useState(() => createPlaybackClock(playbackYearKey(initial.life), YEAR_DURATION_MS));
  const [clockProgress, setClockProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(ranked ? "saved" : "saving");
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
      setClockProgress(yearClock.pause(performance.now()).progress);
      clockAllowedRef.current = false;
      autoAllowedRef.current = false;
    }
    setPauseState(next);
  }, [yearClock]);

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
    setClockProgress(yearClock.pause(performance.now()).progress);
    const rankedPlay = rankedRef.current;
    if (rankedPlay && !fresh) {
      // Pause commands and the clock while key decisions draw and checkpoints post on chain.
      lifeRef.current = next;
      setSaveStatus("saving");
      setSyncing(true);
      void rankedPlay.sync(next).then(adopted => {
        yearClock.setYear(playbackYearKey(adopted));
        setClockProgress(yearClock.read().progress);
        lifeRef.current = adopted;
        setLife(adopted);
        setSaveStatus("saved");
        rankedPlay.onSynced?.(adopted);
        if (adopted.phase === "ended") commitPauseState(updatePauseState(pauseStateRef.current, { type: "ended" }, { hasBegun: hasBegunRef.current, phase: adopted.phase }));
      }, error => {
        const current = rankedPlay.current();
        yearClock.reset(playbackYearKey(current));
        setClockProgress(0);
        lifeRef.current = current;
        setLife(current);
        setSaveStatus("unavailable");
        setNotice(message(error));
      }).finally(() => setSyncing(false));
      return;
    }
    if (fresh || next.worldFingerprint !== lifeRef.current.worldFingerprint || next.seed !== lifeRef.current.seed) {
      setFocusSelection({ key: yearlyFocusStorageKey(next), id: fresh ? "everyday" : savedFocus(next) });
    }
    if (fresh) yearClock.reset(playbackYearKey(next));
    else yearClock.setYear(playbackYearKey(next));
    setClockProgress(yearClock.read().progress);
    lifeRef.current = next;
    setLife(next);
    setSaveStatus("saving");
    if (next.phase === "ended" || fresh) commitPauseState(updatePauseState(pauseStateRef.current, { type: next.phase === "ended" ? "ended" : "fresh" }, { hasBegun: hasBegunRef.current, phase: next.phase }));
  }, [commitPauseState, yearClock]);

  const choose = useCallback((choiceId: string) => {
    // Ignore an old rendered button after its snapshot has already been replaced.
    if (!canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    try {
      const current = life;
      const next = engineForLife(current).choose(current, choiceId);
      commit(next);
      setNotice("");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, hasBegun, life]);

  const act = useCallback((activityId: string) => {
    if (!canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    try {
      const current = life;
      const next = engineForLife(current).act(current, activityId);
      commit(next);
      setNotice("");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, hasBegun, life]);

  const actWithLoan = useCallback((activityId: string) => {
    if (!canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    try {
      // The player has confirmed the contract. Commit both ordinary commands
      // together, so a changed opportunity can never leave an unwanted loan.
      commit(borrowAndAct(engineForLife(life), life, activityId));
      setNotice("");
    } catch (error) { setNotice(message(error)); }
  }, [commit, life]);

  const advance = useCallback(() => {
    if (!canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return;
    try {
      commit(advanceYearWithFocus(engineForLife(life), life, focusIdRef.current));
      setNotice("");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, hasBegun, life]);

  const nextTurningPoint = useCallback(() => {
    if (!canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life || life.phase !== "ready") return;
    try {
      const next = advanceToDecisionWithFocus(engineForLife(life), life, focusIdRef.current);
      commit(next);
      setNotice("");
    } catch (error) { setNotice(message(error)); }
  }, [commit, hasBegun, life]);

  const revealStats = useCallback(() => {
    if (lifeRef.current !== life) return;
    setHasRevealedStats(true);
  }, [life]);

  const chooseAvatar = useCallback((variant: number) => {
    if (hasBegunRef.current || lifeRef.current !== life) return;
    try {
      commit(engineForLife(life).chooseAvatar(life, variant));
      setNotice("");
    } catch (error) { setNotice(message(error)); }
  }, [commit, life]);

  const beginLife = useCallback(() => {
    if (hasBegunRef.current || !hasRevealedStats || lifeRef.current !== life) return;
    hasBegunRef.current = true;
    setHasBegun(true);
    setPlaying(true);
    setNotice("");
  }, [hasRevealedStats, life, setPlaying]);

  const restart = useCallback(() => {
    if (rankedRef.current) return; // A ranked life ends by minting or closing it, never by rerolling.
    setPlaying(false);
    setAutoDecisions(false);
    hasBegunRef.current = false;
    setHasBegun(false);
    setHasRevealedStats(false);
    commit(createSampleLife(newLifeSeed()), true);
    setNotice("");
  }, [commit, setPlaying, setAutoDecisions]);

  const importLife = useCallback((json: string) => {
    try {
      const restored = loadAnyLife(json);
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
      yearClock.reset(playbackYearKey(restored));
      setClockProgress(0);
      setAutoDecisions(false);
      setHasBegun(begun);
      setHasRevealedStats(revealed);
      commit(restored);
      setNotice("The imported life is ready.");
      return restored;
    } catch (error) { setNotice(message(error)); return false; }
  }, [commit, commitPauseState, setAutoDecisions, yearClock]);

  useEffect(() => {
    try { persistYearlyFocus(window.localStorage, life, focusId); }
    catch { /* A blocked preference store does not prevent playing this life. */ }
  }, [focusId, life.worldFingerprint, life.seed]);

  useEffect(() => {
    try { setArchivedLives(readArchivedLives(window.localStorage)); }
    catch (error) { setNotice(message(error)); }
  }, []);

  useEffect(() => {
    if (rankedRef.current) return; // The ranked session keeps its own save; never overwrite the free-play slot.
    try {
      persistLife(window.localStorage, life);
      persistBirthPresentation(window.localStorage, life, hasBegun);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("unavailable");
      setNotice(message(error));
    }
  }, [hasBegun, life]);

  useEffect(() => {
    try { persistBirthStatsReveal(window.localStorage, life, hasRevealedStats); }
    catch (error) {
      setSaveStatus("unavailable");
      setNotice(message(error));
    }
  }, [hasRevealedStats, life]);

  useEffect(() => {
    // Ranked lives are kept on chain and by their session; the past-lives shelf is for free play.
    if (life.phase !== "ended" || rankedRef.current) return;
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
    const key = playbackYearKey(life);
    if (!isClockRunning) {
      setClockProgress(yearClock.hold(key, yearDurationMs, performance.now()).progress);
      return;
    }
    const token = yearClock.resume(key, yearDurationMs, performance.now());
    const publish = () => {
      if (yearClock.isCurrent(token)) setClockProgress(yearClock.read(performance.now()).progress);
    };
    publish();
    const countdown = window.setInterval(publish, Math.min(100, yearDurationMs / 10));
    let timer: number;
    const finishYear = () => {
      // A pause, overlay or snapshot change may precede effect cleanup.
      if (document.hidden || !yearClock.isCurrent(token) || !clockAllowedRef.current || !playbackIntentRef.current ||
        lifeRef.current !== life || lifeRef.current.phase !== "ready") return;
      const now = performance.now();
      const remainingMs = yearClock.read(now).remainingMs;
      if (remainingMs > 0) {
        timer = window.setTimeout(finishYear, Math.max(1, Math.ceil(remainingMs)));
        return;
      }
      if (yearClock.takeDue(token, now)) {
        setClockProgress(1);
        advance();
      }
    };
    timer = window.setTimeout(finishYear, Math.ceil(yearClock.read().remainingMs));
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(countdown);
      setClockProgress(yearClock.pause(performance.now()).progress);
    };
  }, [advance, isClockRunning, life, yearDurationMs, yearClock]);

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
    if (!canUseLifeCommands({ hasBegun: hasBegunRef.current, phase: lifeRef.current.phase }) || lifeRef.current !== life) return "Wait until this life can take a command.";
    const result = sendDemoCommand(engineForLife(life), life, command, orderSlot);
    if (!result.sent) return result.reason;
    commit(result.life);
    setNotice("");
    return null;
  }, [commit, life]);

  useEffect(() => { releaseOrder(orderSlot); }, [life]);

  return {
    life,
    choose,
    act,
    runDemo,
    actWithLoan,
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
    archivedLives,
    isPlaying,
    pauseLife,
    continueLife,
    isClockRunning,
    clockRemainingMs: Math.max(0, yearDurationMs * (1 - clockProgress)),
    clockProgress,
    setPlaying,
    speed,
    setSpeed,
    notice,
    setNotice,
    saveStatus,
  };
}
