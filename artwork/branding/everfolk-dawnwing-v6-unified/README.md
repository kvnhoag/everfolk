# Everfolk — Dawnwing connected scarab

This revision corrects the leg spacing and the separation between the upper winged form and lower body. It introduces a restrained colour palette while keeping the scarab and the full Everfolk. name independently usable.

## Structural corrections

- Front leg roots sit near y118, middle roots near y146 and rear roots near y170 in the 256-unit source geometry. The origins are separated by roughly 25–30 units, rather than the previous long gap between the front and middle pairs.
- The raised forelegs are shorter, ending around y74 rather than y43.
- A continuous dark core joins the crown head, thorax and full oval shell. Colour boundaries separate the plates; there is no transparent gap across the body.
- Both wings overlap behind the same compact shoulders. Their roots converge into the thorax and upper shell.
- Gold and clay wing details follow the same outward sweep. Their inner ends are curved, and the outer wing tips remain pointed.

## Colour

The core and outlines use deep green `#214942` / `#203f3b`; the thorax uses muted jade `#4e7c67`. The paired wing cases use warm gold `#ddc383` and `#b89c64`; the crown uses warm clay `#dfad79`. Clay wings `#b97854` carry gold and clay feather accents.

The main emblem is full colour. The compact emblem keeps the same body and leg structure while omitting the fine feather accents for small icons. Both are transparent and work with the approved cream or ink wordmark.

## Files

- `review/Dawnwing-Unified-Comparison.png`: previous and revised compositions.
- `review/Dawnwing-Identity-Proof.png`: full-colour standalone emblem, combined signature, independent name and compact icon examples at 24–64 px.
- Matching editable `.vectorcraft` review documents and outlined SVGs are included.
- `masters/Everfolk-Dawnwing-Unified.vectorcraft`: eight transparent artboards: primary emblem, compact emblem, stacked and horizontal signatures for light/dark surfaces, and the independent name in ink/cream.
- `svg/` and `png/`: eight production variants. Additional compact icon PNGs cover 16, 24, 32, 48, 64, 128 and 256 px.

All emblem components are editable native VectorCraft paths, with colour fills and a small number of outline strokes. The master was saved, closed and reopened with eight artboards and zero raster images. Production SVGs contain vector paths; the wordmark is outlined. Export warnings were empty. Both proof layouts were rendered and visually checked.

## References and original source

The [University of Nebraska State Museum scarab morphology guide](https://unsm-ento.unl.edu/Guide/Guide-introduction/key%20tools/Morphology/Morphology.html) informed the body structure and leg distribution. [Vincenzo Famoso's scarab composition](https://dribbble.com/shots/14751873-scarab-logo) was studied for the relationship between a compact core and wings that converge at it. These references informed the structural revision; the paths, crown treatment, colour blocking and lettering in this kit are independently constructed.

`source/body.cjs` and `source/wings.cjs` retain the original geometry. `source/previous.cjs` is the previous Dawnwing used in the comparison. On this installation, run `node source/build.cjs` to rebuild through the ArtCraft MCP helper and VectorCraft CLI. The helper closes its task-owned headless process after completion.

The lettering remains the approved clean outlined Printed Folktale wordmark: Eczar 600, −0.025 em tracking and its clay period. Copyright 2014 The Eczar Project Authors (https://github.com/rosettatype/eczar). The SIL Open Font License accompanies the kit in `OFL-Eczar.txt`.
