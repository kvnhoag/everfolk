// Authored household possessions, not reconstructed historical asset holdings.
// These inclusive birth ranges affect starting quantities only, never ownership
// during play. Working households retain a moderate cash reserve and tools;
// investment holdings remain concentrated in wealthier backgrounds.
const householdResources = {
  "merchant-household": [[0, 1], [0, 1]],
  "artisan-household": [[1, 2], [0, 0]],
  "harbor-household": [[0, 1], [0, 0]],
  "fishing-household": [[1, 1], [0, 0]],
  "bakery-household": [[1, 1], [0, 1]],
  "clerk-household": [[0, 0], [0, 0]],
  "weaver-household": [[1, 1], [0, 0]],
  "delta-newcomers": [[0, 0], [0, 0]],
  "royal-household": [[0, 1], [1, 2]],
  "estate-household": [[0, 1], [1, 1]],
  "temple-household": [[0, 1], [0, 1]],
  "soldier-household": [[0, 1], [0, 0]],
  "tenant-farming-household": [[1, 1], [0, 0]],
  "domestic-service-household": [[0, 0], [0, 0]],
  "boatbuilder-household": [[1, 2], [0, 1]],
  "musician-household": [[0, 0], [0, 0]],
};

// The existing Wealth ranges are cash in resource points (10 drachmas here).
// These cushions cover ordinary household needs without implying investments.
const householdCashReserves = {
  "tenant-farming-household": [4, 9],
  "artisan-household": [5, 12],
  "weaver-household": [5, 11],
  "boatbuilder-household": [6, 14],
  "bakery-household": [5, 12],
  "fishing-household": [4, 10],
};

export function applyStartingResources(world) {
  world.version = "0.37.0";
  world.economy.uncappedResources = true;
  for (const asset of world.economy.assets) {
    delete asset.maxOwned;
    asset.initialRange = { min: 0, max: 0 };
  }
  for (const origin of world.origins) {
    const ranges = householdResources[origin.id];
    if (!ranges) throw new Error(`Missing starting resources for ${origin.id}`);
    origin.assetRanges = Object.fromEntries(["tool-chest", "workshop-share"].map((id, index) => [id, {
      min: ranges[index][0], max: ranges[index][1],
    }]));
    const cashReserve = householdCashReserves[origin.id];
    if (cashReserve) origin.statRanges[world.economy.stat] = { min: cashReserve[0], max: cashReserve[1] };
  }
  // Buying another copy requires cash and a yearly activity, with no ownership
  // ceiling. Selling still requires at least one copy of the chosen resource.
  for (const asset of world.economy.assets) {
    const purchase = world.character.activities.find(activity => activity.id === `buy-${asset.id}`);
    if (!purchase) throw new Error(`Missing purchase activity for ${asset.id}`);
    purchase.when = { type: "cash", op: "gte", value: asset.value };
  }
  world.economy.description += " Starting household resources are rolled by background and count toward wealth at the listed market prices. Resource quantities and total wealth have no gameplay cap. Resource ranges and prices are authored game balance, not measured historical holdings or market prices.";
}
