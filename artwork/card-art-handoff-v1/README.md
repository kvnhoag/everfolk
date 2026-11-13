# Card art handoff kit

Replace the collection's illustrations with pixel art and render them inside the approved frames. You can work in any pixel editor or image generator. The kit keeps the frame, symbols and card copy separate from your illustration.

Start with [artist quickstart](docs/artist-quickstart.md), [ten prompt templates](docs/prompt-templates.md), the [offline reference gallery](reference/index.html) and the [card inventory](data/cards.csv). `data/cards.json` is the machine-readable inventory. The historical main portraits retain their identities; the male/female contributor portraits are fictional representatives of the same professions.

There is an [individual drawing brief for every card](briefs/) and a [system map](docs/system-map.md) explaining how the illustration reaches the game. The three original user-supplied composition and armour references are preserved in `reference/brief/`.

## Install and inspect

Use **Node.js 24**. From this extracted kit folder:

```powershell
npm install
node tools/card-art.mjs verify-kit
node tools/card-art.mjs list
node tools/card-art.mjs list --figure alexander --kind contribution --rarity common --gender female
```

The renderer uses the pinned `sharp` 0.35.5 dependency. Python and PixelOE are optional; they are not needed to draw native pixel art or render a ready PNG.

To try the whole fitting workflow using the included approved art, run `node examples/reproduce-baseline.mjs --out output/example-v1`, then open `output/example-v1/review.html`. This creates two main catalogue renderings and Euclid's four additional runtime rarity frames without requiring any new artwork.

PNG compositing uses the supplied transparent overlays and needs no font installation. To edit the SVG typography, install **Source Serif 4** and **Inter**. Inter's WOFF2 and license are bundled; Source Serif 4 is not bundled. Official source links and font details are in `licenses/fonts/fonts.json`.

The catalogue has **117 designs**: 13 main figures plus 52 professions × two genders. It includes 34 newer v14 illustrations and 83 retained approved v12 illustrations. There were originally 16 main-card rarity-frame variants used by saved game/contract records; they reuse four existing main portraits, not 16 extra paintings.

## Prepare two art-only fitting assets

The main portrait is an **opaque 840 × 1050 PNG**. It is also the Legendary full-art source. For strict pixel-grid preservation in the standard frame, supply a second matching illustration at **592 × 740**. Keep both art-only: no frame, text, rarity label, symbol, edition number or watermark.

| Input mode | Main `--art` | Optional `--standard-art` |
| --- | --- | --- |
| `finished` — default | 840 × 1050 | 592 × 740 |
| `native-pixel` — exact integer enlargement | 420 × 525, 280 × 350, 168 × 210, or 140 × 175 | 296 × 370 or 148 × 185 |

Use 8-bit RGB or fully opaque RGBA PNGs. Arbitrary dimensions and meaningful transparency are outside this input contract. Draw at your chosen logical size and keep the editable source. The 280 × 350 ×3 and 420 × 525 ×2 presets are good starting points; choose based on readable eyes, hands and tools at card size.

The standard aperture displays the full portrait at 592 × 740, with coloured side inlays in an 800 × 740 opening. If you omit `--standard-art`, the tool fits the 840 × 1050 image using nearest-neighbor sampling. That preserves sharp edges but is **not an integer grid scale**; QA identifies the resample. A separately finished standard image avoids this compromise without changing the existing frame geometry. The two art versions should preserve the same identity, role and scene.

Legendary artwork is placed at native 840 × 1050 size. Its title and lower biography overlay the painting. Review the actual frame early so that the head, grip, sword point and key tool remain visible.

## Render one replacement

Create an `incoming` folder and put your ready art there. These examples run from the kit root; paths can also be absolute.

```powershell
node tools/card-art.mjs render --id alexander-common-female --art incoming/alexander-common-female.png --standard-art incoming/alexander-common-female-standard.png --out output/first-pass
node tools/card-art.mjs check --bundle output/first-pass
```

For native logical-resolution sources:

```powershell
node tools/card-art.mjs render --id aristotle-epic-male --art incoming/aristotle-epic-male-280x350.png --standard-art incoming/aristotle-epic-male-296x370.png --mode native-pixel --out output/scholar-v1
```

For a main portrait:

```powershell
node tools/card-art.mjs render --id euclid-parent --art incoming/euclid-parent.png --standard-art incoming/euclid-parent-standard.png --out output/euclid-v1
```

Replacing a retained main portrait also rebuilds that figure's other rarity-frame variants. This keeps its recorded-rarity appearance consistent. Other main portraits have no additional runtime variants to rebuild.

Render outputs contain a complete PNG/WebP derivative set and `replacement.json` metadata. Keep the output together. Use a new output folder for each reviewable version; preserve the original baseline. The numbered full-card image uses example numerator **001** only. The **footerless** image is for a live owned-card view, which draws the actual recorded edition separately.

## Render a batch

Copy and edit `examples/replacements.json`. Each `art` and `standardArt` path is relative to the batch JSON file, not to your terminal's working directory.

```json
{
  "schemaVersion": 1,
  "art": [
    {
      "id": "alexander-common-female",
      "art": "../incoming/alexander-common-female.png",
      "standardArt": "../incoming/alexander-common-female-standard.png",
      "mode": "finished"
    },
    {
      "id": "aristotle-epic-male",
      "art": "../incoming/aristotle-epic-male-280x350.png",
      "standardArt": "../incoming/aristotle-epic-male-296x370.png",
      "mode": "native-pixel"
    }
  ]
}
```

```powershell
node tools/card-art.mjs batch --manifest examples/replacements.json --out output/pixel-v1
node tools/card-art.mjs check --bundle output/pixel-v1
```

Start with a few representatives: a Legendary main portrait, a Common contributor and a hand/tool-heavy Epic contributor. Check both gender variants and several face angles before commissioning all 117 replacements.

## Optional painterly source → PixelOE

A native pixel artist can skip this section. For an AI-assisted route, save the original source painting and exact prompt, correct anatomy/equipment, then convert. The supplied `tools/pixelate.py` and `tools/pixelate_regions.py` require Python and external packages listed in `tools/pixel-requirements.txt`. The package list is pinned for reproducibility; dependency installations are not bundled.

Install those packages into a separate environment or target directory using your normal Python tooling. Pass the directory containing the installed packages as `--runtime`. For example, from the kit root:

```powershell
python -m pip install --target .pixeloe-runtime -r tools/pixel-requirements.txt
python -m pip install --target .pixeloe-runtime --no-deps pixeloe==1.0.0
python tools/pixelate.py --input incoming/source-painting.png --output output/euclid-conversion/euclid-parent.png --runtime .pixeloe-runtime --logical-width 420 --logical-height 525 --scale 2 --qa output/euclid-conversion/pixel-qa.json
```

Review the logical PNG, enlarged PNG and QA before framing. Conversion expects an opaque source already composed in 4:5; do not rely on a conversion to repair a stretched body or wrong sword grip. A separate 296 × 370 ×2 conversion can provide the standard-fit source, with its own QA and visual review.

The current art uses an optional mixed **3 px body / 2 px face** finish. Regional detail needs the original painting, verified coarse PNG and its QA, plus a region config measured for that particular face. `python tools/pixelate_regions.py --help` documents the exact input/config flags. Keep the binary mask and provenance, and review the transition. Do not copy another portrait's face coordinates.

PixelOE is a real outline/contrast-aware process. A nearest-neighbor mosaic of a painting is only a nearest preview; do not label it PixelOE. Finished native pixel art needs only exact integer enlargement and no conversion pass.

## Hand back to the repository maintainer

Send the complete output bundle, ready PNGs, editable native pixel file or original painting, reference credits, prompt and actual conversion settings/QA. The kit alone does not change game rules or publish a site.

From the **game repository root**, a maintainer prepares an import using a fresh version name:

```powershell
node scripts/import-card-art.mjs --bundle PATH_TO_REPLACEMENT_BUNDLE --version pixel-v1
```

Review the staged assets and registry change, then install that prepared replacement with:

```powershell
node scripts/import-card-art.mjs --bundle PATH_TO_REPLACEMENT_BUNDLE --version pixel-v1 --apply
```

The import installs versioned outputs and updates the active manifest. Keep the approved baseline. Do not replace isolated files under `public/assets/cards/collection-v14/`: public WebP files, thumbnails, portraits, footerless versions, hashes and runtime frame variants must stay in agreement.

Keep card IDs, figure identity, role, gender, copy, rarity and edition limits intact during an art replacement. Do not infer gender from a name, replace a saved custom portrait, award a new contributor card or resolve a historical promotion gate. Actual NFT serials and ownership remain runtime data, never part of the painting.

The frame's professionally drawn symbols and their licenses/credits remain separate assets. Preserve attribution when distributing the system. Main biographies and contributor copy are English; a contributor paragraph describes a profession, its duty and its value as connected prose. No “Player Contribution,” “Art Preview,” generic “Historical Figure” subtitle or gender label belongs on the card face.

The runtime set now includes 19 alternate parent frames: the 16 retained onchain variants plus full-art Legendary promotions for Demetrius, Zeno and Ptolemy. Each promotion reuses its approved main portrait; no additional illustration is required.
