import { buildEvidence } from "../../chain/evidence.ts";
import { buildNpcWorld } from "../../chain/npc-world.ts";
import { worldForVersion } from "../../chain/worlds.ts";
import type { WorldPack } from "../../src/types.ts";
import rankedWorld from "../../worlds/ranked/alexandria-ranked-1.json" with { type: "json" };
import demoWorld from "../../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import legacyDemoWorld from "../../worlds/demo/alexandria-demo-1.json" with { type: "json" };
import lives8World from "../../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import { configuredNpcRankedService } from "../npc/composition.ts";
import type { RankedDependencies, RankedEnvironment } from "./routes.ts";
import { createEvidenceSigner, type EvidenceSigner } from "./signer.ts";
import { createServerSignerVerifier, VerificationUnavailableError } from "./verifier.ts";

const signerCache = new Map<string, Promise<EvidenceSigner>>();

function cachedSigner(secretHex: string): Promise<EvidenceSigner> {
  let signer = signerCache.get(secretHex);
  if (!signer) {
    signer = createEvidenceSigner(secretHex);
    signerCache.set(secretHex, signer);
  }
  return signer;
}

/** The server-signer verifier for all supported ranked worlds; signer is cached per secret, request deps stay fresh. */
export function defaultRankedDependencies(): RankedDependencies {
  return {
    async verifier(env: RankedEnvironment, deps?: RankedDependencies) {
      const secretHex = env.RANKED_VERIFIER_SECRET ?? "";
      const signer = await cachedSigner(secretHex);
      return createServerSignerVerifier({
        secretHex,
        signer,
        contractId: env.RANKED_CONTRACT_ID ?? "",
        loadWorld: version => worldForVersion(
          version,
          rankedWorld as unknown as WorldPack,
          demoWorld as unknown as WorldPack,
          legacyDemoWorld as unknown as WorldPack,
          buildNpcWorld(lives8World as unknown as WorldPack),
        ),
        verifyNpcSession: (life, save) => {
          const service = env.NPC_RANKED ?? configuredNpcRankedService(env, {
            fetch: deps?.fetch,
            now: deps?.now ? () => deps.now!().getTime() : undefined,
          });
          if (!service) {
            throw new VerificationUnavailableError("Live NPC reward verification is not configured on this server.");
          }
          return service.verifyForReward(life, save);
        },
        buildEvidence,
      });
    },
  };
}
