# Everfolk — rarity editions

The rarity limits supplied on 13 November 2026 are applied to the card templates as edition caps per card:

| Rarity | Maximum copies per card | Example footer | Layout |
| --- | ---: | --- | --- |
| Legendary | 10 | 001/010 | Full art |
| Epic | 25 | 001/025 | Standard |
| Rare | 100 | 001/100 | Standard |
| Uncommon | Unlimited | UNLIMITED | Standard |
| Common | Unlimited | UNLIMITED | Standard |

This interprets the supplied limits as copies of each card, rather than the number of distinct card designs in each rarity. The finite numerator is an example copy number. Common and Uncommon have no finite denominator, and the onchain mint logic still assigns each copy a sequential number. This version applies the later request to make Uncommon unlimited and raise Rare to 100.

The selected jade-and-bronze vector style is retained. Rarity labels appear on the standard information panels. Legendary keeps the uninterrupted full-card artwork underlay and its lighter border. No additional rarity colours or different ornament systems are introduced.

## Files

- masters/Everfolk-Rarity-Frames.vectorcraft — native master with five 900 × 1260 artboards, live type and editable border/ornament groups.
- exports/{rarity}-frame.svg and matching PNG — transparent overlays without card text.
- exports/{rarity}-layout.svg — outlined text; {rarity}-layout-live.svg — live editable text.
- PNG layout exports at 900 × 1260 and 1800 × 2520.
- review/Everfolk-Rarity-Frames.png and the smaller *-1570.png — five-card visual proof.
- review/Everfolk-Rarity-Frames-Proof.vectorcraft — native editable proof with vector-gradient artwork placeholders.
- rarity-editions.json — the five limits and display convention. Unlimited is represented by a null limit.
- source/selected-reference.png — the original selected concept; earlier versions remain preserved.

The saved configuration and artwork specify edition labels. They do not issue cards or enforce caps in the game's backend.

## Verification

The native master was saved, closed, reopened and re-exported with identical PNG results for all five artboards. Source Serif 4 and Inter resolve exactly. There are no raster images in the production master, no app warnings, and central artwork fields remain fully transparent. Footer labels fit the reserved space. The five-card proof was visually reviewed.

Rebuild using the installed VectorCraft CLI and ArtCraft MCP helper:

    node artwork/cards/frame-system-v5-limits/source/build-frames.cjs
    node artwork/cards/frame-system-v5-limits/source/verify-exports.cjs

The helpers close their task-owned processes when finished. These are digital exports without print bleed.
