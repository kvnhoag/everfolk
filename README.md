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

## NPC companions

Visit `/npc` or choose **NPC companions** from the main menu to play an online free-play life with five changing NPC slots. Characters share the real household/shop accounts, pursue their own needs and accept optional external MCP control. Every accepted NPC and player decision is recorded for exact replay; these NPCs never mint NFTs.

Rules work without a model. Local Laya selects live actions and short authored responses; an OpenAI-compatible provider can generate dialogue. Endpoint failure keeps ordinary play running and blocks real reward checks. See [NPC setup, API and MCP access](guide/NPC_AGENTS.md) and [what remains for judge play](guide/JUDGE_READINESS.md).

## Skill tree

Open **[the skill-tree guide](guide/SKILL_TREE.md)** for the connected 74-node attribute atlas. Run locally and visit `/skills` to inspect it before a birth, or use **Skill tree** / **Character → Skills** in a game. The main branches are Physique, Handmade, Knowledge and Trade. Two crossovers join Knowledge with physical conditioning for military foundations and tactical command. [Military progression and requirements](guide/SKILL_CROSSOVERS.md). New lives learn capabilities through proficiency and demonstrated work; earlier saves retain their original rules.

![Everfolk skill atlas](public/assets/skills/skill-atlas.svg)

## Play

Begin a life near Rhakotis with a birth year between 350 and 300 BCE and experience the world around the emerging city of Alexandria. Develop skills, find work, maintain relationships and manage health and household finances. Accepted work can lead to named accomplishments and later career opportunities. At the end, review the life record or begin again.

The bundled classic Alexandria world groups eight earned historical title paths and their milestone sub-cards, including Right Hand of Alexander, General of Alexander, and scholarly work associated with Aristotle, Euclid and Theophrastus. Scholarly paths use independent study and reviewed work, without requiring personal lessons or teaching-window deadlines. Complete a path's tasks and recognition review to collect its sub-cards under your character's name. Works & deeds shows preparation and progress; the collection can filter by historical figure.

The engine uses a recorded seed and accepted commands for deterministic replay. Existing saves retain their exact world revisions.

### Classic Alexandria resource economy

Classic Alexandria lives record named parents and grandparents with their household backgrounds and occupations. Living grandparents are rare: 10% of new households start with one. Open Family for a table of living relatives, your spouse and children, with deceased relatives kept under Remembered family. Relationships lists friends, business partners, teachers, disciples, enemies and romantic relationships as they form, alongside backgrounds, work and recorded bonds.

Classic Alexandria lives offer work shaped by their household background, with farming as an optional livelihood. Independent material trades use purchased supplies to produce goods for sale. Place bulk market contracts during the year: cash or stock is reserved immediately, and deliveries and sale receipts settle at the next year end. Quotes respond to events reported in the life. Choosing the Trading focus puts ordinary work aside; repeated years of completed sales can open the trader occupation.

The market shows resources useful to your current work and background, goods you own or have ordered, and supplies for tasks you can take. Traders, shopkeepers, merchants, estate stewards and quartermasters can browse the full catalogue with search and category filters because their work involves broad purchasing or resale. Other occupations keep a focused selection. Starting-resource displays focus on your household's rolls and possessions.

In new classic Alexandria lives, royal births follow a separate household council path. Guide the house treasury, court influence, household stability, security and succession, with private lessons from age eight and council responsibilities from sixteen. Household staff handle trade and ordinary work; royal decisions concern envoys, guards, petitions, estate obligations and family agreements. Personal health, family and historical changes still shape the life. This fictional minor royal branch does not automatically inherit Egypt's throne. Earlier saves retain their original rules.

Aristocrats born into the landowning estate household manage an Estate council: invest in land and storage, settle tenant agreements, maintain local patronage, collect rents and plan the family's inheritance. Estate prosperity and tenant loyalty affect annual returns. Their staff handle ordinary trade and paid work. New lives have a 6% chance of an aristocratic birth and a 2% chance of a royal birth; these are authored game probabilities, increased from 3% and 1%. Begun lives keep their original world revision.

For a local preview of the full game and ready-to-play class scenarios, run `node scripts/preview-lives.mjs`. The game opens at `http://localhost:5175/`, with isolated adult scenarios at `/test-aristocrat` and `/test-royalty`. Both test routes use the regular life screen, year controls, event feed and management dialog, with a small preset selector. Test sessions do not write personal saves; normal play at the root uses browser saves. The preview serves the bundled worlds locally without a database.

Royal and aristocratic births receive a congratulations popup after the starting-stat reveal and **Begin life**. A skippable four-step tour introduces their treasury, household conditions, yearly council decisions and earned titles; time waits while the tour is open. **Household guide** in the character panel reopens it. Both class test pages show the introduction and include **Try birth welcome** to test the complete newborn reveal and tutorial without personal saves.

Each council contains three earned title paths. Royal households pursue Ambassador of the House, Guardian of the House or Unifier of the House; estate households pursue Restorer of the Estate, Trusted Patron or Keeper of the Family Lands. A path requires an actual council service, three accepted duties across several years, maintained household conditions and a final recognition action. The two middle projects can fail, spend their budget and require two years before a retry. Recognition adds 5 drachmas to the household treasury each year. These are fictional household distinctions. They also develop practical skills; treasury-funded lessons and historical service opportunities let either class pursue the existing historical titles within their original dates and recognition odds.

New lives limit ordinary household contracts to 50 units per order and 100 total units per year. Roles with full market access can commit 100 units per order and 300 per year. Purchases and sales share that yearly allowance, including orders split across different goods. Cancelling a contract releases its allowance; completing the year renews it. At most eight contracts may be pending.


## Ranked lives on NEAR

**Guides:** [project report](guide/REPORT.md) · [how to play](guide/TUTORIAL.md) · [a real life that became Euclid](guide/EXAMPLE_LIFE.md)

Ordinary play stays offline. A **ranked life** adds NEAR in four places, each one necessary to the game rather than decoration:

1. **A birth nobody can choose.** `start_life` assigns the life's seed from NEAR block randomness and records which famous figures shape that world. The engine is deterministic, so the seed plus the player's choices *is* the life.
2. **Other players' lives reach into yours.** At key decisions (study, work, war, money, risk, family) the contract draws a living NPC token, weighted by its Affection. Its owner's chosen action, scaled by its Rarity, becomes part of your life. Figure tokens (Alexander, Aristotle, Euclid, Cleomenes) act from birth.
3. **A life is proven before it is minted.** The verifier replays the save from the on-chain seed, checks it against every draw and against checkpoints posted every five game years (so a life can't be rewound), and signs the evidence. `mint_life` checks the Ed25519 signature on chain, then randomness decides whether the life becomes a famous figure (about 5% when the life met that figure's requirements, five copies each) or an NPC of its own.
4. **Influence pays.** Every token whose action fired in your life is a *source* of your NFT. Half the mint fee and 5% of every resale go to sources in proportion to how much each changed your life, paid to whoever owns them now.

| | |
|---|---|
| Contract (testnet) | [`everfolk-albums-11121956.testnet`](https://testnet.nearblocks.io/address/everfolk-albums-11121956.testnet) — current contract with stage albums, 5% figure drop, the real rules |
| Earlier contract (testnet) | [`everfolk-lives-11101338.testnet`](https://testnet.nearblocks.io/address/everfolk-lives-11101338.testnet) — before stage albums; its lives and tokens remain there |
| Demo contract (testnet) | [`demo.genesis-1794297139-6.testnet`](https://testnet.nearblocks.io/address/demo.genesis-1794297139-6.testnet) — used only to record the video: 100% figure drop, every key decision draws someone, no wait after closing a life |
| Standards | NEP-171, 177, 178, 181, and NEP-199 payouts that include sources |
| Contract code and tests | [`contract/`](contract/README.md) (Rust, `cargo test`) |
| Verifier | [`server/ranked/`](server/ranked) — `POST /api/ranked/verify`, exact signed evidence at `/api/ranked/evidence/<sha256>` and replay saves at that URL plus `/save` |
| Shared rules | [`chain/`](chain) — ids, wire types, impact and save validation used by both the verifier and the game |

**Honest limits.** Randomness is NEAR block randomness (validator VRF), fine for testnet. Between checkpoints a player could simulate ahead offline, but draws come from future blocks. The verifier is a server key today; it sits behind a `LifeVerifier` interface so a TEE verifier can replace it. External marketplaces pay sources up to their `max_len_payout`; the in-game market pays every source. The demo video uses the separate demo contract above so a figure mint can be shown; the main contract keeps the 5% drop. Figure requirements are calibrated by simulation: a player who deliberately follows a figure's path qualifies in about 20–30% of lives (Alexander also needs a royal birth, 1 in 100), an unfocused life almost never does (`test/chain-figure-calibration.test.ts`).

Run ranked mode locally with a verifier secret in `.dev.vars` (`RANKED_VERIFIER_SECRET=<64 hex>`); the contract id and RPC are set in `vite.config.ts`. Testnet tools live in [`scripts/ranked/`](scripts/ranked): deploy, smoke run and genesis seeding.

Without a configured verifier, choose **Practice ranked life** to try the same screens and simulation using a browser-only ledger. It sends no transactions to NEAR. Live mode requires deploying the updated contract and configuring its account; updating the application source does not replace the existing testnet deployments listed above.

## Career and economy tree

Open **Character → Skills** to follow the full career and economy tree, or **Wiki → All skills & requirements** to browse it without taking actions. The tree connects authored skills, occupations and accomplishment paths. Filter by branch, follow a foundation skill into later careers, and inspect the real age, skill, cash, resource and accepted-work requirements.

Occupation cards explain yearly income before costs, harvest and storage mechanics, or army wages and rations. Training and career actions use the existing yearly activity budget. **Locked** paths have unmet requirements; **Unavailable** paths remain inspectable but are excluded by the current world. Existing worlds retain their own rules.

## Development

The standalone [character creator](tools/character-creator/README.md) includes editable historical presets, layered NFT artwork, and five rarity previews. Run `node tools/character-creator/server.mjs` to open it locally on port 4173, or visit `/collection.html` on that server to browse the collection.

`pnpm test` runs both the game tests and the character creator tests. `pnpm check` also runs the English-only text check.

```sh
pnpm check
pnpm test
pnpm build
pnpm preview
```

Edit content generator modules and run `pnpm content` to rebuild the current world. Keep earlier packs available for their saves.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, [ARCHITECTURE.md](ARCHITECTURE.md) for folder ownership and dependency rules, and [ROADMAP.md](ROADMAP.md) for development phases.

## Source and assets

The TypeScript simulation lives in `src/`, the React interface in `client/`, and the application/content service in `app/`, `server/`, `db/` and `worker/`. World packs, required research inputs and their citations are included.

Original pixel/vector artwork, source geometry and editable native masters are retained with the project. The ordinary portrait libraries include their source manifests, review records and dependencies; the game delivers 240 reviewed v3 PNGs. `artwork/history-live/` holds the character design references (Vietnamese), the pixel character creator used for figure NFT avatars, and the Alexander and Euclid collectible art; its reports are read-only references (see its `AGENTS.md`). These scenes are fictional illustrations, not archaeological reconstructions. Font copyright and SIL Open Font License notices remain under `public/fonts/`; the vendored Sites plugin retains its upstream license notice.

## Grain and Service demo

New free-play births use `alexandria-lives-5`, with household resource rolls shown beneath the four main stats, including zero results. Total wealth includes held resources at their applicable market quotes. Begun lives retain their recorded revision, including the original `alexandria-lives-4` pack and capability rules. Ranked and practice worlds remain separate from the free-play revision. In the separate ranked demo, a finished farmer can mint a Farming NFT whose deed (stocked the granary, shared seed) is drawn into a later life at a harvest shock. A soldier who earns convoy distinction can mint as Alexander under the demo standard. Grain, wages and the convoy stay in the game; only the NFT is on chain. The owner calls that open the ranked demo on its contract are printed by `scripts/ranked/prepare-demo-owner-calls.sh` and are not run from here.


The approved **Printed Folktale** identity uses locally bundled Eczar 600 for the wordmark and headings, with DM Sans 500 at 16px for narrative text. The textured wordmark keeps its clay-coloured period. Transparent SVG/PNG logos, the font licence and rebuild sources are packaged in [the brand kit](artwork/branding/everfolk-printed-folktale/README.md).
