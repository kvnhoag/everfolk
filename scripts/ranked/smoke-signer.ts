// Test-only life verifier for the testnet smoke run. The real verifier is server/ranked (lane E).
// CLI: node scripts/ranked/smoke-signer.ts keygen <pem-file>
//      node scripts/ranked/smoke-signer.ts sign <pem-file> <life_id> <seed_hex> <account_id> [matched_figure ...]
import { createPrivateKey, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { base58 } from "../../chain/base58.ts";
import { RANKED_WORLD_VERSION } from "../../chain/ids.ts";
import { canonicalJson } from "../../src/random.ts";

export { base58 };

export function newSigningKey(): KeyObject {
  return generateKeyPairSync("ed25519").privateKey;
}

export function nearPublicKey(key: KeyObject): string {
  const jwk = key.export({ format: "jwk" });
  return `ed25519:${base58(Buffer.from(jwk.x ?? "", "base64url"))}`;
}

export function signEvidence(key: KeyObject, evidenceJson: string): { evidence_json: string; signature: string } {
  return { evidence_json: evidenceJson, signature: sign(null, Buffer.from(evidenceJson), key).toString("hex") };
}

/** Plausible finished-life evidence with no sources, for exercising mint on testnet. */
export function smokeEvidence(input: { lifeId: string; seed: string; accountId: string; matchedFigures: string[] }): string {
  return canonicalJson({
    v: 1, seed: input.seed, life_id: input.lifeId, account_id: input.accountId, world_version: RANKED_WORLD_VERSION,
    world_fingerprint: "0".repeat(64), save_hash: "0".repeat(64),
    stats: { health: 40, knowledge: 80, wealth: 30, bonds: 60 }, skills: { literacy: 90, reckoning: 85 },
    origin_id: "clerk-household", peak_job_id: "copyist", accomplishments: [], death_age: 63,
    birth_year: -350, death_year: -287, career_group: "letters", matched_figures: input.matchedFigures, sources: [],
  });
}

function main(argv: string[]): void {
  const [command, file, lifeId, seed, accountId, ...figures] = argv;
  if (command === "keygen" && file) {
    const key = newSigningKey();
    writeFileSync(file, key.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
    process.stdout.write(nearPublicKey(key));
    return;
  }
  if (command === "sign" && file && lifeId && seed && accountId) {
    const key = createPrivateKey(readFileSync(file));
    process.stdout.write(JSON.stringify(signEvidence(key, smokeEvidence({ lifeId, seed, accountId, matchedFigures: figures }))));
    return;
  }
  throw new Error("Usage: smoke-signer.ts keygen <pem> | sign <pem> <life_id> <seed_hex> <account_id> [figure ...]");
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
