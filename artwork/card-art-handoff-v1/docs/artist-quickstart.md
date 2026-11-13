# Replace an illustration and keep its card

You provide **one art-only PNG for an existing card ID**. The kit places it behind the approved frame, title, symbol and biography. Use any image generator or pixel editor you prefer. No wallet or game checkout is needed to review a replacement.

## First replacement

1. Open `reference/index.html` and `data/cards.csv`, or run `node tools/card-art.mjs list`. Pick one exact ID, such as `euclid-parent`, `alexander-common-female` or `aristotle-epic-male`. Read its profession, copy, current illustration and frame before drawing.
2. Choose a finish: draw at **280 × 350 and enlarge ×3**, or **420 × 525 and enlarge ×2**, using nearest-neighbor enlargement. Both produce **840 × 1050**. Use one deliberate finish across a series. The current baseline uses real PixelOE with a **3 px body / 2 px face mixed finish**.
3. Save a fresh working version. Keep the approved baseline intact. Collect the approved face/scene reference and the correct character's equipment reference. Record the source, credit and any deliberate interpretation or exaggeration.
4. Deliver an **opaque 840 × 1050, 8-bit PNG**, with the illustration only. For a strict standard-frame pixel grid, also prepare a matching **592 × 740** illustration. Include no frame, icon, card text, edition number or watermark. Keep your editable pixel file too.
5. Render the exact ID into a new output folder using the example below. Review the full-card preview, footerless version and portrait. Use the batch workflow once a few representative cards pass review.
6. Return the ready PNGs, editable source, reference/prompt notes and generated review output. A maintainer uses `scripts/import-card-art.mjs` in the game repository to update versioned production images and their registry together. Do not edit public WebP files directly.

From the kit root, after installing its dependencies:

```powershell
node tools/card-art.mjs render --id alexander-common-female --art incoming/alexander-common-female.png --standard-art incoming/alexander-common-female-standard.png --out output/first-pass
node tools/card-art.mjs check --bundle output/first-pass
```

Omit `--standard-art` only if you accept the standard frame's nearest-neighbor resample. See the [kit README](../README.md) for installation, native-pixel inputs, batch rendering and repository import. The [prompt templates](prompt-templates.md) cover ten different illustration briefs.

## Ready PNG or AI-assisted source

**Pixel artist:** finish the image in your pixel editor, enlarge by the chosen integer scale, export the ready PNG, and render it. Alternatively pass a native logical PNG with `--mode native-pixel`. The main image accepts 420 × 525, 280 × 350, 168 × 210 or 140 × 175; a separate standard image accepts 296 × 370 or 148 × 185. The tool enlarges each by an exact integer factor to its required dimensions. No PixelOE conversion is required. Keep purposeful clusters and readable pupils, hands and tools; do not smooth the result.

**AI-assisted:** generate or edit a clean painterly source, then correct the face, anatomy and equipment. Apply an actual PixelOE conversion if you want that finish, or hand the source to a pixel artist. A nearest-neighbor reduction is only a nearest preview, not a PixelOE conversion. Retain the source painting and actual settings/QA. A mixed face-detail pass needs regions measured for the new image; do not reuse another character's face coordinates.

## Compose for the frame

The card canvas is **900 × 1260**. Common through Epic cards show the complete portrait at **592 × 740**, placed at `(154,190)` in the larger coloured opening. They do not crop the figure to force a landscape fit. Without `--standard-art`, the 840→592 nearest resize is not an integer pixel-grid scale and QA reports it. Prefer a matching, separately finished 592 × 740 standard image to preserve deliberate pixel clusters in that frame. Both fitting assets should show the same character, role and composition.

Legendary cards show the **840 × 1050** portrait at native size at `(30,140)`. The top title and lower biography overlap the painting. Put the head, important hand and key tool in clear space, and quieter atmosphere behind the lower text. Use the real overlay to check visibility. Keep a long blade fully readable, with a believable grip and blade rotation.

## Preserve these decisions

| Art can change | Preserve while replacing art |
| --- | --- |
| Composition, painted lighting, pixel clusters and scene detail | Exact card ID, main figure, profession, gender and saved rarity |
| Contributor's distinct face and face angle | Historical main portrait identity and appropriate character references |
| Clothing/equipment details supported by the brief | Frame, sourced symbol, card prose and edition policy |
| Versioned working files | Approved baseline and production registry consistency |

The roster has **117 designs**: 13 main portraits plus 52 professions × two genders. There are another **16 runtime rarity-frame variants**, using four existing main portraits, which need no separate painting. V14 contains 34 newly made illustrations and preserves 83 earlier approved ones.

Contributor portraits represent fictional game professions. Both genders should look capable and appropriately equipped for the same job. Vary faces and angles across the roster; do not turn every contributor into the parent figure. Lower military tiers use plainer kit, not the commander's decorative set. Match the supplied character reference; do not lift armour from another named character.

## Five frame treatments

| Rarity | Recognition | Preview number |
| --- | --- | --- |
| Common | Plain iron, single border, square joints | `001/∞` |
| Uncommon | Green/bronze, paired borders, leaf corners | `001/∞` |
| Rare | Silver-blue, gems, chamfer brackets | `001/100` |
| Epic | Amethyst/gold, interlaced corners, jewel rails | `001/025` |
| Legendary | Full art, gilded edge, radiant rarity cartouche, large emblem | `001/010` |

These preview numbers are examples. The game uses the **footerless** image and draws the actual recorded edition live. Your painting must never contain a serial or ownership claim. Changing a picture does not grant an award, change rarity, alter mint limits or resolve a historical promotion condition.

## Check before delivery

- The main PNG is opaque and exactly 840 × 1050, or an accepted native size with explicit `native-pixel` mode. A dedicated standard fit is 592 × 740, or its accepted native size.
- The historical main face remains recognizable; contributor faces and angles vary.
- Pupils and gaze are readable at card size. Each shoulder, elbow, wrist and hand connects naturally.
- Fingers wrap the grip, thumb opposes fingers, and sword edge/guard/rotation agree with the wrist. Reins and tools are held accurately too.
- Equipment matches the correct reference, period and profession. Any longer blade or heightened movement is recorded as deliberate exaggeration.
- No magnetic compass, sextant, modern bound book or feather quill has slipped into an ancient scene.
- The actual framed preview keeps the head, hands and key prop clear of text and ornaments.
- Pixel finish is honestly labelled; reference credits, editable source and prompt/conversion notes are included.

The supplied frames, live copy, sourced icons and icon licenses remain part of the handoff. The symbols are visual associations rather than attested ancient personal badges. Keep their credits with any redistributed card system.
