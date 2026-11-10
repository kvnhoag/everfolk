import { env } from "cloudflare:workers";
import { handleApi } from "../../../server/api";
import type { ApiEnvironment } from "../../../server/api";

export const dynamic = "force-dynamic";
const handle = (request: Request) => handleApi(request, env as unknown as ApiEnvironment);
export const GET = handle;
export const PUT = handle;
export const POST = handle;
export const DELETE = handle;
export const PATCH = handle;
