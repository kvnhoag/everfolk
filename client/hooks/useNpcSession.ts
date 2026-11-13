import { useEffect, useRef, useState } from "react";
import type { NpcConnection, NpcSnapshot } from "../types/npc.ts";
import { readNpcExport, readNpcSession } from "../queries/npc.ts";
import { changeNpcSession, startNpcSession } from "../mutations/npc.ts";
export function useNpcSession() {
  const [session, setSession] = useState<NpcSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [connection, setConnection] = useState<NpcConnection | null>(null),
    [lease, setLease] = useState<{ npcId: string; token: string } | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const activeSessionId = useRef<string | null>(null);
  const requestController = useRef<AbortController | null>(null);

  function beginRequest() {
    requestController.current?.abort();
    const controller = new AbortController();
    const gen = ++generation.current;
    requestController.current = controller;
    return {
      gen,
      controller,
      isCurrent: () =>
        mounted.current &&
        generation.current === gen &&
        !controller.signal.aborted,
    };
  }

  useEffect(() => {
    mounted.current = true;
    const gen = ++generation.current;
    const controller = new AbortController();
    requestController.current = controller;
    const isCurrentRestore = () =>
      mounted.current &&
      generation.current === gen &&
      !controller.signal.aborted;
    try {
      const raw = sessionStorage.getItem("everfolk:npc-connection");
      if (raw) {
        const c = JSON.parse(raw);
        if (typeof c.id === "string" && typeof c.token === "string") {
          activeSessionId.current = c.id;
          setConnection(c);
          void readNpcSession(c, controller.signal)
            .then((restored) => {
              if (
                !isCurrentRestore() ||
                restored.id !== c.id ||
                activeSessionId.current !== c.id
              ) {
                return;
              }
              setSession(restored);
              setLease(null);
            })
            .catch(() => {
              if (!isCurrentRestore() || activeSessionId.current !== c.id) {
                return;
              }
              setError(
                "The saved NPC session could not be reached. Your ordinary life is unaffected.",
              );
            })
            .finally(() => {
              if (requestController.current === controller) {
                requestController.current = null;
              }
            });
        }
      }
    } catch {
      setError("This browser cannot restore the NPC connection.");
    }
    return () => {
      mounted.current = false;
      generation.current += 1;
      controller.abort();
      requestController.current?.abort();
      requestController.current = null;
    };
  }, []);
  async function start(seed: string) {
    if (locked.current) return;
    locked.current = true;
    const req = beginRequest();
    const isCurrent = () =>
      mounted.current &&
      generation.current === req.gen &&
      !req.controller.signal.aborted;
    setBusy(true);
    setError("");
    try {
      const result = await startNpcSession(seed, req.controller.signal),
        c = { id: result.id, token: result.token };
      if (!isCurrent()) return;
      activeSessionId.current = c.id;
      setConnection(c);
      setSession(result);
      setLease(null);
      try {
        sessionStorage.setItem("everfolk:npc-connection", JSON.stringify(c));
      } catch {
        setError(
          "The session is active, but this browser could not remember the connection.",
        );
      }
    } catch (e) {
      if (!isCurrent()) return;
      setError(e instanceof Error ? e.message : "NPC session could not start.");
    } finally {
      locked.current = false;
      if (mounted.current && generation.current === req.gen) setBusy(false);
      if (requestController.current === req.controller) {
        requestController.current = null;
      }
    }
  }
  async function act(
    operation:
      "turn" | "step" | "answer" | "speak" | "lease" | "check-provider",
    input: Record<string, unknown> = {},
  ) {
    if (
      !connection ||
      !session ||
      session.id !== connection.id ||
      activeSessionId.current !== connection.id ||
      locked.current
    )
      return;
    locked.current = true;
    const targetConnection = connection;
    const req = beginRequest();
    const isCurrent = () =>
      req.isCurrent() && activeSessionId.current === targetConnection.id;
    setBusy(true);
    setError("");
    try {
      const next = await changeNpcSession(
        targetConnection,
        operation,
        session.revision,
        input,
        req.controller.signal,
      );
      if (!isCurrent() || next.id !== targetConnection.id) return;
      setSession(next);
      if (next.npcToken)
        setLease({ npcId: String(input.npcId), token: next.npcToken });
      else if (operation === "lease") setLease(null);
    } catch (e) {
      if (!isCurrent()) return;
      setError(e instanceof Error ? e.message : "The action could not finish.");
      try {
        const refreshed = await readNpcSession(
          targetConnection,
          req.controller.signal,
        );
        if (isCurrent() && refreshed.id === targetConnection.id) {
          setSession(refreshed);
        }
      } catch {}
    } finally {
      locked.current = false;
      if (mounted.current && generation.current === req.gen) setBusy(false);
      if (requestController.current === req.controller) {
        requestController.current = null;
      }
    }
  }
  async function download() {
    if (!connection) return;
    const targetId = connection.id;
    const gen = generation.current;
    try {
      const data = await readNpcExport(connection);
      if (
        !mounted.current ||
        generation.current !== gen ||
        activeSessionId.current !== targetId
      )
        return;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `everfolk-npc-${connection.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (!mounted.current || generation.current !== gen) return;
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  }
  return { session, busy, error, start, act, download, lease };
}
