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
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("everfolk:npc-connection");
      if (raw) {
        const c = JSON.parse(raw);
        if (typeof c.id === "string" && typeof c.token === "string") {
          setConnection(c);
          void readNpcSession(c)
            .then(setSession)
            .catch(() =>
              setError(
                "The saved NPC session could not be reached. Your ordinary life is unaffected.",
              ),
            );
        }
      }
    } catch {
      setError("This browser cannot restore the NPC connection.");
    }
  }, []);
  async function start(seed: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await startNpcSession(seed),
        c = { id: result.id, token: result.token };
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
      setError(e instanceof Error ? e.message : "NPC session could not start.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function act(
    operation: "turn" | "step" | "answer" | "speak" | "lease",
    input: Record<string, unknown> = {},
  ) {
    if (!connection || !session || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await changeNpcSession(
        connection,
        operation,
        session.revision,
        input,
      );
      setSession(next);
      if (next.npcToken)
        setLease({ npcId: String(input.npcId), token: next.npcToken });
      else if (operation === "lease") setLease(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action could not finish.");
      try {
        setSession(await readNpcSession(connection));
      } catch {}
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function download() {
    if (!connection) return;
    try {
      const data = await readNpcExport(connection);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `everfolk-npc-${connection.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  }
  return { session, busy, error, start, act, download, lease };
}
