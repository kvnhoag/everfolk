import { useEffect, useId, useRef, useState } from "react";
import { formatYear } from "../../src/calendar.ts";
import type { LifeState } from "../../src/types.ts";
import SiteNav from "../components/SiteNav.tsx";
import RankedMenuEntry from "../chain/RankedMenuEntry.tsx";
import { errorText, type ChainBackend } from "../chain/chain-backend.ts";
import SignInPanel, { EMAIL_UNAVAILABLE } from "../chain/SignInPanel.tsx";
import LivingCoast, { useCoastMotion } from "../homepage/LivingCoast.tsx";
import EverfolkBrand from "../components/EverfolkBrand.tsx";
import "../homepage/homepage.css";
import "../homepage/luminous.css";
import "../homepage/typeset.css";
import { useLuminousLight } from "../homepage/useLuminousLight.ts";
import GameMusicPlayer from "../components/GameMusicPlayer.tsx";
import TutorialButton from "../components/TutorialButton.tsx";

export interface MainMenuProps {
  /** A ranked life is in progress: it can only be continued, never replaced from here. */
  rankedLife?: boolean;
  life: LifeState;
  hasBegun: boolean;
  hasRevealedStats: boolean;
  onBegin(): void;
  onContinue(): void;
  notice?: string;
  active?: boolean;
  chainBackend?: ChainBackend | null;
}

/** The home header also reaches the NPC companions and the wiki, which have no place in the game header. */
const HOME_EXTRA_LINKS = [{ href: "/npc", label: "NPC companions" }, { href: "/wiki", label: "Wiki" }] as const;

function HomeNotice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return <div className="ef-home-notice-stack">
    {notice && <p className="ef-home-notice" role="status">{notice}</p>}
    {error && <p className="ef-home-notice" role="alert">{error}</p>}
  </div>;
}

const unavailableEmailFlow = {
  async sendCode() { throw new Error(EMAIL_UNAVAILABLE); },
  async verify() { throw new Error(EMAIL_UNAVAILABLE); },
};

function WeaveSignIn({ backend, notice }: { backend?: ChainBackend | null; notice?: string }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const live = backend?.mode === "live" ? backend : null;
  const signIn = live?.signin;
  const enterWeave = () => { window.location.hash = "#weave"; };

  async function connectWallet() {
    if (!live) return;
    setConnecting(true);
    setError("");
    try {
      await (signIn?.useWallet ?? live.connect)();
      enterWeave();
    } catch (cause) {
      setError(errorText(cause, "The NEAR wallet could not connect."));
    } finally {
      setConnecting(false);
    }
  }

  if (live?.accountId) return <>
    <button className="ef-home-auth-button" type="button" onClick={enterWeave}>Enter Weave Mode</button>
    <HomeNotice notice={notice} />
  </>;

  const signInNotice = !live ? "Weave Mode sign-in is unavailable right now."
    : !signIn?.available.email ? "Email sign-in is unavailable on this server." : undefined;

  return <>
    <button className="ef-home-auth-button" type="button" disabled={!live || connecting || emailOpen} onClick={() => { void connectWallet(); }}>
      {connecting ? "Connecting…" : "Connect with NEAR wallet"}
    </button>
    <div className="ef-home-auth-divider"><span>or</span></div>
    <button className="ef-home-auth-button ef-home-auth-email" type="button" disabled={connecting || emailOpen} onClick={() => { setError(""); setEmailOpen(true); }}>
      Log in with email
    </button>
    <HomeNotice notice={notice || signInNotice} error={error} />
    {emailOpen && <dialog className="ef-home-email-dialog" aria-label="Email sign-in" data-tutorial="hide"
      ref={dialog => { if (dialog && !dialog.open) dialog.showModal(); }}
      onClose={() => setEmailOpen(false)}>
      <SignInPanel available={signIn?.available ?? { email: false }} onEmail={signIn?.emailFlow ?? unavailableEmailFlow}
        onSuccess={() => { setEmailOpen(false); enterWeave(); }}
        onWallet={async () => {
          if (!live) throw new Error("Sign-in could not connect. Please try again.");
          await (signIn?.useWallet ?? live.connect)(); enterWeave();
        }} onClose={() => setEmailOpen(false)} />
    </dialog>}
  </>;
}

/** Presentation only: opening the menu never advances, rolls or replaces a life. */
export default function MainMenu({ rankedLife = false, life, hasBegun, hasRevealedStats, onBegin, onContinue, notice, active = true, chainBackend }: MainMenuProps) {
  const lightRoot = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const headingId = useId();
  const saveId = useId();
  const [weaveEnabled, setWeaveEnabled] = useState(true);
  const motion = useCoastMotion();
  const running = motion.enabled && !motion.reduced;
  useLuminousLight(lightRoot, running && active);
  const ended = life.phase === "ended";
  const continuing = hasBegun && !ended;
  const pendingBirth = !hasBegun && hasRevealedStats;
  const openWeave = !rankedLife && weaveEnabled;
  const primaryLabel = rankedLife ? "Return to Weave Mode" : continuing ? "Continue your life" : ended ? "Begin a new life" : "Play as guest";
  const enterFreeLife = rankedLife || continuing || pendingBirth ? onContinue : onBegin;

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
          <SiteNav className="ef-home-weave-links" onPlay={enterFreeLife} extra={HOME_EXTRA_LINKS} />
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
          {rankedLife && <p className="ef-home-eyebrow">WEAVE MODE · NEAR TESTNET</p>}
          <h1 id={headingId} ref={heading} aria-label="Everfolk" tabIndex={-1}>
            <span className="ef-title-wrap">
              <img className="ef-home-wordmark" src="/assets/branding/everfolk-wordmark-cream.svg" alt="" width={1280} height={291} />
              {[0, 1, 2].map(i => <i key={i} className="ef-title-glint" aria-hidden="true" />)}
            </span>
          </h1>
          <div className="ef-home-logo-rule" aria-hidden="true"><span /><i>✦</i><span /></div>
          {hasBegun && <div className="ef-home-save" id={saveId}>
            <span className="ef-home-save-mark" aria-hidden="true" />
            <div><span>{ended ? "YOUR LAST STORY" : "A STORY IN PROGRESS"}</span><strong>{life.character?.name ?? "Your character"}</strong></div>
            <span className="ef-home-save-age">Age {life.age}<small>{formatYear(life.year)}</small></span>
          </div>}
          <div className="ef-home-actions">
            {!rankedLife && <div className="ef-home-ranked"><RankedMenuEntry checked={weaveEnabled} onChange={setWeaveEnabled} /></div>}
            <div className="ef-home-mode-actions">
              {openWeave ? <WeaveSignIn backend={chainBackend} notice={notice} /> : <>
                <button className="ef-home-primary" type="button" onClick={enterFreeLife} aria-describedby={continuing ? saveId : undefined}>
                  <span className="ef-home-button-mark" aria-hidden="true">✦</span><span>{primaryLabel}</span><span className="ef-home-button-arrow" aria-hidden="true">→</span>
                </button>
                <HomeNotice notice={notice} />
              </>}
            </div>
            {hasBegun && !rankedLife && <button className="ef-home-secondary" type="button" onClick={ended ? onContinue : onBegin}>{ended ? "Revisit your last life" : "Begin a different story"}<span aria-hidden="true"> →</span></button>}
          </div>
        </section>
      </div>
    </div>
  </main>;
}
