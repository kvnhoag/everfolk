import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import { BIRTH_ROLL_DURATION_MS, canRepresentBirthReelValue, getBirthDigitReels, getBirthReelLayout, getBirthRollFrame, getVisibleBirthRollResources, getBirthRollStats } from "./birth-stat-roll.ts";
import type { BirthRollPhase, BirthRollStat } from "./birth-stat-roll.ts";
import { createBirthRollClock } from "./birth-roll-clock.ts";
import { formatMoney } from "./wealth.ts";
import "./birth-stat-roll.css";

export interface BirthStatRollProps {
  life: LifeState;
  world: WorldPack;
  revealed: boolean;
  onComplete(): void;
  paused?: boolean;
  autoStart?: boolean;
}

function BirthRollNumber({ stat, phase, seed, elapsed, index, count, compact = false }: {
  stat: BirthRollStat; phase: BirthRollPhase; seed: string; elapsed: number; index: number; count: number; compact?: boolean;
}) {
  const layout = getBirthReelLayout(stat);
  const digits = getBirthDigitReels(stat, seed, elapsed, index, count);
  const rawFinal = phase === "settled" && !canRepresentBirthReelValue(stat, layout);
  return <strong className={compact ? "birth-resource-number" : "birth-roll-number"}>
    {phase === "waiting" ? <span className="birth-roll-waiting">—</span> : <span className={`birth-roll-digits${phase === "settled" ? " birth-roll-final" : ""}`} data-final-value={phase === "settled" ? String(stat.value) : undefined} style={digits.length > 4 ? { fontSize: Math.max(8, (compact ? 88 : 126) / digits.length) } : undefined}>
      {layout.hasSign && <span className="birth-digit-sign" style={{ visibility: phase === "settled" && stat.value < 0 && !rawFinal ? "visible" : "hidden" }}>−</span>}
      {digits.map((digit, place) => <span className="birth-digit-place" key={place}>
        {layout.fractionPlaces > 0 && place === layout.integerPlaces && <span className="birth-digit-decimal" style={rawFinal ? { visibility: "hidden" } : undefined}>.</span>}
        <span className="birth-digit-window" style={{ visibility: rawFinal ? "hidden" : "visible" }}><span className={`birth-digit-reel rolls-${digit.direction}`} data-direction={digit.direction} data-position={digit.position} style={{ transform: `translate3d(0, ${-1.1 * (1 + digit.fraction)}em, 0)` }}>
          {digit.glyphs.map((glyph, row) => <span key={row}>{glyph}</span>)}
        </span></span>
      </span>)}
      {rawFinal && <span className="birth-roll-raw-final" style={{ fontSize: `${Math.min(100, layout.digitCount / String(stat.value).length * 115)}%` }}>{stat.value}</span>}
    </span>}
    {stat.currency && <small>{stat.currency}</small>}
  </strong>;
}

function BirthStatRollSession({ life, world, revealed, onComplete, paused = false, autoStart = true }: BirthStatRollProps) {
  const stats = useMemo(() => getBirthRollStats(world, life), [world, life]);
  const resources = useMemo(() => getVisibleBirthRollResources(world, life), [world, life]);
  const origin = world.origins.find(item => item.id === life.originId);
  const characterName = life.character?.name ?? "Damon";
  const [started, setStarted] = useState(revealed || autoStart);
  const [finished, setFinished] = useState(revealed);
  const [elapsed, setElapsed] = useState(revealed ? BIRTH_ROLL_DURATION_MS : 0);
  const [clock] = useState(() => createBirthRollClock(BIRTH_ROLL_DURATION_MS, revealed ? BIRTH_ROLL_DURATION_MS : 0));
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
    setElapsed(clock.finish());
    callbackRef.current();
  }, [clock]);

  const start = useCallback(() => {
    if (completeRef.current || paused || hidden) return;
    setStarted(true);
    if (reducedMotion) finish();
  }, [finish, hidden, paused, reducedMotion]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => {
      if (document.hidden) setElapsed(clock.pause(performance.now()));
      setHidden(document.hidden);
    };
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    updateVisibility();
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, [clock]);

  useEffect(() => {
    if (!revealed) return;
    completeRef.current = true;
    setFinished(true);
    setStarted(true);
    setElapsed(clock.finish());
  }, [revealed, clock]);

  useEffect(() => { if (autoStart && !started) start(); }, [autoStart, started, start]);

  useEffect(() => {
    if (!started || finished || revealed || paused || hidden) return;
    if (reducedMotion) { finish(); return; }
    clock.resume(performance.now());
    let animationFrame = 0;
    const tick = (now: number) => {
      if (document.hidden) { setElapsed(clock.pause(now)); setHidden(true); return; }
      const next = clock.tick(now);
      setElapsed(next);
      if (next >= BIRTH_ROLL_DURATION_MS) { finish(); return; }
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => { window.cancelAnimationFrame(animationFrame); clock.pause(performance.now()); };
  }, [started, finished, revealed, paused, hidden, reducedMotion, finish, clock]);

  const settled = revealed || finished;
  const rollElapsed = settled ? BIRTH_ROLL_DURATION_MS : elapsed;
  const frame = getBirthRollFrame(rollElapsed, stats.length);
  // Resource rolls share the wealth card's landing time and never lengthen the reveal.
  const wealthIndex = Math.max(0, stats.findIndex(stat => stat.id === world.economy?.stat));
  const resourcePhase = settled ? "settled" : !started ? "waiting" : frame.phases[wealthIndex];
  const running = started && !settled;
  const resourceSummary = resources.length ? ` Resources: ${resources.map(resource => `${resource.label} ${resource.value}, market value ${formatMoney(resource.marketValue, world)}`).join("; ")}. Included in total wealth.` : "";
  const summary = settled ? `Starting stats ready. ${characterName}. ${life.character?.sex === "female" ? "Born a girl. " : life.character?.sex === "male" ? "Born a boy. " : ""}${origin?.title ?? "Origin selected"}. ${stats.map(stat => `${stat.label} ${stat.value}${stat.currency ? ` ${stat.currency}` : ""}`).join(", ")}.${resourceSummary}`
    : running ? "Rolling starting stats. Final values are hidden until each roll finishes." : autoStart ? "Starting the stat roll automatically." : "Reveal your name, household and starting stats.";

  return <section className={`birth-stat-roll ${running ? "is-rolling" : ""} ${settled ? "is-complete" : ""} ${paused || hidden ? "is-paused" : ""}`} aria-label="Starting stat roll" aria-busy={running}>
    <div className="birth-roll-heading"><div><span className="birth-roll-eyebrow">NEW LIFE</span><h3>{settled ? "Starting stats" : "Rolling stats…"}</h3></div><span className="birth-roll-seal" aria-hidden="true">{settled ? "✓" : "✦"}</span></div>
    <div className={`birth-roll-origin ${frame.originRevealed || settled ? "is-revealed" : ""}`} aria-hidden="true"><span>BACKGROUND</span><strong>{frame.originRevealed || settled ? origin?.title ?? "Your household" : running ? "Rolling…" : "Unrevealed"}</strong></div>
    <div className={`birth-roll-origin ${frame.originRevealed || settled ? "is-revealed" : ""}`} aria-hidden="true"><span>NAME</span><strong>{frame.originRevealed || settled ? characterName : "Unrevealed"}</strong></div>
    {life.character?.sex && <div className={`birth-roll-origin ${frame.originRevealed || settled ? "is-revealed" : ""}`} aria-hidden="true"><span>BIRTH</span><strong>{frame.originRevealed || settled ? life.character.sex === "female" ? "A girl" : "A boy" : "Unrevealed"}</strong></div>}
    <div className="birth-roll-cards" aria-hidden="true">{stats.map((stat, index) => {
      const phase = settled ? "settled" : !started ? "waiting" : frame.phases[index];
      return <div className={`birth-roll-card birth-roll-${stat.id} is-${phase}`} key={stat.id}>
        <span className="birth-roll-stat-name">{stat.label}</span>
        <BirthRollNumber stat={stat} phase={phase} seed={life.seed} elapsed={rollElapsed} index={index} count={stats.length} />
        <span className="birth-roll-range">{phase === "settled" ? stat.range ? `${stat.range.min} - ${stat.range.max}${stat.currency ? ` ${stat.currency}` : ""}` : "Starting value" : "Final value hidden"}</span>
        <span className="birth-roll-card-state">{phase === "settled" ? "Set" : phase === "rolling" ? "Rolling" : "Waiting"}<i /></span>
      </div>;
    })}</div>
    {resources.length > 0 && <div className={`birth-roll-resources is-${resourcePhase}`} aria-hidden="true">
      <div className="birth-resources-heading"><h4>Starting resources</h4><span>{resourcePhase === "settled" ? "Counted in total wealth" : resourcePhase === "rolling" ? "Rolling…" : "Waiting to roll"}</span></div>
      <table><caption className="sr-only">Starting resource quantities and market values</caption>
        <thead><tr><th scope="col">Resource</th><th scope="col">Rolled</th><th scope="col">Market value</th></tr></thead>
        <tbody>{resources.map(resource => <tr key={resource.id}>
          <th scope="row">{resource.label}<small>{formatMoney(resource.unitPrice, world)} each</small></th>
          <td><BirthRollNumber stat={resource} phase={resourcePhase} seed={life.seed} elapsed={rollElapsed} index={wealthIndex} count={stats.length} compact /></td>
          <td>{resourcePhase === "settled" ? formatMoney(resource.marketValue, world) : "—"}</td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={2}>Resources at market prices</th><td>{resourcePhase === "settled" ? formatMoney(resources.reduce((total, resource) => total + resource.marketValue, 0), world) : "—"}</td></tr></tfoot>
      </table>
    </div>}
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{summary}</p>
    {(!autoStart || running) && <div className="birth-roll-footer">{!autoStart && <p>{settled ? "Ready." : paused || hidden ? "Paused." : running ? "Rolling…" : "Starting stats"}</p>}
      {!autoStart && !started && !settled && <button type="button" className="birth-roll-button" disabled={paused || hidden} onClick={start}>Roll starting stats <span aria-hidden="true">↗</span></button>}
      {running && <button type="button" className="birth-roll-skip" onClick={finish}>Skip animation</button>}
    </div>}
  </section>;
}

/** A changed life resets only this presentation, never the simulation snapshot. */
export default function BirthStatRoll(props: BirthStatRollProps) {
  return <BirthStatRollSession key={`${props.life.worldFingerprint}:${props.life.seed}`} {...props} />;
}
