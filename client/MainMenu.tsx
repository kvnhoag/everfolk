import { useEffect, useId, useRef } from "react";
import { formatYear } from "../src/calendar.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
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
  onSources(): void;
  isAdmin?: boolean;
  notice?: string;
  active?: boolean;
}

/** Presentation only: opening the menu never advances, rolls or replaces a life. */
export default function MainMenu({ world, life, hasBegun, hasRevealedStats, onBegin, onContinue, onWorlds, onPastLives, onSources, isAdmin = false, notice, active = true }: MainMenuProps) {
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
      <header className="main-menu-topline"><span className="main-menu-mark" aria-hidden="true"><svg width="13" height="17" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 1h12M2 19h12M4 1v3c0 3 4 4 4 6s-4 3-4 6v3M12 1v3c0 3-4 4-4 6s4 3 4 6v3M5 16h6" /></svg></span><span>A historical life simulator</span>{isAdmin && <a href="/admin">World editor <span aria-hidden="true">↗</span></a>}</header>
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
            <button type="button" onClick={onSources}>History &amp; sources</button>
          </nav>
        </section>
        <figure className="main-menu-landscape">
          <div className="main-menu-image"><img src="/assets/alexandria-harbor.webp" alt="Illustrated harbor of ancient Alexandria, with sailing boats and a lighthouse" fetchPriority="high" /></div>
          <figcaption><span>{worldTitle}</span><span>{formatYear(world.startYear)}</span></figcaption>
        </figure>
      </div>
      <footer className="main-menu-footer"><span>Historical setting. Your own life.</span><span>Progress saves in this browser.</span></footer>
    </div>
  </main>;
}
