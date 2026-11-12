import type { Condition, Effect, LifeEvent, Outcome, WorldPack } from "../types.ts";

const skill = (id: string, delta: number): Effect => ({ type: "skill", skill: id, delta });
const stat = (id: string, delta: number): Effect => ({ type: "stat", stat: id, delta });
const proficient = (id: string, value: number): Condition => ({ type: "skill", skill: id, op: "gte", value });
const learned = (node: string): Condition => ({ type: "capability", node });
const all = (...conditions: Condition[]): Condition => ({ type: "all", conditions });
const any = (...conditions: Condition[]): Condition => ({ type: "any", conditions });
type Decision = { id: string; text: string; result: string; effects: Effect[] };
const choice = (id: string, text: string, result: string, ...effects: Effect[]): Decision => ({ id, text, result, effects });
const keepWorking = (subject: string): Decision => choice("continue", "Keep to your current work", `You leave the discussion and return to ${subject}.`);

/** Once-only reviews and dilemmas complement actual work. They do not create goods or capability proofs. */
function event(_startYear: number, id: string, title: string, text: string, when: Condition, choices: Decision[]): LifeEvent {
  return { id: `cap-tree-${id}`, title, text, trigger: { type: "random", weight: 3 }, maxOccurrences: 1,
    when: all({ type: "age", op: "gte", value: 12 }, when), evidence: "fictional",
    choices: choices.map(c => ({ id: `cap-tree-${id}-${c.id}`, text: c.text,
      outcomes: [{ id: `cap-tree-${id}-${c.id}-result`, text: c.result, weight: 1, effects: c.effects }] })) };
}

/** Each specialization has an introductory, applied and advanced event subject. */
export const CAPABILITY_EVENT_TOPICS = [
  ["seed-sample", "Cultivation", "introductory"], ["water-turns", "Cultivation", "applied"], ["cultivation-plan", "Cultivation", "advanced"],
  ["reserve-labels", "Resilience", "introductory"], ["stock-discrepancy", "Resilience", "applied"], ["shortage-rehearsal", "Resilience", "advanced"],
  ["pattern-offcuts", "Clothing", "introductory"], ["fit-dispute", "Clothing", "applied"], ["ceremonial-brief", "Clothing", "advanced"],
  ["damp-clay", "Ceramics", "introductory"], ["kiln-draft", "Ceramics", "applied"], ["matching-vessels", "Ceramics", "advanced"],
  ["profile-sketch", "Sculpture", "introductory"], ["stone-vein", "Sculpture", "applied"], ["public-relief", "Sculpture", "advanced"],
  ["two-accounts", "Research", "introductory"], ["awkward-observation", "Research", "applied"], ["research-credit", "Research", "advanced"],
  ["small-hearing", "Civic practice", "introductory"], ["conflicting-receipts", "Civic practice", "applied"], ["policy-consequences", "Civic practice", "advanced"],
  ["unequal-measures", "Commercial planning", "introductory"], ["supplier-terms", "Commercial planning", "applied"], ["late-customer", "Commercial planning", "advanced"],
] as const;

export function capabilityEvents(startYear: number): LifeEvent[] {
  return [
    event(startYear, "seed-sample", "Not every grain belongs in the seed basket", "A neighbour brings a small sample of next season's grain. Some kernels are damaged. The neighbour asks which differences you would examine before choosing seed.", proficient("farming", 0), [
      choice("sort", "Compare the sound and damaged kernels", "You separate the sound kernels from the damaged ones and explain which differences you can observe. The grower asks you to compare the next crop with these first impressions.", skill("farming", 2), skill("reckoning", 1), stat("knowledge", 1)),
      choice("ask", "Ask an experienced grower to explain their choices", "The grower describes how they choose seed and where they have been wrong before. You leave with better questions for the next fieldwork year.", skill("farming", 1), stat("bonds", 2)), keepWorking("your household duties"),
    ]),
    event(startYear, "water-turns", "Two households want the same water turn", "Neighbours compare the channel timetable before the next growing season. One family wants an earlier turn; another says that would leave its lower plot dry. They ask you to compare the needs before the timetable is agreed.", learned("F4"), [
      choice("measure", "Compare plot levels and the proposed timetable", "You mark where the water has to travel and revise the timetable with both households. Both families can now see why the same timetable affects their plots differently.", skill("farming", 2), skill("reckoning", 1), stat("knowledge", 1)),
      choice("mediate", "Hear both families before proposing a compromise", "You make the competing needs explicit and ask each family to name a workable concession. The argument ends more calmly, without a promise of extra water.", skill("oratory", 1), stat("bonds", 2)), choice("favour-kin", "Back your relatives before checking the other plot", "Your relatives welcome the support, but the other household says you have not heard its case. The discussion teaches you how quickly a timetable becomes a dispute.", skill("farming", 1), stat("bonds", -2)),
    ]),
    event(startYear, "cultivation-plan", "The plan looks better than the fields", "Your draft of an integrated cultivation plan assumes every workday will go smoothly. A fellow grower asks what happens if illness or a broken tool takes a week out of the season.", learned("FC9"), [
      choice("revise", "Revise the plan around available labour", "You remove an ambitious task and make the labour shortfall visible in the estimates. The revised plan leaves room for a delay instead of promising more work than the household can do.", skill("farming", 1), skill("reckoning", 2), stat("knowledge", 1)),
      choice("consult", "Ask another household to review the weakest assumption", "They identify a maintenance task you had treated as free. You correct the explanation and acknowledge their contribution.", stat("bonds", 2), skill("literacy", 1)), keepWorking("the plan you can currently support"),
    ]),
    event(startYear, "reserve-labels", "Seed sacks and supper sacks", "Two similar sacks have been marked for different purposes. A child asks why grain kept for sowing should not be counted twice when the household plans its meals.", learned("F2"), [
      choice("count", "Explain the separate seed and food counts", "You lay out the two purposes and check the written totals. The household can now distinguish food already promised to meals from grain intended for sowing.", skill("farming", 1), skill("reckoning", 2), stat("knowledge", 1)),
      choice("teach", "Teach the household a clearer labelling method", "You agree on marks that everyone can distinguish and ask each person to explain them back. The labels make a future mistake less likely.", skill("literacy", 1), stat("bonds", 2)), keepWorking("the household's current reserve arrangements"),
    ]),
    event(startYear, "stock-discrepancy", "The store count is short", "The figures in a stock note do not match a neighbour's recollection. The difference could be a counting error or an unrecorded withdrawal; an accusation would travel faster than either explanation.", learned("FR6"), [
      choice("recount", "Recount the entries before blaming anyone", "You find which line needs checking and separate the observed count from an assumption about theft. The household agrees to check that entry together before making an accusation.", skill("reckoning", 2), skill("farming", 1), stat("knowledge", 1)),
      choice("listen", "Ask everyone who used the store to explain the note", "The conversation is awkward, but the household agrees that uncertainty should be recorded before blame. The household agrees to keep the uncertain entry visible while the count is checked.", stat("bonds", 2), skill("oratory", 1)), keepWorking("your existing reserve plan"),
    ]),
    event(startYear, "shortage-rehearsal", "A shortage that has not happened yet", "Before a difficult season, neighbours ask you to explain your reserve plan under a smaller harvest. They want to know which purchases are affordable and which depend on grain nobody actually owns.", learned("FR9"), [
      choice("stress-test", "Recalculate the plan using only existing reserves and cash", "You distinguish a possible purchase from grain already in store and identify the point at which the plan would fail. You can now point to the weak place in the plan before a poor harvest exposes it.", skill("reckoning", 2), skill("farming", 1), stat("knowledge", 1)),
      choice("share", "Explain the limits openly to the neighbours", "You make no promise that every loss can be covered. The households agree to compare their actual positions after the next settlement.", stat("bonds", 2), skill("oratory", 1)), keepWorking("the commitments already made"),
    ]),
    event(startYear, "pattern-offcuts", "The useful piece between two cuts", "At a textile bench, two ways of laying out a sample pattern leave different offcuts. The maker invites you to explain the measurements before any cloth is committed to an order.", proficient("craft", 8), [
      choice("measure", "Mark the sample and compare its dimensions", "You discover that a tidy-looking arrangement can still give the wrong size. The maker turns the sample around and asks you to check the same measurement from the other edge.", skill("craft", 2), skill("reckoning", 1), stat("knowledge", 1)),
      choice("ask", "Ask the maker why one offcut is still useful", "They show where a small piece can serve a different purpose. You learn to describe the material honestly rather than treating every scrap as waste.", skill("craft", 1), stat("bonds", 1), skill("literacy", 1)), keepWorking("your current apprenticeship"),
    ]),
    event(startYear, "fit-dispute", "The garment and the customer's measure", "A customer and a maker disagree about which measurements were agreed. You are asked to read the old note, whose shortest line admits two different interpretations.", learned("AT6"), [
      choice("compare", "Compare the written measure with the sample", "You identify the ambiguous line and suggest a clearer specification for the next fitting. The customer and maker agree to write down that measure before another fitting.", skill("craft", 1), skill("reckoning", 2), stat("knowledge", 1)),
      choice("mediate", "Help both sides agree how the next fitting will be checked", "You keep the discussion about the agreed measure rather than personal pride. Both sides leave with a clearer question to put to the inspector.", skill("oratory", 1), stat("bonds", 2)), choice("defend", "Defend the maker's reading without offering a new fitting", "You argue the written wording firmly. The customer leaves unconvinced, and the disagreement becomes harder to settle.", skill("oratory", 2), stat("bonds", -2)),
    ]),
    event(startYear, "ceremonial-brief", "Four garments, one accepted standard", "A patron's draft brief calls four ceremonial garments 'fine' without defining the workmanship. Before a masterwork assessment can begin, the specification must say what an inspector can actually accept.", learned("AT9"), [
      choice("specify", "Write a checkable standard for fit and finish", "You separate the patron's preferences from the inspection criteria. The inspector can now say what would make the set acceptable, and the patron knows what has been promised.", skill("craft", 1), skill("literacy", 2), stat("knowledge", 1)),
      choice("question", "Ask the patron to explain the intended use", "The conversation reveals which parts need to survive repeated wear and which are decorative. You can now discuss the order without promising an impossible finish.", skill("oratory", 1), stat("bonds", 2)), keepWorking("the orders you have already accepted"),
    ]),
    event(startYear, "damp-clay", "Clay that behaves differently overnight", "Two small clay samples look alike at first, but one has begun to crack. A potter asks you to describe the difference before offering an explanation.", proficient("craft", 8), [
      choice("observe", "Compare moisture, thickness and the visible cracks", "You distinguish what you can see from a guess about the cause. The potter sets the samples aside so their changes can be compared again tomorrow.", skill("pottery", 2), skill("craft", 1), stat("knowledge", 1)),
      choice("listen", "Ask how the potter records a failed trial", "They show why a failed sample is useful only when its conditions were recorded. You agree to keep a clearer note on your next real work year.", skill("literacy", 1), stat("bonds", 1), skill("pottery", 1)), keepWorking("your existing workshop tasks"),
    ]),
    event(startYear, "kiln-draft", "One side of the kiln runs hotter", "A firing note records an uneven result. The discussion turns to the placement of vessels and the path of the draft, rather than a promise that more fuel always makes better pottery.", learned("AC6"), [
      choice("compare", "Compare positions in the kiln with the reported results", "You find which comparison would make the next firing more informative. The next loading plan now names which positions to compare and where the draft must be watched.", skill("pottery", 2), skill("reckoning", 1), stat("knowledge", 1)),
      choice("share", "Ask the crew to explain their loading choices", "You hear why one arrangement was chosen and where the crew was uncertain. Their practical account makes your next question more precise.", skill("craft", 1), stat("bonds", 2)), keepWorking("the firing method you can currently support"),
    ]),
    event(startYear, "matching-vessels", "A set must match in use", "A buyer asks for vessels that work together, not merely pieces that look impressive alone. The draft order has to explain the acceptable capacity, finish and variation before a master assessment starts.", learned("AC9"), [
      choice("define", "Define the matching standard in measurable terms", "You turn a vague request into dimensions and an inspection question. The buyer points out which differences would make a piece awkward to use, and you amend the brief.", skill("pottery", 1), skill("reckoning", 2), stat("knowledge", 1)),
      choice("handle", "Discuss how the set will be carried and used", "The buyer explains which variation matters in daily handling. You add the handling requirement to the brief rather than leaving it to guesswork.", skill("oratory", 1), stat("bonds", 2)), keepWorking("the commissions already on your bench"),
    ]),
    event(startYear, "profile-sketch", "The likeness changes when you move", "A model's profile looks different from the front view. A sculptor asks you which features belong to the person and which belong to the viewpoint.", proficient("craft", 8), [
      choice("compare", "Compare the views before changing the model", "You describe the relationship between the views and avoid correcting one by guessing at the other. The sculptor asks you to keep both views beside the model as you work.", skill("sculpture", 2), skill("carving", 1), stat("knowledge", 1)),
      choice("ask", "Ask the sitter what feels wrong about the likeness", "Their answer makes you notice an expression you had ignored. Listening becomes part of the work rather than a substitute for making it.", stat("bonds", 2), skill("sculpture", 1)), keepWorking("your current making exercises"),
    ]),
    event(startYear, "stone-vein", "The line inside the stone", "A sketch of a stone figure crosses a visible vein. The maker asks whether the plan should be changed before the next piece of stone is bought and cut.", learned("AS6"), [
      choice("revise", "Revise the plan around the observed weakness", "You change the proposed load and compare what the alteration does to the figure. The cutter marks the risky line on the sketch and explains where a change would be safer.", skill("carving", 2), skill("sculpture", 1), stat("knowledge", 1)),
      choice("review", "Ask a more experienced cutter to review the risk", "They explain which uncertainty can be inspected and which would remain after the cut. You acknowledge the advice in your working note.", stat("bonds", 2), skill("craft", 1)), choice("dismiss", "Test the rough sample without following the cutter's advice", "A sharp edge catches your hand before the test tells you anything useful. You stop and compare the sample with the sketch more carefully.", skill("carving", 1), stat("health", -2)),
    ]),
    event(startYear, "public-relief", "A public relief has several audiences", "A proposed public relief has to be legible to people who stand close to it and people who pass at a distance. The patron's description says little about either view.", learned("AS9"), [
      choice("plan", "Compare scale, viewing distance and the proposed relief", "You identify what a large-work plan must show before anyone commits materials. The new sketch makes the distant view clearer without losing the details intended for a close observer.", skill("sculpture", 2), skill("reckoning", 1), stat("knowledge", 1)),
      choice("consult", "Listen to the people who will use the space", "Their questions expose a feature the patron had overlooked. You revise the brief while making clear who contributed the observation.", stat("bonds", 2), skill("oratory", 1)), keepWorking("the work already promised"),
    ]),
    event(startYear, "two-accounts", "Two accounts of the same event", "Two readers describe the same incident differently. One account is more elegant; the other names observations that could be checked. A teacher asks which claim you would investigate first.", proficient("literacy", 8), [
      choice("compare", "Separate the claims and list what could be checked", "You distinguish testimony, inference and a missing observation. You leave with a short list of observations that could distinguish the two accounts.", skill("philosophy", 2), skill("literacy", 1), stat("knowledge", 1)),
      choice("question", "Ask both readers how they reached their conclusion", "Each has to expose an assumption they had left unstated. You learn to ask a focused question without pretending the dispute is settled.", skill("oratory", 1), stat("bonds", 1), skill("philosophy", 1)), keepWorking("the questions already under study"),
    ]),
    event(startYear, "awkward-observation", "The observation that does not fit", "A colleague points to a result that sits badly with your preferred explanation. Removing it would make the account easier to present, but would also hide the question a new test should answer.", learned("PS6"), [
      choice("retain", "Keep the observation and explain the discrepancy", "You distinguish a difficult result from a useless one and describe a possible comparison. The difficult result becomes a question to investigate instead of a line to conceal.", skill("philosophy", 2), skill("reckoning", 1), stat("knowledge", 2)),
      choice("review", "Ask another reader to check the observation first", "You preserve the uncertain result and invite a check of the procedure. The reader agrees to check the procedure and compare their notes with yours.", stat("bonds", 2), skill("literacy", 1)), keepWorking("your current inquiry"),
    ]),
    event(startYear, "research-credit", "Who can reproduce the inquiry?", "Before an original inquiry is assessed, a fellow reader asks whether someone else could follow the record, identify the sources and understand the limits of the result.", learned("PS9"), [
      choice("document", "Make the method and limitations explicit", "You improve the account and identify which earlier observations support it. The reader can now follow where the account is secure and where its conclusion remains uncertain.", skill("literacy", 2), skill("philosophy", 1), stat("knowledge", 2)),
      choice("credit", "Invite the contributors to check how their work is credited", "They correct an omission in the working record. You make the contribution visible and preserve the distinction between your result and theirs.", stat("bonds", 3), skill("oratory", 1)), keepWorking("the material that is already ready for review"),
    ]),
    event(startYear, "small-hearing", "The quieter voice at the hearing", "At a small neighbourhood discussion, confident speakers interrupt someone who has brought a relevant observation. The chair asks how you would make the exchange useful.", proficient("philosophy", 8), [
      choice("hear", "Ask for the observation before the next speech", "The discussion gains a detail that had been missing. The chair gives the quieter speaker time to explain how they know it.", skill("oratory", 2), skill("philosophy", 1), stat("bonds", 1)),
      choice("summarise", "Summarise the points of agreement and disagreement", "The participants can see where they differ rather than arguing past one another. Both sides correct the summary, and the disagreement becomes more precise.", skill("literacy", 1), stat("bonds", 2)), keepWorking("your present obligations"),
    ]),
    event(startYear, "conflicting-receipts", "Two receipts, one public payment", "A copy of a district receipt gives a different amount from the original. The officials want a quick explanation, while the households want the figures checked before anyone is accused.", learned("PP6"), [
      choice("trace", "Trace the entry back to the original receipt", "You identify the line that needs reconciliation and explain the uncertainty plainly. You show the officials exactly which entry must be checked before the accounts can be explained.", skill("reckoning", 2), skill("literacy", 1), stat("knowledge", 1)),
      choice("explain", "Explain why the discrepancy must remain visible until checked", "The delay is unpopular, but people understand what is known and what is still uncertain. You resist giving an unsupported answer.", skill("oratory", 1), stat("bonds", 2)), choice("announce", "Give the officials a quick answer before checking the original", "The answer sounds confident until someone produces a conflicting note. You learn how to hold an audience, but lose trust by speaking beyond the evidence.", skill("oratory", 2), stat("bonds", -3)),
    ]),
    event(startYear, "policy-consequences", "The cost falls on a different household", "A district proposal looks affordable in total, but a neighbour points out that its cost falls unevenly. Before a final assessment, the policy record needs to show who gains, who pays and what happened after implementation.", learned("PP9"), [
      choice("compare", "Compare the household costs with the expected benefit", "You revise the explanation to distinguish a total from its distribution. You add the uneven burden to the discussion instead of hiding it inside a favourable total.", skill("reckoning", 2), skill("philosophy", 1), stat("knowledge", 1)),
      choice("consult", "Hear the affected households before defending the proposal", "They identify a cost the first account had missed. You acknowledge it and explain the remaining trade-off without promising an outcome nobody can guarantee.", skill("oratory", 1), stat("bonds", 3)), choice("defend-total", "Defend the favourable total and dismiss the distribution", "You make a forceful speech, but the households carrying the cost feel unheard. They ask why their loss has disappeared inside your total.", skill("oratory", 2), stat("bonds", -3)),
    ]),
    event(startYear, "unequal-measures", "The baskets do not hold the same amount", "Two traders quote the same price for baskets of different sizes. A buyer asks which offer is cheaper once the measure, not just the spoken number, is compared.", proficient("reckoning", 0), [
      choice("compare", "Compare price per equal measure", "You show why the smaller spoken price need not be the cheaper purchase. The buyer asks for both offers in the same measure before choosing.", skill("reckoning", 2), skill("literacy", 1), stat("knowledge", 1)),
      choice("question", "Ask each trader to state their measure clearly", "Both quotes become easier to compare, and the buyer can make an informed choice. The clearer terms reduce the room for a later dispute.", skill("oratory", 1), stat("bonds", 1), skill("reckoning", 1)), keepWorking("your current trade"),
    ]),
    event(startYear, "supplier-terms", "A cheap quote with an uncertain delivery", "A supplier's low quote omits the delivery date and who bears a transport loss. The plan should identify those terms before goods or money are committed.", learned("T5"), [
      choice("cost", "Compare the full delivered cost and the missing terms", "You separate the attractive headline price from the costs the quote leaves open. You write the unanswered questions beside the price rather than assuming them away.", skill("reckoning", 2), skill("literacy", 1), stat("knowledge", 1)),
      choice("negotiate", "Ask the supplier to state the obligations on both sides", "The discussion clarifies where each party's responsibility would begin and end. The quote is less impressive at first glance, but its obligations are easier to understand.", skill("oratory", 2), stat("bonds", 1)), keepWorking("the supply arrangements you can presently honour"),
    ]),
    event(startYear, "late-customer", "The margin exists only on paper", "A trading-house plan counts a customer's expected payment as if the cash were already in hand. A reviewer asks whether the next purchase could still be paid for if the customer were late.", learned("T9"), [
      choice("reconcile", "Separate cash, expected receipts and committed costs", "You expose the gap between profit on paper and money available to use. The reviewer can now see which commitment the available cash will actually cover.", skill("reckoning", 2), skill("literacy", 1), stat("knowledge", 2)),
      choice("discuss", "Explain the uncertainty before agreeing to the next order", "The customer may dislike the caution, but both parties understand what can actually be promised. You leave the next order open until both parties can make a promise they can keep.", skill("oratory", 1), stat("bonds", 2)), keepWorking("the commitments already funded"),
    ]),
  ];
}

const SUPPORTED_SCORES = new Set(["farming", "craft", "pottery", "carving", "sculpture", "philosophy", "literacy", "reckoning", "oratory"]);
function includesNode(condition: Condition | undefined, node: string): boolean {
  if (!condition) return false;
  if (condition.type === "capability") return condition.node === node;
  return (condition.type === "all" || condition.type === "any") && condition.conditions.some(child => includesNode(child, node));
}
function gated(condition: Condition | undefined, nodes: string[]): Condition {
  if (nodes.every(node => includesNode(condition, node))) return condition!;
  const gate = nodes.length === 1 ? learned(nodes[0]) : any(...nodes.map(learned));
  return condition ? all(condition, gate) : gate;
}
function reviseOutcome(outcome: Outcome): Outcome {
  let wasMastery = false;
  const effects = outcome.effects.map(effect => {
    if (effect.type === "mastery" && effect.target === "skill" && SUPPORTED_SCORES.has(effect.id)) {
      wasMastery = true; return skill(effect.id, 3);
    }
    if (effect.type === "mastery" && effect.target === "stat" && ["knowledge", "bonds"].includes(effect.id)) {
      wasMastery = true; return stat(effect.id, 3);
    }
    if (effect.type === "skill" && SUPPORTED_SCORES.has(effect.skill) && effect.delta > 3) return { ...effect, delta: 3 };
    return effect;
  });
  return { ...outcome, effects, ...(wasMastery ? { text: "Experienced practitioners review your methods and give specific feedback. You leave with a clearer method and a practical question to carry into your next work year." } : {}) };
}

/** Called only while building the new capability-enabled revision; retained packs are never adapted on load. */
export function adaptSkillTreeEvents(input: WorldPack): WorldPack {
  const world = structuredClone(input);
  world.events = world.events.filter(item => !item.id.startsWith("cap-tree-")).map(item => {
    const event = { ...item, choices: item.choices.map(c => ({ ...c, outcomes: c.outcomes.map(reviseOutcome) })) };
    if (event.id === "legacy-sculpture-prestige") event.when = gated(event.when, ["AS9"]);
    if (event.id === "legacy-philosophy-prestige") event.when = gated(event.when, ["PS9", "PP9"]);
    if (event.id === "legacy-commerce-prestige") event.when = gated(event.when, ["T9"]);
    if (event.id === "rare-masterwork") {
      event.title = "A demanding workshop review";
      event.text = "Experienced makers examine the methods behind your recent work. They ask you to explain a difficult part of the method, then compare your answer with the work in front of them.";
    }
    if (event.id === "rare-scholarly-mastery") {
      event.title = "An exacting scholarly review";
      event.text = "Readers ask you to defend a difficult step in your explanation. They point out where an assumption needs defending and where a comparison would strengthen the account.";
    }
    return event;
  });
  world.events.push(...capabilityEvents(world.startYear));
  return world;
}
