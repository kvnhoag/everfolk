# Paths of a life

Open `/skills` after starting the local server to inspect the complete atlas without creating a save. In a game, use **Skill tree** in the top navigation or **Character → Skills**.

The atlas contains 74 connected capabilities across Physique, Handmade, Knowledge and Trade. All paths remain visible. Choose a node to light its complete path from the root and inspect its prerequisites, proficiency thresholds, demonstrated-work proof, quoted action and practical reward. Scroll to zoom around the pointer and drag the map to explore; touchscreens support dragging and pinch zoom. Use **Read selected path** to center the selected skill at reading size, **Fit whole tree** to return to the overview, or the named-node picker on a small screen. Arrow keys follow connected skills.

![The complete skill atlas](../public/assets/skills/skill-atlas.svg)

## Learning and work

A capability needs its parent nodes, the required proficiency and accepted work evidence. Proficiency alone never awards it. Ordinary work develops its named primary and support skills; deliberate practice develops the selected score. A work action uses that year's major activity. Inspecting the map changes nothing.

Farming evidence settles after the real harvest and household food ledger. Artisan work consumes owned or explicitly purchased inputs, pays workshop fees and produces graded goods; learned methods control batch size, quality and inspection. Inquiry and civic assessments retain their evidence, fees and funded payments. Trade work records paid baskets, quotations and fulfilled supply orders. A multi-year assessment counts active work years and keeps its reserved inputs/payment while paused.

Locked nodes explain missing requirements. Unavailable nodes remain inspectable when an older world does not support the new progression. Careers are consequences and offers shown in node details, rather than separate skill nodes.

## Saves and versions

New free-play births use `alexandria-lives-4`. Already-started lives retain their exact immutable world. The retained `alexandria-lives-1`, `alexandria-lives-2`, `alexandria-lives-3`, demo and ranked packs remain available for save/load and replay. An old life can inspect the atlas as a reference; it is not silently granted new proofs or replay rules. Start another life to play the new progression.

## Reproduce and verify

```sh
node scripts/vocations/build-world.mjs
node scripts/skills/build-atlas.mjs
pnpm check
pnpm test
pnpm build
```

The focused-play evaluation uses ordinary accepted game commands, three of four eligible work years on a chosen path, safe disclosed choices, and finite accounts. It counts early deaths and separately reports adult survivors. It never injects learned nodes or cash:

```sh
node scripts/skills/evaluate-focus.mjs 100
```

The design's 50–60% mastery goal refers to reaching depth 10 on one specialization, not learning every sibling node. Numerical balance is an authored gameplay model; the evaluator's output is the evidence for any measured rate, rather than a promise about every seed.

## Current balance limit

The retained `alexandria-lives-3` smoke cohort used 10 seeds for each specialization. Resilience reached mastery in 3 of 10 lives; the other seven paths reached none under that disclosed policy. This is below the design target. Food security, training time and financing need further balance work; the policy is not an optimal player. The mastery-path regression fixture deliberately supplies expertise and resources to verify proofs and replay, and does not measure ordinary-play attainment.

The attribute revision has not been calibrated to that target. See [military crossovers](SKILL_CROSSOVERS.md) for Strength, Endurance, Health and career gates.
