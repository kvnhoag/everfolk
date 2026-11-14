import ArtworkImage from "../components/ArtworkImage.tsx";
import { useEffect, useId, useRef, useState } from "react";
import type { LifeState } from "../../src/types.ts";
import type { LifeView } from "../../chain/types.ts";
import SiteNav from "../components/SiteNav.tsx";
import RankedMenuEntry from "../chain/RankedMenuEntry.tsx";
import type { ChainBackend } from "../chain/chain-backend.ts";
import { WeaveAccountDetails } from "../chain/WeaveMenu.tsx";
import MenuLifeCard from "../components/MenuLifeCard.tsx";
import LivingCoast, { useCoastMotion } from "../homepage/LivingCoast.tsx";
import EverfolkBrand from "../components/EverfolkBrand.tsx";
import "../homepage/homepage.css";
import "../homepage/luminous.css";
import "../homepage/typeset.css";
import { useLuminousLight } from "../homepage/useLuminousLight.ts";
import GameMusicPlayer from "../components/GameMusicPlayer.tsx";
import TutorialButton from "../components/TutorialButton.tsx";
import { readWeaveMode, writeWeaveMode } from "../storage/weave-mode.ts";

export interface MainMenuProps {
  /** A ranked life stays saved when the player starts a separate guest life. */
  rankedLife?: boolean;
  life: LifeState;
  hasBegun: boolean;
  hasRevealedStats: boolean;
  onBegin(): void;
  onContinue(): void;
  onContinueWeave?(life: LifeView): Promise<void>;
  weaveEnabled?: boolean;
  onWeaveChange?(enabled: boolean): void;
  notice?: string;
  active?: boolean;
  chainBackend?: ChainBackend | null;
}

/** The home header also reaches the NPC companions and the wiki, which have no place in the game header. */
const HOME_EXTRA_LINKS = [{ href: "/npc", label: "NPC companions" }, { href: "/wiki", label: "Wiki" }] as const;

function HomeNotice({ notice }: { notice?: string }) {
  return notice ? <div className="ef-home-notice-stack"><p className="ef-home-notice" role="status">{notice}</p></div> : null;
}

function NewLifeChoice({ rankedLife = false, life, hasBegun, hasRevealedStats, onBegin, onContinue, weaveEnabled }: Pick<MainMenuProps, "rankedLife" | "life" | "hasBegun" | "hasRevealedStats" | "onBegin" | "onContinue"> & { weaveEnabled: boolean }) {
  const ended = life.phase === "ended";
  const pendingBirth = !hasBegun && hasRevealedStats;
  return <div className="ef-home-mode-actions">
    <button className={`ef-home-primary ${weaveEnabled ? "is-weave" : "is-guest"}`} type="button" onClick={weaveEnabled ? () => { window.location.hash = "#weave/new"; } : !rankedLife && pendingBirth ? onContinue : onBegin}>
      <span className="ef-home-button-mark" aria-hidden="true">✦</span><span>Start a new life<small>{weaveEnabled ? "Weave Mode" : "Without an account"}</small></span><span className="ef-home-button-arrow" aria-hidden="true">→</span>
    </button>
    {!weaveEnabled && hasBegun && ended && !rankedLife && <button className="ef-home-secondary" type="button" onClick={onContinue}>Revisit your last life<span aria-hidden="true"> →</span></button>}
  </div>;
}

/** Presentation only: opening the menu never advances, rolls or replaces a life. */
export default function MainMenu({ rankedLife = false, life, hasBegun, hasRevealedStats, onBegin, onContinue, onContinueWeave, weaveEnabled: selectedWeaveMode, onWeaveChange, notice, active = true, chainBackend }: MainMenuProps) {
  const lightRoot = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const headingId = useId();
  const [menuWeaveEnabled, setMenuWeaveEnabled] = useState(readWeaveMode);
  const weaveEnabled = selectedWeaveMode ?? menuWeaveEnabled;
  const motion = useCoastMotion();
  const running = motion.enabled && !motion.reduced;
  useLuminousLight(lightRoot, running && active);
  const ended = life.phase === "ended";
  const continuing = hasBegun && !ended;
  const pendingBirth = !hasBegun && hasRevealedStats;
  const showGuestSave = hasBegun && !rankedLife && !weaveEnabled;
  const enterFreeLife = !rankedLife && (continuing || pendingBirth) ? onContinue : onBegin;

  function changeWeaveMode(enabled: boolean) {
    if (onWeaveChange) onWeaveChange(enabled);
    else {
      setMenuWeaveEnabled(enabled);
      writeWeaveMode(enabled);
    }
  }

  function enterSelectedMode() {
    if (!weaveEnabled) { enterFreeLife(); return; }
    if (rankedLife) onContinue();
    else window.location.hash = "#weave";
  }

  useEffect(() => { if (active) heading.current?.focus({ preventScroll: true }); }, [active]);

  return <main ref={lightRoot} className="ef-home" aria-labelledby={headingId} data-motion={running && active ? "running" : "paused"}>
    <LivingCoast running={running} active={active} />
    <div className="ef-light-air" aria-hidden="true">{Array.from({length:8}, (_,i) => <i key={i} className="ef-light-mote" />)}</div>
    <div className="ef-home-shell">
      <header className="ef-home-weave-bar ef-home-top-bar">
        <div className="ef-home-weave-bar-main">
          <a className="ef-home-weave-brand" href="#" aria-label="Everfolk home">
            <EverfolkBrand tone="cream" />
          </a>
          <SiteNav className="ef-home-weave-links" onPlay={enterSelectedMode} extra={HOME_EXTRA_LINKS} />
        </div>
        <div className="ef-home-settings">
          <TutorialButton tone="dark" />
          <GameMusicPlayer variant="home" />
          <button type="button" className="ef-motion-toggle" onClick={motion.toggle} aria-label="Animate the coastal scene" aria-pressed={running} disabled={motion.reduced} title={motion.reduced ? "Reduced motion follows your device preference." : "Pause or resume the living coast"}>
            <span className="ef-motion-icon" aria-hidden="true">{running ? "Ⅱ" : "▷"}</span><span>{motion.reduced ? "Reduced motion" : running ? "Scene motion on" : "Scene motion off"}</span>
          </button>
        </div>
      </header>
      <div className="ef-home-body">
        <section className="ef-home-content">
          {rankedLife && weaveEnabled && <p className="ef-home-eyebrow">WEAVE MODE · NEAR TESTNET</p>}
          <h1 id={headingId} ref={heading} aria-label="Everfolk" tabIndex={-1}>
            <span className="ef-title-wrap">
              <ArtworkImage className="ef-home-wordmark" src="/assets/branding/everfolk-wordmark-cream.svg" alt="" width={1280} height={291} />
              {[0, 1, 2].map(i => <i key={i} className="ef-title-glint" aria-hidden="true" />)}
            </span>
          </h1>
          <div className="ef-home-logo-rule" aria-hidden="true"><span /><i>✦</i><span /></div>
          <div className="ef-home-actions">
            <div className="ef-home-ranked"><RankedMenuEntry checked={weaveEnabled} onChange={changeWeaveMode} /></div>
            {showGuestSave && <MenuLifeCard label={ended ? "YOUR LAST STORY" : "Continue your life"} name={life.character?.name ?? "Your character"} age={life.age} year={life.year} onContinue={continuing ? onContinue : undefined} />}
            {weaveEnabled && <WeaveAccountDetails backend={chainBackend} life={rankedLife ? life : undefined} onContinue={rankedLife ? onContinue : undefined} onContinueWeave={onContinueWeave} />}
            <NewLifeChoice life={life} rankedLife={rankedLife} hasBegun={hasBegun} hasRevealedStats={hasRevealedStats} onBegin={onBegin} onContinue={onContinue} weaveEnabled={weaveEnabled} />
            <HomeNotice notice={notice} />
          </div>
        </section>
      </div>
    </div>
  </main>;
}
