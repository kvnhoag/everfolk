# Everfolk — selected frames with set numbering

The bottom-right catalogue label now uses **001/025**: card 1 in a 25-card set. The total 025 is a layout placeholder until the set size is decided. This is a set catalogue number, not a print-run serial. Both standard and legendary layouts use the same format; the footer divider is shortened to preserve space around the wider label. This version preserves the earlier VectorCraft master separately.

The user selected the original paired standard / legendary concept on 13 November 2026. The exact reference is preserved in source/selected-reference.png. This version rebuilds its borders, divider lines, corner laurels and upper-right wreath as smooth native VectorCraft geometry. The earlier frame variants remain unchanged.

## Files

- masters/Everfolk-Selected-Frames.vectorcraft — native master, two 900 × 1260 artboards with independent geometry groups and live type.
- exports/standard-frame.svg and exports/legendary-full-art-frame.svg — reusable vector overlays without card text.
- Matching *-frame.png — transparent 900 × 1260 overlays.
- *-layout.svg — predictable outlined typography; *-layout-live.svg — live type.
- *-layout.png and *-layout-2x.png — transparent layout exports at 900 × 1260 and 1800 × 2520.
- review/Everfolk-Selected-Frames.png — full side-by-side proof with native gradient artwork placeholders.
- review/Everfolk-Selected-Frames-1060.png — the same proof with cards displayed at 450 × 630.
- review/Everfolk-Selected-Frames-Proof.vectorcraft — editable review-board document.

## Geometry and usage

Standard: jade body, three concentric bronze/gold rules, 800 × 740 transparent artwork aperture at x50/y190, and an independent ivory information panel. The nested border corner centres coincide at x48/y48 and its reflected equivalents; the radii are 30, 23 and 16 at offsets 18, 25 and 32. The formerly hard chamfer joins have short smooth curves.

Legendary: artwork underlays the entire 900 × 1260 card. A single 1.5 px gold rule, small mirrored sprigs and a laurel wreath sit over the artwork. Top/bottom readability fills remain translucent; there is no opaque outer mat or description panel. Clip the artwork underlay separately to the 42 px outer card corner radius if rounded card trim is required.

The native master separates body, borders, corner ornaments, readability, editable type and footer. The repeated sprigs are mirrored copies of the same cubic Bezier geometry. Artwork is not embedded in the production master. Placeholder names and copy remain editable. The reference's small wreath and uppercase serif EVERFOLK footer are retained; the earlier provisional scarab substitution is not used.

Fonts resolve exactly in VectorCraft: Source Serif 4 Regular and Inter Regular/Medium. The native master and live SVGs need those fonts to edit or render live type. Outlined SVGs preserve its appearance as vector paths.

These are digital frames with no print bleed. Card art, gameplay rules and additional rarity tiers are not introduced by this work.

## Verification and reproduction

qa/native-build.json records the native VectorCraft authoring, exact fonts, zero raster images, zero warnings and byte-identical PNG exports after closing and reopening the native master. qa/export-validation.json records dimensions, trim-corner alpha and complete transparency in the central artwork fields. Full-resolution and card-size proofs were visually inspected.

Rebuild using the installed ArtCraft MCP helper and VectorCraft CLI:

    node artwork/cards/frame-system-v3-numbered/source/build-frames.cjs
    node artwork/cards/frame-system-v3-numbered/source/verify-exports.cjs

No dependency installation is required. The helper closes every task-owned headless process after export. Source artwork, app code and earlier masters are preserved.
