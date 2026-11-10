# Everfolk · Living Legacies — design rules

## Historical figures require exclusive frames

1. Every historical figure must have a `state.figure` matching its catalog ID. The renderer retains this identity when importing JSON or opening a profile in the editor; changing an outfit does not turn a historical figure into an NPC.
2. Never use the NPC frame for a historical figure. NPCs use the restrained `citizen` frame. Historical frames require a distinct architectural structure: carved gold uprights, a stepped cornice and a recognizable crest above the portrait.
3. Each historical figure has a dedicated frame design and background, rather than a recolor of another figure. Rules are declared in `src/historical-frame.js` and checked before exporting the collection.
4. Historical frames must convey rarity, luxury and mystery through obsidian or onyx tones, chased gold, faceted gemstones, crests and restrained highlights. Keep each figure's individual emblem clearly visible.
5. Common–Legendary artwork variants progressively increase gemstone count, engraving density and highlights. Historical structure and identity crests remain present at every tier. The original artwork is not a minted rarity assignment; frame color does not assign a token's rarity or supply.

## Scope and atmosphere of historical backgrounds

- Only the four historical backgrounds and historical frames receive this treatment. Preserve the backgrounds, frames, portraits and rarity artwork of all six NPC career groups when changing historical art direction.
- Use rich twilight palettes: royal blue and gold for Alexander, amethyst and bronze-gold for Aristotle, celestial blue and aquamarine for Euclid, and emerald with antique gold for Cleomenes.
- Give backgrounds depth through dark architecture, reflected highlights and fine celestial rings behind the figure. Keep luminous particles sparse and peripheral; faces and props must remain readable.
- Create mystery through color, light and ornament while retaining each figure's occupational setting and catalog actions. Do not replace all four environments with the same gate or palace.
- Preserve crisp sprite pixels. Effects must not obscure faces, names or props, or invent minted serial numbers, rarity assignments or token IDs. Avoid flooding the entire background with gold and weakening frame contrast.

## Four art directions

- **Alexander — `royal-laurel`:** carved laurel leaves and a spear crest; a coastal city under construction, scaffolding and Macedonian banners. The setting follows the commander role and the catalog's “Found and build” action; it is not an archaeological reconstruction.
- **Aristotle — `lyceum-scroll`:** scroll capitals and a manuscript crest; a Lyceum garden with a colonnade, olive trees and reading places. Use a long face, deep-set eyes, a long nose and a thoughtful expression.
- **Euclid — `museum-geometry`:** square geometric relief and a triangle crest; a geometry courtyard with scroll shelves, diagrams and a demonstration table. Keep the geometric prop distinct from a philosopher's scroll.
- **Cleomenes — `granary-wheat`:** wheat relief and a grain crest; waterfront granaries, grain sacks and a trade balance. Use a soft build, heart-shaped face, deep-set eyes and a stern expression. Do not portray him as a king or warrior.

## Facial diversity

- Support six genuinely different head shapes: round, oval, square, long, heart and diamond.
- Provide six eye styles, four eyebrow styles, five nose styles and six expressions. Every option must change actual pixels, rather than only changing a UI label.
- Distinguish identities through more than skin, beard or clothing color. Each original profile has an authored combination of head shape, eyes, nose, eyebrows and expression in `src/nft-collection.js`.
- Faces must remain readable at the native 64×96 sprite resolution and in all three views. Skin, features and clothing retain the creator palette; environments and frames may use their own art-direction palettes.
- `nft-collection/face-study.png` and `face-studies.json` contain twelve editable face studies. They are art profiles, not twelve additional NFT types.

## Artwork delivery rules

- Use integer pixels and nearest-neighbor scaling. Maintain consistent body proportions and lighting from the upper left.
- Separate the landscape, character paint passes, historical frame and lettering. Every `.ora` must reconstruct the delivered PNG exactly, pixel for pixel.
- Frames must not obscure faces, props or names. Place the crest above the portrait and the uprights outside the sprite area.
- Export each profile's background separately as `<id>/background.png`.
- Portraits are artistic interpretations. Do not claim they reproduce a historical figure's verified appearance.
- Take names, descriptions, actions and supply caps from `chain/`; do not invent mint data, Affection values or probabilities in the artwork.

## Language

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
