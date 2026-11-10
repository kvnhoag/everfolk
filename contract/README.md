# Everfolk lives contract

NEAR contract for ranked Everfolk lives: seeded births, live influence draws, checkpoints, verified mints of figure or NPC NFTs, and royalties that pay each life's sources.

Design: `docs/superpowers/specs/2026-11-10-everfolk-near-lives-design.md` (local). Wire shapes shared with the TypeScript code live in `chain/types.ts`.

## Build and test

```sh
export PATH="$HOME/.cargo/bin:$PATH"
cargo test                              # unit tests (near-sdk mocked blockchain)
cargo near build non-reproducible-wasm  # → target/near/everfolk_lives.wasm
```

## Deploy to testnet

```sh
CONTRACT_ID=everfolk-lives-demo.testnet VERIFIER_PUBLIC_KEY=ed25519:... scripts/ranked/deploy-contract.sh
CONTRACT_ID=everfolk-lives-demo.testnet KEEP_VERIFIER_KEY=ed25519:... scripts/ranked/smoke.sh
```

The deploy script creates a missing contract account from the testnet faucet and stores its key in `~/.near-credentials/testnet`. It loads the catalog from `chain/catalog/contract-catalog.json` when present, otherwise a placeholder built from `chain/ids.ts`. Use a new `CONTRACT_ID` after any change to stored state.

## Methods

| Area | Methods |
|---|---|
| Lives | `start_life`, `abandon_life`, `draw_npc`, `checkpoint`, `get_life`, `active_life_of` |
| Mint | `mint_life` (payable), `set_action`, `figure_supply` |
| Earnings | `withdraw`, `balance_of`, `sources_of`, `children_of`, `token_stats` |
| Market | `list`, `unlist`, `buy` (payable, returns seller proceeds), `listing`, `listings` |
| Pools | `active_pool`, `figure_copies` |
| Standards | NEP-171 core, NEP-177 metadata, NEP-178 approvals, NEP-181 enumeration, NEP-199 `nft_payout` / `nft_transfer_payout` |
| Admin (owner) | `set_verifier_keys`, `set_catalog`, `set_params`, `set_world_versions`, getters |

## Known limits

- Gas floors: `mint_life` needs 150 Tgas and `draw_npc` 100 Tgas, so no outcome can be retried by starving its branch of gas.
- Per life: at most 128 draws and 128 checkpoints. Per category: at most 1000 drawable NPCs (later ones are minted but not drawn).
- Each mint's storage is paid from the treasury's share of the fee; mint panics if the fee can't cover it.
- Evidence is bound to the life's on-chain seed, so it can't be replayed on another deployment.
- Randomness comes from NEAR block randomness (validator VRF). Fine for testnet; a block producer could withhold a block.
- External marketplaces receive NEP-199 payouts limited by `max_len_payout`; the source owners that don't fit go to treasury. The in-game market pays every source.
- Gas: pools and source lists are vectors; the MVP caps sources at 64 per token.
