# Everfolk card collection v14

117 cards: 13 main figures and 52 contributor professions, each with male and female art. Every figure now has Common, Uncommon, Rare and Epic subcards. This revision adds 34 new illustrations, including all 26 Common variants and eight lower-tier Nearchus/Eumenes variants. The 83 existing illustrations and their approved portrait fits are preserved.

Open `review/index.html` for the complete offline gallery. Finished transparent PNGs are in `exports/` at 900 × 1260. Each card has a native editable `masters/<slug>.vectorcraft` and a self-contained live-text SVG in `source/cards/`. Typography uses Source Serif 4 and Inter.

## Card language and layout

Main cards have a profession or historical identity as their subtitle, a figure-specific emblem, a short epithet and a concise biography. Subcards have a profession as the card title, a relational title below it, and a short paragraph that brings together their responsibilities and the value of their work. Both gender variants share the same prose. Existing long gameplay titles are retained as `canonicalTitle` in the catalogue; the card face sometimes uses a shorter `displayTitle` for readability.

The removed labels—Historical Figure, Player Contribution, Art Preview and gender labels—do not appear on the card faces. Footers use the requested example numbering: `001/010`, `001/025`, `001/100`, and `001/∞` for unlimited Common/Uncommon cards. Numerators are display examples, not records of issued ownership.

## Rarity system

- Common: plain iron, a single border and square corner joints.
- Uncommon: forest green, antique bronze, paired borders and leaf corners.
- Rare: silver-blue, faceted gems and chamfered brackets.
- Epic: amethyst and gold, interlaced corner ornaments and jewel rails.
- Legendary: full art, gilded perimeter, a radiant rank cartouche and a larger figure emblem.

The 13 emblems are professionally drawn internet-sourced symbols: 12 Game-icons.net designs by Lorc and Delapouite (CC BY 3.0) and Google's filled drafting compass for Euclid (Apache 2.0). The original SVGs, author links, licenses and source hashes are retained in `source/icons/` and `source/icon-sources.json`. Only the full-canvas background is removed and the glyph is tinted to the card palette. These are design associations, not attested personal insignia. The artwork is a fitted bitmap; the frame paths, sourced emblems, ornaments and live type remain editable in each native master.

## Artwork and verification

Standard cards retain the complete portrait at 592 × 740, sampled with nearest neighbour and placed in a rarity-coloured inlay within the approved 800 × 740 opening. Legendary portraits retain their original 840 × 1050 pixels at native size. New artwork follows the existing painterly direction and mixed PixelOE finish: 3 px body with 2 px face detail.

Use the PNG exports for the crisp production finish. Final PNGs combine fitted pixels with the transparent frame/type overlay exported by VectorCraft. Each native master is saved, closed, reopened and exported again. QA checks source hashes, all 52 gender pairs, copy and edition strings, native text bounds, information-panel bounds, original fitted pixels, uncovered compositing pixels and transparent corners.

Historical sources and evidence boundaries are in `source/research.md`; the copy is in `source/card-copy.json`. Generated sources, prompts and pixel QA are in the sibling `figure-inner-art-v14` library. Its `review/reference-comparison.html` shows the actual painting inputs beside each new source and PixelOE result. New Common roles and lower Nearchus/Eumenes tiers are editorial collection additions; gameplay code and promotion gates are unchanged. Existing five Legendary/eight Epic main-card base ranks are preserved.

The portable ZIP includes the framed library, its live SVGs and native masters, the new illustration library, and the existing inner-art PNGs needed by the gallery. Gallery previews and inner-art links therefore work after extracting the top-level directories together.
