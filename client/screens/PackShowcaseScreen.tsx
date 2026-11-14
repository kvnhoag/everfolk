"use client";

import { useState } from "react";
import BoosterOpening from "../components/BoosterOpening.tsx";
import { createShowcasePackCards } from "../models/showcase-pack.ts";
import "../styles/showcase.css";

export default function PackShowcaseScreen() {
  const [{ cards, revision }, setPack] = useState(() => ({ cards: createShowcasePackCards(), revision: 0 }));
  const openAnotherPack = () => setPack(pack => ({ cards: createShowcasePackCards(), revision: pack.revision + 1 }));

  return <main className="showcase-pack" aria-label="Card pack showcase">
    <BoosterOpening replayKey={revision} options={{
      cards,
      hideClose: true,
      labels: {
        tag: "CARD PACK SHOWCASE",
        footer: "5 RANDOM CARDS · AT LEAST 1 LEGENDARY",
        loading: "Preparing your showcase pack",
        close: "Open another pack",
        showCount: false,
        revealAction: "Open another pack",
        revealHint: "Double-click a card to inspect · Open another pack for a fresh draw",
        inspectionLabel: "Showcase preview",
      },
      onSave: () => 0,
      onSkip: openAnotherPack,
      onClose: openAnotherPack,
      onRevealed: openAnotherPack,
    }} />
    <p className="showcase-pack-note">5 random cards · At least 1 Legendary</p>
  </main>;
}
