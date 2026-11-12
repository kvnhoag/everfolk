import { useEffect, useState } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import type { ArchivedLife } from "../types/session.ts";
import { engineForLife, loadAnyLife } from "../lib/world-session.ts";
import { collectLegacyEntries, persistLegacyEntries, readLegacyEntries } from "../storage/legacy-store.ts";
import type { LegacyEntry } from "../storage/legacy-store.ts";

/** Keep the personal collection available across archived and current lives. */
export function useLegacyGallery(life: LifeState, world: WorldPack, archivedLives: readonly ArchivedLife[], enabled = true) {
  const [legacyEntries, setLegacyEntries] = useState<LegacyEntry[]>([]);
  const [legacyNotice, setLegacyNotice] = useState("");

  useEffect(() => {
    if (!enabled) {setLegacyEntries(collectLegacyEntries(world, life, []));setLegacyNotice("");return;}
    try {
      let entries = readLegacyEntries(window.localStorage);
      for (const archived of archivedLives) {
        try { const archivedLife = loadAnyLife(archived.save); entries = collectLegacyEntries(engineForLife(archivedLife).world, archivedLife, entries); }
        catch { /* An unavailable old pack must not hide this collection. */ }
      }
      entries = collectLegacyEntries(world, life, entries);
      setLegacyEntries(entries);
      persistLegacyEntries(window.localStorage, entries);
      setLegacyNotice("");
    } catch (error) {
      setLegacyEntries(previous => collectLegacyEntries(world, life, previous));
      setLegacyNotice(error instanceof Error ? error.message : "The legacy gallery could not be saved in this browser.");
    }
  }, [life, world, archivedLives, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { try { setLegacyEntries(readLegacyEntries(window.localStorage)); } catch { /* Preserve the visible collection. */ } };
    window.addEventListener("everfolk:legacy-updated", refresh);
    return () => window.removeEventListener("everfolk:legacy-updated", refresh);
  }, [enabled]);

  return { legacyEntries, legacyNotice };
}
