import type { ContentDatabase } from "../db/types.ts";
import type { WorldPack } from "../../src/types.ts";
import world from "../../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import { d1NpcStore } from "./store.ts";
import { createNpcSessionService } from "./service.ts";
import { compatibleNpcController } from "./controller.ts";
export interface NpcEnvironment {
  DB?: ContentDatabase;
  NPC_LLM_ENDPOINT?: string;
  NPC_LLM_KEY?: string;
  NPC_LLM_MODEL?: string;
}
export function configuredNpcService(env: NpcEnvironment) {
  if (!env.DB) return undefined;
  const configured =
    env.NPC_LLM_ENDPOINT && env.NPC_LLM_KEY && env.NPC_LLM_MODEL;
  return createNpcSessionService({
    world: world as unknown as WorldPack,
    store: d1NpcStore(env.DB),
    ...(configured
      ? {
          controller: compatibleNpcController({
            endpoint: env.NPC_LLM_ENDPOINT!,
            apiKey: env.NPC_LLM_KEY!,
            model: env.NPC_LLM_MODEL!,
          }),
        }
      : {}),
  });
}
