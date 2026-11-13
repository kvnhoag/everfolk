import { requestJson } from "../lib/http.ts";
import type { NpcConnection, NpcSnapshot } from "../types/npc.ts";
export function readNpcSession(connection: NpcConnection, signal?: AbortSignal) {
  return requestJson<NpcSnapshot>(
    `/api/npc/sessions/${encodeURIComponent(connection.id)}`,
    { headers: { Authorization: `Bearer ${connection.token}` }, signal },
  );
}
export function readNpcExport(connection: NpcConnection, signal?: AbortSignal) {
  return requestJson<unknown>(
    `/api/npc/sessions/${encodeURIComponent(connection.id)}/export`,
    { headers: { Authorization: `Bearer ${connection.token}` }, signal },
  );
}
