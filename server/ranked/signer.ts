import { base58 } from "../../chain/base58.ts";

/** DER prefix that wraps a raw 32-byte Ed25519 seed as PKCS#8, the only private format WebCrypto imports. */
const PKCS8_ED25519_PREFIX = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];

export interface EvidenceSigner {
  /** NEAR format `ed25519:<base58>`; register it with the contract's `set_verifier_keys`. */
  readonly publicKey: string;
  /** Hex Ed25519 signature over the exact UTF-8 bytes of `message`. */
  sign(message: string): Promise<string>;
}

function hexBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("The verifier secret must be a 32-byte hex seed.");
  return Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
}

/** Ed25519 signer from a 32-byte hex seed, via WebCrypto (Node 24 and Cloudflare Workers). */
export async function createEvidenceSigner(secretHex: string): Promise<EvidenceSigner> {
  const pkcs8 = new Uint8Array([...PKCS8_ED25519_PREFIX, ...hexBytes(secretHex)]);
  const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const publicBytes = Uint8Array.from(atob((jwk.x ?? "").replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  return {
    publicKey: `ed25519:${base58(publicBytes)}`,
    async sign(message) {
      const signature = await crypto.subtle.sign({ name: "Ed25519" }, key, new TextEncoder().encode(message));
      return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
    },
  };
}
