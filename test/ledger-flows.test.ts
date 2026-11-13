import assert from "node:assert/strict";
import test from "node:test";
import { flowTotal, ledgerFlows, signedAmount } from "../client/demo/ledger-flows.ts";
import { mentionedResources } from "../client/demo/storehouse-model.ts";

const read = (id: string, text: string, touched: Parameters<typeof ledgerFlows>[1]) => ledgerFlows({ id, text }, touched, mentionedResources);

test("settlement lines become signed movements with a colour tone", () => {
  const harvest = read("household-harvest", "After a normal flood, the household plot brings in a harvest of 1300 measures of grain and 40 bundles of flax.", ["grain", "flax"]);
  assert.deepEqual([harvest.grain?.delta, harvest.grain?.tone, harvest.flax?.delta], [1300, "gain", 40]);
  const fallow = read("household-harvest", "No one could work the household plot this year; it lay fallow and brought in no harvest.", ["grain", "flax"]);
  assert.deepEqual([fallow.grain?.label, fallow.grain?.delta, fallow.grain?.tone], ["No harvest", 0, "loss"]);
  assert.deepEqual([read("household-rent", "You hand 260 measures of grain to the landowner as rent for the plot.", ["grain"]).grain?.delta], [-260]);
  assert.equal(read("household-eat", "The household eats 600 measures of grain from the store this year.", ["grain"]).grain?.delta, -600);
  assert.equal(read("household-spoilage", "108 measures of stored grain spoil over the year.", ["grain"]).grain?.delta, -108);
  const spun = read("household-spinning", "In the quiet season the household spins 6 bundles of flax into 2 bolts of linen.", ["flax", "linen"]);
  assert.deepEqual([spun.flax?.delta, spun.linen?.delta, spun.linen?.tone], [-6, 2, "gain"]);
  assert.equal(read("household-hunger", "The household goes hungry: 120 measures of grain were missing from what everyone needed to eat.", ["grain"]).grain?.tone, "loss");
});

test("trades move goods and money in opposite directions", () => {
  const sold = read("market-trade", "You sell 30 measures of grain to the merchant for 24.3 drachmas (0.81 a measure on average). The price held.", ["drachmas", "grain"]);
  assert.deepEqual([sold.grain?.delta, sold.drachmas?.delta, sold.drachmas?.tone], [-30, 24.3, "gain"]);
  const bought = read("market-trade", "You buy 1 ox from the merchant for 300 drachmas.", ["drachmas", "ox"]);
  assert.deepEqual([bought.ox?.delta, bought.drachmas?.delta], [1, -300]);
  const credit = read("offer-settled", "The merchant gives you 50 measures of grain on credit at 1 drachmas each; 50 drachmas are added to your debt.", ["drachmas", "grain"]);
  assert.deepEqual([credit.grain?.delta, credit.drachmas?.label, credit.drachmas?.tone], [50, "On credit", "loss"]);
  const contract = read("market-trade", "You contract to deliver 100 measures of grain to the army at 1 drachmas a measure.", ["drachmas", "grain"]);
  assert.deepEqual([contract.grain?.tone, contract.grain?.delta], ["neutral", null]);
});

test("an unfamiliar line still shows, as a neutral note that keeps its sentence", () => {
  const odd = read("household-something-new", "Something new happened.", ["grain"]);
  assert.deepEqual([odd.grain?.label, odd.grain?.tone, odd.grain?.delta, odd.grain?.text], ["Noted", "neutral", null, "Something new happened."]);
});

test("totals and signs read clearly", () => {
  assert.equal(flowTotal([{ delta: 1300 }, { delta: -260 }, { delta: null }, { delta: -600 }]), 440);
  assert.equal(flowTotal([{ delta: null }]), null);
  assert.deepEqual([signedAmount(5), signedAmount(-5), signedAmount(0), signedAmount(24.3)], ["+5", "−5", "0", "+24.30"]);
});

test("hunger, deaths, flax rent, household purchases and animal feed read correctly", async () => {
  const hunger = read("household-hunger", "The household goes hungry: 120 measures of grain were missing from what everyone needed to eat.", ["grain"]);
  assert.deepEqual([hunger.grain?.delta, hunger.grain?.tone, hunger.grain?.label], [null, "loss", "Short 120"], "missing grain was never in the store");
  assert.equal(read("household-ox-died", "There was not enough grain to feed every animal. 2 oxen died over the hungry months.", ["ox"]).ox?.delta, -2);
  const fed = read("household-feed-donkey", "Your donkeys eat 80 measures of grain.", ["donkey", "grain"]);
  assert.deepEqual([fed.grain?.delta, fed.grain?.label, fed.donkey?.tone], [-80, "Animal feed", "neutral"]);
  const bought = read("market-household-buy", "The household buys 120 measures of grain from the merchant for 96 drachmas.", ["drachmas", "grain"]);
  assert.deepEqual([bought.grain?.delta, bought.drachmas?.delta], [120, -96]);
  assert.equal(read("household-rent-flax", "You hand 4 bundles of flax to the landowner as rent for the flax plots.", ["flax"]).flax?.delta, -4);
});

test("flax rent lands on the flax row only, and animal feed on grain", async () => {
  const { storehouseRows } = await import("../client/demo/storehouse-model.ts");
  const { demoEngine } = await import("./fixtures/demo/world.ts");
  const engine = demoEngine();
  const life = engine.start("ledger-routing");
  const lines = [
    { type: "activity" as const, id: "household-rent-flax", text: "You hand 4 bundles of flax to the landowner as rent for the flax plots.", age: life.age, year: life.year },
    { type: "activity" as const, id: "household-feed-ox", text: "Your ox eats 60 measures of grain.", age: life.age, year: life.year },
  ];
  const rows = storehouseRows(engine.world, { ...life, journal: [...life.journal, ...lines] })!;
  const byId = Object.fromEntries(rows.map(row => [row.id, row]));
  assert.deepEqual(byId.flax.lastYearFlows.map(flow => flow.delta), [-4]);
  assert.ok(!byId.grain.lastYear.some(line => line.includes("bundles of flax")), "flax rent is not grain rent");
  assert.ok(byId.grain.lastYearFlows.some(flow => flow.label === "Animal feed" && flow.delta === -60));
});
