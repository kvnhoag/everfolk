# Everfolk — ten scarab logo directions

Created in VectorCraft on 11 November 2026. These are ten original design directions for discussion and selection.

The identity has two independently sufficient parts: **a standalone scarab emblem** and **the standalone Everfolk. name**. A stacked or horizontal signature combines them when space and context call for both. The emblem does not rely on a letter, a caption or a coloured background to complete its silhouette.

## Start here

Open `review/Everfolk-10-Scarab-Directions.png` for the ten-direction comparison. The matching `.vectorcraft` is the editable review sheet. Each numbered `*-proof.png` shows the emblem by itself, the emblem with the name, the name alone and a small-size comparison. The proof sheets have presentation backgrounds; the production SVG and PNG assets are transparent.

| Number | Direction | Intended meaning for Everfolk |
| --- | --- | --- |
| 01 | Becoming | A life coming into being; a small creature lifting a new beginning. |
| 02 | Quiet Amulet | The value of an ordinary life, held in a simple enduring form. |
| 03 | Crossroads | One life takes a course while other possibilities branch away. |
| 04 | Earth Seal | An individual life leaves an imperfect imprint on the world. |
| 05 | Dawnwing | A life opening outward into a wider world. |
| 06 | Upward | Potential, effort and the possibility of becoming. |
| 07 | Unfolding | A living possibility revealed as a story unfolds. |
| 08 | Heart of a Life | Attachment, belonging and the people who give a life meaning. |
| 09 | Another Beginning | Every new life opens into different circumstances and possibilities. |
| 10 | Toward the Horizon | A small life reaching toward an open future. |

The meanings assigned to the individual designs are proposed brand interpretations, rather than translations of ancient signs.

## Editable masters and exports

Each numbered file in `masters/` has four transparent artboards:

1. Standalone scarab in ink, 512 × 512.
2. Standalone scarab in cream, 512 × 512.
3. Scarab above the name in cream, 1200 × 820.
4. Scarab beside the name in ink, 1400 × 380.

`masters/everfolk-independent-wordmark.vectorcraft` contains the standalone name in ink and cream. All emblem parts and title letters are native filled vector paths. Reflected pairs remain editable. The negative spaces are transparent geometry; there are no background-coloured patches or embedded raster illustrations.

`svg/` contains 42 production exports: four per scarab and two independent wordmarks. `png/` contains matching transparent exports plus icon sizes of 16, 24, 32, 48, 64 and 128 pixels. The 16-pixel exports are supplied for browser testing; the more intricate wing and seed details are clearer at 32 pixels and above.

The chosen name treatment remains **Eczar 600**, title case, with **−0.025 em tracking** and its clay terminal period. The native masters use the existing clean outlined version of Printed Folktale, preserving the letterforms and spacing without adding grain to small logos. The font itself is unmodified. Its copyright and SIL Open Font License are included in `OFL-Eczar.txt`.

| Use | Colour |
| --- | --- |
| Cream emblem and lettering | `#e7e0c9` |
| Clay period on dark surfaces | `#db9c78` |
| Ink emblem and lettering | `#284744` |
| Clay period on light surfaces | `#9b553e` |
| Olive proof background | `#292c25` |

Use cream exports on dark surfaces and ink exports on light surfaces. Preserve the proportions. Keep the period with the name. Treat the emblem and name as separate identifiers; neither needs to be inserted into the other.

## References and originality

The historical starting point is the scarab's association with becoming and coming into existence, described by [The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection/search/549272). This provides the core connection to beginning another life in Everfolk. The individual geometries, names and game-specific interpretations are original.

The requested [Assassin's Creed reference](https://www.ubisoft.com/en-us/game/assassins-creed) informs the identity structure: a recognisable emblem and a complete name that can each stand alone. No Ubisoft emblem geometry, hood artwork or title lettering was used.

The Eczar font project is [Rosetta Type / Eczar](https://github.com/rosettatype/eczar). Copyright 2014 The Eczar Project Authors.

## Verification and rebuilding

Every production master was saved, closed and reopened in VectorCraft. The ten scarab masters each retain four artboards; the shared wordmark retains two. Reopened masters report no raster images. Production SVGs contain outlined paths. Export warnings were empty. The comparison sheet and individual proof layouts were visually reviewed.

`source/` contains the original paths, the approved clean wordmark reference and the native VectorCraft build script. `qa/` retains reopening records and export validation. To rebuild on this installation, run `node source/build.cjs`; it uses the installed ArtCraft MCP helper and VectorCraft CLI. The helper closes its task-owned headless process after the build. No live VectorCraft session is required.
