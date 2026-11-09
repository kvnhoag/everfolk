import { useEffect, useMemo, useRef, useState } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import { engineForLife } from "./session.ts";
import { resolveLifeScenes, sceneContextLabel } from "./scene-model.ts";
import type { EventVisuals, MotionId } from "./scene-model.ts";
import "./paper-motion.css";

const MOTION_KEY = "historical-lives:scene-motion:v1";

function Leaf({ className, x, y }: { className: string; x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}><path className={className} data-loop="leaf" d="M0 0C-23-18-14-37 2-43 19-26 19-10 0 0Z" fill="#7e916a" /><path d="m0 0 2-34" fill="none" stroke="#b7c3a2" strokeWidth="1.3" /></g>;
}

/** Independently moving paper props accompany the event without articulating raster people. */
function PaperAtmosphere({ motion, front = false }: { motion: MotionId; front?: boolean }) {
  const water = motion === "sail" || motion === "unrest";
  return <svg className={`paper-atmosphere ${front ? "atmosphere-front" : "atmosphere-back"}`} viewBox="0 0 600 400" aria-hidden="true" focusable="false">
    {!front && <>
      {(["cradle", "gather", "reflect", "play"] as MotionId[]).includes(motion) && <>
        <Leaf className="paper-leaf leaf-one" x={36} y={149} /><Leaf className="paper-leaf leaf-two" x={553} y={203} />
        <circle className="paper-mote mote-one" data-loop="mote" cx="113" cy="98" r="3" fill="#bdad72" /><circle className="paper-mote mote-two" data-loop="mote" cx="499" cy="89" r="2" fill="#9ba67e" />
      </>}
      {(motion === "sail" || motion === "city") && <g className="paper-birds" data-loop="birds" fill="none" stroke="#76877b" strokeWidth="2.5" strokeLinecap="round"><path d="m86 95 10-4 10 4m35 24 8-3 8 3" /></g>}
      {motion === "rest" && <><path className="paper-shade" data-loop="shade" d="m81 52 53-15 132 253-38 12Z" fill="#d8dfd1" /><path className="paper-shade shade-two" data-loop="shade" d="m143 34 31-8 116 249-22 9Z" fill="#d8dfd1" /></>}
      {motion === "unrest" && <g fill="#b1b2a5" opacity=".28"><path className="paper-haze haze-one" data-loop="haze" d="M95 92c26-20 40-5 58-13 23-13 30 5 52 1 16-3 30 10 14 17-45 3-83 5-124-5Z" /><path className="paper-haze haze-two" data-loop="haze" d="M324 62c28-14 35-3 53-8 25-11 32 4 54 1 16-2 30 8 14 13-45 3-81 2-121-6Z" /></g>}
      {motion === "city" && <g className="paper-city-banner" data-loop="banner"><path d="M476 78h40v69l-20-12-20 12Z" fill="#b87e5c" /><path d="M471 78h49" stroke="#927b59" strokeWidth="3" strokeLinecap="round" /></g>}
    </>}
    {front && <>
      {water && <g fill="none" strokeLinecap="round"><path className="paper-wave wave-back" data-loop="wave" d="M-50 351q35-13 70 0t70 0t70 0t70 0t70 0t70 0t70 0t70 0t70 0t70 0" stroke="#a0b6af" strokeWidth="8" /><path className="paper-wave wave-front" data-loop="wave" d="M-50 371q28-11 56 0t56 0t56 0t56 0t56 0t56 0t56 0t56 0t56 0t56 0t56 0t56 0" stroke="#d4dfd4" strokeWidth="6" /></g>}
      {motion === "play" && <g className="paper-play-ball" data-loop="ball"><circle cx="455" cy="353" r="9" fill="#b9954c" /><path d="m450 346 6 15m-9-10 16 3" stroke="#d0b36f" strokeWidth="1.2" fill="none" /></g>}
      {motion === "write" && <g className="paper-writing" transform="translate(75 325)"><path d="m-25-14 66-5 5 39-66 5Z" fill="#d2b681" stroke="#bda06c" strokeWidth="1" /><path className="paper-writing-line" data-loop="writing" d="M-12 0q8-8 14-1t14-3m-27 14q11-6 21-2" fill="none" stroke="#827353" strokeWidth="2" strokeLinecap="round" /><path className="paper-stylus" data-loop="stylus" d="m18-20 17-25" stroke="#795d3f" strokeWidth="4" strokeLinecap="round" /></g>}
      {motion === "work" && <g fill="#c3a06b"><path className="paper-shaving shaving-one" data-loop="shaving" d="m94 333 14-5 5 3-14 5Z" /><path className="paper-shaving shaving-two" data-loop="shaving" d="m120 348 10-4 5 3-11 5Z" /><path className="paper-shaving shaving-three" data-loop="shaving" d="m76 355 11-4 4 3-10 4Z" /></g>}
      {(motion === "gather" || motion === "reflect") && <circle className="paper-warm-light" data-loop="light" cx="422" cy="339" r="15" fill="#d6bb72" opacity=".16" />}
      {motion === "rest" && <path className="paper-rest-line" data-loop="rest-line" d="M73 345q23-9 47 0" fill="none" stroke="#bdcbb9" strokeWidth="3" strokeLinecap="round" />}
    </>}
  </svg>;
}

export default function PaperScene({ life, compact, world = engineForLife(life).world, eventVisuals, paused = false, birthReveal = false, dashboard = false }: {
  life: LifeState; compact: boolean; world?: WorldPack; eventVisuals?: EventVisuals; paused?: boolean; birthReveal?: boolean; dashboard?: boolean;
}) {
  const contexts = useMemo(() => {
    // Pending questions belong to the decision dialog. The dashboard scene
    // continues to show established events rather than unchosen possibilities.
    const scenes = resolveLifeScenes(dashboard && life.phase === "choice" ? { ...life, phase: "ready", pendingEventId: null } : life, world, eventVisuals);
    return birthReveal ? scenes.filter(scene => scene.kind === "birth") : scenes;
  }, [life, world, eventVisuals, birthReveal, dashboard]);
  const primaryKey = contexts[0]?.key;
  const [selectedKey, setSelectedKey] = useState(primaryKey);
  const scene = contexts.find(context => context.key === selectedKey) ?? contexts[0];
  const [motionEnabled, setMotionEnabled] = useState(() => { try { return window.localStorage.getItem(MOTION_KEY) !== "off"; } catch { return true; } });
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [inView, setInView] = useState(true);
  const figure = useRef<HTMLElement>(null);

  useEffect(() => { setSelectedKey(primaryKey); }, [primaryKey]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(preference.matches);
    const visibility = () => setVisible(!document.hidden);
    preference.addEventListener("change", change);
    document.addEventListener("visibilitychange", visibility);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => setInView(entries[0]?.isIntersecting ?? false), { threshold: 0.05 });
    if (figure.current) observer?.observe(figure.current);
    return () => { preference.removeEventListener("change", change); document.removeEventListener("visibilitychange", visibility); observer?.disconnect(); };
  }, []);

  if (!scene) return null;
  const running = motionEnabled && !reducedMotion && !paused && visible && inView && scene.motion !== "still";
  const motionState = reducedMotion ? "reduced" : !motionEnabled ? "off" : scene.motion === "still" ? "still" : paused ? "paused" : !visible || !inView ? "resting" : "running";
  const toggleMotion = () => {
    const next = !motionEnabled;
    setMotionEnabled(next);
    try { window.localStorage.setItem(MOTION_KEY, next ? "on" : "off"); } catch { /* The control still works for this visit. */ }
  };

  return <figure ref={figure} className={`scene-image paper-scene paper-motion-scene ${compact ? "paper-in-play" : ""} ${dashboard ? "dashboard-scene" : ""} ${life.phase === "ended" ? "paper-memorial" : ""} ${running ? "motion-running" : "motion-paused"}`} data-scene={scene.scene} data-motion={scene.motion} data-motion-state={motionState}>
    <div className="paper-scene-copy">{scene.eventId !== "the-first-household" && <span className="paper-scene-kicker">{sceneContextLabel(scene)}</span>}<h2>{scene.title}</h2>{!dashboard && scene.eventId !== "the-first-household" && <p className="paper-event-caption">{scene.caption}</p>}</div>
    <div className={`paper-illustration-wrap motion-${scene.motion}`} key={`${scene.scene}-${scene.motion}`}>
      <PaperAtmosphere motion={scene.motion} /><div className="paper-character-layer" data-loop="character"><img src={`/assets/paper/${scene.scene === "rest" && life.age < 18 ? "rest-child" : scene.scene}.webp`} alt={scene.alt} fetchPriority="high" /></div><PaperAtmosphere motion={scene.motion} front />
    </div>
    <div className="paper-scene-bottom">
      {!dashboard && contexts.length > 1 && <div className="scene-context-list" role="group" aria-label="Scenes from this year">{contexts.map(context => <button type="button" key={context.key} className={context.key === scene.key ? "is-active" : ""} aria-pressed={context.key === scene.key} aria-label={`Show scene: ${context.title}`} title={context.title} onClick={() => setSelectedKey(context.key)}><span>{sceneContextLabel(context)}</span><strong>{context.title}</strong></button>)}</div>}
      <div className="paper-motion-controls"><span className="paper-motion-status">{reducedMotion ? "Reduced motion" : ""}</span><button type="button" className="scene-motion-toggle" aria-label="Scene motion" aria-pressed={motionEnabled && !reducedMotion} disabled={reducedMotion} title={reducedMotion ? "Your device is set to reduce motion." : "Turn scene animation on or off"} onClick={toggleMotion}><span className={running ? "motion-indicator is-moving" : "motion-indicator"} aria-hidden="true" />Animation {motionEnabled && !reducedMotion ? "on" : "off"}</button></div>
    </div>
  </figure>;
}
