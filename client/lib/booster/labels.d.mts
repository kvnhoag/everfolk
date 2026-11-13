export interface BoosterLabels {
  tag: string;
  footer: string;
  loading: string;
  back: string;
  close: string;
  showCount: boolean;
  reviewLabel: string;
}
export const LEGACY_LABELS: Readonly<BoosterLabels>;
export const NFT_LABELS: Readonly<BoosterLabels>;
export function resolveBoosterLabels(labels?: Partial<BoosterLabels>): BoosterLabels;
export function reviewHint(labels: BoosterLabels, count: number, name: string, position: number): string;
