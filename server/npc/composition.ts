import type { ContentDatabase } from "../db/types.ts";
import type { WorldPack } from "../../src/types.ts";
import { buildNpcWorld } from "../../chain/npc-world.ts";
import world from "../../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import { d1ChallengeStore, memoryChallengeStore } from "./account-proof.ts";
import { createNpcRankedService } from "./ranked-service.ts";
import { d1NpcRankedStore } from "./ranked-store.ts";
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
export function npcProviderConfiguration(env: NpcEnvironment, fetcher?: typeof fetch) {
  let controller: NpcController | undefined;
  let configurationError = false;
  const laya = env.NPC_PROVIDER === "laya";
  if (laya) {
    try {
      controller = layaNpcController({
        endpoint: env.NPC_LAYA_ENDPOINT ?? "",
        apiKey: env.NPC_LAYA_KEY,
        ...(fetcher ? { fetcher } : {}),
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
        ...(fetcher ? { fetcher } : {}),
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

export interface RankedNpcEnvironment extends NpcEnvironment {
  RANKED_CONTRACT_ID?: string;
  NEAR_RPC_URL?: string;
}

export function configuredNpcRankedService(
  env: RankedNpcEnvironment,
  options: { fetch?: typeof fetch; now?: () => number } = {},
) {
  if (!env.DB || !env.RANKED_CONTRACT_ID) return undefined;
  const provider = npcProviderConfiguration(env, options.fetch);
  const providerName = env.NPC_PROVIDER === "laya" ? "Laya" : provider.controller ? "OpenAI-compatible" : null;
  return createNpcRankedService({
    contractId: env.RANKED_CONTRACT_ID,
    rpcUrl: env.NEAR_RPC_URL || "https://test.rpc.fastnear.com",
    npcWorld: buildNpcWorld(world as unknown as WorldPack),
    store: d1NpcRankedStore(env.DB),
    challenges: env.DB ? d1ChallengeStore(env.DB) : memoryChallengeStore(),
    controller: provider.controller,
    providerName,
    configurationError: provider.configurationError,
    decisionTimeoutMs: provider.decisionTimeoutMs,
    fetch: options.fetch,
    now: options.now,
  });
}
