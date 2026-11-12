# Everfolk — ancient royal pixel identity

## The inscription

The previous smooth vector capitals have been replaced with eight custom bitmap letter placements, spelling EVERFOLK. Each silhouette is authored as binary rows on a shared 31-pixel cap-height grid. No conventional font, font tracing or text rasterization draws the title. The complete insignia has a 278 × 84 native viewBox; SVG paths contain integer square cells and use crisp-edge rendering.

The 2,220 letter cells use a twelve-color antique-metal palette: champagne rim light, luminous brass surfaces, warm bronze facets, deep olive recesses and selected malachite patina. Exactly 62 cells, about 2.8%, use the two green patina shades. Small fracture seams and shaded edge chips carry the weathering; broad central surfaces remain readable gold. One-cell borders and three-cell offset extrusion provide relief. The lettering remains complete without JavaScript.

The surrounding papyrus/open-book seal, guiding star, small laurel branches, broken brass rules, restrained meander and central malachite inset are also square-grid artwork. Their density stays lower than the lettering. The existing page composition and Mediterranean coast are preserved.

## Alexander emblem

The transparent sculpture was generated using the built-in `image_gen` tool, then copied into `public/assets/brand/alexander-royal-pixel.png`. Its alpha channel is preserved. The source is a 1122 × 1402 RGBA image; the SVG places it in a 65 × 82 native-unit box beside the wordmark. Nearest-neighbor sampling retains the pixel treatment at game scale. No museum image was downloaded or embedded.

The youthful, beardless face, upswept wavy hair and antique material treatment draw on documented portrait characteristics, including the anastole described by the [Cleveland Museum of Art](https://www.clevelandart.org/art/1927.209) and the [Walters Art Museum](https://art.thewalters.org/object/23.121/). This is an original generated interpretation, not an authenticated likeness or a reproduction of one particular ancient object.

The bust is a symbolic title device outside the simulation. It makes no claim that an adult royal statue stood in Rhakotis in 350 BCE. No statue, pedestal, modern era, meteor or decorative object has been added to the village renderer.

## Motion and integration

Sixteen deterministic, interleaved cohorts assemble pixels across all letters together. Small integer offsets settle into the common grid; there is no typing order or rainbow cycling. A clipped golden reflection crosses the inscription slowly, with a long rest between passes. The sculpture receives a restrained 1.00–1.08 brightness variation, while a few square dust points and existing sparse glints provide atmosphere.

All animation remains inside the existing scoped GSAP lifecycle and media context. The scene motion switch reverts decorative animation; reduced-motion users receive the full static identity. Visibility and intersection guards pause running timelines. The existing heading still exposes one accessible name, Everfolk. No game callbacks, character state, world data, NFT tools or simulation rules were changed.

Editable sources and asset provenance are listed in `identity-manifest.json`. Run `node scripts/export-homepage-wordmark.mjs` to produce the standalone SVG; it embeds the portrait so the downloaded composition has no external image dependency. The live page references the cached PNG separately instead of embedding it in page markup.

## References and production path

The relevant [PixiJS bitmap text](https://github.com/pixijs/pixijs-skills/tree/main/skills/pixijs-scene-text), [sprite](https://github.com/pixijs/pixijs-skills/tree/main/skills/pixijs-scene-sprite) and [filter](https://github.com/pixijs/pixijs-skills/tree/main/skills/pixijs-filters) instructions were consulted for precomputed glyphs, stable sprite placement, nearest-neighbor sampling and bounded effects. The [game-asset production workflow](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/disciplines/create-game-assets) informed palette, source tracking and in-context review. The existing SVG/Canvas/GSAP architecture supplies those techniques without installing another renderer.

## Validation — 11 November 2026

TypeScript checking and the production build passed. All 27 tests passed across `royal-pixel-art.test.ts`, `homepage.test.ts`, `dawn-water.test.ts`, `chain-ui-screens.test.ts` and `scene-model.test.ts`. The new artwork checks protect integer grid bounds, consistent rows, limited patina coverage and assembly cohorts that span every letter. Existing menu, life-state, water, sprite and game presentation checks still pass.

The real application was inspected at 1440 × 900 desktop and 390 × 844 and 320 × 740 phone viewports, without horizontal overflow. Assembly was observed in the browser: early cohorts were partly visible while later ones were still at zero, then all cohorts settled to complete opacity. With motion disabled, all letter cohorts remain fully visible, the reflection becomes transparent and the statue returns to brightness 1. The motion preference was restored after testing. A fresh preview tab reported no JavaScript console errors.

The saved character remains Sarapion, age 0 in 350 BCE. Local proof images are `artifacts/homepage/royal-pixel-desktop.png`, `royal-pixel-mobile.png` and `royal-pixel-mobile-320.png`, following the existing ignored-artifacts policy. Reduced-motion behavior is implemented and reviewed; the operating-system preference was not changed. No external frame-time profiler was used.
