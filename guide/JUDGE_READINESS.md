# Judge play: what is ready and what remains

The local `/npc` mode can begin a life, make real Laya decisions, continue under rules during an endpoint outage, resume live decisions, and export a replay. It has five changing core slots and the existing offline end-of-life booster preview. Laya chooses supplied actions and authored responses; it is not a generative chat model.

This is not yet one hosted, reward-bearing judge journey. The NPC mode and ranked NFT mode have different session logs and entry points. A provider connection alone does not make an NPC life eligible for minting.

## Release work, in order

| Priority | Work                                                                                                                                                                          | Done when                                                                                                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Assemble one judge build from the completed gameplay, pacing, figures, NFT and NPC feature branches. Keep active workflows separate until their changes are complete.         | A fresh user can enter one coherent mode, see the skill tree and core NPCs, and reach the end using the same world revision.                                                                                                                                                              |
| 2        | Connect the NPC session log to ranked verification and the reward issuer. Check live provider availability immediately before granting any real NFT/account reward or credit. | The verifier reconstructs accepted NPC effects as well as player commands, verifies the assigned life and world, and rejects missing, altered or disconnected-provider award attempts. Repeated requests cannot issue twice. An offline booster preview cannot claim real assets.         |
| 3        | Deploy the app, D1 migrations and model service behind a stable public HTTPS URL. Configure server-only credentials, budgets and a real health check.                         | An external phone or laptop can start a life without reaching a localhost address. The model service stays up independently of a developer terminal. Logs contain no tokens or provider keys.                                                                                             |
| 4        | Rehearse sign-in and the intended NEAR testnet award route on that public deployment. Confirm the deployed contract matches the selected release.                             | A fresh email player or supported wallet signs in, receives sufficient test gas when eligible, finishes a life, verifies it, opens the pack, selects or mints the result, and sees the confirmed asset. If market/earnings are shown to judges, test one purchase and withdrawal as well. |
| 5        | Add a short guided judge route and rehearse its failures.                                                                                                                     | A judge can understand the loop in about five to ten minutes, see one career/skill payoff and one NPC interaction, and reach the final result. Refreshing, reconnecting and retrying after a failed request preserve the same life and never duplicate an award.                          |

Use the normal in-game economy without wallet prompts. Real awards happen at the verified end-of-life boundary. The five core agent NPCs remain non-mintable characters.

## Current reward boundary

The NPC snapshot always reports `nftEnabled: false` and `accountCreditsEnabled: false`. Those flags are intentional: no real issuer is connected to this mode. Its provider check can report eligibility for a future issuer, but cannot mint or credit an account.

The server's `requireLiveProviderForRewards` guard makes a fresh provider request; cached UI status is not enough. A failed endpoint, invalid answer, timeout, exhausted allowance or missing setup rejects the guard. Ordinary in-game wages, food, skills and story progress continue. Recovery does not automatically grant or backfill any real reward.

Existing ranked contracts can still have balances and NFT provenance independent of the new NPC mode. This feature does not change deployed contracts or revoke already-earned royalties. Disabling new real rewards for an integrated NPC journey must happen at its authoritative verifier/issuer boundary; UI hiding is insufficient.

## Local operator rehearsal

1. Start the Laya service and the game using [the NPC setup guide](NPC_AGENTS.md).
2. Run `pnpm npc:provider-check`; expect `status: live`, no game changes and no real awards.
3. Begin a fresh `/npc` life and resolve an NPC turn. Confirm `(laya)` actions appear in the record.
4. Stop the model service. Use **Check live connection**, then continue the year and resolve the next turn. Expect rules, preserved game progress and disabled real rewards/credits.
5. Restart the model service. After the thirty-second cooldown, check again. Expect a live response in the same life, without losing history or granting a reward.
6. Finish the life, open the offline booster preview and export the replay. This final step demonstrates the NPC free-play loop; it is not a testnet mint.

## Validation of this provider branch

The project test suite passes 1,942 tests, and the production build succeeds. A native-Laya run completed a life at age 45 over 46 annual turns, met all five core NPCs, and used 209 provider reservations. Both player and NPC state replayed exactly from the exported log. Its final booster contained three preview cards and issued no real award. A separate browser rehearsal stopped and restarted the actual local model service, preserving game progress while switching to rules and back to live decisions.
