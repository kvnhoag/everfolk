import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import AdminClient from "../../client/AdminClient";
import AdminAccessDenied from "../../client/admin/AdminAccessDenied.tsx";
import { requestIdentity } from "../../server/identity.ts";
import type { AdminEnvironment } from "../../server/identity.ts";

export const dynamic = "force-dynamic";

export default async function Page() {
  const identity = requestIdentity(await headers(), env as unknown as AdminEnvironment);
  if (!identity.isAdmin) return <AdminAccessDenied />;
  return <AdminClient />;
}
