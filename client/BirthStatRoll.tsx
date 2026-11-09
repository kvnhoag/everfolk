import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import { BIRTH_ROLL_DURATION_MS, getBirthRollFrame, getBirthRollStats, getCosmeticBirthValue } from "./birth-stat-roll.ts";
import "./birth-stat-roll.css";

export interface BirthStatRollProps {
  life: LifeState;
  world: WorldPack;
  revealed: boolean;
  onComplete(): void;
  paused?: boolean;
  autoStart?: boolean;
}

function BirthStatRollSession({ life, world, revealed, onComplete, paused = false, autoStart = false }: BirthStatRollProps) {
  const stats = useMemo(() => getBirthRollStats(world, life), [world, life]);
  const origin = world.origins.find(item => item.id === life.originId);
  const characterName = life.character?.name ?? "Damon";
  const [started, setStarted] = useState(revealed);
  const [finished, setFinished] = useState(revealed);
  const [elapsed, setElapsed] = useState(revealed ? BIRTH_ROLL_DURATION_MS : 0);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const completeRef = useRef(revealed);
  const callbackRef = useRef(onComplete);
  callbackRef.current = onComplete;

  const finish = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    setStarted(true);
    setFinished(true);
    setElapsed(BIRTH_ROLL_DURATION_MS);
    callbackRef.current();
  }, []);

  const start = useCallback(() => {
    if (completeRef.current || paused || hidden) return;
    setStarted(true);
    if (reducedMotion) finish();
  }, [finish, hidden, paused, reducedMotion]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setHidden(document.hidden);
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!revealed) return;
    completeRef.current = true;
    setFinished(true);
    setStarted(true);
    setElapsed(BIRTH_ROLL_DURATION_MS);
  }, [revealed]);

  useEffect(() => { if (autoStart && !started) start(); }, [autoStart, started, start]);

  useEffect(() => {
    if (!started || finished || revealed || paused || hidden) return;
    if (reducedMotion) { finish(); return; }
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.max(0, Math.min(160, now - previous));
      previous = now;
      setElapsed(value => Math.min(BIRTH_ROLL_DURATION_MS, value + delta));
    }, 60);
    return () => window.clearInterval(timer);
  }, [started, finished, revealed, paused, hidden, reducedMotion, finish]);

  useEffect(() => { if (started && elapsed >= BIRTH_ROLL_DURATION_MS) finish(); }, [elapsed, started, finish]);

  const settled = revealed || finished;
  const frame = getBirthRollFrame(settled ? BIRTH_ROLL_DURATION_MS : elapsed, stats.length);
  const running = started && !settled;
  const summary = settled ? `Starting stats ready. ${characterName}. ${origin?.title ?? "Origin selected"}. ${stats.map(stat => `${stat.label} ${stat.value}${stat.currency ? ` ${stat.currency}` : ""}`).join(", ")}.`
    : running ? "Rolling starting stats." : "Reveal your name, household and starting stats.";

  return <section className={`birth-stat-roll ${running ? "is-rolling" : ""} ${settled ? "is-complete" : ""} ${paused || hidden ? "is-paused" : ""}`} aria-label="Starting stat roll" aria-busy={running}>
    <div className="birth-roll-heading"><div><span className="birth-roll-eyebrow">YOUR BEGINNING</span><h3>{settled ? "Your starting stats." : "A different start for every life."}</h3></div><span className="birth-roll-seal" aria-hidden="true">{settled ? "✓" : "✦"}</span></div>
    <div className={`birth-roll-origin ${frame.originRevealed || settled ? "is-revealed" : ""}`} aria-hidden="true"><span>HOUSEHOLD</span><strong>{frame.originRevealed || settled ? origin?.title ?? "Your household" : running ? "Finding your origin…" : "To be revealed"}</strong></div>
    <div className={`birth-roll-origin ${frame.originRevealed || settled ? "is-revealed" : ""}`} aria-hidden="true"><span>NAME</span><strong>{frame.originRevealed || settled ? characterName : "To be revealed"}</strong></div>
    <div className="birth-roll-cards" aria-hidden="true">{stats.map((stat, index) => {
      const phase = settled ? "settled" : frame.phases[index];
      const display = phase === "waiting" ? "—" : phase === "settled" ? stat.value : getCosmeticBirthValue(stat, life.seed, Math.floor(elapsed / 60));
      return <div className={`birth-roll-card birth-roll-${stat.id} is-${phase}`} key={stat.id}>
        <span className="birth-roll-stat-name">{stat.label}</span><strong className="birth-roll-number">{display}{stat.currency && <small>{stat.currency}</small>}</strong>
        <span className="birth-roll-range">{stat.range ? `${stat.range.min} - ${stat.range.max}${stat.currency ? ` ${stat.currency}` : ""}` : "Starting value"}</span>
        <span className="birth-roll-card-state">{phase === "settled" ? "Set" : phase === "rolling" ? "Rolling" : "Waiting"}<i /></span>
      </div>;
    })}</div>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{summary}</p>
    <div className="birth-roll-footer"><p>{settled ? "Ready to begin." : running ? paused || hidden ? "The reveal is paused." : "Your starting stats are being revealed…" : "Roll once to see the stats for this life."}</p>
      {!started && !settled && <button type="button" className="birth-roll-button" disabled={paused || hidden} onClick={start}>Roll starting stats <span aria-hidden="true">↗</span></button>}
      {running && <button type="button" className="birth-roll-skip" onClick={finish}>Skip animation</button>}
    </div>
  </section>;
}

/** A changed life resets only this presentation, never the simulation snapshot. */
export default function BirthStatRoll(props: BirthStatRollProps) {
  return <BirthStatRollSession key={`${props.life.worldFingerprint}:${props.life.seed}`} {...props} />;
}
