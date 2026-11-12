// These fictional occupations and purchasing permissions are authored gameplay.
// A purchasing post does not grant free stock, credit or guaranteed trade profit.
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const job = job => ({ type: "job", job });
const skill = (skill, delta = 1) => ({ type: "skill", skill, delta });

export function applyMarketRoles(world) {
  world.version = "0.40.0";
  for (const id of ["shopkeeper", world.economy.market.traderJob]) {
    const occupation = world.character.jobs.find(item => item.id === id);
    if (!occupation) throw new Error(`Missing market occupation ${id}`);
    occupation.marketAccess = "full";
  }
  world.character.jobs.find(item => item.id === "shopkeeper").description += " Buying varied goods for resale gives you access to the full market catalogue. Personal orders still use your own cash and stock.";
  world.character.jobs.find(item => item.id === world.economy.market.traderJob).description += " Buying and selling across goods gives you access to the full market catalogue.";

  const roles = [
    {
      id: "merchant", title: "Merchant", minAge: 18, requirements: { reckoning: 30, oratory: 15 },
      marketAccess: "full",
      description: "Arrange purchases and sales across several kinds of goods. Experience in market trading opens this independent livelihood and the full market catalogue. There is no salary: your own stock, contracts and completed sales determine your earnings.",
      yearlyEffects: [skill("reckoning"), skill("oratory")],
    },
    {
      id: "estate-steward", title: "Estate steward", minAge: 18, requirements: { reckoning: 25, literacy: 20 },
      marketAccess: "full",
      description: "Keep an estate's supply accounts and arrange varied purchases. A household connection or previous clerk's post gives you a way into this work, with reading and reckoning still required. Your purchasing duties open the full market catalogue. Your employer supplies ordinary duties; personal orders use your own cash and stock.",
      yearlyEffects: [{ type: "cash", delta: 30 }, skill("reckoning"), skill("literacy")],
    },
    {
      id: "quartermaster", title: "Quartermaster", minAge: 18, requirements: { warfare: 20, reckoning: 25, literacy: 15 },
      marketAccess: "full",
      description: "Check stores, maintain supply records and arrange purchases for a military unit. An existing command post or a recommendation for supply work is required. Broad purchasing duties open the full market catalogue. The unit supplies ordinary duties; independent orders still use your own cash and stock. This supply appointment does not grant an officer's commission.",
      yearlyEffects: [{ type: "cash", delta: 30 }, skill("reckoning"), skill("warfare")],
    },
  ];
  world.character.jobs.push(...roles);
  const entry = {
    merchant: any({ type: "flag", flag: "trader-qualified", value: true }, job(world.economy.market.traderJob)),
    "estate-steward": any(job("clerk"), { type: "origin", origin: "estate-household" }, { type: "origin", origin: "royal-household" }),
    quartermaster: any(job("officer"), job("general"), { type: "flag", flag: "officer-recommendation", value: true }),
  };
  for (const occupation of roles) {
    world.character.activities.push({
      id: `work-${occupation.id}`, text: `Become ${occupation.id === "estate-steward" ? "an estate steward" : `a ${occupation.title.toLowerCase()}`}`,
      category: "career", minAge: occupation.minAge, cooldownYears: 1,
      when: all({ type: "not", condition: job(occupation.id) }, entry[occupation.id],
        ...Object.entries(occupation.requirements).map(([skill, value]) => ({ type: "skill", skill, op: "gte", value }))),
      outcomes: [{ id: `work-${occupation.id}-accepted`, weight: 1,
        text: occupation.id === "merchant"
          ? "Your experience earns you a place arranging a wider range of purchases and sales as a merchant. You can browse the full market, but must fund your own orders and earn through completed sales; there is no salary."
          : `You accept work as ${occupation.title.toLowerCase()}. Its broad purchasing responsibilities give you access to the full market. The employer supplies ordinary duties; personal orders still use your own cash and goods.`,
        effects: [{ type: "job", job: occupation.id }, { type: "flag", flag: "retired", value: false }],
      }],
    });
  }

  // Extend the appropriate existing orders without changing their stock or cash terms.
  const taskRoles = {
    "fulfil-shop-parcel": ["merchant"],
    "check-estate-supply-order": ["estate-steward", "quartermaster"],
    "repair-service-equipment": ["quartermaster"],
  };
  for (const [id, occupations] of Object.entries(taskRoles)) {
    const task = world.character.activities.find(item => item.id === id);
    const eligibility = task?.when?.type === "all" && task.when.conditions.find(condition => condition.type === "any");
    if (!eligibility) throw new Error(`Missing role conditions for ${id}`);
    eligibility.conditions.push(...occupations.map(job));
  }
  const resources = {
    merchant: ["oil", "preserved-fish", "transport-baskets"],
    "estate-steward": ["wax-tablets", "transport-baskets"],
    quartermaster: ["leather", "bronze-fittings", "wax-tablets", "transport-baskets"],
  };
  for (const [occupation, ids] of Object.entries(resources)) for (const id of ids) {
    const resource = world.economy.assets.find(item => item.id === id);
    if (!resource) throw new Error(`Missing purchasing resource ${id}`);
    resource.context ??= {};
    resource.context.jobs ??= [];
    if (!resource.context.jobs.includes(occupation)) resource.context.jobs.push(occupation);
  }
}
