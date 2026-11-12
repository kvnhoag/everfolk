# Life paths

Opt-in engine rules for worlds that declare `paths` (which requires `lifeStages`). They make a
career grow out of the life the player is in: where they live, what the household holds, whom they
meet and what the world needs. Worlds without `paths`, and their saves, keep their previous rules.

## Fields and districts

Eight **fields**: farming, clothing, ceramics, sculpture, research, civic, trade, soldiering. Each
names its skills (the first is its entry skill), jobs and skill-atlas specializations.

Each life has a **district** — where the player lives — with people per field in four tiers
(learners, workers, masters, renowned). Free-play Alexandria has a Delta village, the garrison,
the estate lands, the city quarter and the court quarter; the birthplace decides the start. Each
year the district changes by rule on its own seeded stream: people leave, learners and workers
advance, scarce fields attract newcomers, war takes soldiers and learners, a low flood ruins
farmers. Only the player moves (an apprenticeship, study, a posting, a return home), at most once
per life stage; the household and its plot stay at home.

## Needs and pay

A field's **need** is the district's demand divided by the people working in it, bounded to
0.7×–1.6× (`scarce` from 1.2×, `crowded` to 0.85×). It scales only pay that a finite account
already funds — skill-atlas work, the army purse, and grain supply premiums — so no money is
created. `fieldNeedsView` explains each field ("3 potters working where the city quarter needs 6").

## Affinity and meetings

**Affinity** (0–100 per field) is a visible pull toward a field. It raises that field's events (up
to ×2) and speeds practice of its skills (up to +20%). Meeting someone who does the work adds to
it by their tier — a learner nudges, a master introduces, a renowned figure is remembered. Unused
affinity fades slowly from age 12, never below the household background.

## Stage records

When a life leaves a stage, and when it ends, the engine records that stage: title, ages,
district, field and tier, job, top skills, learned nodes, reputation, accomplishments and the
people met. Stage figures are minted from these records.

## Event fields and effects

- `fields` on an event: the fields it belongs to (affinity raises it).
- Conditions: `affinity`, `field-need`, `field-people`, `district`, `away-from-home`, `introduced`, `material`.
- Effects: `affinity`, `meet-practitioner`, `introduce-field`, `move-district` (`"home"` returns),
  `use-material` (consumes work materials with a cause).

## Writing events

Follow `src/life-stages/README.md`, then: tag the fields; never create cash or goods (selling is a
market command; consume or move goods with a cause); spending above 5 drachmas or any shared goods
is a `household` decision with a household answer if a minor can reach it; give every adult
decision a cause beyond age. `node scripts/events/audit.mjs --list` reports the rules; the world
build fails on spending and cause problems.
