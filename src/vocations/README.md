# Handmade work and public life

`alexandria-lives-2` is the current **free-play** birth revision, built from the retained `alexandria-demo-2` pack. It adds deterministic household resource rolls and market-valued wealth. The previous `alexandria-lives-1` revision remains available for exact replay. Started lives keep their exact pack. Live ranked configuration, contract allowlists and deployment are unchanged.

Run `node scripts/vocations/build-world.mjs` to reproduce the shipped JSON. The builder reads the public [skill-tree design](../../design/skill-tree/README.md) for recipe inputs and reference prices.

This first runtime pass supports:

- Thirteen recipes for thread, linen, clothes, ceramics and sculpture, with purchased or household-produced inputs, workshop fees, graded products and finite buyers.
- One recipe unit per work action. Thread yields four units. Large reliefs and monuments reserve all inputs and fees at the start, pause between active work years, and produce once after two work actions.
- One shared flax/linen store with the existing farm and town market. Other materials and graded finished products live in the vocation inventory.
- Paid textile, pottery and sculpture apprenticeships; deliberate practice; philosophical study, observations, tests, independent checking and original inquiry; public addresses, negotiated agreements, account reconciliation and policy review.
- Ordinary work gains of +3 primary / +2 to each named support; deliberate practice +5 primary. Main Knowledge and Bonds effects are authored per activity. Workshop safety, research credit and public-account decisions affect Health, Knowledge and Bonds.
- Seven supported career roles, including Tailor, Scientist and Politician. Appointments require proficiency and recorded completed work. Their job definitions grant no automatic wage or skill gain: actual paid work and product sales provide income.
- Bounded material stock, lifetime buyer demand and separate merchant, workshop, school and council cash accounts. Purchases, fees, wages and sales transfer money between those accounts and the household. They never create money or borrow automatically.
- Work consumes the player's annual action and farm labour. Existing automatic job gains are skipped in a year spent on vocation work. Family helpers continue contributing to the farm.
- Deterministic commands, immutable snapshots, journal receipts, validated pack references, save/load and replay. The existing Career screen exposes work, price/skill previews, inventory and project status.

The complete **65-node capability evaluator is still a separate integration step**. This revision uses explicit work/proficiency gates for its new activities; it does not claim to enforce every proposed per-node proof or grant every node reward. The design remains the source for that integration. Supervised A3 templates, batch-size upgrades and discounts, paid inspection, detailed commissions and assessment ledgers, Farming/Trade capability rewards, and the proposed 50–60% mastery cohort are not implemented or measured here. Numerical stock and payer budgets are bounded gameplay starting values, not reconstructed historical accounts.

No shared skill-tree screen redesign, NFT mint rule or on-chain resource inventory is introduced.
