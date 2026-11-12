import type { AdminCatalog } from "../../server/content.ts";
import { requestJson } from "../lib/http.ts";

export interface AdminSession { authenticated?: unknown; isAdmin?: unknown }

export function readAdminSession(): Promise<AdminSession> {
  return requestJson("/api/session");
}

export function readAdminCatalog(): Promise<AdminCatalog> {
  return requestJson("/api/admin/catalog");
}
