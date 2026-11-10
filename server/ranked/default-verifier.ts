import { buildEvidence } from "../../chain/evidence.ts";
import { RANKED_WORLD_VERSION } from "../../chain/ids.ts";
import type { WorldPack } from "../../src/types.ts";
import rankedWorld from "../../worlds/ranked/alexandria-ranked-1.json" with { type: "json" };
import type { RankedDependencies, RankedEnvironment } from "./routes.ts";
import { createServerSignerVerifier, type LifeVerifier } from "./verifier.ts";

const cache = new Map<string, Promise<LifeVerifier>>();

/** The server-signer verifier for the ranked world shipped with this build; one per secret and contract. */
export function defaultRankedDependencies(): RankedDependencies {
  return {
    verifier(env: RankedEnvironment) {
      const key = `${env.RANKED_CONTRACT_ID}:${env.RANKED_VERIFIER_SECRET}`;
      let verifier = cache.get(key);
      if (!verifier) {
        verifier = createServerSignerVerifier({
          secretHex: env.RANKED_VERIFIER_SECRET ?? "",
          contractId: env.RANKED_CONTRACT_ID ?? "",
          loadWorld: version => (version === RANKED_WORLD_VERSION ? (rankedWorld as unknown as WorldPack) : null),
          buildEvidence,
        });
        cache.set(key, verifier);
      }
      return verifier;
    },
  };
}
