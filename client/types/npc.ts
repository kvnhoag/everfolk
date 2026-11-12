import type { NpcSessionService } from "../../server/npc/service.ts";
export type NpcSnapshot = Awaited<ReturnType<NpcSessionService["get"]>>;
export interface NpcConnection {
  id: string;
  token: string;
}
