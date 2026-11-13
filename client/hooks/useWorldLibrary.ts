import { useEffect, useState } from "react";
import { getBuiltinWorld, getLegacyWorld, worldSummary } from "../../server/content.ts";
import type { PublishedWorld, WorldSummary } from "../../server/content.ts";
import type { LifeState } from "../../src/types.ts";
import { contentFingerprint } from "../../src/random.ts";
import { engineForLife, selectWorldPack } from "../lib/world-session.ts";
import { selectFactoryWorld } from "../models/factory-world-selection.ts";
import { persistSelectedWorld } from "../mutations/worlds.ts";
import { hasLifeBegun, readSavedLife } from "../queries/lives.ts";
import { hasLegacyWorldSave, readSelectedWorld, readWorld, readWorldCatalog } from "../queries/worlds.ts";
import type { LoadingPhase } from "../types/loading.ts";

/** Restore and select immutable worlds independently from the library dialog. */
export function useWorldLibrary() {
  const [active, setActive] = useState<{ world: PublishedWorld; key: number; fresh: boolean; previousLife?: LifeState } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("opening");
  const [loadingProgress, setLoadingProgress] = useState(5);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingPhase("restoring");
      setLoadingProgress(20);
      const builtin = getBuiltinWorld();
      let world = builtin;
      let restored = false;
      try {
        const saved = readSelectedWorld(window.localStorage);
        if (saved) {
          world = saved;
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
        else if (hasLegacyWorldSave(window.localStorage)) { world = getLegacyWorld(); restored = true; }
      } catch { world = builtin; }
      if (!restored) {
        setLoadingPhase("world");
        setLoadingProgress(45);
        try {
          const catalog = await readWorldCatalog();
          if (cancelled) return;
          setLoadingProgress(65);
          if (catalog.worlds[0]) world = selectFactoryWorld(await readWorld(catalog.worlds[0].id));
        } catch { /* A saved or bundled world also works while the service is unavailable. */ }
      }
      if (cancelled) return;
      setLoadingProgress(90);
      selectWorldPack(world.pack);
      try { persistSelectedWorld(window.localStorage, world); } catch { /* In-memory play still works. */ }
      setLoadingProgress(100);
      setActive({ world, key: 0, fresh: false });
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const holdWorldPicker = () => { if (document.hidden) setPickerOpen(false); };
    document.addEventListener("visibilitychange", holdWorldPicker);
    return () => document.removeEventListener("visibilitychange", holdWorldPicker);
  }, []);

  async function openWorlds() {
    setPickerOpen(true);
    setError("");
    setBusy(true);
    try { setWorlds((await readWorldCatalog()).worlds); }
    catch (cause) { setWorlds([worldSummary(active?.world ?? getBuiltinWorld())]); setError(cause instanceof Error ? cause.message : "The world library is unavailable."); }
    finally { setBusy(false); }
  }

  async function enterWorld(id: string, fresh: boolean, previousLife?: LifeState) {
    setBusy(true);
    setError("");
    try {
      let world = await readWorld(id);
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
      try { persistSelectedWorld(window.localStorage, world); } catch { /* Per-life saves still report their storage status. */ }
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
    try { persistSelectedWorld(window.localStorage, world); } catch { /* The life controller reports save availability. */ }
    setActive(current => current ? { ...current, world } : current);
  }

  return { active, pickerOpen, setPickerOpen, worlds, busy, error, loadingPhase, loadingProgress, openWorlds, enterWorld, keepImportedWorld };
}
