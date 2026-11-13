"use client";
import { useEffect, useRef, useState } from "react";
import { displayProse } from "./models/display-prose.ts";
import { useWorldLibrary } from "./hooks/useWorldLibrary.ts";
import { registerWorldPack } from "./lib/world-session.ts";
import App from "./screens/App.tsx";
import LoadingScreen from "./screens/LoadingScreen.tsx";
import ChainLayer, { leaveChainRoute, useChainRoute } from "./chain/ChainLayer.tsx";
import { parseChainRoute } from "./chain/chain-route.ts";
import TutorialOverlay from "./components/TutorialOverlay.tsx";
import { useTutorialNavigator } from "./hooks/useTutorial.ts";
import type { TutorialScreen } from "./models/tutorial-steps.ts";
import { tutorialStore } from "./state/tutorial-store.ts";
import type { ChainBackend } from "./chain/chain-backend.ts";
import { DEFAULT_CHAIN_CONFIG } from "./chain/config.ts";
import { useChainBackend, loadRankedConfig } from "./chain/chain-backend.ts";
import { beginRankedSession, type RankedSession } from "./chain/ranked-session.ts";
import { PRACTICE_CONTRACT_ID, practiceVerifier } from "./chain/practice-verifier.ts";
import type { LifeView } from "../chain/types.ts";
import { loadLifeWorld } from "./chain/life-world.ts";
/** Register an exact ranked pack without changing free-play bindings. */
async function loadRankedWorld(version: string) {
  const ready = await loadLifeWorld(version);
  registerWorldPack(ready);
  return ready;
}

/** Tour steps on the Weave screens use their hash routes; every other step leaves them for the game. */
function navigateChainForTutorial(screen: TutorialScreen): void {
  if (screen.kind === "chain") {
    if (window.location.hash !== screen.hash) window.location.hash = screen.hash;
  } else if (parseChainRoute(window.location.hash)) leaveChainRoute();
}

export default function GameClient() {
  const backend = useChainBackend();
  const chainRoute = useChainRoute();
  const { active, pickerOpen, setPickerOpen, worlds, busy, error, loadingPhase, openWorlds, enterWorld, keepImportedWorld, holdFreePlayForRanked } = useWorldLibrary();
  const dialog = useRef<HTMLDialogElement>(null);
  // A ranked life replaces free play until its ending report is closed; free play's save is untouched meanwhile.
  const [rankedSession, setRankedSession] = useState<RankedSession | null>(null);
  const [, setRankedRevision] = useState(0);

  async function beginRanked(life: LifeView, backend: ChainBackend) {
    const config = backend.mode === "live" ? await loadRankedConfig() : null;
    const world = await loadRankedWorld(life.world_version);
    const contractId = backend.mode === "preview"
      ? (backend.contractId ?? PRACTICE_CONTRACT_ID)
      : (config?.contract_id ?? backend.contractId ?? DEFAULT_CHAIN_CONFIG.contractId);
    const session = await beginRankedSession({
      contract: backend.contract, contractId,
      networkId: backend.networkId ?? DEFAULT_CHAIN_CONFIG.networkId,
      practice: backend.mode === "preview",
      verifyUrl: "/api/ranked/verify", world,
      ...(backend.mode === "preview" ? { verifyLocally: practiceVerifier(world, backend.contract) } : {}),
    }, life);
    holdFreePlayForRanked();
    setRankedSession(session);
  }

  useTutorialNavigator(navigateChainForTutorial);
  // First visit only, once the game is on screen. A shared link straight into a Weave screen is left alone.
  useEffect(() => {
    if (active && !parseChainRoute(window.location.hash)) tutorialStore.autoOpen();
  }, [Boolean(active)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pickerOpen && !dialog.current?.open) dialog.current?.showModal();
    else if (!pickerOpen && dialog.current?.open) dialog.current?.close();
  }, [pickerOpen]);

  if (!active) return <LoadingScreen phase={loadingPhase} />;
  return <>
    {rankedSession
      ? <App key={`ranked-${rankedSession.life.life_id}`} worldPickerOpen={pickerOpen || busy || Boolean(chainRoute)} ranked={{
        initial: rankedSession.state, current: () => rankedSession.state,
        sync: next => rankedSession.sync(next), onSynced: () => setRankedRevision(value => value + 1),
      }} />
      : <App key={active.key} chainBackend={backend} onChooseWorld={() => { void openWorlds(); }} onNewLife={previous => { void enterWorld(active.world.id, true, previous); }} onImportedLife={keepImportedWorld} worldPickerOpen={pickerOpen || busy || Boolean(chainRoute)} startFresh={active.fresh} startFreshFrom={active.previousLife} worldRoutes={active.world.routes} eventVisuals={active.world.eventVisuals} />}
    <dialog ref={dialog} className="detail-dialog world-picker" onCancel={() => setPickerOpen(false)} aria-labelledby="world-picker-title">
      <div className="dialog-content"><button className="dialog-close" aria-label="Close world library" onClick={() => setPickerOpen(false)}>×</button><p className="eyebrow">WORLD SELECT</p><h2 id="world-picker-title">Choose a world</h2><p>Start a life or resume your save.</p>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        {busy && <p role="status">Opening the world library…</p>}
        <div className="world-library">{worlds.map(world => <article key={world.id}><span className="eyebrow">{world.id === active.world.id ? "YOUR CURRENT WORLD" : "A WORLD TO EXPLORE"}</span><h3>{world.title}</h3><p>{displayProse(world.description)}</p><div className="world-route-tags">{world.routes.filter(route => route.enabled).map(route => <span key={route.id}>{route.title}</span>)}</div><button className="primary-button" disabled={busy} onClick={() => { void enterWorld(world.id, false); }}>Enter this world →</button></article>)}</div>
      </div>
    </dialog>
    <ChainLayer backend={backend} rankedSession={rankedSession} onBeginRanked={beginRanked} onRankedClosed={() => setRankedSession(null)} />
    <TutorialOverlay />
  </>;
}
