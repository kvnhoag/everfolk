const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_INDEX = new Map(Array.from(ALPHABET, (char, index) => [char, BigInt(index)]));

/** Bitcoin-alphabet base58, as used by NEAR public keys. */
export function base58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = ALPHABET[Number(value % 58n)] + out;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = `1${out}`;
  }
  return out;
}

/** Decode Bitcoin-alphabet base58 back into exact raw bytes. */
export function decodeBase58(text: string): Uint8Array {
  if (!text) return new Uint8Array(0);
  let value = 0n;
  for (const char of text) {
    const digit = ALPHABET_INDEX.get(char);
    if (digit === undefined) throw new Error("Invalid base58 character.");
    value = value * 58n + digit;
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  bytes.reverse();
  let leadingZeros = 0;
  for (const char of text) {
    if (char !== "1") break;
    leadingZeros += 1;
  }
  const result = new Uint8Array(leadingZeros + bytes.length);
  result.set(bytes, leadingZeros);
  return result;
}
