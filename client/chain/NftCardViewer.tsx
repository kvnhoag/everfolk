import BoosterOpening from "../components/BoosterOpening.tsx";
import { NFT_LABELS } from "../lib/booster/labels.mjs";
import type { BoosterCardView } from "../types/booster.ts";

/** The 3D scene holds up to five cards at once. */
const MAX_VIEWED_CARDS = 5;

/** Full-screen 3D view of NFTs: rotate with a drag, flip with F. Viewing never signs or spends anything. */
export default function NftCardViewer({ cards, onClose }: { cards: readonly BoosterCardView[]; onClose(): void }) {
  const shown = cards.slice(0, MAX_VIEWED_CARDS);
  return <div className="verified-booster-stage nft-card-viewer">
    <BoosterOpening options={{ cards: shown, reviewIndices: shown.map((_, index) => index), labels: NFT_LABELS, onSave: () => 0, onSkip: onClose, onClose }} />
  </div>;
}
