import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { KeyType, PublicKey, Signer } from "near-api-js";

/**
 * A near-api-js `Signer` backed by a Privy embedded key. near-api-js serialises and sha256-hashes every
 * transaction, delegate action and NEP-413 message, then hands the 32-byte hash to `signBytes`; Privy signs that
 * raw hash (`signRawHash`) without ever exposing the key. Loaded only by the email session, never by the worker.
 */

/** Signs a `0x`-prefixed hash and resolves to the `0x`-prefixed ed25519 signature. */
export type SignHash = (hex0x: string) => Promise<string>;

const ED25519_SIGNATURE_BYTES = 64;
const IMPLICIT_ACCOUNT = /^[0-9a-f]{64}$/;

const strip0x = (hex: string) => (hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex);

/** A NEAR implicit account id is the lowercase hex of its ed25519 public key. */
export function implicitAccountId(publicKeyHex: string): string {
  const id = strip0x(publicKeyHex.trim()).toLowerCase();
  if (!IMPLICIT_ACCOUNT.test(id)) throw new Error("This sign-in did not return a usable account.");
  return id;
}

/** The ed25519 public key behind an implicit account id. */
export function publicKeyFromHex(publicKeyHex: string): PublicKey {
  return new PublicKey({ keyType: KeyType.ED25519, data: hexToBytes(implicitAccountId(publicKeyHex)) });
}

export class PrivyNearSigner extends Signer {
  readonly #publicKey: PublicKey;
  readonly #signHash: SignHash;

  constructor(publicKey: PublicKey, signHash: SignHash) {
    super();
    this.#publicKey = publicKey;
    this.#signHash = signHash;
  }

  async getPublicKey(): Promise<PublicKey> {
    return this.#publicKey;
  }

  protected async signBytes(bytes: Uint8Array): Promise<Uint8Array> {
    const signature = strip0x(await this.#signHash(`0x${bytesToHex(bytes)}`));
    if (!/^[0-9a-fA-F]+$/.test(signature) || signature.length !== ED25519_SIGNATURE_BYTES * 2) {
      throw new Error("Sign-in returned an unreadable signature.");
    }
    return hexToBytes(signature);
  }
}
