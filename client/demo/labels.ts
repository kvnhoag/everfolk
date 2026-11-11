export const ITEM_LABEL: Record<string, string> = {
  grain: "Grain", flax: "Flax", linen: "Linen", silver: "Silver", gold: "Gold", silk: "Coan silk", ox: "Ox", donkey: "Donkey",
};
export const LEVEL_LABEL: Record<string, string> = {
  low: "Low flood", normal: "Normal flood", high: "High flood",
  quiet: "Quiet army", recruiting: "Army recruiting", war: "Army at war",
  safe: "Safe road", uneasy: "Uneasy road", dangerous: "Dangerous road",
};
export function itemLabel(id: string): string { return ITEM_LABEL[id] ?? id; }
export function levelLabel(id: string): string { return LEVEL_LABEL[id] ?? id; }

export const EMAIL_SIGN_IN_NOTE = "Email sign-in is not connected yet.";
