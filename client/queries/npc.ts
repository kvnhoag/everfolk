import { requestJson } from "../lib/http.ts";
import type { NpcConnection, NpcSnapshot } from "../types/npc.ts";
export function readNpcSession(connection: NpcConnection) {
  return requestJson<NpcSnapshot>(
    `/api/npc/sessions/${encodeURIComponent(connection.id)}`,
    { headers: { Authorization: `Bearer ${connection.token}` } },
  );
}
export function readNpcExport(connection: NpcConnection) {
  return requestJson<unknown>(
    `/api/npc/sessions/${encodeURIComponent(connection.id)}/export`,
    { headers: { Authorization: `Bearer ${connection.token}` } },
  );
}
