# Work, inquiry and learned capabilities

**`alexandria-lives-3`** integrates the deep skill tree for new free-play births. The builder starts from retained `alexandria-lives-2`, attaches the `deep-1` rules and adapts the content for that new revision. Started lives continue using their exact earlier pack. Live ranked configuration, contract allowlists and deployed NFT rules are unchanged.

Run `node scripts/vocations/build-world.mjs` to reproduce the shipped JSON. Read the [runtime progression record](../../design/skill-tree/runtime-progression.md) for the chosen stats, skill mappings and all new event IDs; the [design package](../../design/skill-tree/README.md) retains the full prerequisite graph.

## Implemented progression

- **65 learned capabilities**, four families and eight depth-10 specializations, with 161 vocation action definitions in this revision. Relevant numeric proficiencies, prerequisite nodes and verified work all matter; a high score alone cannot award mastery.
- Work gives **+3 primary and +2 to each of up to two relevant supports**. Deliberate practice gives **+5 primary and +1 to each of up to two relevant supports**. Production, practice, farm work and inquiry share the annual major action; the same labour does not also collect an automatic full job wage.
- **Health** reflects safety, fatigue and recovery. **Knowledge** develops through learning and inquiry. **Bonds** records cooperation and public trust. **Wealth/Resources** remain real cash, debt, stock and inventory, rather than a proof currency. Demanding major work requires Health 20; capability evidence is still required after recovery.
- Successful receipts retain their year, kind, action and facts. Gates can require distinct years, quality, quantity, paid inputs, accepted inspections, independent checks, delivered funded agreements, reconciled accounts and references to prior work. Rejected work produces no proof.
- **24 once-only decisions** cover Cultivation, Resilience, Clothing, Ceramics, Sculpture, Research, Civic practice and Commercial planning at introductory, applied and advanced stages. Decisions offer bounded learning and social or physical consequences; conversations create no imaginary crops, products, work receipts or Legendary awards.
- Supported legacy one-event mastery grants become bounded feedback. Existing sculpture, philosophy and commerce prestige events require advanced capabilities. Retained packs are never rewritten during loading.

## Work and rewards

The runtime retains thirteen recipes for thread, linen, clothing, ceramics and sculpture. Capability rewards control supervised entry templates, independent production, recipe access, batch and quality limits, paid inspection, relevant efficiency improvements, commissions and assessments. Multi-year work reserves inputs and fees once, pauses safely and produces its output once.

Thirteen service operations now execute the reward quotes: eleven research/civic services, garment repair after AT10 and restoration after AS10. Research/civic work includes guided study, observation, survey, investigation, reviewed method, treatise, hearing, mediation, public accounts, coalition and policy. Guided study charges a fee; paid contracts reserve real school, council or workshop funds, debit their materials and access fees once, and transfer the reserved payment only when the required work years finish. Treatises, policy contracts and restoration take two work years. A partial work receipt does not claim a completed contract or payment.

Farming progression covers soil and water knowledge, cultivation plans, reserves, store improvements and resilient household settlements. Trade covers actual measures, cost records, stock planning, funded deliveries, realized margin and enterprise accounts. Research develops from questions and observations to independent checking and original inquiry; civic practice develops from public argument to funded agreements, accounts, coalition work and reviewed policy.

Learning a node itself costs no extra action or fee and grants no automatic cash or special title. It opens methods and career eligibility. Paid work and sales still need real labour, materials and available employer/buyer funds. Household and vocation stores share their existing grain, flax and linen balances; other materials and graded products remain in the vocation inventory.

## Retained limits

Military, Seafaring, Music/performance and Court/rulership deep branches remain unavailable until their own detailed rules are authored. Existing unrelated scores and older saved worlds remain supported.

Real-engine full-path tests cover all eight mastery endpoints using high-proficiency, resource-rich fixtures and actual commands and receipts. This checks mechanical reachability and durable replay, rather than measuring balance across ordinary lives. The final repository-wide test run remains the integration release check.

Historical figure paths, subordinate/disciple rank awards, special titles and on-chain minting are not declared complete by this update. The 50–60% focused-life mastery target is still unmeasured; balancing needs representative cohort simulations. Numerical stock, prices and payer budgets are authored gameplay values, not historical estimates. No dev-server lifecycle change is required by this implementation.

The current new-birth revision is `alexandria-lives-4`, which extends the retained deep-tree pack with eleven figure-linked development paths and earned titles. Build it with `node scripts/figures/build-world.mjs` after retaining `alexandria-lives-3`. The earlier builder still reproduces the unchanged deep-tree foundation.
