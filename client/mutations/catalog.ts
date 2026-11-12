import type { AdminCatalog, PublishedCatalog } from "../../server/content.ts";
import { requestJson } from "../lib/http.ts";

export function saveCatalogDraft(catalog: AdminCatalog): Promise<AdminCatalog> {
  return requestJson("/api/admin/catalog", {
    method: "PUT",
    body: JSON.stringify({ revision: catalog.revision, worlds: catalog.worlds }),
  });
}

export function publishCatalogDraft(revision: number): Promise<PublishedCatalog> {
  return requestJson("/api/admin/publish", { method: "POST", body: JSON.stringify({ revision }) });
}
