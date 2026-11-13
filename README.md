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

Historical figure cards group eight earned title paths and their milestone sub-cards, including Right Hand of Alexander, General of Alexander, and scholarly work associated with Aristotle, Euclid and Theophrastus. Scholarly paths use independent study and reviewed work, without requiring personal lessons or teaching-window deadlines. Complete a path's tasks and recognition review to collect its sub-cards under your character's name. Works & deeds shows preparation and progress; the collection can filter by historical figure.

The engine uses a recorded seed and accepted commands for deterministic replay. Existing saves retain their exact world revisions.

New lives record named parents and grandparents with their household backgrounds and occupations. Living grandparents are rare: 10% of new households start with one. Open Family for a table of living relatives, your spouse and children, with deceased relatives kept under Remembered family. Relationships lists friends, business partners, teachers, disciples, enemies and romantic relationships as they form, alongside backgrounds, work and recorded bonds.

New lives offer work shaped by their household background, with farming as an optional livelihood. Independent material trades use purchased supplies to produce goods for sale. Place bulk market contracts during the year: cash or stock is reserved immediately, and deliveries and sale receipts settle at the next year end. Quotes respond to events reported in the life. Choosing the Trading focus puts ordinary work aside; repeated years of completed sales can open the trader occupation.

The market shows resources useful to your current work and background, goods you own or have ordered, and supplies for tasks you can take. Traders, shopkeepers, merchants, estate stewards and quartermasters can browse the full catalogue with search and category filters because their work involves broad purchasing or resale. Other occupations keep a focused selection. Starting-resource displays focus on your household's rolls and possessions.

Royal-born lives follow a separate household council path. Guide the house treasury, court influence, household stability, security and succession, with private lessons from age eight and council responsibilities from sixteen. Household staff handle trade and ordinary work; royal decisions concern envoys, guards, petitions, estate obligations and family agreements. Personal health, family and historical changes still shape the life. This fictional minor royal branch does not automatically inherit Egypt's throne. Earlier saves retain their original rules.

Aristocrats born into the landowning estate household manage an Estate council: invest in land and storage, settle tenant agreements, maintain local patronage, collect rents and plan the family's inheritance. Estate prosperity and tenant loyalty affect annual returns. Their staff handle ordinary trade and paid work. New lives have a 6% chance of an aristocratic birth and a 2% chance of a royal birth; these are authored game probabilities, increased from 3% and 1%. Begun lives keep their original world revision.

For a local preview of the full game and ready-to-play class scenarios, run `node scripts/preview-lives.mjs`. The game opens at `http://localhost:5175/`, with isolated adult scenarios at `/test-aristocrat` and `/test-royalty`. Both test routes use the regular life screen, year controls, event feed and management dialog, with a small preset selector. Test sessions do not write personal saves; normal play at the root uses browser saves. The preview serves the bundled worlds locally without a database.

Royal and aristocratic births receive a congratulations popup after the starting-stat reveal and **Begin life**. A skippable four-step tour introduces their treasury, household conditions, yearly council decisions and earned titles; time waits while the tour is open. **Household guide** in the character panel reopens it. Both class test pages show the introduction and include **Try birth welcome** to test the complete newborn reveal and tutorial without personal saves.

Each council contains three earned title paths. Royal households pursue Ambassador of the House, Guardian of the House or Unifier of the House; estate households pursue Restorer of the Estate, Trusted Patron or Keeper of the Family Lands. A path requires an actual council service, three accepted duties across several years, maintained household conditions and a final recognition action. The two middle projects can fail, spend their budget and require two years before a retry. Recognition adds 5 drachmas to the household treasury each year. These are fictional household distinctions. They also develop practical skills; treasury-funded lessons and historical service opportunities let either class pursue the existing historical titles within their original dates and recognition odds.

New lives limit ordinary household contracts to 50 units per order and 100 total units per year. Roles with full market access can commit 100 units per order and 300 per year. Purchases and sales share that yearly allowance, including orders split across different goods. Cancelling a contract releases its allowance; completing the year renews it. At most eight contracts may be pending.

## Development

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

Original pixel/vector artwork, source geometry and editable native masters are retained with the project. These scenes are fictional illustrations, not archaeological reconstructions. Font copyright and SIL Open Font License notices remain under `public/fonts/`; the vendored Sites plugin retains its upstream license notice.

The approved **Printed Folktale** identity uses locally bundled Eczar 600 for the wordmark and headings, with DM Sans 500 at 16px for narrative text. The textured wordmark keeps its clay-coloured period. Transparent SVG/PNG logos, the font licence and rebuild sources are packaged in [the brand kit](artwork/branding/everfolk-printed-folktale/README.md).
