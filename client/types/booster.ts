export interface BoosterCardView {
  name: string;
  rarity: number;
  art: string;
  sub: string;
}

export interface BoosterCollectionPack {
  id: string;
  lifeKey: string;
  characterName: string;
  cards: BoosterCardView[];
  selected: number[];
}

export interface BoosterSceneOptions {
  cards: BoosterCardView[];
  legacyCount?: number;
  reviewIndices?: number[];
  onSave(indices: number[]): number;
  onSkip(): void;
  onClose(): void;
  onReady?(): void;
  /** Verified packs continue to the contract's existing single-card decision UI. */
  onRevealed?(): void;
}
