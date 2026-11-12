import { requestJson } from "../lib/http.ts";
import type { NpcConnection, NpcSnapshot } from "../types/npc.ts";
export function startNpcSession(seed: string) {
  return requestJson<NpcSnapshot & { token: string }>("/api/npc/sessions", {
    method: "POST",
    body: JSON.stringify({ seed }),
  });
}
export function changeNpcSession(
  connection: NpcConnection,
  operation: "turn" | "step" | "answer" | "speak" | "lease" | "check-provider",
  revision: number,
  input: Record<string, unknown> = {},
) {
  return requestJson<NpcSnapshot & { npcToken?: string }>(
    `/api/npc/sessions/${encodeURIComponent(connection.id)}/${operation}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${connection.token}` },
      body: JSON.stringify({ revision, key: crypto.randomUUID(), ...input }),
    },
    { timeoutMs: 16000 },
  );
}
