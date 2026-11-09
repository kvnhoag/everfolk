import { useEffect, useId, useRef } from "react";
import { formatYear } from "../src/calendar.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import PixelIcon from "./PixelIcon.tsx";
import "./main-menu.css";

export interface MainMenuProps {
  world: WorldPack;
  life: LifeState;
  hasBegun: boolean;
  hasRevealedStats: boolean;
  onBegin(): void;
  onContinue(): void;
  onWorlds?(): void;
  onPastLives(): void;
  onLegacy?(): void;
  onSources(): void;
  isAdmin?: boolean;
  notice?: string;
  active?: boolean;
}

/** Presentation only: opening the menu never advances, rolls or replaces a life. */
export default function MainMenu({ world, life, hasBegun, hasRevealedStats, onBegin, onContinue, onWorlds, onPastLives, onLegacy, onSources, isAdmin = false, notice, active = true }: MainMenuProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const saveId = useId();
  const ended = life.phase === "ended";
  const continuing = hasBegun && !ended;
  const pendingBirth = !hasBegun && hasRevealedStats;
  const primaryLabel = continuing ? "Continue" : ended ? "Begin a new life" : "Begin life";
  const worldTitle = world.title.replace(/[.!?]+$/u, "");

  useEffect(() => { if (active) heading.current?.focus({ preventScroll: true }); }, [active]);

  return <main className="main-menu" aria-labelledby={headingId}>
    <div className="main-menu-shell">
      <header className="main-menu-topline"><span className="main-menu-mark" aria-hidden="true"><PixelIcon name="hourglass" size={18} /></span><span>A historical life simulator</span>{isAdmin && <a href="/admin">World editor <span aria-hidden="true">↗</span></a>}</header>
      <div className="main-menu-layout">
        <section className="main-menu-content">
          <p className="main-menu-kicker">One life in another age.</p>
          <h1 id={headingId} ref={heading} tabIndex={-1}>Historical<br />Lives<span>.</span></h1>
          <p className="main-menu-world">{worldTitle}</p>
          {hasBegun && <div className="main-menu-save" id={saveId}>
            <span className="main-menu-save-label">{ended ? "Last life" : "Your saved life"}</span>
            <strong>{life.character?.name ?? "Your character"}</strong>
            <span>Age {life.age} <span aria-hidden="true">·</span> {formatYear(life.year)}</span>
          </div>}
          {notice && <p className="main-menu-notice" role="status">{notice}</p>}
          <div className="main-menu-actions">
            <button className="main-menu-primary" type="button" onClick={continuing || pendingBirth ? onContinue : onBegin} aria-describedby={continuing ? saveId : undefined}>{primaryLabel}<span aria-hidden="true">→</span></button>
            {hasBegun && <button className="main-menu-secondary" type="button" onClick={ended ? onContinue : onBegin}>{ended ? "View last life" : "Begin a new life"}</button>}
          </div>
          <nav className="main-menu-links" aria-label="Main menu">
            {onWorlds && <button type="button" onClick={onWorlds}>Choose a world</button>}
            <button type="button" onClick={onPastLives}>Past lives</button>
            {onLegacy && <button type="button" onClick={onLegacy}>Legacy gallery</button>}
            <button type="button" onClick={onSources}>History &amp; sources</button>
          </nav>
        </section>
        <div className="main-menu-world-stack">
          <div className="main-menu-world-preview main-menu-world-preview-medieval" aria-hidden="true">
            <img src="/assets/pixel/worlds/medieval-europe.svg" alt="" />
            <span>Medieval Europe</span>
          </div>
          <div className="main-menu-world-preview main-menu-world-preview-ottoman" aria-hidden="true">
            <img src="/assets/pixel/worlds/ottoman-constantinople.svg" alt="" />
            <span>Ottoman Empire</span>
          </div>
          <figure className="main-menu-landscape">
            <div className="main-menu-image"><img src="/assets/pixel/worlds/alexandria.svg" alt="Pixel artwork of an imagined ancient Alexandrian harbor, with merchant sails, a lighthouse and a waterfront terrace" fetchPriority="high" /></div>
            <figcaption><span>{worldTitle}</span><span>{formatYear(world.startYear)}</span></figcaption>
          </figure>
        </div>
      </div>
      <footer className="main-menu-footer"><span>Historical setting. Your own life.</span><span>Progress saves in this browser.</span></footer>
    </div>
  </main>;
}
