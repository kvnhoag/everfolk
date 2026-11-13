# How the art reaches a card

The **illustration**, **frame and card copy**, and **live edition data** are separate layers. Your replacement changes the illustration. Existing card identities, professions, biographies, ranks and edition caps come from the approved catalogue. Ownership and actual serial numbers come from the game.

| Layer | Artist-kit source | Result |
| --- | --- | --- |
| Art | Your opaque PNG, plus an optional separately finished standard-fit PNG | Portrait and fitted illustration |
| Frame | `frames/cards/ID-footerless.png` | Frame, sourced symbol, title, biography and rarity treatment |
| Preview serial | `frames/cards/ID.png` | Numbered example for review only |
| Live serial | Game component or 3D canvas | Real numerator/cap over the footerless image |

The manifest `data/cards.json` is the authoritative list of 117 immutable IDs. There are 13 main portraits and four contributor professions per figure, each represented by a man and a woman. Contributors are fictional professional representatives, not claims about documented historical individuals. `data/cards.csv` is the spreadsheet version; `reference/index.html` is an offline browser catalogue. All 117 individual generation briefs are in `briefs/`.

The 16 extra runtime parent frames serve retained records for Alexander, Aristotle, Euclid and Cleomenes at different recorded rarities. They use their parent's portrait and the appropriate frame/cap. They are not additional characters or collectible awards. A replacement of one of those parents includes the whole frame cohort automatically.

## What is inside a replacement bundle

`replacement.json` identifies the kit, artwork hashes, frame hashes and all derivative files. `webp/` contains lossless game files. `png/` contains full-resolution review and fitted layers. `editable/` contains SVGs with the new illustration embedded below the editable frame, symbols and text. `review.html` compares the old reference with the replacement; its reference thumbnails are included, so the review can be sent on its own. Optional `sources/ID-standard.png` retains the separately finished standard-fit illustration.

The renderer checks input dimensions, aspect ratio, opacity, frame fingerprints, uncovered artwork pixels, transparent outer corners and lossless export readback. `check --bundle` independently reconstructs the expected card from its portrait and the kit overlays and compares decoded pixels. This catches changes to semi-transparent as well as opaque frame pixels. It cannot judge whether an eye, hand, pose or historical detail is convincing; the artist and reviewer still inspect those.

The 592 × 740 standard fit and 840 × 1050 legendary fit cannot share a useful single logical pixel grid at integer scales. Supply separate finished sizes if a regular grid throughout the displayed illustration matters. Nearest fitting of only the larger asset is supported for compatibility, but the QA reports the fractional standard resample. Legendary side fields are atmospheric edge extensions, separate from the native-size central portrait.

## Maintainer integration

These paths refer to the game repository, not the portable kit:

| Responsibility | File |
| --- | --- |
| Current game artwork registry | `client/models/card-art-registry.json` |
| Portrait lookup, title aliases, recorded-rarity selection | `client/models/card-art.ts` |
| HTML card art and live edition text | `client/components/CollectionCardArtwork.tsx` |
| 3D card face and live edition | `client/lib/booster/card-face.mjs` |
| Approved editable frame generation | `artwork/cards/framed-collection-v14/source/frame-design.cjs` |
| Source-library WebP delivery | `scripts/sync-card-assets.mjs` |
| Replacement staging and installation | `scripts/import-card-art.mjs` |
| Active replacement merge and validation | `scripts/lib/card-art-replacements.mjs` |
| Versioned artist overrides, once installed | `artwork/cards/replacements/active.json` |

From the repository root, `node scripts/import-card-art.mjs --bundle DIR --version pixel-v1` validates the complete bundle and stages a candidate registry and review report under `artifacts/card-art-import/`. Inspect that report and the bundle's visual comparison. Add `--apply` to install the versioned files under `public/assets/cards/pixel-v1/`, store active overrides and switch the registry URLs. No production art is changed by merely building this kit or staging an import.

Partial batches are supported. Unchanged card records remain intact. Replacing a parent requires its matching runtime variants, which the renderer supplies. Subsequent `art:cards` source rebuilds reapply active overrides. Use a fresh version name for the next accepted batch, commit the versioned assets, active descriptor and registry together, and validate the app before publishing. Reverting that import commit restores its previous registry and active descriptor; retain older versioned files until no active row uses them.

The original v14 masters, artwork sources and review provenance remain in their versioned libraries. The kit's pre-rendered overlays make routine portrait replacement independent of VectorCraft and installed fonts. Frame or copy edits are a separate design revision: edit the live SVG or native master, install Source Serif 4 and Inter as needed, render new approved overlays and issue a new kit manifest. Never paint card text or emblems into an AI-generated portrait.

## PixelOE provenance

The optional Python helpers are copied from this project's existing Everfolk asset workflow. They invoke upstream PixelOE 1.0.0's legacy CPU outline/contrast pipeline, verify repeated renders, keep source hashes, and export QA. The observed runtime is Python 3.12.14, OpenCV headless 5.0.0.93, NumPy 2.5.4 and Torch 2.7.1+cpu. Package availability varies by platform; the native pixel workflow needs none of these packages. PixelOE's Apache 2.0 license is included. No AI credentials, generator subscription, model or Python runtime is bundled.
