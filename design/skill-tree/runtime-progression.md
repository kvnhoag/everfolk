# Deep skill-tree runtime progression · deep-1

**Status:** `deep-1` is integrated for new free-play lives in **`alexandria-deep-1`**, with the 65-node evaluator, work receipts, rewards, 13 service operations and 24 new decisions. Earlier saved lives retain their original packs. This record does not claim a deployed ranked-contract update, a measured mastery cohort or completed historical-title paths.

This implements the agreed [65-node design](design.md) using [machine-readable proofs](../../src/deep-capabilities/rules.ts), [operation definitions](../../src/deep-capabilities/operations.ts), [reward quotes](../../src/deep-capabilities/rewards.ts), [funded service execution](../../src/deep-capabilities/services.ts) and [events](../../src/deep-capabilities/events.ts). Numerical costs and gains are authored gameplay balance, not reconstructed historical measurements.

## Stats and proficiencies

| Attribute | Chosen role | What it cannot replace |
| --- | --- | --- |
| Health | Physical safety, fatigue, illness and the consequences of risky workshop or field decisions. Existing care and mortality systems remain relevant; demanding major work requires Health 20. | A high Health score is not proof of a completed task. |
| Knowledge | Understanding developed through reading, observation, comparison and reflective work. | General Knowledge cannot substitute for the named proficiency or reviewed evidence required by a node. |
| Bonds | Cooperation, household relationships, trust and the social consequences of negotiation, credit and public decisions. | Popularity does not certify a funded agreement, a balanced account or successful research. |
| Wealth / Resources | The existing cash, debt, assets, household stores and vocation inventory ledgers. Purchases, wages, fees, escrow and sales move real balances. | There is no new spendable skill-point currency and no proof gained merely by being wealthy. |

The graph contains **65 learned capabilities, not 65 new numeric scores**. The existing fourteen proficiencies remain: Farming, Literacy, Reckoning, Tool handling (`craft`), Pottery, Carving, Sculpture, Philosophy, Oratory, Seamanship, Astronomy, Sky-omen reading (`astrology`), Warfare and Music. The current deep-tree families use the first nine relevant scores: Farming; Tool handling/Pottery/Carving/Sculpture; Philosophy/Literacy/Reckoning/Oratory.

A completed relevant work year gives **+3 primary proficiency and +2 to each of up to two relevant supports**. Deliberate practice gives **+5 primary and +1 to each of up to two relevant supports**. Only scores used by the authored activity gain. Rejected work gives no gain, and the same annual labour cannot also receive a duplicate automatic job wage or a second full work action. A preparatory decision event generally gives only +1–3 in its relevant scores.

| Depth | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Primary minimum | 0 | 8 | 16 | 24 | 32 | 40 | 48 | 56 | 64 | 72 |

Support-score minima remain attached to each individual rule. All listed parent capabilities are required. An OR applies only where the rule explicitly supplies alternative evidence or supporting proficiencies. One depth-10 specialization is branch mastery; sibling specializations are optional.

## How work creates evidence

The engine records successful, immutable receipts with a year, kind, action, facts and optional references to earlier receipts. Receipt kinds include work, exercise, production, harvest, trade, contract, reconciliation and assessment. The evaluator checks proficiency, prerequisite nodes and these recorded facts; it never interprets English design prose or accepts a client-supplied “completed” flag as proof.

Evidence can require distinct work years, acceptable quality and quantity, paid inputs, recorded payment, a met deadline, reconciled stock, independent checking, or references to earlier work. Advanced assessments are registered before their work is completed. A quote, intention, conversation, high score or failed action cannot stand in for the required result. Proof work must be available from predecessor nodes, so a player is not required to own the capability they are trying to learn.

Learning an eligible node consumes no extra action or fee. Its reward opens a method, quote, plan or eligible career; it creates no cash, materials, finished products or historical special title by itself. Production, farm plans and contracts still need the required labour, materials, payment and available buyer/payer budget.

Thirteen service operations make these opportunities playable. Eleven research/civic services cover guided study, observation, survey, investigation, reviewed method, a two-year treatise, hearing, mediation, public accounts, coalition and a two-year policy contract. Guided study charges a fee; the other ten offer completion payments funded by the school or council. AT10 also opens garment repair (24 dr, linen and thread); AS10 opens a two-year restoration (80 dr, stone and pigment). Workshop customers fund the two artisan services. Inputs and fees are debited once and the quoted customer's payment is reserved in escrow when a contract begins. Multi-year work pays only on completion; intermediate receipts record completed labour without claiming that payment has already happened.

## Branch progression and event subjects

The 24 new decisions add one introductory, one applied and one advanced subject for every specialization. They are once-only stories within normal event pacing. Intermediate and advanced subjects require the appropriate learned parent; maximum proficiency alone cannot reveal them. Choices offer small learning gains, cooperation or trust trade-offs, and occasional physical consequences. Actual capability evidence continues to come from work.

| Specialization | Main work and supporting scores | Three new event IDs |
| --- | --- | --- |
| Cultivation | Fieldwork, soil preparation, channel maintenance, crop care and integrated planning. Farming with Reckoning; maintenance also uses Tool handling. | `cap-tree-seed-sample`; `cap-tree-water-turns`; `cap-tree-cultivation-plan` |
| Resilience | Reserve planning, paid store inspection/repair, stock reconciliation and consecutive food/seed settlements. Farming with Reckoning; inspections also use Tool handling. | `cap-tree-reserve-labels`; `cap-tree-stock-discrepancy`; `cap-tree-shortage-rehearsal` |
| Clothing | Safe tools and measurements, material preparation, supervised starters, inspected garment orders and a registered masterwork. Tool handling with Reckoning; briefs also use Literacy. | `cap-tree-pattern-offcuts`; `cap-tree-fit-dispute`; `cap-tree-ceremonial-brief` |
| Ceramics | Clay preparation, fired vessels, controlled firing, matching sets and assessed production. Tool handling with Pottery and Reckoning. | `cap-tree-damp-clay`; `cap-tree-kiln-draft`; `cap-tree-matching-vessels` |
| Sculpture | Clay models, supervised relief exercises, stone figures, proportions, project budgets and commissioned large work. Tool handling with Carving and Sculpture; large-work planning also uses Reckoning. | `cap-tree-profile-sketch`; `cap-tree-stone-vein`; `cap-tree-public-relief` |
| Research | Guided questions, reasoned argument, evidence comparison, observations, measurement, prediction, independent checks, synthesis and original inquiry. Philosophy with Literacy and Reckoning. | `cap-tree-two-accounts`; `cap-tree-awkward-observation`; `cap-tree-research-credit` |
| Civic practice | Public argument, funded negotiation, public budgets, delivered service, coalition agreements and reviewed policy. Philosophy with Oratory and Literacy or Reckoning. | `cap-tree-small-hearing`; `cap-tree-conflicting-receipts`; `cap-tree-policy-consequences` |
| Commercial planning | Actual exchanges, cost baskets, comparable quotes, inventory reconciliation, funded supply/delivery and reconciled enterprise contracts. Reckoning with Literacy and Oratory. | `cap-tree-unequal-measures`; `cap-tree-supplier-terms`; `cap-tree-late-customer` |

Existing supported-branch events are adapted for the new revision: one-event mastery grants become bounded feedback; supported positive decision gains are capped at +3; sculpture, philosophy and commerce prestige require advanced capabilities. Ordinary entry-work stories remain useful. The adapter clones its input and is idempotent; it is not applied when loading or replaying an old pack.

## Boundaries and completion checks

- Earlier free-play worlds retain their exact content and fingerprints. The integration uses a new birth revision, not a silent rewrite of `alexandria-lives-1` or `alexandria-lives-2`.
- Military, Seafaring, Music/performance and Court/rulership deep branches remain **Unavailable** until their own rules are authored. Existing unrelated activities are not presented as completed deep branches.
- The retained `alexandria-deep-1` pack remains the deep-tree foundation. Its successor, `alexandria-figures-1`, implements eleven [figure-specific paths](../figure-paths.md), contribution titles and separate defining achievements. Deployed ranked/NFT minting rules remain separate.
- Real-engine full-path tests cover all eight depth-10 endpoints, including actual annual commands, paid inputs, funded contracts and registered assessment work. These use high-proficiency, resource-rich fixtures to check mechanical reachability; they do not estimate ordinary-life success rates. Save/load and replay checks protect the recorded progression.
- The design target of 50–60% of normally focused lives reaching one depth-10 specialization is **not a measured result**. Representative cohort simulations and balance checks are still required before making that claim. Repository-wide validation is recorded below.

## Validation

The capability, retained-vocation and household checks pass (108 tests), and the complete TypeScript check passes. Real engine commands reach all eight depth-10 endpoints; saved lives load and replay identically. These mechanics fixtures start with high proficiency and generous resources, so they do not measure normal-life balance. The final wider repository run reports 1,513 passing tests and 19 failures (1,532 total). The remaining failures are in birth-resource, economy, content-version, moneylender/event-priority and legacy UI expectations; none is in the capability suites. This is not a clean repository-wide release check.

The integrated current free-play release is `alexandria-lives-6`, which preserves the official numeric attribute/life-stage/path systems and adds the same figure-title metadata. This document describes the independently versioned 65-node proof tree.
