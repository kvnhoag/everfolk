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
| Mint | `mint_life` (payable), `retry_mint` (payable), `mint_result`, `set_action`, `figure_supply` |
| Earnings | `withdraw`, `balance_of`, `sources_of`, `children_of`, `token_stats` |
| Market | `list`, `unlist`, `buy` (payable, returns seller proceeds), `listing`, `listings` |
| Pools | `active_pool`, `figure_copies` |
| Standards | NEP-171 core, NEP-177 metadata, NEP-178 approvals, NEP-181 enumeration, NEP-199 `nft_payout` / `nft_transfer_payout` |
| Admin (owner) | `set_verifier_keys`, `set_catalog`, `set_params`, `set_world_versions`, getters |

## Known limits

- Gas floors: `mint_life` and `retry_mint` need 200 Tgas, including a separate 150-Tgas mint resolver receipt; `draw_npc` needs 100 Tgas.
- A mint request commits its fee, evidence, action, random seed and economic/catalog settings before the resolver creates a token. The life reports `minting` while pending. A later failing action in the request's batch cannot inspect a minted outcome, and failed resolver retries keep the same committed seed. Figure supply is checked when resolving, so concurrent requests cannot exceed the committed catalog's caps.
- `mint_life` returns a promise whose successful result remains the original `MintResult` JSON. If execution or its wallet response is interrupted, call `mint_result({ life_id })` to find a completed result, or the owner can call `retry_mint({ life_id })` with zero deposit to reschedule the pending request. Duplicate callbacks/retries return the same result without another token or fee. An optional retry deposit covers extra storage only; unused funds are refunded and do not earn another royalty.
- Per life: at most 128 draws and 128 checkpoints. Per category: at most 1000 drawable NPCs (later ones are minted but not drawn).
- Each mint's storage is paid from the treasury's share of the fee. Every changed lazy collection and any new treasury balance row is flushed before measuring the full request-plus-resolver storage delta. If storage exceeds the available fee, the resolver fails atomically while the committed request remains recoverable with an additional storage deposit.
- Evidence is bound to the life's on-chain seed, so it can't be replayed on another deployment.
- Randomness comes from NEAR block randomness (validator VRF). Fine for testnet; a block producer could withhold a block.
- External marketplaces receive NEP-199 payouts limited by `max_len_payout`; the source owners that don't fit go to treasury. The in-game market pays every source.
- Gas: pools and source lists are vectors; the MVP caps sources at 64 per token.

The pending/completed mint records use an appended storage-key prefix and `minting` is appended to the life-status enum; existing field layouts and enum discriminants are preserved. The contract unit suite checks resolver receipt isolation, committed retry data, duplicate-callback idempotency and fee-versus-persisted-storage conservation. These mocked-receipt tests do not replace a sandbox or testnet transaction-level release check.
