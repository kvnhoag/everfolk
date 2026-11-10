# Everfolk

[![CI](https://github.com/kvnhoag/everfolk/actions/workflows/ci.yml/badge.svg)](https://github.com/kvnhoag/everfolk/actions/workflows/ci.yml)

Everfolk is a browser-based historical life simulation. Be born into different circumstances, learn a trade, form relationships and discover what your choices make possible. Alexandria is the first playable world choice; future worlds will be independent settings.

Historical context is sourced. Individual lives are fictional, and prices, probabilities and progression values are authored game design.

## Run locally

Use Node.js 24+ and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by the server. Ordinary play needs no account or hosted content service. Lives save in the browser, with JSON import/export for transfer.

## Play

Begin a life near Rhakotis in 350 BCE and experience the world around the emerging city of Alexandria. Develop skills, find work, maintain relationships and manage health and household finances. Accepted work can lead to named accomplishments and later career opportunities. At the end, review the life record or begin again.

The engine uses a recorded seed and accepted commands for deterministic replay. Existing saves retain their exact world revisions.

## Ranked lives on NEAR

**Guides:** [project report](guide/REPORT.md) · [how to play](guide/TUTORIAL.md) · [a real life that became Euclid](guide/EXAMPLE_LIFE.md)

Ordinary play stays offline. A **ranked life** adds NEAR in four places, each one necessary to the game rather than decoration:

1. **A birth nobody can choose.** `start_life` assigns the life's seed from NEAR block randomness and records which famous figures shape that world. The engine is deterministic, so the seed plus the player's choices *is* the life.
2. **Other players' lives reach into yours.** At key decisions (study, work, war, money, risk, family) the contract draws a living NPC token, weighted by its Affection. Its owner's chosen action, scaled by its Rarity, becomes part of your life. Figure tokens (Alexander, Aristotle, Euclid, Cleomenes) act from birth.
3. **A life is proven before it is minted.** The verifier replays the save from the on-chain seed, checks it against every draw and against checkpoints posted every five game years (so a life can't be rewound), and signs the evidence. `mint_life` checks the Ed25519 signature on chain, then randomness decides whether the life becomes a famous figure (about 5% when the life met that figure's requirements, five copies each) or an NPC of its own.
4. **Influence pays.** Every token whose action fired in your life is a *source* of your NFT. Half the mint fee and 5% of every resale go to sources in proportion to how much each changed your life, paid to whoever owns them now.

| | |
|---|---|
| Contract (testnet) | [`everfolk-lives-11101338.testnet`](https://testnet.nearblocks.io/address/everfolk-lives-11101338.testnet) — 5% figure drop, the real rules |
| Demo contract (testnet) | [`demo.genesis-1794297139-6.testnet`](https://testnet.nearblocks.io/address/demo.genesis-1794297139-6.testnet) — used only to record the video: 100% figure drop, every key decision draws someone, no wait after closing a life |
| Standards | NEP-171, 177, 178, 181, and NEP-199 payouts that include sources |
| Contract code and tests | [`contract/`](contract/README.md) (Rust, `cargo test`) |
| Verifier | [`server/ranked/`](server/ranked) — `POST /api/ranked/verify`, public evidence at `/api/ranked/evidence/<sha256>` |
| Shared rules | [`chain/`](chain) — ids, wire types, impact and save validation used by both the verifier and the game |

**Honest limits.** Randomness is NEAR block randomness (validator VRF), fine for testnet. Between checkpoints a player could simulate ahead offline, but draws come from future blocks. The verifier is a server key today; it sits behind a `LifeVerifier` interface so a TEE verifier can replace it. External marketplaces pay sources up to their `max_len_payout`; the in-game market pays every source. The demo video uses the separate demo contract above so a figure mint can be shown; the main contract keeps the 5% drop. Figure requirements are calibrated by simulation: a player who deliberately follows a figure's path qualifies in about 20–30% of lives (Alexander also needs a royal birth, 1 in 100), an unfocused life almost never does (`test/chain-figure-calibration.test.ts`).

Run ranked mode locally with a verifier secret in `.dev.vars` (`RANKED_VERIFIER_SECRET=<64 hex>`); the contract id and RPC are set in `vite.config.ts`. Testnet tools live in [`scripts/ranked/`](scripts/ranked): deploy, smoke run and genesis seeding.

## Development

```sh
pnpm check
pnpm test
pnpm build
pnpm preview
```

Edit content generator modules and run `pnpm content` to rebuild the current world. Keep earlier packs available for their saves.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and architecture, and [ROADMAP.md](ROADMAP.md) for development phases.

## Source and assets

The TypeScript simulation lives in `src/`, the React interface in `client/`, and the application/content service in `app/`, `server/`, `db/` and `worker/`. World packs, required research inputs and their citations are included.

Original pixel/vector artwork, source geometry and editable native masters are retained with the project. `artwork/history-live/` holds the character design references (Vietnamese), the pixel character creator used for figure NFT avatars, and the Alexander and Euclid collectible art; its reports are read-only references (see its `AGENTS.md`). These scenes are fictional illustrations, not archaeological reconstructions. Font copyright and SIL Open Font License notices remain under `public/fonts/`; the vendored Sites plugin retains its upstream license notice.
