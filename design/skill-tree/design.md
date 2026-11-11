# Everfolk skill-tree design · v1

**Stage output:** a progression-system design, prerequisite DAG and engine handoff. Application implementation is outside this stage.

**Date:** 2026-11-12. **Review status:** the structure and learning model were agreed with the user; exact thresholds, prices, proofs and effects below are proposed v1 balance values. Historical price accuracy and a measured 50–60% success rate are not claimed.

[Open the read-only design viewer](index.html) · [Full DAG drawing](skill-tree.svg) · [Exact node rules](node-rules.md) · [Structured catalog](catalog.json) · [Design checks](review.json)

## 1. What the player progresses through

The graph contains **65 learned capabilities**, organized into four families and eight depth-10 specializations. A player practices, applies a method, records relevant experience and learns the next capability when its requirements are met. Careers are consequences of those capabilities and appear in the selected node's details.

| Family | Shared foundation | Specializations | Career directions in details |
| --- | --- | --- | --- |
| Farming | Fieldwork, seed handling, soil and water knowledge, seasonal planning | Cultivation; Resilience | Experienced cultivator; household-farm manager |
| Artisan | Safe tools, measurement, material preparation, controlled making | Clothing; Ceramics; Sculpture | Master Tailor; Master Potter; Master Sculptor |
| Philosophy | Reading/questioning, argument, evidence/comparison, inquiry/ethics | Research; Civic practice | Philosopher/tutor, then Scientist or Politician |
| Trade | A ten-depth commercial-planning route | Commercial planning | Merchant; trading-house manager |

The complete graph stays rendered. Choosing a branch highlights it instead of removing other paths. Military progression, Seafaring, Music and performance, and Court/rulership remain visible in the roadmap as **Unavailable**; their detailed extension rules are outside this stage. Existing soldier gameplay is unaffected by the proposed military progression extension.

## 2. Agreed design decisions

- Skills-only, left-to-right DAG with approximately ten depths per specialization.
- One specialization reaching depth 10 counts as branch mastery; clearing every sibling node is optional.
- Practice and demonstrated deeds earn nodes. There is no generic spendable skill-point currency.
- Rewards combine new choices and practical improvements.
- Farming specializes into Cultivation and Resilience. Commercial planning belongs to Trade.
- Artisan work buys real inputs and produces actual clothes, ceramics and sculpture inventory.
- Philosophy specializes toward Scientist or Politician career outcomes.
- Unavailable branches stay greyed out, labelled and inspectable. **Locked** describes a supported skill with unmet requirements.
- Aim for 50–60% of normally focused lives reaching one depth-10 specialization.

## 3. Graph logic and readability

**Depth means prerequisite depth.** Roots are depth 1. A node's depth is one plus its deepest required parent. All eight specialization endpoints are exactly depth 10. Farming has two depth-3 nodes joined by an explicit AND gate at depth 4.

**An arrow means required capability.** A node appears once. Every listed parent is required. Where the rule permits alternatives, the node details explicitly say OR: FR9 accepts shortage experience or demonstrated reserve coverage; T5 accepts elementary farming or craft proficiency. Neither creates a hidden mandatory route.

**Only immediate dependencies are drawn.** Transitive shortcuts are removed; the design has 62 edges and no redundant prerequisite edge. Material purchases, sales, work-to-proficiency gains and career outcomes are not drawn as backward edges. The economic simulation can have feedback loops while the skill dependency graph remains acyclic.

**Proficiency scores stay in details.** Farming, Tool handling, Pottery, Sculpture, Philosophy, Literacy, Reckoning and Oratory measure competence. They are score gates, not duplicate graph nodes. Introductory practice remains available before a branch's entry node when that world enables it. This keeps the agreed ten-depth structure intact.

**Layout:** ten vertical depth columns; shared foundations on the left; parallel specialization lanes on the right. Links route through the gaps between adjacent columns, with no unrelated line passing through a node. Node positions depend on topology, never on current proficiency or search. Color identifies the highlighted family; labels and line/outline styles carry meaning independently of color.

## 4. Learning, proof and time

The proposed primary proficiency minima by depth are:

| Depth | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Minimum | 0 | 8 | 16 | 24 | 32 | 40 | 48 | 56 | 64 | 72 |

A depth-10 capability does not require every underlying score to reach 100. The exact support-score requirements are attached to each node.

### Work and practice

- A completed relevant work year grants **+3 primary proficiency and +2 to each of up to two authored supporting proficiencies** actually used by that work.
- Deliberate practice grants **+5 to the chosen proficiency and +1 to each of up to two relevant support proficiencies**.
- Skills not used by the activity receive no gain. The same action is recorded once; existing job gains and a full fixed wage cannot also be counted for the same labour.
- Production, research, civic work and practice share one major activity per year. Their use of player labour reduces the labour available to the farm; family helpers retain their own capacity.
- Learning the node after its gates are satisfied uses no additional action or fee.

Developing relevant supporting skills alongside work is a proposed refinement to keep the multi-skill routes practical within an ordinary lifetime. The earlier one-support-only draft is superseded here.

### Authored proficiency mappings

The following are work mappings. Apply +3 to the primary and +2 to each listed relevant support once for a completed work year. For deliberate practice, choose one listed score for +5 and at most two remaining listed scores for +1 each; the practice variant produces an exercise/sample, not a full commercial batch. Rejected actions grant nothing.

| Work type | Primary | Supporting scores |
| --- | --- | --- |
| fieldwork | farming | reckoning |
| channel-maintenance | farming | craft, reckoning |
| tool-practice | craft | carving, reckoning |
| measurement-exercise | craft | reckoning, literacy |
| textile-preparation | craft | reckoning |
| clay-preparation | craft | pottery, sculpture |
| wood-stone-preparation | craft | carving, sculpture |
| reading-discussion | philosophy | literacy, oratory |
| evidence-comparison | philosophy | reckoning, literacy |
| research-project | philosophy | reckoning, literacy |
| public-speaking | philosophy | oratory, literacy |
| negotiation | philosophy | oratory, reckoning |
| public-accounts | philosophy | reckoning, literacy |
| coalition-building | philosophy | oratory, literacy |
| policy-project | philosophy | oratory, reckoning |
| trade-work | reckoning | literacy, oratory |
| Recipe: thread | craft | reckoning |
| Recipe: linen | craft | reckoning |
| Recipe: garment | craft | reckoning |
| Recipe: dyed-garment | craft | reckoning |
| Recipe: ceremonial-garment | craft | reckoning |
| Recipe: vessel | craft | pottery, reckoning |
| Recipe: decorated-vessel | craft | pottery, reckoning |
| Recipe: clay-model | craft | pottery, sculpture |
| Recipe: small-relief | craft | carving, sculpture |
| Recipe: stone-figure | craft | carving, sculpture |
| Recipe: bust | craft | carving, sculpture |
| Recipe: large-relief | craft | sculpture, reckoning |
| Recipe: monument | craft | sculpture, reckoning |

A score only develops when the mapped work actually uses it. This mapping is part of the design handoff; it is not a second source of runtime gains layered on top of legacy job effects.

### Proof rules

Every proof is attributable to completed work, an accepted review or an annual resource settlement. A batch counts as one work-year deed, not one deed per item. All proof grades are minimums: quality 2 means quality ≥ 2, so inspected quality-3 work satisfies a quality-2 requirement. A later-tier project must begin after its required parents were learned. A new synthesis may cite older records when explicitly requested, but its new analysis/review must be completed after the parent unlock.

Practice toward an unearned node is available once its parents are learned. Exercises and supervised starter jobs supply the proof before an advanced method unlocks. No node requires its own reward to perform its qualifying practice.

Exact quality, quantity, time and reconciliation requirements are specified for each node in [node-rules.md](node-rules.md). A policy exercise checks reasoning and consequences, not one prescribed moral or political stance. A well-supported negative research result can satisfy scientific proof.

### Entry access and progression gaps

A beginner does not need to own land, a loom, a kiln or a workshop. Hired labour and NPC-funded apprenticeships provide practical access: the employer owns its inputs/output and pays the agreed wage. Independent production uses the player's owned, cost-traced inputs: purchases or self-produced intermediates. ‘Paid materials’ means external obligations were settled; it does not require repurchasing one's own thread or cloth. Employer-owned apprenticeship stock stays on its separate ledger. Introductory reading/counting/tool practice is available before the relevant root node, preventing entry-score deadlocks.

Artisan A3 supplies a supervised **one-unit** starter template in each material line: a garment, vessel or clay model, alongside thread/linen work. A4 proof can therefore come from the chosen craft. A4 removes the supervision surcharge and unlocks larger independent batches. A ceramicist or sculptor does not have to complete textile production first.

## 5. Exact branch definitions

Every capability has named parents, numerical current-score gates, demonstrated proof and a defined reward in the [node catalog](node-rules.md).

### Farming

Shared F1 → F2 → (F3S **AND** F3W) → F4, then:

- **Cultivation:** Sowing methods → Crop care → Water allocation → Crop allocation → Yield reliability → Integrated cultivation.
- **Resilience:** Grain preservation → Reserve budgeting → Storehouse management → Reserve replenishment → Shortage preparedness → Resilient husbandry.

Cultivation trades labour, seed and maintenance for production methods. Resilience reduces losses and improves reserve management while tying up resources that could otherwise be sold. Neither requires advanced Trade mastery.

Soil preparation and crop care are alternative annual work actions. Dense and conservative sowing are alternative plans. The combined optional sowing/crop-care/flax yield modifier is capped at +20%; correction of the low-flood factor is separate. Later spoilage rewards replace earlier rewards rather than adding together. All in-capacity spoilage reductions, including existing compatible effects, are combined multiplicatively and clamped so total reduction does not exceed 75% of the configured base rate. Over-capacity loss remains separate.

### Artisan

Shared A1 → A2 → A3 → A4, then:

- **Clothing:** Garment assembly → Patterns and dyes → Tailoring fit → Batch cutting → Fine finishing → Masterwork tailoring.
- **Ceramics:** Vessel forming → Controlled firing → Form and decoration → Kiln batching → Reliable ceramic sets → Master ceramic work.
- **Sculpture:** Modelling and relief → Stone cutting → Proportion and likeness → Large-work planning → Commission execution → Masterwork sculpture.

Crafting expertise unlocks methods, quality caps, batch capacity and commissions. Ordinary selling remains accessible. Commercial negotiation, inventory strategy and business expansion belong to Trade.

### Philosophy

Shared P1 → P2 → P3 → P4, then:

- **Research:** Systematic observation → Measurement/calculation → Testable explanations → Independent checking → Research synthesis → Original inquiry.
- **Civic practice:** Public speaking → Negotiation → Public accounts → Coalition building → Policy/consequences → Statesmanship.

P4 qualifies the player for Philosopher/tutor opportunities. PS10 qualifies for Scientist opportunities; PP10 qualifies for Politician opportunities. These are career outcomes in details, not extra graph nodes. Qualification does not automatically appoint the player or transfer an institution's budget into personal cash.

### Trade

Measures/exchange → Cost accounting → Price comparison → Inventory planning → Commercial production planning → Negotiated supply → Delivery logistics → Stock turnover → Enterprise accounts → Commercial stewardship.

T5 supports either elementary farming or craft knowledge; a merchant does not have to become a master farmer. Basic access to prices, receipts, baskets and ordinary sales is never withheld behind Trade skills. Advanced Trade changes planning and terms within actual NPC acceptance, stock, demand and funding limits.

## 6. Production and materials

The textile supply chain is **flax → thread → linen → garments**. Makers may buy any intermediate, so mastering clothing does not require personally operating every upstream production business. Ceramics consumes clay and fuel; sculpture uses clay, timber, stone and pigments. Inputs are transferred or consumed, output is created once, and selling transfers existing product lots and buyer cash.

The [structured catalog](catalog.json) contains 11 material reference quotes/stock caps and 13 recipes with exact input/output quantities, first unlock, access fee, work duration and opening batch limit. All values are fictional game-balance proposals. Existing grain/flax/linen quotes remain governed by their actual world rules.

Material reference asks are: flax 3 dr, flax seed 3, linen 25, thread 4, clay 2, fuel 2, timber 5, stone 30, pigment 6, papyrus 2 and ink 1 per game unit. Initial stocks and paid import caps are in the catalog. Restock must be financed and recorded; finite stock cannot be bypassed by a recipe.

A new-world annual market basket may contain multiple purchases and sales within one visit. Goods made after that visit are sold at a later visit unless delivered through a previously accepted funded commission. This is a proposed versioned market rule, not a reinterpretation of existing saves or single-order commands.

### Clothing working capital and pace

A plain garment consumes **2 linen + 2 thread**: 58 dr at the reference asks. Independent access costs 8 dr per batch; optional inspection adds 3 dr per batch. After A3, supervised one-unit work adds 2 dr supervision; A4 removes that charge and permits two garments/year. AT5 permits four, later nodes increase capacity to twelve.

| Example | Cash needed | Reference sales | Gross margin |
| --- | ---: | ---: | ---: |
| A3 supervised starter, 1 quality-1 garment | 68 dr | 80 dr | 12 dr |
| A4 independent maker, 1 quality-1 garment | 66 dr | 80 dr | 14 dr |
| A4 independent maker, 2 quality-1 garments | 124 dr | 160 dr | 36 dr |
| Depth 5, 4 quality-1 garments | 240 dr | 320 dr | 80 dr |
| Depth 5, 4 inspected quality-2 garments | 243 dr | 368 dr | 125 dr |
| Depth 8, 8 quality-3 garments with batch cutting | 422 dr | 832 dr | 410 dr |

These are reference arithmetic examples, not guaranteed or net livelihood income. Food, rent, debt, unsold stock and opportunity costs remain additional. Higher-quality output still needs a buyer with demand and money.

Self-supplying four basic garments is three work years at the stated caps: 20 flax → 40 thread; use 32 thread to weave 8 linen; use those 8 linen plus the remaining 8 thread for 4 garments. Raw flax costs 60 dr and access fees total 16 dr. At quality 1, reference gross margin is 244 dr across the three work years. Buying intermediates trades more cash for less player time.

### Quality and pricing

Quality grades are 1–5. Use integer arithmetic:

- Grade = min(5, learned family cap, 1 + floor(max(0, Craft − 24) / 16) + paid inspection bonus + paid recipe bonus).
- Inspection contributes 1 only when its 3 dr fee is paid. Dye/firing bonuses require the stated extra inputs.
- Grade multipliers in basis points: 10000, 11500, 13000, 15000, 18000.
- Reference retail = floor(base ask × multiplier / 10000).
- Reference merchant bid = floor(retail × 10000 / 12500).

Quality caps are per specialization and replace lower caps. Thread and linen are intermediates and receive no expert quality markup. Current accepted quotes, buyer budgets and demand govern actual sales. A high recipe reference value does not create a buyer.

### Projects and contracts

Multi-year projects reserve their stated inputs and consume one major activity in each work year. A work-year deadline counts active annual actions assigned to that project: a two-work-year job needs two such actions. Paused calendar years do not consume that deadline. An explicitly accepted calendar deadline is a separate due-year promise and keeps running during pauses. Reservations do not shelter stock from ordinary spoilage/theft; lost reserved input needs replacement before work can resume. Consumed inputs are not recreated, and each project output/payment happens once. Commissions state owner of materials, quantity, minimum quality, total payment, payer and work-year deadline before acceptance. The payer reserves its budget.

An assessment spanning several ordinary jobs records their distinct job IDs. Each ordinary job produces/pays once under its own normal rules; passing the assessment grants the qualification only, with no duplicate goods or payment. A single multi-year production recipe instead creates its one finished output at completion.

A material advance buys or earmarks real input stock and is deducted from the agreed final payment. It is not a second wage or free inventory. Tool, teaching, review, haulage and inspection fees transfer to service providers. Public funds remain separate from personal cash.

Final assessments must have regularly available supervised opportunities even without a commercial buyer for the result. Intermediate funded work orders and paid apprenticeship alternatives must be offered often enough for the mastery target; their finite payer accounts and replenishment sources are engine integration parameters. No design rule promises infinite funded orders.

## 7. Pacing and the mastery target

The target is **50–60% of normally focused attempts completing one specialization to depth 10 during that life**. It is not an explicit success roll at the final node.

Proposed evaluation policy: assign a path from birth; spend about three in four eligible major-activity years on it or its necessary supporting practice, leaving the rest for family, recovery or another interest. Measure all such seeded attempts, including early deaths; report the adult-survivor rate separately as a diagnostic. The cohort definition is a v1 proposal for review.

A 72-point primary threshold takes 24 work gains of +3, or 15 practice gains of +5, before other modifiers. At three-quarters focus, 24 working actions represent approximately 32 eligible calendar years. Deeds normally overlap those actions; unlocks do not add a separate year. Support scores, materials and multi-year projects can lengthen the route. This is a pacing worksheet, not a simulation of the current game and not evidence that the target has passed.

During engine calibration, compare low-wealth apprenticeship starts and ordinary household starts for every specialization. Report completion age, survival, cash/material shortages, supporting-skill detours, proof bottlenecks and demand interruptions. Adjust those gates/opportunities rather than hiding failed runs or making the final assessment a random gate.

## 8. Interaction design

The stage viewer is a read-only design artifact. Its colors identify families, not earned player progress. It renders the complete DAG, allows branch highlighting, and shows one selected capability's exact rules. It cannot learn skills, spend money or advance a life.

In the eventual game, clicking/focusing a node inspects it. A separate explicit activity action performs training or work. The detail pane contains description, direct prerequisites with AND/OR meaning, score progress, missing proof, costs, rewards and associated career outcomes. Unavailable nodes remain inspectable, with learning and activation disabled by authoritative world rules.

Whole-tree overview and branch highlight must preserve topology. Search locates/highlights nodes without repositioning them. Pan and zoom are bounded inside the map; the page itself does not scroll horizontally. Keyboard navigation follows the graph and details remain readable on a phone. An accessible list presents the same node facts.

## 9. Review checks and integration handoff

The package checks 65 unique nodes, 62 immediate prerequisite edges, no cycles or backward dependencies, no transitive shortcuts, eight exact depth-10 paths and 15 advanced quality-proof gates against preceding caps. It includes worked recipe arithmetic. It does not run or change the simulation.

Runtime integration covers new material inventories, recipes, projects, deed records, gains/effects, finite payer accounts and world version/replay rules. The game screen presents these rules. Ranked verification handles any allowlist, verification or career-to-NFT mappings. All new behavior needs a new immutable world revision; existing saves and world packs keep their original rules.

Records needed for reproducibility: world revision, node/parent unlock ages, work/project ID, accepted inputs and quote, material ownership, completion age, score gains, output/quality, actual food/seed coverage, review results and payer/public-account reconciliation. A client flag alone is not evidence.

Before runtime implementation, user review should settle the proposed numeric gates/effects and the engine owner should bind provider accounts, budget replenishment, starter job offers, carrier limits, career appointments and project persistence to real simulation rules. These are integration inputs, not undocumented assumptions that the viewer enforces.

## 10. Decisions preserved and changes in this deliverable

User-agreed: skills-only DAG, left-to-right flow, ten depths, whole-tree visibility with branch highlighting, grey inspectable unavailable branches, practice/deeds learning, mixed rewards, 50–60% one-specialization mastery, Farming/Trade split, artisan production, Scientist/Politician endpoints and versioned runtime integration.

Proposed v1 refinements for review: two relevant support gains per work action; independent starter templates in all artisan material lines; numerical gates and recipes; the ten-depth Trade catalog; integer quality-price arithmetic; and the focused-run evaluation cohort. No proposal in this document is presented as a measured game result or automatic implementation approval.
