import { useEffect, useMemo, useRef, useState } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import { engineForLife } from "./session.ts";
import { resolveLifeScenes, sceneContextLabel } from "./scene-model.ts";
import type { EventVisuals, MotionId } from "./scene-model.ts";
import { resolveLifeBanner } from "./banner-state.ts";
import { bannerActorSource } from "./banner-actor.ts";
import { formatYear } from "../src/calendar.ts";
import { readEverfolkStorage } from "./brand-storage.ts";
import "./paper-motion.css";
import "./life-banner.css";

const MOTION_KEY = "everfolk:scene-motion:v1";

/** Discrete pixel props add atmosphere without distorting the scene artwork. */
function PixelAtmosphere({ motion, front = false, water = false }: { motion: MotionId; front?: boolean; water?: boolean }) {
  return <svg className={`paper-atmosphere pixel-atmosphere ${front ? "atmosphere-front" : "atmosphere-back"}`} viewBox="0 0 64 48" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    {!front && <>
      {motion === "write" && <g className="pixel-twinkle" data-loop="stars" fill="#fff2d1"><rect x="46" y="10" width="1" height="1"/><rect x="51" y="14" width="1" height="1"/></g>}
      {(motion === "sail" || motion === "city") && <g className="pixel-birds" data-loop="birds" fill="#41637b"><rect x="18" y="9" width="2" height="1"/><rect x="20" y="10" width="2" height="1"/><rect x="22" y="9" width="2" height="1"/></g>}
      {motion === "unrest" && <g className="pixel-smoke" data-loop="smoke" fill="#adb4a6"><rect x="32" y="20" width="3" height="2"/><rect x="34" y="17" width="4" height="2"/></g>}
    </>}
    {front && <>
      {water && <g className="pixel-wave" data-loop="wave" fill="#b8d2c4"><rect x="5" y="44" width="7" height="1"/><rect x="22" y="46" width="9" height="1"/><rect x="46" y="43" width="10" height="1"/></g>}
      {motion === "play" && <g className="pixel-play-spark" data-loop="play" fill="#edcf91"><rect x="31" y="35" width="1" height="1"/><rect x="34" y="37" width="1" height="1"/></g>}
      {motion === "work" && <g className="pixel-work-spark" data-loop="work" fill="#fff2d1"><rect x="30" y="25" width="1" height="2"/><rect x="33" y="27" width="2" height="1"/></g>}
      {(["cradle", "gather", "reflect", "rest"] as MotionId[]).includes(motion) && <g className="pixel-lamp-flame" data-loop="light" fill="#e4b651"><rect x="55" y="28" width="1" height="2"/><rect x="54" y="29" width="2" height="1"/></g>}
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
  const [motionEnabled, setMotionEnabled] = useState(() => { try { return readEverfolkStorage(window.localStorage, MOTION_KEY) !== "off"; } catch { return true; } });
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
  const banner = resolveLifeBanner(life, world, scene, { eventVisuals, birthReveal });
  const actorSrc = bannerActorSource(life, banner);
  const running = motionEnabled && !reducedMotion && !paused && visible && inView && banner.motion !== "still";
  const motionState = reducedMotion ? "reduced" : !motionEnabled ? "off" : banner.motion === "still" ? "still" : paused ? "paused" : !visible || !inView ? "resting" : "running";
  const toggleMotion = () => {
    const next = !motionEnabled;
    setMotionEnabled(next);
    try { window.localStorage.setItem(MOTION_KEY, next ? "on" : "off"); } catch { /* The control still works for this visit. */ }
  };

  return <figure ref={figure} className={`scene-image paper-scene pixel-scene paper-motion-scene life-banner ${compact ? "paper-in-play" : ""} ${dashboard ? "dashboard-scene" : ""} ${life.phase === "ended" ? "paper-memorial" : ""} ${running ? "motion-running" : "motion-paused"}`} data-scene={scene.scene} data-situation={banner.situation} data-life-stage={banner.stage} data-motion={banner.motion} data-motion-state={motionState}>
    <div className="paper-scene-copy" hidden={dashboard}><span className="paper-scene-kicker">Age {life.age} · {formatYear(life.year)}</span><h2>{banner.title}</h2><strong className="life-banner-situation">{banner.situationLabel}</strong><p className="paper-event-caption">{banner.caption}</p></div>
    <div className={`paper-illustration-wrap life-banner-art motion-${banner.motion}`} key={`${banner.situation}-${banner.stage}-${banner.actorPose}`} role="img" aria-label={banner.alt}>
      <img className="life-banner-background" src={banner.assetSrc} alt="" width={240} height={112} fetchPriority="high" />
      <PixelAtmosphere motion={banner.motion} water={banner.situation === "harbor" || banner.situation === "war"} />
      {actorSrc && <div className={`paper-character-layer life-banner-actor pose-${banner.actorPose}`}><img src={actorSrc} alt="" width={240} height={112} /></div>}
      <PixelAtmosphere motion={banner.motion} water={banner.situation === "harbor" || banner.situation === "war"} front />
    </div>
    <div className="paper-scene-bottom">
      {dashboard && <details className="dashboard-scene-notes"><summary>{banner.title} · Scene notes</summary><p>{banner.situationLabel}. {banner.caption}</p></details>}
      {!dashboard && contexts.length > 1 && <div className="scene-context-list" role="group" aria-label="Scenes from this year">{contexts.map(context => <button type="button" key={context.key} className={context.key === scene.key ? "is-active" : ""} aria-pressed={context.key === scene.key} aria-label={`Show scene: ${context.title}`} title={context.title} onClick={() => setSelectedKey(context.key)}><span>{sceneContextLabel(context)}</span><strong>{context.title}</strong></button>)}</div>}
      <div className="paper-motion-controls"><span className="paper-motion-status">{reducedMotion ? "Reduced motion" : ""}</span><button type="button" className="scene-motion-toggle" aria-label="Scene motion" aria-pressed={motionEnabled && !reducedMotion} disabled={reducedMotion} title={reducedMotion ? "Your device is set to reduce motion." : "Turn scene animation on or off"} onClick={toggleMotion}><span className={running ? "motion-indicator is-moving" : "motion-indicator"} aria-hidden="true" />Animation {motionEnabled && !reducedMotion ? "on" : "off"}</button></div>
    </div>
  </figure>;
}
