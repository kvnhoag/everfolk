"use client";
import { useEffect, useRef, useState } from "react";
import App from "./App";
import { getArchivedBuiltinWorld, getBuiltinWorld, getLegacyWorld, worldSummary } from "../server/content.ts";
import type { PublishedCatalog, PublishedWorld, WorldSummary } from "../server/content.ts";
import { engineForLife, hasLifeBegun, readSavedLife, selectWorldPack } from "./session.ts";
import type { LifeState } from "../src/types.ts";
import { contentFingerprint } from "../src/random.ts";

const SELECTION_KEY = "historical-lives:selected-world:v1";

async function readApi<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "The world library could not be opened.");
  return data as T;
}

export default function GameClient() {
  const [active, setActive] = useState<{ world: PublishedWorld; key: number; fresh: boolean; previousLife?: LifeState } | null>(null);
  const [isAdmin, setAdmin] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const builtin = getBuiltinWorld();
      let world = builtin;
      let restored = false;
      try {
        const saved = window.localStorage.getItem(SELECTION_KEY);
        if (saved) {
          world = JSON.parse(saved) as PublishedWorld;
          selectWorldPack(world.pack);
          restored = true;
          // Keep lives already begun in their original era. An untouched pending
          // factory birth may use the new setting, including its Reborn button.
          if (world.id === builtin.id && world.pack.startYear !== builtin.pack.startYear) {
            const archived = getArchivedBuiltinWorld(world.revisionId);
            const currentLife = readSavedLife(window.localStorage);
            if (archived && contentFingerprint(archived.pack) === contentFingerprint(world.pack) &&
              (!currentLife || !hasLifeBegun(window.localStorage, currentLife))) {
              world = builtin;
              restored = false;
            }
          }
        }
        else if (window.localStorage.getItem("historical-lives:alexandria-sample:v3") !== null) { world = getLegacyWorld(); restored = true; }
      } catch { world = builtin; }
      if (!restored) {
        try {
          const catalog = await readApi<PublishedCatalog>("/api/worlds");
          if (catalog.worlds[0]) world = await readApi<PublishedWorld>(`/api/worlds/${encodeURIComponent(catalog.worlds[0].id)}`);
        } catch { /* A saved or bundled world also works while the service is unavailable. */ }
      }
      if (cancelled) return;
      selectWorldPack(world.pack);
      try { window.localStorage.setItem(SELECTION_KEY, JSON.stringify(world)); } catch { /* In-memory play still works. */ }
      setActive({ world, key: 0, fresh: false });
    })();
    void readApi<{ isAdmin: boolean }>("/api/session").then(session => { if (!cancelled) setAdmin(session.isAdmin); }).catch(() => {});
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
      const world = await readApi<PublishedWorld>(`/api/worlds/${encodeURIComponent(id)}`);
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

  if (!active) return <main className="page-shell"><p>Loading Historical Lives…</p></main>;
  return <>
    <App key={active.key} isAdmin={isAdmin} onChooseWorld={() => { void openWorlds(); }} onNewLife={previous => { void enterWorld(active.world.id, true, previous); }} onImportedLife={keepImportedWorld} worldPickerOpen={pickerOpen || busy} startFresh={active.fresh} startFreshFrom={active.previousLife} worldRoutes={active.world.routes} eventVisuals={active.world.eventVisuals} />
    <dialog ref={dialog} className="detail-dialog world-picker" onCancel={() => setPickerOpen(false)} aria-labelledby="world-picker-title">
      <div className="dialog-content"><button className="dialog-close" aria-label="Close world library" onClick={() => setPickerOpen(false)}>×</button><p className="eyebrow">WORLD SELECT</p><h2 id="world-picker-title">Choose a world</h2><p>Start a life or resume your save.</p>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        {busy && <p role="status">Opening the world library…</p>}
        <div className="world-library">{worlds.map(world => <article key={world.id}><span className="eyebrow">{world.id === active.world.id ? "YOUR CURRENT WORLD" : "A WORLD TO EXPLORE"}</span><h3>{world.title}</h3><p>{world.description}</p><div className="world-route-tags">{world.routes.filter(route => route.enabled).map(route => <span key={route.id}>{route.title}</span>)}</div><button className="primary-button" disabled={busy} onClick={() => { void enterWorld(world.id, false); }}>Enter this world →</button></article>)}</div>
      </div>
    </dialog>
  </>;
}
