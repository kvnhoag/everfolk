# Everfolk · Living Legacies — design rules

## Rarity follows a life-stage progression

1. The five artwork tiers are Common, Uncommon, Rare, Epic and Legendary. A historical figure has a distinct setting at every tier. Change the background architecture, scale, props and atmosphere, rather than merely recoloring one scene.
2. Keep the character exactly the same across all five tiers: face, body, age, hair, skin, outfit, pose and handheld prop. Rarity progression is expressed by the setting and frame, not by repainting the person.
3. Common must read as an ordinary early-life setting. Use the same restrained card treatment as a civilian: no historical gold uprights, gemstones, crest or supernatural halo. Uncommon remains modest and has no gilded historical frame.
4. Rare introduces an established professional setting and the first carved historical frame. Epic uses an imposing headquarters, residence or institution, with richer carving and gemstones. Legendary uses an exceptional palace or grand scholarly institution, with the most elaborate historical frame and restrained mystical highlights.
5. Every historical figure retains a catalog identity (`state.figure`). Their exclusive frame family appears only from Rare onward. Frame identity is independent of rarity; it does not require displaying gold decoration at Common.
6. These settings are fictional visual chapters, not a dated biography or proof of a historical figure's wealth. Artwork previews do not mint tokens, assign a real rarity or allocate the five-copy figure supply.

## Five settings for each figure

- **Alexander:** Field camp → Officer quarters → Command pavilion → General headquarters → Royal palace. Common begins at a simple tent; Epic reaches a large command residence; Legendary is a lavish ceremonial palace. No flags, banners or flagpoles may appear at any tier.
- **Aristotle:** Humble study → Private study → Teaching courtyard → Lyceum complex → Court library. Scholarly influence is expressed through reading space, manuscripts, lecture colonnades and institutional prestige.
- **Euclid:** Sand-tray courtyard → Geometry workroom → Geometry school → Museum hall → Grand library. Use geometric demonstrations, diagrams, shelves and a monumental scholarly setting; do not turn Euclid into a ruler.
- **Cleomenes:** Market storehouse → Merchant warehouse → Revenue office → Administrator residence → Treasury hall. Grain, records and trade balances remain the visual theme. A grand administrative palace does not make the character a king.

The source of truth is `src/historical-stages.js`. The export manifest records the stage title, description, background, layered card and importable profile for every rarity preview.

## Scope and atmosphere

- The four historical figures receive the five-stage background progression. Other NPC backgrounds remain ordinary. In particular, Stargazer of Alexandria uses the local daytime landscape at every tier, not the night observatory.
- Keep rich but readable historical colors at higher tiers: royal blue and gold for Alexander, amethyst for Aristotle, aquamarine for Euclid, emerald and antique gold for Cleomenes.
- Use clear daylight and restrained everyday materials at Common/Uncommon. Architectural scale and atmosphere must rise visibly through Rare and Epic into Legendary.
- Restrict celestial rings and luminous particles to Rare and higher. Keep highlights sparse and peripheral. Faces, names and props must remain unobscured.
- Preserve crisp pixels and the existing creator renderer. Keep landscapes, character paint passes, historical ornament and lettering in separate layers.
- Historical and NPC card previews must use the background matching the selected rarity. Gallery downloads and “Edit in creator” must preserve that same tier.

## Facial diversity

- Support six genuinely different head shapes: round, oval, square, long, heart and diamond.
- Provide six eye styles, four eyebrow styles, five nose styles and six expressions. Every option must change actual pixels, rather than only changing a UI label.
- Distinguish identities through more than skin, beard or clothing color. Each original profile has an authored combination of head shape, eyes, nose, eyebrows and expression in `src/nft-collection.js`.
- Faces must remain readable at the native 64×96 sprite resolution and in all three views. Skin, features and clothing retain the creator palette; environments and frames may use their own art-direction palettes.
- `nft-collection/face-study.png` and `face-studies.json` contain twelve editable face studies. They are art profiles, not twelve additional NFT types.

## Artwork delivery rules

- Use integer pixels and nearest-neighbor scaling. Maintain consistent body proportions and lighting from the upper left.
- Separate the landscape, character paint passes, historical frame and lettering. Every `.ora` must reconstruct the delivered PNG exactly, pixel for pixel.
- Frames must not obscure faces, props or names. Where historical ornament is present (Rare and higher), place the crest above the portrait and uprights outside the sprite area.
- Export each profile's base/Common background as `<id>/background.png`, and tier-specific backgrounds as `<id>/background-rarity-<index>.png`. Include layered cards and JSON profiles for all five tiers.
- Portraits are artistic interpretations. Do not claim they reproduce a historical figure's verified appearance.
- Take names, descriptions, actions and supply caps from `chain/`; do not invent mint data, Affection values or probabilities in the artwork.

## Language

- Communicate with the project owner in Vietnamese. All delivered products, documentation and reports remain in English.

- All project-authored interface copy, accessibility labels, option names, descriptions, notifications, prompts, exported profiles, documentation and reports must be in English.
- Generated copies of this document and text files inside the downloadable ZIP must use the same English content as their sources.
- Use English text in image exports and sample cards. Preserve stable IDs, file routes, source URLs, contract identifiers and third-party license notices.
- Keep player-authored names and stories intact. Do not silently rewrite a player's saved character during an interface-language update.

## Pre-delivery verification

```sh
node tools/character-creator/scripts/build-collection.mjs
node --test tools/character-creator/tests/*.test.mjs
python tools/character-creator/scripts/verify-collection.py
```

The independent Python verifier requires Pillow. Inspect the contact sheet, face studies and browser gallery after exporting, and audit report/documentation files together with generated JSON and archive contents for untranslated authored text.
