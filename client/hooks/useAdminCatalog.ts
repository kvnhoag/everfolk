import { useEffect, useMemo, useState } from "react";
import { validateCatalog } from "../../server/content.ts";
import type { AdminCatalog } from "../../server/content.ts";
import { publishCatalogDraft, saveCatalogDraft } from "../mutations/catalog.ts";
import { readAdminCatalog, readAdminSession } from "../queries/admin.ts";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something interrupted this action.";
}

/** Own remote catalog state while the editor keeps its selection and dialog state. */
export function useAdminCatalog(selectInitialWorld: (id: string) => void) {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied" | "error">("checking");
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [savedWorlds, setSavedWorlds] = useState("");
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = catalog !== null && JSON.stringify(catalog.worlds) !== savedWorlds;
  const validation = useMemo(() => {
    if (!catalog) return "";
    try { validateCatalog(catalog); return ""; }
    catch (error) { return errorText(error); }
  }, [catalog]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await readAdminSession();
        if (!active) return;
        if (session.authenticated !== true || session.isAdmin !== true) { setAccess("denied"); return; }
        const loaded = await readAdminCatalog();
        if (!active) return;
        setCatalog(loaded);
        setSavedWorlds(JSON.stringify(loaded.worlds));
        selectInitialWorld(loaded.worlds[0]?.id ?? "");
        setAccess("allowed");
      } catch (error) {
        if (active) { setError(errorText(error)); setAccess("error"); }
      }
    })();
    return () => { active = false; };
  }, [selectInitialWorld]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function saveDraft(): Promise<void> {
    if (!catalog) return;
    setError("");
    setBusy("save");
    try {
      validateCatalog(catalog);
      const saved = await saveCatalogDraft(catalog);
      setCatalog(saved);
      setSavedWorlds(JSON.stringify(saved.worlds));
      setNotice("Draft saved. Publish when you are ready for new lives to use it.");
    } catch (error) { setError(errorText(error)); }
    finally { setBusy(null); }
  }

  async function publish(): Promise<boolean> {
    if (!catalog) return false;
    setError("");
    setBusy("publish");
    try {
      await publishCatalogDraft(catalog.revision);
      const saved = await readAdminCatalog();
      setCatalog(saved);
      setSavedWorlds(JSON.stringify(saved.worlds));
      setNotice("Published. New lives will use this revision; lives already underway keep their original world.");
      return true;
    } catch (error) { setError(errorText(error)); return false; }
    finally { setBusy(null); }
  }

  return { access, catalog, setCatalog, busy, error, setError, notice, setNotice, dirty, validation, saveDraft, publish };
}
