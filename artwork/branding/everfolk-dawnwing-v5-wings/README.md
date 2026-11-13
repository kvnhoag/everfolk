# Everfolk — Dawnwing wing placement refinement

This revision moves the wings to short roots behind the thorax. Each side opens outward and upward as a single continuous fan, with two curved internal feather divisions. The lower edge finishes above the oval shell, giving the body and legs a clear outline.

The crown head, thorax, paired wing cases and all three leg pairs use the same geometry as the previous scarab revision. The internal wing divisions have rounded ends and genuine transparency; the outer tips remain pointed.

## Review and production files

- `review/Dawnwing-Wing-Placement-Comparison.png`: previous and revised wing placement.
- `review/Dawnwing-Identity-Proof.png`: standalone emblem, combined signature, independent wordmark and 24–64 px size comparison.
- Matching `.vectorcraft` and SVG files retain the review layouts.
- `masters/Everfolk-Dawnwing-Lifted-Wings.vectorcraft`: eight transparent artboards containing the emblem, stacked signature, horizontal signature and independent wordmark, each in ink and cream.
- `svg/` and `png/`: eight production variants plus 16, 24, 32, 48, 64, 128 and 256 px icons. Feather divisions are clearer at larger sizes.

Production exports are outlined vectors with transparent negative space. The master was saved, closed and reopened with all eight artboards and zero raster images. Export warnings were empty. Both layouts were rendered and visually inspected.

`source/dawnwing.cjs` contains the original curve constructions. `source/original-dawnwing.cjs` retains the previous scarab for comparison. Run `node source/build.cjs` on this installation to rebuild through the ArtCraft MCP helper and VectorCraft CLI. The helper closes its task-owned headless process on completion.

The scarab and full Everfolk. name each remain independently usable. Lettering is the existing clean outlined Printed Folktale artwork: Eczar 600 with −0.025 em tracking and a clay period. Copyright 2014 The Eczar Project Authors (https://github.com/rosettatype/eczar). The SIL Open Font License is included in `OFL-Eczar.txt`.
