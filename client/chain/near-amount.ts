/** NEAR amounts for display and input. The ledger counts yoctoNEAR (10^-24 NEAR) as decimal strings. */

export const YOCTO_PER_NEAR = 10n ** 24n;
export const DEFAULT_MINT_FEE_YOCTO = YOCTO_PER_NEAR.toString();
const SHOWN_DECIMALS = 4;

/** "1", "0.5", "12.3456"; rounds down to 4 decimals; tiny non-zero amounts show as "<0.0001". */
export function formatNear(yocto: string): string {
  if (!/^\d+$/.test(yocto)) return "0";
  const amount = BigInt(yocto);
  const whole = amount / YOCTO_PER_NEAR;
  const fraction = (amount % YOCTO_PER_NEAR).toString().padStart(24, "0").slice(0, SHOWN_DECIMALS).replace(/0+$/u, "");
  if (whole === 0n && !fraction && amount > 0n) return `<0.${"0".repeat(SHOWN_DECIMALS - 1)}1`;
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export type NearInput = { ok: true; yocto: string } | { ok: false; error: string };

/** Parses a player-typed price such as "2.5" into yoctoNEAR. */
export function parseNearInput(text: string): NearInput {
  const value = text.trim();
  const match = /^(\d{1,12})(?:\.(\d{1,24}))?$/u.exec(value);
  if (!match) return { ok: false, error: "Enter a price in NEAR, like 2.5." };
  const yocto = BigInt(match[1]) * YOCTO_PER_NEAR + BigInt((match[2] ?? "").padEnd(24, "0") || "0");
  if (yocto === 0n) return { ok: false, error: "The price must be more than zero." };
  return { ok: true, yocto: yocto.toString() };
}
