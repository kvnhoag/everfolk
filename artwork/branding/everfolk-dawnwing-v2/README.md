# Everfolk — Dawnwing refinement

This develops direction **05 Dawnwing** from the ten-scarab exploration in response to the chosen design and the request for smoother internal flow.

## What changed

- The three sweeping wing tiers share a continuous body contour.
- The small square steps at the wing roots are removed.
- The two channels between wing tiers curve into rounded inner terminals.
- The central abdomen seam has a rounded top and softly curved lower ends.
- The head scallops, foreleg elbows and hindleg ends are softened.
- The six outer wing tips retain their original pointed positions.

The scarab remains an independently usable logo. The approved Eczar 600 **Everfolk.** wordmark, with its existing spacing and clay period, remains independently usable. Combined signatures are included.

## Review and production files

- `review/Dawnwing-Before-and-After.png`: direct original/refined comparison.
- `review/Dawnwing-Identity-Proof.png`: emblem, combined signature, independent name and 24–64 px scale comparison.
- Matching `.vectorcraft` review documents retain editable vector artwork and live supporting labels.
- `masters/Everfolk-Dawnwing-Refined.vectorcraft`: eight transparent artboards, containing the standalone scarab, stacked signature, horizontal signature and independent wordmark, each in ink and cream.
- `svg/`: eight transparent production SVGs containing outlined paths.
- `png/`: matching transparent exports and icon sizes of 16, 24, 32, 48, 64, 128 and 256 pixels.

The inner negative spaces are transparent. The production silhouette is united natively in VectorCraft, avoiding seams between overlapping filled parts. Its paths remain editable, and `source/dawnwing.cjs` retains the separate original curve constructions. No raster illustration or live font is required to render the production logo.

Use cream on dark surfaces and ink on light surfaces. The palette matches the earlier kit: cream `#e7e0c9`, ink `#284744`, clay `#db9c78` / `#9b553e`, olive proof background `#292c25`.

The native production master was saved, closed and reopened with all eight artboards and zero raster images. Both proof layouts were rendered and visually inspected. The original ten-direction exploration is retained separately.

## Source

The source folder includes the refined geometry, the original direction for comparison, the approved clean wordmark outlines and a VectorCraft MCP build script. On this installation, rebuild with `node source/build.cjs`. The script uses the installed ArtCraft helper and closes its headless CLI process when finished.

The lettering uses the existing clean outlined Printed Folktale artwork, based on Eczar 600 with −0.025 em tracking. Copyright 2014 The Eczar Project Authors (https://github.com/rosettatype/eczar). The unmodified font's SIL Open Font License accompanies this kit in `OFL-Eczar.txt`.
