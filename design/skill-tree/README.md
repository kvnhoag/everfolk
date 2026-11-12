# Everfolk deep skill tree

The agreed 65-capability design is now integrated into new free-play lives in **`alexandria-deep-1`**. Earlier world revisions retain their exact rules and fingerprints. The original design package remains the reference for its prerequisite graph; the runtime record explains the implemented proficiency gains, work evidence, rewards and events.

- [Read the runtime progression decisions](runtime-progression.md)
- [Open the read-only design viewer](index.html)
- [Read the original design](design.md)
- [Read the requirements for all 65 nodes](node-rules.md)
- [View the full DAG drawing](skill-tree.svg)
- [Use the structured design catalog](catalog.json)
- [Review design validation](review.json) and [worked economic examples](economy-examples.json)
- [Read the runtime world guide](../../src/vocations/README.md)

The implemented graph has four families and eight specializations: Farming/Cultivation/Resilience; Artisan/Clothing/Ceramics/Sculpture; Philosophy/Research/Civic practice; and Trade/Commercial planning. Capabilities are earned from prerequisite nodes, the relevant proficiencies and successful engine-recorded work. They are not 65 additional numeric scores or a spendable skill-point system.

The runtime adds **24 decisions** and **13 service operations**, adapts supported legacy mastery and prestige events, and keeps material purchases, labour, fees, funded payments and delivered products in their actual ledgers. Historical special-title routes and NFT rarity/minting integration remain separate work.

Engine full-path tests cover the eight mastery endpoints with high-proficiency, resource-rich fixtures; this is a mechanics reachability check. The proposed 50–60% mastery cohort target has **not** been measured. Costs, gains and prices are authored gameplay values; no claim of reconstructed historical prices or a measured lifetime success rate is made.

The current new-birth revision is `alexandria-figures-1`, which extends the retained deep-tree pack with eleven figure-linked development paths and earned titles. Build it with `node scripts/figures/build-world.mjs` after retaining `alexandria-deep-1`. The earlier builder still reproduces the unchanged deep-tree foundation.

The integrated current free-play release is `alexandria-lives-6`, which preserves the official numeric attribute/life-stage/path systems and adds the same figure-title metadata. This document describes the independently versioned 65-node proof tree.
