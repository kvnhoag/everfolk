"use client";
import { displayProse } from "./display-prose.ts";
import { useEffect, useRef, useState } from "react";
import App from "./App";
import { getBuiltinWorld, getLegacyWorld, worldSummary } from "../server/content.ts";
import type { PublishedCatalog, PublishedWorld, WorldSummary } from "../server/content.ts";
import { engineForLife, hasLifeBegun, readSavedLife, registerWorldPack, selectWorldPack } from "./session.ts";
import type { LifeState } from "../src/types.ts";
import { contentFingerprint } from "../src/random.ts";
import { selectFactoryWorld } from "./factory-world-selection.ts";
import { readEverfolkStorage } from "./brand-storage.ts";
import LoadingScreen from "./LoadingScreen.tsx";
import type { LoadingPhase } from "./LoadingScreen.tsx";
import { keepFreePlayOnRankedStart } from "./ranked-return.ts";
import ChainLayer, { useChainRoute } from "./chain/ChainLayer.tsx";
import type { ChainBackend } from "./chain/chain-backend.ts";
import Web3Navigation from "./chain/Web3Navigation.tsx";
import { useChainBackend, loadRankedConfig } from "./chain/chain-backend.ts";
import { beginRankedSession, type RankedSession } from "./chain/ranked-session.ts";
import { PRACTICE_CONTRACT_ID, practiceVerifier } from "./chain/practice-verifier.ts";
import type { LifeView } from "../chain/types.ts";
import type { WorldPack } from "../src/types.ts";
import { LIVES_WORLD_VERSION } from "../src/vocations/ids.ts";
import { loadLifeWorld } from "./chain/life-world.ts";


/** Loads the world a ranked life was started in. New free-play lives use the vocation expansion; ranked lives use their recorded pack. */
async function loadRankedWorld(version: string): Promise<WorldPack> {
  const ready = await loadLifeWorld(version);
  registerWorldPack(ready);
  return ready;
}

async function loadDemoWorld(): Promise<WorldPack> {
  return loadRankedWorld(LIVES_WORLD_VERSION);
}

const SELECTION_KEY = "everfolk:selected-world:v1";

async function readApi<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "The world library could not be opened.");
    return data as T;
  } finally { clearTimeout(timeout); }
}

export default function GameClient() {
  const backend = useChainBackend();
  const chainRoute = useChainRoute();
  const [active, setActive] = useState<{ world: PublishedWorld; key: number; fresh: boolean; previousLife?: LifeState } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("opening");
  const dialog = useRef<HTMLDialogElement>(null);
  // A ranked life replaces free play until its ending report is closed; free play's save is untouched meanwhile.
  const [rankedSession, setRankedSession] = useState<RankedSession | null>(null);
  const [, setRankedRevision] = useState(0);

  async function beginRanked(life: LifeView, backend: ChainBackend) {
    const config = backend.mode === "live" ? await loadRankedConfig() : null;
    const world = await loadRankedWorld(life.world_version);
    const session = await beginRankedSession({
      contract: backend.contract, contractId: config?.contract_id ?? PRACTICE_CONTRACT_ID,
      verifyUrl: "/api/ranked/verify", world,
      ...(backend.mode === "preview" ? { verifyLocally: practiceVerifier(world, backend.contract) } : {}),
    }, life);
    setActive(keepFreePlayOnRankedStart);
    setRankedSession(session);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingPhase("restoring");
      const builtin = getBuiltinWorld();
      let world = builtin;
      let restored = false;
      let hadSelection = false;
      try {
        const saved = readEverfolkStorage(window.localStorage, SELECTION_KEY);
        if (saved) {
          hadSelection = true;
          world = JSON.parse(saved) as PublishedWorld;
          selectWorldPack(world.pack);
          restored = true;
          // Started lives retain their exact pack. Pending official births may
          // refresh after any content revision, including one in the same era.
          let hasBegunLife = true;
          try {
            const currentLife = readSavedLife(window.localStorage);
            hasBegunLife = Boolean(currentLife && hasLifeBegun(window.localStorage, currentLife));
          } catch { /* Keep an existing selection when its save cannot be checked. */ }
          const selection = selectFactoryWorld(world, { hasBegunLife });
          if (selection !== world) { world = selection; restored = false; }
          if (!hasBegunLife && world.pack.version !== LIVES_WORLD_VERSION) { restored = false; hadSelection = false; }
        }
        else if (readEverfolkStorage(window.localStorage, "everfolk:alexandria-sample:v3") !== null) { world = getLegacyWorld(); restored = true; }
      } catch { world = builtin; }
      if (!restored && (!hadSelection || world.pack.version !== LIVES_WORLD_VERSION)) {
        setLoadingPhase("world");
        const demo = await loadDemoWorld();
        world = { id: demo.id, revisionId: `pack-${contentFingerprint(demo)}`, pack: demo, routes: [] };
      }
      if (cancelled) return;
      selectWorldPack(world.pack);
      try { window.localStorage.setItem(SELECTION_KEY, JSON.stringify(world)); } catch { /* In-memory play still works. */ }
      setActive({ world, key: 0, fresh: false });
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (pickerOpen && !dialog.current?.open) dialog.current?.showModal();
    else if (!pickerOpen && dialog.current?.open) dialog.current?.close();
  }, [pickerOpen]);

  useEffect(() => {
    const holdWorldPicker = () => { if (document.hidden) setPickerOpen(false); };
    document.addEventListener("visibilitychange", holdWorldPicker);
    return () => document.removeEventListener("visibilitychange", holdWorldPicker);
  }, []);

  async function openWorlds() {
    setPickerOpen(true);
    setError("");
    setBusy(true);
    try { setWorlds((await readApi<PublishedCatalog>("/api/worlds")).worlds); }
    catch (cause) { setWorlds([worldSummary(active?.world ?? getBuiltinWorld())]); setError(cause instanceof Error ? cause.message : "The world library is unavailable."); }
    finally { setBusy(false); }
  }

  async function enterWorld(id: string, fresh: boolean, previousLife?: LifeState) {
    setBusy(true);
    setError("");
    try {
      const useDemo = fresh || id === "alexandria" || id === "alexandria-sample" || Boolean(active?.world.pack.demo);
      const demo = useDemo ? await loadDemoWorld() : null;
      let world: PublishedWorld = demo
        ? { id: demo.id, revisionId: `pack-${contentFingerprint(demo)}`, pack: demo, routes: [] }
        : await readApi<PublishedWorld>(`/api/worlds/${encodeURIComponent(id)}`);
      if (fresh && !demo) world = selectFactoryWorld(world, { fresh: true });
      else {
        const refreshed = selectFactoryWorld(world);
        if (refreshed !== world) {
          selectWorldPack(world.pack);
          try {
            const savedLife = readSavedLife(window.localStorage);
            if (!savedLife || !hasLifeBegun(window.localStorage, savedLife)) world = refreshed;
          } catch { /* Preserve the selected world when its save cannot be checked. */ }
        }
      }
      selectWorldPack(world.pack);
      try { window.localStorage.setItem(SELECTION_KEY, JSON.stringify(world)); } catch { /* Per-life saves still report their storage status. */ }
      setActive(current => ({ world, key: (current?.key ?? 0) + 1, fresh, ...(fresh && previousLife ? { previousLife } : {}) }));
      setPickerOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This world could not be opened.");
      setPickerOpen(true);
    } finally { setBusy(false); }
  }

  function keepImportedWorld(life: LifeState) {
    const pack = engineForLife(life).world;
    const samePack = active && contentFingerprint(active.world.pack) === life.worldFingerprint;
    const world: PublishedWorld = {
      id: life.worldId, revisionId: `pack-${life.worldFingerprint}`, pack,
      routes: active?.world.id === life.worldId ? active.world.routes.filter(route => Object.hasOwn(pack.flags, route.flag)) : [],
      ...(samePack && active.world.eventVisuals ? { eventVisuals: active.world.eventVisuals } : {}),
    };
    selectWorldPack(world.pack);
    try { window.localStorage.setItem(SELECTION_KEY, JSON.stringify(world)); } catch { /* The life controller reports save availability. */ }
    setActive(current => current ? { ...current, world } : current);
  }

  if (!active) return <LoadingScreen phase={loadingPhase} />;
  return <>
    <div className="web3-home-bar" hidden={Boolean(chainRoute) || rankedSession?.state.phase === "ended"}><Web3Navigation backend={backend} onExplore={() => { setRankedSession(null); }} /></div>
    {rankedSession
      ? <App key={`ranked-${rankedSession.life.life_id}`} worldPickerOpen={pickerOpen || busy || Boolean(chainRoute)} ranked={{
        initial: rankedSession.state, current: () => rankedSession.state,
        sync: next => rankedSession.sync(next), onSynced: () => setRankedRevision(value => value + 1),
      }} />
      : <App key={active.key} onChooseWorld={() => { void openWorlds(); }} onNewLife={previous => { void enterWorld(active.world.id, true, previous); }} onImportedLife={keepImportedWorld} worldPickerOpen={pickerOpen || busy || Boolean(chainRoute)} startFresh={active.fresh} startFreshFrom={active.previousLife} worldRoutes={active.world.routes} eventVisuals={active.world.eventVisuals} />}
    <dialog ref={dialog} className="detail-dialog world-picker" onCancel={() => setPickerOpen(false)} aria-labelledby="world-picker-title">
      <div className="dialog-content"><button className="dialog-close" aria-label="Close world library" onClick={() => setPickerOpen(false)}>×</button><p className="eyebrow">WORLD SELECT</p><h2 id="world-picker-title">Choose a world</h2><p>Start a life or resume your save.</p>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        {busy && <p role="status">Opening the world library…</p>}
        <div className="world-library">{worlds.map(world => <article key={world.id}><span className="eyebrow">{world.id === active.world.id ? "YOUR CURRENT WORLD" : "A WORLD TO EXPLORE"}</span><h3>{world.title}</h3><p>{displayProse(world.description)}</p><div className="world-route-tags">{world.routes.filter(route => route.enabled).map(route => <span key={route.id}>{route.title}</span>)}</div><button className="primary-button" disabled={busy} onClick={() => { void enterWorld(world.id, false); }}>Enter this world →</button></article>)}</div>
      </div>
    </dialog>
    <ChainLayer backend={backend} rankedSession={rankedSession} onBeginRanked={beginRanked} onRankedClosed={() => setRankedSession(null)} />
  </>;
}
