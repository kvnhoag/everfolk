// Order capacity is authored game balance, not a historical trading limit.
// Existing stocks remain owned; only new annual market commitments are limited.
export function applyMarketCapacity(world) {
  world.version = "0.41.0";
  const market = world.economy.market;
  market.maxQuantity = 100;
  market.maxOrders = 8;
  market.orderLimits = {
    household: { perOrder: 50, perYear: 100 },
    professional: { perOrder: 100, perYear: 300 },
  };
  world.economy.description += " Annual market capacity limits each household to 50 units per order and 100 committed units per year. Occupations with full market access can arrange up to 100 units per order and 300 committed units per year. Purchases and sales share the annual allowance; splitting a contract does not increase it. Cancelling a pending contract frees its committed capacity. Existing possessions and production capacity are unchanged. These limits are authored game balance.";
}
