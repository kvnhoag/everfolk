import { useCallback, useEffect, useRef, useState } from "react";
import type { LifeState } from "../src/types.ts";
import { createSampleLife, persistLife, readSavedLife, sampleEngine } from "./session.ts";

export type SaveStatus = "saving" | "saved" | "unavailable";
export type PlaybackSpeed = 1 | 2 | 4;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something interrupted this action. Please try again.";
}

function initialSession(): { life: LifeState; notice: string } {
  try {
    if (typeof window !== "undefined") {
      const restored = readSavedLife(window.localStorage);
      if (restored) return { life: restored, notice: "Your life has been restored." };
    }
    return { life: createSampleLife(), notice: "" };
  } catch (error) {
    return { life: createSampleLife(), notice: `${message(error)} A fresh sample is ready.` };
  }
}

/** Bridge React to one authoritative engine snapshot; UI pacing stays outside the core. */
export function useGame() {
  const [initial] = useState(initialSession);
  const [life, setLife] = useState(initial.life);
  const lifeRef = useRef(life);
  const [notice, setNotice] = useState(initial.notice);
  const [isPlaying, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saving");
  const [isVisible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  const commit = useCallback((next: LifeState) => {
    lifeRef.current = next;
    setLife(next);
    setSaveStatus("saving");
    if (next.phase === "ended") setPlaying(false);
  }, []);

  const choose = useCallback((choiceId: string) => {
    // Ignore an old rendered button after its snapshot has already been replaced.
    if (lifeRef.current !== life) return;
    try {
      const current = life;
      const next = sampleEngine.choose(current, choiceId);
      const outcome = next.journal.slice(current.journal.length).find(entry => entry.type === "outcome");
      commit(next);
      setNotice(outcome?.text ?? "Your choice has been recorded.");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, life]);

  const advance = useCallback(() => {
    if (lifeRef.current !== life) return;
    try {
      commit(sampleEngine.advance(life));
      setNotice("");
    } catch (error) {
      setNotice(message(error));
    }
  }, [commit, life]);

  const restart = useCallback(() => {
    const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}`;
    setPlaying(false);
    commit(createSampleLife(`alexandria-${suffix}`));
    setNotice("A new life begins at the harbor.");
  }, [commit]);

  useEffect(() => {
    try {
      persistLife(window.localStorage, life);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("unavailable");
      setNotice(message(error));
    }
  }, [life]);

  useEffect(() => {
    const updateVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!isPlaying || !isVisible || life.phase !== "ready") return;
    const timer = window.setTimeout(() => {
      // Recheck at execution: a manual choice or hidden-tab transition may have intervened.
      if (!document.hidden && lifeRef.current === life && lifeRef.current.phase === "ready") advance();
    }, 3000 / speed);
    return () => window.clearTimeout(timer);
  }, [advance, isPlaying, isVisible, life, speed]);

  return {
    life,
    choose,
    advance,
    restart,
    isPlaying,
    setPlaying,
    speed,
    setSpeed,
    notice,
    setNotice,
    saveStatus,
  };
}
