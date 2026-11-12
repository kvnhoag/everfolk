# Life stages and who decides

Opt-in engine rules for worlds that declare `lifeStages`. Worlds without it, and every save made in
them, keep their previous event rules.

## Stages and scopes

`lifeStages.stages` lists ordered, contiguous stages from age 0. `lifeStages.scopes` names the first
stage in which the player decides each kind of decision:

| Scope | Covers |
| --- | --- |
| `personal` | Own play, study, friendships, temperament (the default) |
| `work` | Own training, apprenticeship, craft, trade |
| `community` | Levy, civic duty, public disasters as an individual |
| `household` | Shared grain, silver, land, cash, medical care, contracts with townspeople |

Free-play Alexandria (`src/vocations/life-stage-content.ts`): infancy 0–2 (no decisions), early
childhood 3–5 and childhood 6–11 (personal), adolescence 12–13 (+ work), youth 14–15
(+ community), adulthood 16–59 and later life 60+ (+ household). The ages follow the evidence from
Graeco-Roman Egypt: apprenticeships often began before the teens, a boy entered the poll-tax
register at 14 (Greek families also enrolled sons as ephebes then), and most women married by
their later teens. The levy is a household answer (who goes, what is sent).

## Event fields

- `stages` — the event's time frame. Required for random and age events; dated history and
  interrupts may omit it. An age event's trigger age must fall inside its stages.
- `scope` — who would really decide. Decisions outside the player's current scope are not offered.
- `dependent` — how others resolve the event when the player may not decide it:
  `{ text, responses: [{ id, text, when?, weight?, effects }] }`. Responses with `when` are rules
  (one matching rule is drawn by weight from the seeded stream); responses without `when` are the
  fallback, used only when no rule matches, and the last response must be one. The journal records
  the event with `dependent.text` and the response as its outcome. It never uses the year's
  decision slot. Response IDs must be unique across the world's outcomes.

A decision event outside the player's scope without `dependent` does not happen for that player.
The medical care decision must have `dependent` unless its scope is decided from the first stage.

## Writing an event

1. Why does it happen? Put the cause in `when`: a world condition, household state, role or earlier
   choice.
2. When in life can it happen? Set `stages`.
3. Whose decision is it? Set `scope`.
4. If the player may be too young, write `dependent` responses that say who decides ("Your mother
   cuts every portion…"), and make the consequences land on the child.
5. Give consequences in real state and limit repeats with `maxOccurrences` / `cooldownYears`.

Childhood text speaks to a child's world. Never write "you decide" for something others decided.
