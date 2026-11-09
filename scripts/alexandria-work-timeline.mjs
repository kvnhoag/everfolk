// These are authored play thresholds, not a reconstructed Alexandrian age table.
// Childhood learning overlaps work; there is no universal graduation at eighteen.
const job = job => ({ type: "job", job });
const not = condition => ({ type: "not", condition });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const sources = ["diodorus-childhood-work", "alexandrian-minor-apprentice"];

export function applyWorkTimeline(world) {
  const event = id => {
    const found = world.events.find(event => event.id === id);
    if (!found) throw new Error(`Missing timeline event: ${id}`);
    return found;
  };
  const activity = id => {
    const found = world.character.activities.find(activity => activity.id === id);
    if (!found) throw new Error(`Missing timeline activity: ${id}`);
    return found;
  };
  const sourceWork = item => {
    item.sourceIds = [...new Set([...(item.sourceIds ?? []), ...sources])];
    item.evidence = "historically-inspired";
  };

  const apprentice = {
    id: "apprentice", title: "Workshop apprentice", minAge: 12,
    description: "Prepare materials and learn a trade under a craft worker. Your work contributes a small amount to the household while you train.",
    yearlyEffects: [stat("wealth", 1), skill("craft", 4), stat("knowledge", 1)],
  };
  world.character.jobs.unshift(apprentice);
  world.character.activities.unshift({
    id: "work-apprentice", text: "Start a workshop apprenticeship", category: "career", minAge: 12, cooldownYears: 1,
    when: not(job("apprentice")),
    outcomes: [{ id: "work-apprentice-result", text: "You start an apprenticeship. A craft worker shows you how to prepare materials and check your work.", weight: 1,
      effects: [job("apprentice"), { type: "flag", flag: "apprenticed", value: true }, { type: "flag", flag: "retired", value: false }] }],
  });
  const jobAges = {
    porter: 14, potter: 14, clerk: 14, copyist: 14, sailor: 16, shopkeeper: 18,
    "ceramic-decorator": 14, "wood-carver": 14, sculptor: 16,
    "philosophy-tutor": 18, "sky-table-calculator": 18, astrologer: 18,
  };
  for (const definition of world.character.jobs) {
    if (jobAges[definition.id] !== undefined) definition.minAge = jobAges[definition.id];
    const start = world.character.activities.find(item => item.id === `work-${definition.id}`);
    if (start) start.minAge = definition.minAge;
  }
  const activityAges = {
    "leave-regular-work": 12, "take-market-errands": 12, "help-count-stock": 10,
    "take-small-repair-jobs": 14, "careful-copy": 16, "check-cargo-accounts": 16,
    "pottery-order": 16, "shipboard-watch": 16, "take-day-cargo-work": 16,
    "train-seamanship": 12, "research-astrological-readings": 16,
    "buy-tool-chest": 14, "sell-tool-chest": 14,
    "buy-workshop-share": 18, "sell-workshop-share": 18, "repay-household-debt": 14,
  };
  for (const [id, minimum] of Object.entries(activityAges)) activity(id).minAge = minimum;
  // Household contributions are available before a regular occupation exists.
  world.character.activities.push({
    id: "help-household-work", text: "Help with household tasks", category: "training", minAge: 6, cooldownYears: 1,
    outcomes: [{ id: "help-household-work-result", text: "You sort small supplies and carry messages close to home. An older relative checks what you have done.", weight: 1,
      effects: [skill("craft", 2), skill("reckoning", 1), stat("bonds", 1)] }],
  });

  const training = event("a-place-to-learn");
  training.title = "Learning a trade";
  training.text = "You already help with everyday tasks. Your household can arrange more lessons, a workshop apprenticeship or more work at home. Learning and earning can go together.";
  sourceWork(training);
  const bench = training.choices.find(choice => choice.id === "join-workbench");
  bench.text = "Start a workshop apprenticeship";
  bench.when = not(job("apprentice"));
  bench.outcomes[0].text = "You begin an apprenticeship, preparing materials and practising tasks with a craft worker.";
  bench.outcomes[0].effects.push(job("apprentice"));

  const wages = event("the-first-wages");
  wages.trigger.at = 14;
  wages.title = "Regular work";
  wages.text = "A quay crew is taking on workers. You can take regular porter work, do a short paid task or keep the work you already have. Lessons can continue alongside work.";
  sourceWork(wages);
  const offers = event("a-place-on-the-manifest");
  offers.trigger.at = 16;
  offers.text = "A merchant crew and a copyist's workshop are looking for workers with the right skills. You can change jobs or stay with your current work.";
  sourceWork(offers);
  for (const id of ["letters-across-the-water", "the-unfamiliar-page", "the-neighbors-request"]) event(id).trigger.at = 17;

  // Local contacts can offer paid tasks in adolescence, without displacing
  // the apprenticeship and ordinary-work decisions in the milestone queue.
  const opportunities = world.events.filter(item => item.id.startsWith("background-") && item.id.endsWith("-opportunity"));
  world.events = world.events.filter(item => !opportunities.includes(item));
  const afterOffers = world.events.findIndex(item => item.id === offers.id) + 1;
  for (const opportunity of opportunities) opportunity.trigger.at = 14;
  world.events.splice(afterOffers, 0, ...opportunities);

  // Work descriptions follow actual employment, including young workers.
  for (const item of world.events) {
    if (item.id.startsWith("adult-") && item.mode === "automatic" && item.trigger.type === "random" && item.when?.type === "all") {
      const starts = item.when.conditions.find(condition => condition.type === "age" && condition.op === "gte");
      if (starts?.value === 18) starts.value = 14;
    }
  }
  const copy = {
    "youth-stronger-hands": ["More to do", "You take on a few more tasks this year. An experienced worker checks the parts you are still learning."],
    "youth-learning-patience": ["Practice at work", "A task takes several tries. Someone shows you where it went wrong, and you try again."],
    "youth-evening-conversation": ["Work and expenses", "People at home discuss work and the cost of supplies. You help check what needs doing tomorrow."],
  };
  for (const [id, [title, text]] of Object.entries(copy)) {
    const item = world.events.find(item => item.id === id);
    if (item) Object.assign(item, { title, text });
  }
  return world;
}
