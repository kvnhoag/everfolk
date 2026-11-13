import type { ContentDatabase } from "../db/types.ts";
import type { WorldPack } from "../../src/types.ts";
import world from "../../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import { d1NpcStore } from "./store.ts";
import { createNpcSessionService } from "./service.ts";
import { compatibleNpcController } from "./controller.ts";
import type { NpcController } from "./controller.ts";
import { layaNpcController } from "./laya-controller.ts";
export interface NpcEnvironment {
  DB?: ContentDatabase;
  NPC_PROVIDER?: string;
  NPC_LAYA_ENDPOINT?: string;
  NPC_LAYA_KEY?: string;
  NPC_LLM_ENDPOINT?: string;
  NPC_LLM_KEY?: string;
  NPC_LLM_MODEL?: string;
}
export function npcProviderConfiguration(env: NpcEnvironment) {
  let controller: NpcController | undefined;
  let configurationError = false;
  const laya = env.NPC_PROVIDER === "laya";
  if (laya) {
    try {
      controller = layaNpcController({
        endpoint: env.NPC_LAYA_ENDPOINT ?? "",
        apiKey: env.NPC_LAYA_KEY,
      });
    } catch {
      configurationError = true;
    }
  } else if (env.NPC_PROVIDER && env.NPC_PROVIDER !== "openai-compatible")
    configurationError = true;
  else if (env.NPC_LLM_ENDPOINT || env.NPC_LLM_KEY || env.NPC_LLM_MODEL) {
    try {
      controller = compatibleNpcController({
        endpoint: env.NPC_LLM_ENDPOINT ?? "",
        apiKey: env.NPC_LLM_KEY ?? "",
        model: env.NPC_LLM_MODEL ?? "",
      });
    } catch {
      configurationError = true;
    }
  }
  return {
    controller,
    configurationError,
    ...(laya
      ? {
          allowGuestProvider: true,
          maxModelCalls: 1000,
          dailyModelCalls: 5000,
          decisionTimeoutMs: 10000,
        }
      : {}),
  };
}

export function configuredNpcService(env: NpcEnvironment) {
  if (!env.DB) return undefined;
  return createNpcSessionService({
    world: world as unknown as WorldPack,
    store: d1NpcStore(env.DB),
    ...npcProviderConfiguration(env),
  });
}
