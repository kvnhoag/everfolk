/** Words the 3D scene shows. Free lives keep cards in the local Legacy; Weave NFTs live on NEAR. */
export const LEGACY_LABELS = Object.freeze({
  tag: "PERSONAL COLLECTION",
  footer: "FREE TO PLAY · SAVED ON THIS DEVICE",
  loading: "Preparing your legacy",
  back: "Back to memorial",
  close: "Back to memorial",
  showCount: true,
  reviewLabel: "Saved Legacy review",
});

export const NFT_LABELS = Object.freeze({
  tag: "YOUR NFT",
  footer: "WEAVE MODE · MINTED ON NEAR",
  loading: "Preparing your NFT",
  back: "Continue",
  close: "Close the 3D view",
  showCount: false,
  reviewLabel: "Your NFT in 3D",
});

/** A verified Weave pack being opened: one card will be minted from it. */
export const WEAVE_PACK_LABELS = Object.freeze({
  tag: "WEAVE MODE PACK",
  footer: "WEAVE MODE · VERIFIED PACK",
  loading: "Preparing your pack",
  back: "Back to Weave Mode",
  close: "Save the pack and leave",
  showCount: false,
  reviewLabel: "Your pack",
});

export function resolveBoosterLabels(labels) {
  return { ...LEGACY_LABELS, ...(labels ?? {}) };
}

/** The line under the reviewed card. */
export function reviewHint(labels, count, name, position) {
  if (!labels.showCount) return count === 1 ? `Your NFT · ${name}` : `Your NFTs · ${name} · ${position + 1} / ${count}`;
  return `${count} saved to Legacy · ${name} · ${position + 1} / ${count}`;
}
