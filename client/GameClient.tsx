"use client";
import { useEffect, useRef, useState } from "react";
import { displayProse } from "./models/display-prose.ts";
import { useWorldLibrary } from "./hooks/useWorldLibrary.ts";
import { registerWorldPack } from "./lib/world-session.ts";
import App from "./screens/App.tsx";
import LoadingScreen from "./screens/LoadingScreen.tsx";
import ChainLayer, { useChainRoute } from "./chain/ChainLayer.tsx";
import TutorialOverlay from "./components/TutorialOverlay.tsx";
import { useTutorialChainView } from "./hooks/useTutorial.ts";
import { chainTutorialView } from "./models/tutorial-triggers.ts";
import type { ChainBackend } from "./chain/chain-backend.ts";
import { DEFAULT_CHAIN_CONFIG } from "./chain/config.ts";
import { useChainBackend, loadRankedConfig } from "./chain/chain-backend.ts";
import { beginRankedSession, sessionSaveScope, type RankedSession } from "./chain/ranked-session.ts";
import { PRACTICE_CONTRACT_ID, practiceVerifier } from "./chain/practice-verifier.ts";
import { NPC_WORLD_VERSION } from "../chain/ids.ts";
import {
  connectRankedNpcOnline,
  formatNpcProviderStatusNotice,
  openRankedNpcServerSession,
  seedLocalRankedNpcSaveIfMissing,
  type RankedNpcOnlinePlay,
} from "./chain/npc-online.ts";
import type { LifeView } from "../chain/types.ts";
import { loadLifeWorld } from "./chain/life-world.ts";
/** Register an exact ranked pack without changing free-play bindings. */
async function loadRankedWorld(version: string) {
  const ready = await loadLifeWorld(version);
  registerWorldPack(ready);
  return ready;
}

export default function GameClient() {
  const backend = useChainBackend();
  const chainRoute = useChainRoute();
  const { active, pickerOpen, setPickerOpen, worlds, busy, error, loadingPhase, openWorlds, enterWorld, keepImportedWorld, holdFreePlayForRanked } = useWorldLibrary();
  const dialog = useRef<HTMLDialogElement>(null);
  // A ranked life replaces free play until its ending report is closed; free play's save is untouched meanwhile.
  const [rankedSession, setRankedSession] = useState<RankedSession | null>(null);
  const [rankedOnline, setRankedOnline] = useState<RankedNpcOnlinePlay | null>(null);
  const [npcNotice, setNpcNotice] = useState<string | null>(null);
  const [, setRankedRevision] = useState(0);

  async function beginRanked(life: LifeView, backend: ChainBackend) {
    const isNpc = life.world_version === NPC_WORLD_VERSION;
    if (isNpc && (backend.mode !== "live" || typeof backend.proveAccount !== "function")) {
      throw new Error("Live Weave NPC lives require a connected live NEAR sign-in (offline previews cannot mint).");
    }
    const config = backend.mode === "live" ? await loadRankedConfig() : null;
    const world = await loadRankedWorld(life.world_version);
    const contractId = backend.mode === "preview"
      ? (backend.contractId ?? PRACTICE_CONTRACT_ID)
      : (config?.contract_id ?? backend.contractId ?? DEFAULT_CHAIN_CONFIG.contractId);
    const networkId = backend.networkId ?? DEFAULT_CHAIN_CONFIG.networkId;
    const sessionOptions = {
      contract: backend.contract,
      contractId,
      networkId,
      practice: backend.mode === "preview",
      verifyUrl: "/api/ranked/verify",
      world,
      ...(backend.mode === "preview" ? { verifyLocally: practiceVerifier(world, backend.contract) } : {}),
    };

    let npcConnection = null;
    if (isNpc) {
      npcConnection = await openRankedNpcServerSession({
        backend,
        contractId,
        networkId,
        lifeId: life.life_id,
      });
      if (
        npcConnection.snapshot.state.commands.length > life.figure_picks.length ||
        life.draws.length > 0 ||
        life.checkpoints.length > 0
      ) {
        seedLocalRankedNpcSaveIfMissing({
          life,
          snapshot: npcConnection.snapshot,
          scope: sessionSaveScope(sessionOptions),
        });
      }
    }

    const session = await beginRankedSession(sessionOptions, life);
    let onlinePlay: RankedNpcOnlinePlay | null = null;
    let statusNotice: string | null = null;
    if (isNpc && npcConnection) {
      onlinePlay = await connectRankedNpcOnline({
        backend,
        rankedSession: session,
        contractId,
        networkId,
        initialConnection: npcConnection,
        onSynced: () => setRankedRevision(value => value + 1),
        onSnapshot: snapshot => setNpcNotice(formatNpcProviderStatusNotice(snapshot.npcProvider, snapshot.rewardEligible)),
      });
      statusNotice = formatNpcProviderStatusNotice(
        onlinePlay.snapshot().npcProvider,
        onlinePlay.snapshot().rewardEligible,
      );
    }

    holdFreePlayForRanked();
    setRankedOnline(onlinePlay);
    setNpcNotice(statusNotice);
    setRankedSession(session);
  }

  // Tutorial hints follow the screen on view: a Weave screen covers the game, and so does a ranked life's ending report.
  const rankedReportOpen = rankedSession?.state.phase === "ended" && Boolean(backend) && !chainRoute;
  useTutorialChainView(rankedReportOpen || pickerOpen ? "elsewhere" : chainTutorialView(chainRoute?.kind ?? null));

  useEffect(() => {
    if (pickerOpen && !dialog.current?.open) dialog.current?.showModal();
    else if (!pickerOpen && dialog.current?.open) dialog.current?.close();
  }, [pickerOpen]);

  if (!active) return <LoadingScreen phase={loadingPhase} />;
  return <>
    {rankedSession
      ? rankedOnline
        ? <App key={`ranked-${rankedSession.life.life_id}`} worldPickerOpen={pickerOpen || busy || Boolean(chainRoute)} online={rankedOnline} npcStatusNotice={npcNotice} />
        : <App key={`ranked-${rankedSession.life.life_id}`} worldPickerOpen={pickerOpen || busy || Boolean(chainRoute)} ranked={{
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
    <ChainLayer backend={backend} rankedSession={rankedSession} onBeginRanked={beginRanked} onRankedClosed={() => { setRankedOnline(null); setNpcNotice(null); setRankedSession(null); }} />
    <TutorialOverlay />
  </>;
}
