import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { LifeState } from "../src/types.ts";
import { advanceToTurningPoint, archiveLife, createSampleLife, hasLifeBegun, persistBirthPresentation, persistLife, readArchivedLives, readSavedLife, sampleEngine } from "./session.ts";
import type { ArchivedLife } from "./session.ts";

export type SaveStatus = "saving" | "saved" | "unavailable";
export type PlaybackSpeed = 1 | 2 | 4 | 8;
const YEAR_DURATION_MS = 25_000;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something interrupted this action. Please try again.";
}

function initialSession(startFresh = false): { life: LifeState; notice: string; hasBegun: boolean } {
  try {
    if (!startFresh && typeof window !== "undefined") {
      const restored = readSavedLife(window.localStorage);
      if (restored) return { life: restored, notice: "Your life has been restored.", hasBegun: hasLifeBegun(window.localStorage, restored) };
    }
    return { life: createSampleLife(), notice: "", hasBegun: false };
  } catch (error) {
    return { life: createSampleLife(), notice: `${message(error)} A fresh sample is ready.`, hasBegun: false };
  }
}

/** Bridge React to one authoritative engine snapshot; UI pacing stays outside the core. */
export function useGame({ isOverlayOpen = false, startFresh = false }: { isOverlayOpen?: boolean; startFresh?: boolean } = {}) {
  const [initial] = useState(() => initialSession(startFresh));
  const [life, setLife] = useState(initial.life);
  const lifeRef = useRef(life);
  const [hasBegun, setHasBegun] = useState(initial.hasBegun);
  const [notice, setNotice] = useState(initial.notice);
  // Playback is player intent; decisions, panels and hidden tabs only suspend it.
  const [isPlaying, setPlaybackIntent] = useState(initial.hasBegun && initial.life.phase !== "ended");
  const playbackIntentRef = useRef(isPlaying);
  const clockAllowedRef = useRef(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [clockElapsedMs, setClockElapsedMs] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saving");
  const [isVisible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [archivedLives, setArchivedLives] = useState<ArchivedLife[]>([]);
  const yearDurationMs = YEAR_DURATION_MS / speed;
  const isClockRunning = hasBegun && isPlaying && isVisible && !isOverlayOpen && life.phase === "ready";
  clockAllowedRef.current = isClockRunning;

  const setPlaying = useCallback((value: SetStateAction<boolean>) => {
    const next = typeof value === "function" ? value(playbackIntentRef.current) : value;
    playbackIntentRef.current = next;
    if (!next) clockAllowedRef.current = false;
    setPlaybackIntent(next);
  }, []);

  const commit = useCallback((next: LifeState) => {
    lifeRef.current = next;
    setLife(next);
    setSaveStatus("saving");
    if (next.phase === "ended") setPlaying(false);
  }, [setPlaying]);

  const choose = useCallback((choiceId: string) => {
    // Ignore an old rendered button after its snapshot has already been replaced.
    if (!hasBegun || lifeRef.current !== life) return;
    try {
      const current = life;
      const next = sampleEngine.choose(current, choiceId);
      const outcome = next.journal.slice(current.journal.length).find(entry => entry.type === "outcome");
      commit(next);
      setNotice(outcome?.text ?? "Your choice has been recorded.");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, hasBegun, life]);

  const advance = useCallback(() => {
    if (!hasBegun || lifeRef.current !== life) return;
    try {
      commit(sampleEngine.advance(life));
      setNotice("");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, hasBegun, life]);

  const nextTurningPoint = useCallback(() => {
    if (!hasBegun || lifeRef.current !== life || life.phase !== "ready") return;
    try {
      const next = advanceToTurningPoint(life);
      commit(next);
      setNotice("");
    } catch (error) { setNotice(message(error)); }
  }, [commit, hasBegun, life]);

  const beginLife = useCallback(() => {
    setHasBegun(true);
    setPlaying(true);
    setNotice("");
  }, [setPlaying]);

  const restart = useCallback(() => {
    setPlaying(false);
    setHasBegun(false);
    commit(createSampleLife());
    setNotice("");
  }, [commit, setPlaying]);

  const importLife = useCallback((json: string) => {
    try {
      const restored = sampleEngine.load(json);
      const begun = restored.commands.length > 0 || restored.phase === "ended";
      setPlaying(begun && restored.phase !== "ended");
      setHasBegun(begun);
      commit(restored);
      setNotice("The imported life is ready.");
      return true;
    } catch (error) { setNotice(message(error)); return false; }
  }, [commit, setPlaying]);

  useEffect(() => {
    try { setArchivedLives(readArchivedLives(window.localStorage)); }
    catch (error) { setNotice(message(error)); }
  }, []);

  useEffect(() => {
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
    if (life.phase !== "ended") return;
    try { setArchivedLives(archiveLife(window.localStorage, life)); }
    catch (error) { setNotice(message(error)); }
  }, [life]);

  useEffect(() => {
    const updateVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

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

  return {
    life,
    choose,
    advance,
    restart,
    hasBegun,
    beginLife,
    nextTurningPoint,
    importLife,
    archivedLives,
    isPlaying,
    isClockRunning,
    clockRemainingMs: Math.max(0, yearDurationMs - clockElapsedMs),
    clockProgress: Math.min(1, clockElapsedMs / yearDurationMs),
    setPlaying,
    speed,
    setSpeed,
    notice,
    setNotice,
    saveStatus,
  };
}
