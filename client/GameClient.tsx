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
import ChainLayer from "./chain/ChainLayer.tsx";
import type { ChainBackend } from "./chain/chain-backend.ts";
import { loadRankedConfig } from "./chain/chain-backend.ts";
import { beginRankedSession, type RankedSession } from "./chain/ranked-session.ts";
import { PRACTICE_CONTRACT_ID, practiceVerifier } from "./chain/practice-verifier.ts";
import type { LifeView } from "../chain/types.ts";
import type { WorldPack } from "../src/types.ts";


/** Loads the ranked world only when a ranked life begins; it is large and free play never needs it. */
async function loadRankedWorld(): Promise<WorldPack> {
  const module = await import("../worlds/ranked/alexandria-ranked-1.json");
  const pack = (module.default ?? module) as unknown as WorldPack;
  registerWorldPack(pack);
  return pack;
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
    const world = await loadRankedWorld();
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
      try {
        const saved = readEverfolkStorage(window.localStorage, SELECTION_KEY);
        if (saved) {
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
        }
        else if (readEverfolkStorage(window.localStorage, "everfolk:alexandria-sample:v3") !== null) { world = getLegacyWorld(); restored = true; }
      } catch { world = builtin; }
      if (!restored) {
        setLoadingPhase("world");
        try {
          const catalog = await readApi<PublishedCatalog>("/api/worlds");
          if (catalog.worlds[0]) world = selectFactoryWorld(await readApi<PublishedWorld>(`/api/worlds/${encodeURIComponent(catalog.worlds[0].id)}`));
        } catch { /* A saved or bundled world also works while the service is unavailable. */ }
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
      let world = await readApi<PublishedWorld>(`/api/worlds/${encodeURIComponent(id)}`);
      if (fresh) world = selectFactoryWorld(world, { fresh: true });
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
    {rankedSession
      ? <App key={`ranked-${rankedSession.life.life_id}`} worldPickerOpen={pickerOpen || busy} ranked={{
        initial: rankedSession.state, current: () => rankedSession.state,
        sync: next => rankedSession.sync(next), onSynced: () => setRankedRevision(value => value + 1),
      }} />
      : <App key={active.key} onChooseWorld={() => { void openWorlds(); }} onNewLife={previous => { void enterWorld(active.world.id, true, previous); }} onImportedLife={keepImportedWorld} worldPickerOpen={pickerOpen || busy} startFresh={active.fresh} startFreshFrom={active.previousLife} worldRoutes={active.world.routes} eventVisuals={active.world.eventVisuals} />}
    <dialog ref={dialog} className="detail-dialog world-picker" onCancel={() => setPickerOpen(false)} aria-labelledby="world-picker-title">
      <div className="dialog-content"><button className="dialog-close" aria-label="Close world library" onClick={() => setPickerOpen(false)}>×</button><p className="eyebrow">WORLD SELECT</p><h2 id="world-picker-title">Choose a world</h2><p>Start a life or resume your save.</p>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        {busy && <p role="status">Opening the world library…</p>}
        <div className="world-library">{worlds.map(world => <article key={world.id}><span className="eyebrow">{world.id === active.world.id ? "YOUR CURRENT WORLD" : "A WORLD TO EXPLORE"}</span><h3>{world.title}</h3><p>{displayProse(world.description)}</p><div className="world-route-tags">{world.routes.filter(route => route.enabled).map(route => <span key={route.id}>{route.title}</span>)}</div><button className="primary-button" disabled={busy} onClick={() => { void enterWorld(world.id, false); }}>Enter this world →</button></article>)}</div>
      </div>
    </dialog>
    <ChainLayer rankedSession={rankedSession} onBeginRanked={beginRanked} onRankedClosed={() => setRankedSession(null)} />
  </>;
}
