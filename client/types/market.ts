import type { MarketOrderRequest } from "../../src/types.ts";
export type { MarketOrderRequest } from "../../src/types.ts";

export interface MarketActions {
  onMarketOrder?: (order: MarketOrderRequest) => void;
  onCancelMarketOrder?: (orderId: number) => void;
}
