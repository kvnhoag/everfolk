# Character creator

A standalone, local pixel character workshop. It uses the same modular renderer for all characters, including editable Alexander and Euclid presets.

```sh
node tools/character-creator/server.mjs
```

Open http://127.0.0.1:4173. No dependencies or account are required. Drafts and collections stay in browser storage; import/export JSON to transfer them.

Use Appearance, Clothing and Identity to customize a preset. Clothing includes classic, gold and jade finishes; Identity includes local scenery, a sunset palace and a night observatory. Historical appearances are artistic interpretations, particularly Euclid's, whose appearance is unknown.

Export transparent sprites, a three-view sheet, palettes or a composed 480×640 collectible card. Collectible styling is visual artwork; the workshop does not mint tokens or connect to a wallet. Hover shine respects reduced-motion preferences.

```sh
node --test tools/character-creator/tests/*.test.mjs
```

Example profiles and PNG exports are in `historical-figures/`. Sources for the presets are recorded alongside the configurations in `src/data.js`.

## Living Legacies NFT artwork

Read [DESIGN.md](DESIGN.md) for the enforced historical-frame rule, each figure's dedicated backdrop, and the face-diversity requirements. Historical identity remains fixed across tiers. Common and Uncommon have no gilded historical frame; Rare, Epic and Legendary progressively add historical ornament. Twelve editable face studies are included in `nft-collection/face-study.png` and `face-studies.json`.

Open `collection.html` on the workshop server to browse the collection, select a rarity/life-stage preview, inspect actual sprite layers, and open each profile in the editor. This gallery is independent of wallets and the ranked verifier.

```sh
node tools/character-creator/scripts/build-collection.mjs
node --test tools/character-creator/tests/*.test.mjs
```

Node.js 24+ is required for the collection build; it has no npm dependencies. The script reads the real figure/NPC action catalogs from `chain/` and copies the four figure cards/front sprites into `public/assets/figures/`, the paths already used by NFT reveal and market components.

`nft-collection/` contains ten art masters: Alexander, Aristotle, Euclid, Cleomenes, and representatives of letters, military, commerce, craft, sky, and performance. It includes:

- 480×640 collectible PNG cards and layered `.ora` card masters.
- 64×96 transparent front/side/back sprites, 3× exports, and three-view sheets.
- Transparent PNG paint layers per view and `.ora` sprite masters. Layer order is recorded in `manifest.json`; layers retain hidden pixels rather than being cut from a flattened image.
- Five rarity previews per character, each with a PNG, layered card, matching background and importable version-1 JSON profile.
- Twenty distinct historical life-stage backgrounds, a five-column progression sheet, contact sheets and a complete ZIP.

The 12 character passes, bottom to top, are legs/feet, rear cloak, body/base garment, arms/sleeves, outer garment/footwear, garment trim, head/neck, hair, face, beard, jewelry, and prop/grip. Empty optional passes are omitted from exported stacks. A card adds landscape below and frame/lettering above the same character passes. All sprites use the existing modular pixel painter; collection lettering uses an embedded bitmap alphabet so exports are deterministic without system fonts.

Visual choices follow the catalog's role and actions: Alexander has the Macedonian armour/spear; Aristotle has the scholar's beard, himation and scroll; Euclid carries geometric demonstrations; Cleomenes carries a grain sack and wheat. NPCs carry the tools of their catalog careers. These are artistic interpretations, not verified historical likenesses.

Rarity is decided by the game. The five life-stage previews do not assign a rarity, mint a token, set Affection, or allocate the five-copy historical-figure supply. NPC portraits are representative art profiles, not portraits of real players. Each manifest entry records its source description and action IDs.


## Rarity life stages

Use the five-tier selector in the collection or the “NFT rarity preview” control in the creator's Identity tab. Each historical figure keeps the exact same character while the setting progresses from a modest beginning to an exceptional institution or palace. Gallery downloads and editor links retain the selected tier.

- Alexander: field camp, officer quarters, command pavilion, general headquarters, royal palace. No flags or banners appear.
- Aristotle: humble study, private study, teaching courtyard, Lyceum complex, court library.
- Euclid: sand-tray courtyard, geometry workroom, geometry school, Museum hall, grand library.
- Cleomenes: market storehouse, merchant warehouse, revenue office, administrator residence, treasury hall.

Stargazer uses an ordinary local daytime background at every tier. Other NPC settings stay ordinary as well. `nft-collection/historical-progression.png` presents the full 4×5 art direction. The source of truth for stage names, descriptions and scenery is `src/historical-stages.js`.
