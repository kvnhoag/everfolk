import type { LifeState, WorldPack } from "../types.ts";
import type { CapabilityEvidence, CommissionPayer, CommissionTerms } from "./types.ts";
import { farmSaleReason } from "./farming.ts";
import { ruleFor, type CapabilityRule } from "./rules.ts";
import { productionQuote, type ProductionQuote } from "./production.ts";
import { basketQuote, buyBasket, inventoryOf, putItem, takeItem, type BasketQuote } from "./inventory.ts";
import { fieldOfNode, needNote, scaledPay } from "../paths/pay.ts";

export type { CommissionTerms };
export interface WorkQuote {
  inputs: Record<string, number>; basket: BasketQuote; fee: number; pay: number;
  payer: CommissionPayer; production?: ProductionQuote;
  output?: string; quantity?: number; quality?: number; reason?: string;
  /** Paths worlds: why the pay differs from the usual (scarce or crowded field). */
  need?: string;
  terms: CommissionTerms;
}
const records = (life: LifeState, id: string) => life.capabilities!.evidence.filter(e => e.nodeId === id && e.data.qualifies === true);
const held = (life: LifeState, item: string) => inventoryOf(life)[item] ?? 0;

export function nextJobId(life: LifeState, nodeId: string): string {
  const count = (life.capabilities?.evidence ?? []).filter(e => e.nodeId === nodeId && typeof e.data.jobId === "string").length;
  return `${nodeId.toLowerCase()}-${life.age}-${life.year}-${count + 1}`;
}

function materialsOwnershipFor(nodeId: string, inputs: Record<string, number>): "worker" | "employer" | "none" {
  if (nodeId === "A1") return "employer";
  if (Object.keys(inputs).length === 0) return "none";
  return "worker";
}

function splitProjectInputs(nodeId: string, inputs: Record<string, number>): { consumedInputs: Record<string, number>; reservedStock: Record<string, number> } {
  if (nodeId === "T10") {
    const totalGrain = inputs.grain ?? 20;
    const delivered = Math.min(10, totalGrain);
    return { consumedInputs: { grain: delivered }, reservedStock: totalGrain > delivered ? { grain: totalGrain - delivered } : {} };
  }
  const consumedInputs: Record<string, number> = {};
  const reservedStock: Record<string, number> = {};
  for (const [item, qty] of Object.entries(inputs)) {
    const usedNow = Math.ceil(qty / 2);
    consumedInputs[item] = usedNow;
    if (qty > usedNow) reservedStock[item] = qty - usedNow;
  }
  return { consumedInputs, reservedStock };
}

/** Ordinary household spoilage or losses reduce unconsumed reserved stock cleanly until replaced. */
export function loseReservedStock(life: LifeState, item: string, amount: number): number {
  const project = life.capabilities?.project;
  const available = project?.reservedStock?.[item] ?? 0;
  const lost = Math.min(available, Math.max(0, Math.floor(amount)));
  if (!project || lost <= 0) return 0;
  project.reservedStock![item] = available - lost;
  project.reservedMissing ??= {};
  project.reservedMissing[item] = (project.reservedMissing[item] ?? 0) + lost;
  if (project.nodeId === "T10" && item === "grain" && project.data && typeof project.data.undeliveredGrain === "number") {
    project.data.undeliveredGrain = Math.max(0, project.data.undeliveredGrain - lost);
  }
  return lost;
}

/** Forfeit unpaid future escrow without recreating consumed inputs when an accepted calendar deadline lapses. */
export function expireMissedCommissions(world: WorldPack, life: LifeState): void {
  const state = life.capabilities;
  const project = state?.project;
  if (!state || !project || project.calendarDeadlineYear === undefined || life.year <= project.calendarDeadlineYear) return;
  const ledger = life.vocations;
  const rule = ruleFor(project.nodeId);
  const openingTotal = (life.economy?.cash ?? 0)
    + (ledger ? Object.values(ledger.accounts).reduce((a, b) => a + b, 0) : 0)
    + (state.reservedPayment ?? 0);
  let forfeitedPayment = 0;
  if (ledger && project.nodeId === "T10") {
    const perBuyer = Number(project.data?.perBuyer ?? Math.floor((project.payment ?? 0) / 2));
    if (project.completedYears === 0) {
      ledger.accounts.merchant += perBuyer;
      ledger.accounts.council += perBuyer;
      forfeitedPayment = perBuyer * 2;
    } else {
      ledger.accounts.council += perBuyer;
      forfeitedPayment = perBuyer;
    }
    state.reservedPayment = Math.max(0, (state.reservedPayment ?? 0) - forfeitedPayment);
  } else if (ledger && (project.payment ?? 0) > 0) {
    const payer = project.payer ?? rule?.payer ?? "merchant";
    forfeitedPayment = project.payment!;
    ledger.accounts[payer] += forfeitedPayment;
    state.reservedPayment = Math.max(0, (state.reservedPayment ?? 0) - forfeitedPayment);
  }
  // Return any unconsumed intact reserved stock without re-creating already consumed materials or fees.
  for (const [item, qty] of Object.entries(project.reservedStock ?? {})) {
    if (qty > 0) putItem(life, item, qty);
  }
  const closingTotal = (life.economy?.cash ?? 0)
    + (ledger ? Object.values(ledger.accounts).reduce((a, b) => a + b, 0) : 0)
    + (state.reservedPayment ?? 0);
  state.evidence.push({
    nodeId: project.nodeId,
    age: life.age,
    year: life.year,
    kind: rule?.kind ?? "craft",
    data: {
      jobId: project.jobId ?? nextJobId(life, project.nodeId),
      qualifies: false,
      reconciled: closingTotal === openingTotal,
      cashConserved: closingTotal === openingTotal,
      deadlineMissed: true,
      calendarDeadlineYear: project.calendarDeadlineYear,
      expiredYear: life.year,
      forfeitedPayment,
      completedWorkYears: project.completedYears,
    },
  });
  delete state.project;
}

/** Every material/cash obligation appears in this detached quote before accepting the year's work. */
export function workQuote(world: WorldPack, life: LifeState, nodeId: string): WorkQuote {
  const rule = ruleFor(nodeId)!;
  const active = life.capabilities?.project;
  if (active?.nodeId === nodeId) {
    const missingEntries = Object.entries(active.reservedMissing ?? {}).filter(([, qty]) => qty > 0);
    const missingInputs = Object.fromEntries(missingEntries);
    const basket = missingEntries.length ? basketQuote(world, life, missingInputs) : { missing: {}, cost: 0 };
    const inventory = inventoryOf(life);
    const unreplaced = missingEntries.filter(([item, qty]) => (inventory[item] ?? 0) < qty);
    let reason: string | undefined;
    if (active.calendarDeadlineYear !== undefined && life.year > active.calendarDeadlineYear) {
      reason = `This commission's calendar deadline (year ${active.calendarDeadlineYear}) has passed.`;
    } else if (unreplaced.length > 0) {
      reason = `Reserved materials were lost (${unreplaced.map(([k, v]) => `${v} ${k}`).join(", ")}). Replace the missing stock before resuming.`;
    }
    const payer = active.payer ?? rule.payer ?? "merchant";
    return {
      inputs: missingInputs,
      basket,
      fee: 0,
      pay: 0,
      payer,
      quantity: active.quantity ?? rule.quantity ?? (nodeId === "T10" ? 20 : 1),
      quality: active.quality ?? rule.minimumQuality ?? 1,
      ...(reason ? { reason } : {}),
      terms: {
        materialsOwner: materialsOwnershipFor(nodeId, active.inputs ?? rule.inputs ?? {}),
        quantity: active.quantity ?? rule.quantity ?? (nodeId === "T10" ? 20 : 1),
        minimumQuality: rule.minimumQuality ?? 1,
        totalPayment: active.payment ?? 0,
        payer,
        ...(nodeId === "T10" ? { payers: ["merchant", "council"] as CommissionPayer[] } : {}),
        workYearDeadline: active.workYearDeadline ?? rule.years,
        ...(active.calendarDeadlineYear !== undefined ? { calendarDeadlineYear: active.calendarDeadlineYear } : { calendarDeadlineYears: rule.years * 2 }),
        completedWorkYears: active.completedYears,
        ...(missingEntries.length ? { reservedMissing: missingInputs } : {}),
      },
    };
  }
  const quote: WorkQuote = {
    inputs: { ...rule.inputs },
    basket: { missing: {}, cost: 0 },
    fee: rule.fee ?? 0,
    pay: rule.pay ?? 0,
    payer: rule.payer ?? "workshop",
    terms: {
      materialsOwner: materialsOwnershipFor(nodeId, rule.inputs ?? {}),
      quantity: rule.quantity ?? 1,
      minimumQuality: rule.minimumQuality ?? 1,
      totalPayment: rule.pay ?? 0,
      payer: rule.payer ?? "workshop",
      workYearDeadline: rule.years,
      ...(rule.project ? { calendarDeadlineYears: rule.years * 2 } : {}),
    },
  };
  if (rule.kind === "craft") {
    const secondSculptureExercise = nodeId === "AS5" && records(life, nodeId).length % 2 === 1;
    if (secondSculptureExercise) {
      quote.inputs = { timber: 2, clay: 1 }; quote.fee = 6;
      quote.quantity = 1; quote.quality = 1;
    } else {
      const production = productionQuote(world, life, rule.recipe!, rule.quantity, rule.inspected);
      quote.production = production; quote.inputs = production.inputs; quote.fee = production.fee;
      quote.output = production.output; quote.quantity = production.outputQuantity; quote.quality = production.quality;
      if (production.quality < (rule.minimumQuality ?? 1)) quote.reason = `This work requires quality ${rule.minimumQuality}; current method produces quality ${production.quality}. Practice the relevant skills first.`;
      if (rule.contract) {
        quote.pay = production.bid * production.outputQuantity; quote.payer = "merchant";
        if ((life.vocations!.demand[quote.output!] ?? 0) < production.outputQuantity) quote.reason = "The funded buyer has insufficient remaining demand for this batch.";
      }
    }
  }
  if (nodeId === "A4") quote.inputs = { "prepared-clay": 2, fuel: 1 };
  // Proof-from-work worlds: material preparation learned from practice left no prepared clay, so this work prepares its own.
  if (nodeId === "A4" && world.capabilities?.proofFromWork === true && held(life, "prepared-clay") < 2) quote.inputs = { clay: 2, fuel: 1 };
  if (nodeId === "T2") quote.inputs = { clay: 2, fuel: 1, papyrus: 1 };
  if (rule.kind === "trade" && Number(nodeId.slice(1)) >= 5) {
    // Small, explicitly quoted supply orders: use actual household grain, never a minted abstract cargo.
    const deliveries = nodeId === "T10" ? 2 : 1;
    quote.inputs = { grain: 10 * deliveries };
    const unit = life.demo?.town.prices.grain.buy ?? 1;
    // Only the service premium follows the trade need; the grain itself is paid at market value.
    quote.pay = deliveries * (10 * unit + scaledPay(world, life, "trade", rule.pay ?? 0));
    quote.fee = deliveries * (rule.fee ?? 0);
    if (nodeId === "T10") {
      const perBuyer = quote.pay / 2;
      if (life.vocations!.accounts.council < perBuyer || life.vocations!.accounts.merchant < perBuyer) quote.reason = "Both buyers must fund their quoted order before registering the two-year plan.";
    }
    if (!life.demo || life.demo.household.grain < 10 * deliveries) quote.reason = `This supply order needs ${10 * deliveries} owned grain. Harvest or buy it through the existing market first.`;
    const reserveBlock = farmSaleReason(world, life, 10 * deliveries);
    if (reserveBlock) quote.reason = reserveBlock;
    if (life.demo?.lastTradeAge === life.age) quote.reason = "This year's market visit has already been used.";
    if (life.age < (world.demo?.market.minTradeAge ?? 12)) quote.reason = "You must be old enough to use the grain market.";
  }
  if (nodeId === "PP10" && (life.demo?.reputation ?? 0) < 60) quote.reason = "Civic assessment requires district reputation 60. Completed civic service can improve it.";
  if (nodeId === "PS9") {
    const prior = life.capabilities!.evidence.filter(e => e.kind === "research" && e.data.qualifies === true);
    if (prior.length < 3 || new Set(prior.map(e => e.age)).size < 2 || records(life, "PS8").length < 2) quote.reason = "The synthesis needs three distinct earlier records spanning two years and two independent checks.";
  }
  if (nodeId === "T3" && Object.keys(life.capabilities!.costBasis ?? {}).length < 3) quote.reason = "Record the paid basket's three acquisition costs before comparing quotations.";
  const supplyOrder = rule.kind === "trade" && Number(nodeId.slice(1)) >= 5;
  const field = supplyOrder ? "trade" : fieldOfNode(world, nodeId);
  if (!supplyOrder) quote.pay = scaledPay(world, life, field, quote.pay);
  const need = quote.pay > 0 ? needNote(world, life, field) : undefined;
  if (need) quote.need = need;
  quote.basket = basketQuote(world, life, quote.inputs);
  if (!quote.reason && quote.basket.reason) quote.reason = quote.basket.reason;
  const expense = quote.fee + quote.basket.cost;
  if (!quote.reason && rule.project && life.economy!.cash < expense) quote.reason = `This assessment reserves ${expense} dr of inputs and fees up front; future payment is held until delivery.`;
  if (!quote.reason && life.economy!.cash + quote.pay < expense) quote.reason = `This quoted work needs ${expense} dr for materials and fees; its payment is ${quote.pay} dr.`;
  const canPayFirst = life.economy!.cash >= expense;
  const payerBalance = life.vocations!.accounts[quote.payer] + (canPayFirst ? quote.payer === "merchant" ? quote.basket.cost : quote.payer === "workshop" ? quote.fee : 0 : 0);
  if (!quote.reason && nodeId !== "T10" && payerBalance < quote.pay) quote.reason = `The ${quote.payer} cannot fund the quoted ${quote.pay} dr payment.`;
  quote.terms = {
    materialsOwner: materialsOwnershipFor(nodeId, quote.inputs),
    quantity: quote.quantity ?? (supplyOrder ? 10 * (nodeId === "T10" ? 2 : 1) : 1),
    minimumQuality: rule.minimumQuality ?? 1,
    totalPayment: quote.pay,
    payer: quote.payer,
    ...(nodeId === "T10" ? { payers: ["merchant", "council"] as CommissionPayer[] } : {}),
    workYearDeadline: rule.years,
    ...(rule.project ? { calendarDeadlineYears: rule.years * 2 } : {}),
  };
  return quote;
}

function payCosts(world: WorldPack, life: LifeState, quote: WorkQuote, delayed: boolean): boolean {
  let prepaid = false;
  const ledger = life.vocations!, cash = life.economy!;
  // A quoted employer payment can cover an introductory access fee. It is not a loan.
  if (!delayed && cash.cash < quote.fee + quote.basket.cost && quote.pay) {
    ledger.accounts[quote.payer] -= quote.pay; cash.cash += quote.pay;
    prepaid = true;
  }
  buyBasket(world, life, quote.basket);
  for (const [item, quantity] of Object.entries(quote.inputs)) takeItem(life, item, quantity);
  cash.cash -= quote.fee; ledger.accounts.workshop += quote.fee;
  return prepaid;
}
function taskFacts(world: WorldPack, life: LifeState, nodeId: string, quote: WorkQuote): Record<string, string | number | boolean> {
  const history = life.capabilities!.evidence;
  const reference = 100 + life.age * 7 + (life.demo?.household.plots ?? 1);
  const data: Record<string, string | number | boolean> = {
    qualifies: true, materials: JSON.stringify(quote.inputs), materialsPaid: quote.basket.cost, feePaid: quote.fee,
    quotedPayment: quote.pay, payer: quote.payer, inputsPaid: true, reconciled: true,
    quantity: quote.quantity ?? 0, quality: quote.quality ?? 0, inspected: Boolean(ruleFor(nodeId)?.inspected),
    quotedWorkYears: ruleFor(nodeId)!.years, supplierDebt: 0,
  };
  if (nodeId === "A1") Object.assign(data, { supervised: true, employerOwnedTools: true });
  if (nodeId === "A2") Object.assign(data, { targetDimension: reference, measuredDimension: reference, errorPercent: 0 });
  if (nodeId === "A3") Object.assign(data, { line: "clay", preparedQuantity: 2 });
  if (nodeId === "AS5") data.exercise = quote.output === "clay-model" ? "clay-model" : "wood-relief-practice";
  if (nodeId.startsWith("P")) {
    const observation = life.demo ? `Flood ${life.demo.year.flood}; household grain ${life.demo.household.grain}; rent ${world.demo!.household.rentBps} bps` : `Age ${life.age}; cash ${life.economy!.cash}`;
    Object.assign(data, { question: `What does the recorded household account show in year ${life.year}?`, facts: observation,
      reference, measured: reference, errorPercent: 0, claim: "The recorded quantities reconcile.", reasonOne: "Quantities are taken from the household and supplier ledgers.", reasonTwo: "Accepted payments are included in the cash account.",
      counterargument: "A later year's flood could change the result.", response: "The claim is restricted to this recorded year.", disagreement: "A fixed-yield assumption differs from the recorded flood-sensitive harvest.",
      tradeoff: "Material and work-year budgets prevent spending the same resources twice." });
    if (nodeId === "PS7" || nodeId === "PS8" || nodeId === "PS10") Object.assign(data, { predeclaredPrediction: reference, observedResult: reference,
      independentlyChecked: nodeId !== "PS7", reviewer: nodeId === "PS7" ? "not requested" : "district records clerk", negativeFindingAllowed: true });
    if (nodeId === "PS9") data.citedRecords = history.filter(e => e.kind === "research").slice(-3).map(e => `${e.nodeId}:${e.age}`).join(",");
    if (nodeId.startsWith("PP")) Object.assign(data, { groups: records(life, nodeId).length % 2 ? "growers,workshop families" : "market households,neighbouring families",
      budget: quote.pay, fundsReserved: quote.pay, publicFundsInPersonalCash: false, serviceDelivered: true, evaluated: true });
  }
  if (nodeId.startsWith("T")) {
    const inventory = inventoryOf(life);
    Object.assign(data, { openingAndClosingStock: JSON.stringify(inventory), costBasis: JSON.stringify(life.capabilities!.costBasis ?? {}), cashAtClosing: life.economy!.cash,
      acceptedQuotes: JSON.stringify(Object.fromEntries(["clay", "fuel", "papyrus"].map(item => [item, world.vocations!.materials[item].price]))),
      quotationYear: life.year, paymentReceived: quote.pay, transportFee: quote.fee, realizedMargin: quote.pay - quote.basket.cost - quote.fee,
      deliveryWorkYears: 1, promisedWorkYears: 1, fulfilled: true });
  }
  return data;
}
/** Performs actual quoted work and creates one distinct work-year receipt. */
export function performWork(world: WorldPack, life: LifeState, nodeId: string, options?: { calendarDeadline?: boolean }): CapabilityEvidence {
  const rule = ruleFor(nodeId)!, state = life.capabilities!, quote = workQuote(world, life, nodeId);
  if (quote.reason) throw new Error(quote.reason);
  if (nodeId === "T10") return performTradingAssessment(world, life, quote, options);
  const cashOpening = life.economy!.cash;
  const stockOpening = JSON.stringify(inventoryOf(life));
  const totalOpening = cashOpening + Object.values(life.vocations!.accounts).reduce((a,b)=>a+b,0) + (state.reservedPayment ?? 0);
  const continuing = state.project?.nodeId === nodeId;
  let data: Record<string, string | number | boolean>;
  if (!continuing) {
    const jobId = nextJobId(life, nodeId);
    const totalBefore = life.economy!.cash + Object.values(life.vocations!.accounts).reduce((a,b) => a+b,0);
    if (rule.project && life.economy!.cash < quote.fee + quote.basket.cost) throw new Error("The assessment reserves inputs up front; earn enough cash before accepting it.");
    const prepaid = payCosts(world, life, quote, Boolean(rule.project));
    if (rule.contract && quote.output) life.vocations!.demand[quote.output] -= quote.quantity!;
    data = taskFacts(world, life, nodeId, quote);
    data.jobId = jobId;
    if (rule.project) {
      const { consumedInputs, reservedStock } = splitProjectInputs(nodeId, quote.inputs);
      life.vocations!.accounts[quote.payer] -= quote.pay;
      state.reservedPayment = (state.reservedPayment ?? 0) + quote.pay;
      state.project = {
        nodeId, completedYears: 0, startedAge: life.age, jobId, startedYear: life.year,
        workYearDeadline: rule.years,
        ...(options?.calendarDeadline ? { calendarDeadlineYear: life.year + rule.years * 2 } : {}),
        inputs: quote.inputs, consumedInputs,
        ...(Object.keys(reservedStock).length ? { reservedStock } : {}),
        fee: quote.fee, payment: quote.pay, payer: quote.payer,
        output: quote.output, quantity: quote.quantity, quality: quote.quality, data,
      };
    } else {
      if (!prepaid) { life.vocations!.accounts[quote.payer] -= quote.pay; life.economy!.cash += quote.pay; }
      if (quote.output && !rule.contract) putItem(life, quote.output, quote.quantity!, quote.quality);
      if (rule.contract && quote.output) life.vocations!.stock[quote.output] = (life.vocations!.stock[quote.output] ?? 0) + quote.quantity!;
    }
    if (nodeId === "A3") putItem(life, "prepared-clay", 2);
    const totalAfter = life.economy!.cash + Object.values(life.vocations!.accounts).reduce((a,b) => a+b,0) + (state.reservedPayment ?? 0);
    data.cashConserved = totalBefore + (continuing ? state.reservedPayment ?? 0 : 0) === totalAfter;
  } else {
    const project = state.project!;
    if (project.calendarDeadlineYear !== undefined && life.year > project.calendarDeadlineYear) {
      throw new Error(`This commission's calendar deadline (year ${project.calendarDeadlineYear}) has passed.`);
    }
    data = { ...project.data!, jobId: project.jobId ?? nextJobId(life, nodeId), continued: true, materialsPaid: 0, feePaid: 0, quotedPayment: 0 };
    if (project.reservedMissing && Object.keys(project.reservedMissing).length) {
      const missing = { ...project.reservedMissing };
      for (const [item, qty] of Object.entries(missing)) {
        if (qty <= 0) continue;
        takeItem(life, item, qty);
        project.reservedStock ??= {};
        project.reservedStock[item] = (project.reservedStock[item] ?? 0) + qty;
      }
      delete project.reservedMissing;
      data.replacedReservedInputs = JSON.stringify(missing);
    }
  }
  if (rule.project) {
    const project = state.project!;
    project.completedYears++;
    data.activeWorkYear = project.completedYears;
    data.completedAssessment = project.completedYears === rule.years;
    if (project.completedYears === rule.years) {
      life.economy!.cash += project.payment ?? 0;
      state.reservedPayment = (state.reservedPayment ?? 0) - (project.payment ?? 0);
      data.paymentReceived = project.payment ?? 0;
      if (project.output) life.vocations!.stock[project.output] = (life.vocations!.stock[project.output] ?? 0) + (project.quantity ?? 0);
      delete state.project;
    }
  }
  if (rule.kind === "civic" && (!rule.project || !state.project) && life.demo) life.demo.reputation = Math.min(100, life.demo.reputation + (rule.reputation ?? 0));
  if (rule.kind === "trade" && Number(nodeId.slice(1)) >= 5 && life.demo) {
    life.demo.lastTradeAge = life.age;
    // The goods go to the named funded buyer, never disappear into a price-only counter.
    if (quote.payer === "council") state.civicGrain = (state.civicGrain ?? 0) + 10;
    else life.demo.town.merchant.grain += 10;
  }
  const totalClosing = life.economy!.cash + Object.values(life.vocations!.accounts).reduce((a,b)=>a+b,0) + (state.reservedPayment ?? 0);
  data.cashOpening = cashOpening;
  data.cashAtClosing = life.economy!.cash;
  data.stockOpening = stockOpening;
  data.stockClosing = JSON.stringify(inventoryOf(life));
  data.cashConserved = totalClosing === totalOpening;
  data.reconciled = data.cashConserved;
  data.qualifies = data.qualifies === true && data.reconciled === true;
  return { nodeId, age: life.age, year: life.year, kind: rule.kind, data };
}


/** Register both funded orders once, then deliver one reserved lot per active work year. */
function performTradingAssessment(world: WorldPack, life: LifeState, quote: WorkQuote, options?: { calendarDeadline?: boolean }): CapabilityEvidence {
  const state = life.capabilities!, ledger = life.vocations!;
  const total = () => life.economy!.cash + Object.values(ledger.accounts).reduce((a,b)=>a+b,0) + (state.reservedPayment ?? 0);
  const before = total(), openingCash = life.economy!.cash;
  if (!state.project) {
    const jobId = nextJobId(life, "T10");
    if (life.economy!.cash < quote.fee + quote.basket.cost) throw new Error("The registered plan reserves its inputs and fees up front.");
    payCosts(world, life, quote, true);
    const perBuyer = quote.pay / 2;
    ledger.accounts.merchant -= perBuyer; ledger.accounts.council -= perBuyer;
    state.reservedPayment = (state.reservedPayment ?? 0) + quote.pay;
    state.project = {
      nodeId: "T10", completedYears: 0, startedAge: life.age, jobId, startedYear: life.year,
      workYearDeadline: 2,
      ...(options?.calendarDeadline ? { calendarDeadlineYear: life.year + 4 } : {}),
      inputs: { grain: 20 }, consumedInputs: { grain: 0 }, reservedStock: { grain: 20 },
      fee: quote.fee, payment: quote.pay,
      data: { perBuyer, quotedFee: quote.fee, undeliveredGrain: 20, grainCost: 20 * life.demo!.town.prices.grain.buy },
    };
  }
  const project = state.project!;
  if (project.calendarDeadlineYear !== undefined && life.year > project.calendarDeadlineYear) {
    throw new Error(`This commission's calendar deadline (year ${project.calendarDeadlineYear}) has passed.`);
  }
  if (project.reservedMissing?.grain) {
    const missingGrain = project.reservedMissing.grain;
    takeItem(life, "grain", missingGrain);
    project.reservedStock ??= {};
    project.reservedStock.grain = (project.reservedStock.grain ?? 0) + missingGrain;
    project.data!.undeliveredGrain = Number(project.data!.undeliveredGrain) + missingGrain;
    delete project.reservedMissing;
  }
  const payer = project.completedYears === 0 ? "merchant" : "council";
  const payment = Number(project.data!.perBuyer);
  if (payer === "merchant") life.demo!.town.merchant.grain += 10;
  else state.civicGrain = (state.civicGrain ?? 0) + 10;
  project.consumedInputs ??= {};
  project.consumedInputs.grain = (project.consumedInputs.grain ?? 0) + 10;
  if (project.reservedStock) project.reservedStock.grain = Math.max(0, (project.reservedStock.grain ?? 0) - 10);
  project.data!.undeliveredGrain = Number(project.data!.undeliveredGrain) - 10;
  project.completedYears++;
  state.reservedPayment = (state.reservedPayment ?? 0) - payment;
  life.economy!.cash += payment;
  life.demo!.lastTradeAge = life.age;
  const complete = project.completedYears === 2;
  const data = {
    jobId: project.jobId ?? nextJobId(life, "T10"),
    qualifies: total() === before, reconciled: total() === before, cashConserved: total() === before,
    cashOpening: openingCash, cashAtClosing: life.economy!.cash, payer, deliveredGrain: 10,
    reservedGrain: Number(project.data!.undeliveredGrain), paymentReceived: payment, quotedPayment: payment,
    materialsPaid: quote.basket.cost, feePaid: quote.fee,
    activeWorkYear: project.completedYears, completedAssessment: complete, commitmentStartedAge: project.startedAge,
  };
  if (complete) delete state.project;
  return { nodeId: "T10", age: life.age, year: life.year, kind: "trade", data };
}
