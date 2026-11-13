# Everfolk — Dawnwing scarab anatomy refinement

This revision strengthens the beetle within the winged emblem. The central body now has substantial, convex paired wing cases with a clear seam; a broad thorax establishes the head–thorax–abdomen structure. The three-point crown has rounded lower cheeks, forming the beetle's head rather than a separate floating crown. Three pairs of legs are visible: raised front legs, outward middle legs and descending hindlegs.

The outer wings retain their pointed tips and rounded inner channels. Curved transparent space separates them from the central shell so the beetle remains visible within the wider silhouette.

## Files

- `review/Dawnwing-Scarab-Comparison.png` compares the previous crown emblem with this revision.
- `review/Dawnwing-Identity-Proof.png` shows the standalone scarab, combined name treatment, independent wordmark and a 24–64 px size comparison.
- Both review layouts have editable `.vectorcraft` masters and SVG exports.
- `masters/Everfolk-Dawnwing-Scarab.vectorcraft` contains eight transparent artboards: emblem, stacked signature, horizontal signature and independent name, each in ink and cream.
- `svg/` and `png/` contain the eight production variants. Additional icon PNGs cover 16, 24, 32, 48, 64, 128 and 256 pixels. The finer anatomical separation is clearer at 32 pixels and above.

The emblem and the full Everfolk. name each remain independently usable. All production artwork uses editable filled paths and transparent negative spaces. The native master was saved, closed and reopened with eight artboards and zero raster images. Export warnings were empty, and both review layouts were rendered and visually checked.

## Source and references

`source/dawnwing.cjs` preserves the original curve constructions; `source/original-dawnwing.cjs` retains the previous crown design for comparison. Run `node source/build.cjs` on this installation to rebuild through the ArtCraft MCP helper and VectorCraft CLI. The helper closes the task-owned headless process after the build.

The winged-scarab motif is documented by [The Walters Art Museum](https://art.thewalters.org/object/42.1430/). The logo's geometry is original and stylised, rather than an archaeological reconstruction or a biological illustration.

The lettering remains the existing clean outlined Printed Folktale wordmark: Eczar 600 with −0.025 em tracking and its clay period. Copyright 2014 The Eczar Project Authors (https://github.com/rosettatype/eczar). The SIL Open Font License is included in `OFL-Eczar.txt`.
