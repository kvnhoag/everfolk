import { useEffect, useId, useRef } from "react";
import { formatYear } from "../src/calendar.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import StorybookMark from "./StorybookMark.tsx";
import RankedMenuEntry from "./chain/RankedMenuEntry.tsx";
import "./main-menu.css";
import "./storybook-menu.css";

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
  notice?: string;
  active?: boolean;
}

/** Presentation only: opening the menu never advances, rolls or replaces a life. */
export default function MainMenu({ world, life, hasBegun, hasRevealedStats, onBegin, onContinue, onWorlds, onPastLives, onLegacy, onSources, notice, active = true }: MainMenuProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const saveId = useId();
  const ended = life.phase === "ended";
  const continuing = hasBegun && !ended;
  const pendingBirth = !hasBegun && hasRevealedStats;
  const primaryLabel = continuing ? "Continue" : ended ? "Begin a new life" : "Begin life";
  const worldTitle = world.title.replace(/[.!?]+$/u, "");

  useEffect(() => { if (active) heading.current?.focus({ preventScroll: true }); }, [active]);

  return <main className="main-menu storybook-menu" aria-labelledby={headingId}>
    <div className="main-menu-shell">
      <header className="main-menu-topline"><span className="main-menu-mark" aria-hidden="true"><StorybookMark size={32} /></span><span>A life simulator</span><span className="main-menu-stars" aria-hidden="true">· <span>✦</span> ·</span></header>
      <div className="main-menu-layout">
        <section className="main-menu-content">
          <h1 id={headingId} ref={heading} tabIndex={-1}>Everfolk<span>.</span></h1>
          <p className="main-menu-world"><span>Your starting world</span>{worldTitle}</p>
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
          <RankedMenuEntry />
          <nav className="main-menu-links" aria-label="Main menu">
            {onWorlds && <button type="button" onClick={onWorlds}>Choose a world</button>}
            <button type="button" onClick={onPastLives}>Past lives</button>
            {onLegacy && <button type="button" onClick={onLegacy}>Legacy gallery</button>}
            <button type="button" onClick={onSources}>History &amp; sources</button>
          </nav>
        </section>
        <div className="main-menu-world-stack">
          <span className="main-menu-frontispiece-star" aria-hidden="true">✦</span>
          <div className="main-menu-world-preview main-menu-world-preview-medieval" aria-hidden="true">
            <img src="/assets/pixel/worlds/medieval-europe.svg" alt="" />
            <span>Medieval Europe</span>
          </div>
          <div className="main-menu-world-preview main-menu-world-preview-ottoman" aria-hidden="true">
            <img src="/assets/pixel/worlds/ottoman-constantinople.svg" alt="" />
            <span>Ottoman Empire</span>
          </div>
          <figure className="main-menu-landscape">
            <div className="main-menu-illustration-label"><span>Beyond the harbour</span><span aria-hidden="true">✦</span></div>
            <div className="main-menu-image"><img src="/assets/pixel/worlds/alexandria.svg" alt="Pixel artwork of an imagined ancient Egyptian coast, with merchant sails and low waterfront buildings" fetchPriority="high" /></div>
            <figcaption><span>{worldTitle}</span><span>{formatYear(world.startYear)}</span></figcaption>
          </figure>
          <span className="main-menu-world-seal" aria-hidden="true"><StorybookMark size={27} /></span>
        </div>
      </div>
      <footer className="main-menu-footer"><span>Progress saves in this browser.</span></footer>
    </div>
  </main>;
}
