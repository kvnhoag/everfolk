import { useEffect, useId, useRef } from "react";
import { formatYear } from "../../src/calendar.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";
import RankedMenuEntry from "../chain/RankedMenuEntry.tsx";
import LivingCoast, { useCoastMotion } from "../homepage/LivingCoast.tsx";
import "../homepage/homepage.css";
import "../homepage/luminous.css";
import "../homepage/typeset.css";
import { useLuminousLight } from "../homepage/useLuminousLight.ts";
import GameMusicPlayer from "../components/GameMusicPlayer.tsx";

export interface MainMenuProps {
  /** A ranked life is in progress: it can only be continued, never replaced from here. */
  rankedLife?: boolean;
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
export default function MainMenu({ rankedLife = false, world, life, hasBegun, hasRevealedStats, onBegin, onContinue, onWorlds, onPastLives, onLegacy, onSources, notice, active = true }: MainMenuProps) {
  const lightRoot = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const saveId = useId();
  const motion = useCoastMotion();
  const running = motion.enabled && !motion.reduced;
  useLuminousLight(lightRoot, running && active);
  const ended = life.phase === "ended";
  const continuing = hasBegun && !ended;
  const pendingBirth = !hasBegun && hasRevealedStats;
  const primaryLabel = rankedLife ? "Return to Weave Mode" : continuing ? "Continue your life" : ended ? "Begin a new life" : "Begin your life";

  useEffect(() => { if (active) heading.current?.focus({ preventScroll: true }); }, [active]);

  return <main ref={lightRoot} className="ef-home" aria-labelledby={headingId} data-motion={running && active ? "running" : "paused"}>
    <LivingCoast running={running} active={active} />
    <div className="ef-light-air" aria-hidden="true">{Array.from({length:8}, (_,i) => <i key={i} className="ef-light-mote" />)}</div>
    <div className="ef-home-frame" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="ef-home-shell">
      <header className="ef-home-header">
        <nav className="ef-home-links" aria-label="Main menu">
          <a href="/skills">Skill tree</a>
          <a href="/npc">NPC companions</a>
          {onWorlds && <button type="button" onClick={onWorlds}>Choose a world</button>}
          <button type="button" onClick={onPastLives}>Past lives</button>
          {onLegacy && <button type="button" onClick={onLegacy}>Legacy gallery</button>}
          <button type="button" onClick={onSources}>History &amp; sources</button>
        </nav>
        <div className="ef-home-era"><span className="ef-home-diamond" aria-hidden="true" /><span>THE ANCIENT WORLD</span><strong>{formatYear(world.startYear)}</strong></div>
        <GameMusicPlayer variant="home" />
        <button type="button" className="ef-motion-toggle" onClick={motion.toggle} aria-label="Animate the coastal scene" aria-pressed={running} disabled={motion.reduced} title={motion.reduced ? "Reduced motion follows your device preference." : "Pause or resume the living coast"}>
          <span className="ef-motion-icon" aria-hidden="true">{running ? "Ⅱ" : "▷"}</span><span>{motion.reduced ? "Reduced motion" : running ? "Scene motion on" : "Scene motion off"}</span>
        </button>
      </header>
      <div className="ef-home-body">
        <section className="ef-home-content">
          <p className="ef-home-eyebrow">{rankedLife ? "WEAVE MODE · NEAR TESTNET" : "A LIFE SIMULATOR"}</p>
          <h1 id={headingId} ref={heading} aria-label="Everfolk." tabIndex={-1}><span className="ef-title-wrap"><span className="ef-home-wordmark ef-royal-wordmark" aria-hidden="true">Everfolk</span>{[0,1,2].map(i => <i key={i} className="ef-title-glint" aria-hidden="true" />)}</span></h1>
          <div className="ef-home-logo-rule" aria-hidden="true"><span /><i>✦</i><span /></div>
          <p className="ef-home-tagline">Live another story.</p>
          <div className="ef-home-rule" aria-hidden="true"><span /><i /><span /></div>
          {hasBegun && <div className="ef-home-save" id={saveId}>
            <span className="ef-home-save-mark" aria-hidden="true" />
            <div><span>{ended ? "YOUR LAST STORY" : "A STORY IN PROGRESS"}</span><strong>{life.character?.name ?? "Your character"}</strong></div>
            <span className="ef-home-save-age">Age {life.age}<small>{formatYear(life.year)}</small></span>
          </div>}
          {notice && <p className="ef-home-notice" role="status">{notice}</p>}
          <div className="ef-home-actions">
            <button className="ef-home-primary" type="button" onClick={rankedLife || continuing || pendingBirth ? onContinue : onBegin} aria-describedby={continuing ? saveId : undefined}>
              <span className="ef-home-button-mark" aria-hidden="true">✦</span><span>{primaryLabel}</span><span className="ef-home-button-arrow" aria-hidden="true">→</span>
            </button>
            {hasBegun && !rankedLife && <button className="ef-home-secondary" type="button" onClick={ended ? onContinue : onBegin}>{ended ? "Revisit your last life" : "Begin a different story"}<span aria-hidden="true"> →</span></button>}
          </div>
          <p className="ef-home-save-note"><span aria-hidden="true">◇</span>Your story is saved in this browser.</p>
        </section>
      </div>
      <footer className="ef-home-footer">
        <div className="ef-home-footer-main">
          <a className="ef-home-weave-brand" href="#weave" aria-label="Everfolk Weave Mode">
            <strong>Everfolk</strong>
            <span>WEAVING FATES</span>
          </a>
          <nav className="ef-home-weave-links" aria-label="Everfolk experiences">
            <a href="#weave">Weave Mode</a>
            <a href="#figures">Figures</a>
            <a href="#market">Market</a>
            <a href="#mine">My lives</a>
            <button type="button" onClick={rankedLife || continuing || pendingBirth ? onContinue : onBegin}>Explore for free</button>
          </nav>
        </div>
        {!rankedLife && <div className="ef-home-ranked"><RankedMenuEntry /></div>}
      </footer>
    </div>
  </main>;
}
