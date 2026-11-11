# Everfolk — the enduring inscription

## Visual direction

The homepage identity now uses original inscriptional capitals: wedge serifs, flared vertical stems, a long curved R leg, a narrow-waisted O and balanced counters. Eight hand-authored outline placements spell EVERFOLK. They are SVG geometry, not a font, rasterized text or a recoloring of the previous rainbow glyphs. No Age of Empires artwork or letter outlines were copied.

The material combines antique gold, champagne edge light and bronze relief. Offset contour cuts create directional bevels; fine clipped marks provide restrained engraved texture. The existing Everfolk open-book and guiding-star device is redrawn as a small metal seal within the wordmark composition. The book represents the game's storytelling identity rather than an additional object placed in the 350 BCE village. A fine lower rule and quiet rays keep the ornament part of the same graphic.

The native vector viewBox is 812 × 220. It scales independently of the nearest-neighbor pixel environment. The original heading slot, menu hierarchy, coastline, camera and game callbacks remain intact.

## Cleanup

The meteor renderer, cinematic component, modern coast mode, era switching state, era-action UI, related styles and rainbow artwork were removed. The header once again displays **The ancient world · 350 BCE** as a passive label.

Layer inspection traced the anomalous long brown platform to `festival.rug`: the crop of **05 Foreground rugs and shadows** from the source music scene was stretched to 42 × 6 native pixels at coastal coordinates (653, 294). Only that homepage layer was removed. Its sprite field and extraction step were also removed, so regeneration cannot restore it accidentally. The source music scene remains valid elsewhere. The seated musician, original buildings, paving, cargo, textiles, boats and all five waterfront walkers are preserved. The previously removed stationary central crowd remains absent.

## Animation and access

The entire inscription settles into light as a single artifact over approximately 2.5 seconds. A narrow clipped reflection crosses the metal in 9 seconds, resting for 13 seconds between passes. Small occasional edge glints, a subtle emblem halo and slow ray illumination supplement it. No typing, rainbow cycling, impact, camera shake or era transition remains.

The existing scoped GSAP context owns every decorative timeline and reverts them on cleanup. Animations pause when hidden or outside the viewport. The scene motion switch disables logo effects as well as environmental animation. Reduced-motion preferences retain the complete static identity. The accessible heading exposes one name, **Everfolk.**

## Source and reproducibility

- Editable lettering: `client/homepage/classical-lettering.ts`.
- Editable metal, emblem and ornament composition: `client/homepage/ClassicalWordmark.tsx`.
- Standalone transparent vector: `public/assets/brand/everfolk-wordmark.svg`.
- Regenerate that export with `node scripts/export-homepage-wordmark.mjs`.
- Rebuild coastal sprites with `node scripts/build-homepage-assets.mjs`.

All letter outlines and emblem geometry are authored for Everfolk in this repository. No new external image or runtime dependency is required.

References consulted: [PixiJS vector graphics skills](https://github.com/pixijs/pixijs-skills/tree/main/skills/pixijs-scene-graphics), [GSAP React lifecycle](https://github.com/greensock/gsap-skills/tree/main/skills/gsap-react), [GSAP timelines](https://github.com/greensock/gsap-skills/tree/main/skills/gsap-timeline), [Three.js lighting/material principles](https://github.com/tuomashatakka/threejs-scenes-skill), and [game asset production](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/disciplines/create-game-assets). The existing SVG, CSS, Canvas 2D and GSAP architecture supplies the desired result; a WebGL renderer is unnecessary for this fixed vector identity.

## Validation — 11 November 2026

- TypeScript checking and the production framework build passed.
- All 25 tests passed across `homepage.test.ts`, `dawn-water.test.ts`, `chain-ui-screens.test.ts` and `scene-model.test.ts`. They cover homepage destinations and life states, absence of era-transition UI, removal of the rug sprite, animated water, fixed sprite pivots and existing game/chain presentation.
- Both coastal sprite regeneration and the standalone SVG export reproduce identical SHA-256 hashes.
- The actual application was visually inspected at desktop 1440 × 900 and phones 390 × 844 and 320 × 740. The layout has no horizontal overflow; the title, scene and navigation remain readable.
- The reflection's SVG transform was observed changing from the identity matrix to a positive horizontal displacement. With motion switched off, its computed opacity and all three glint opacities become zero. Motion was restored after testing.
- History & sources opens the existing panel and closes back to the homepage. The saved character remains Sarapion, age 0 in 350 BCE throughout these presentation checks.
- Development HMR briefly logged missing imports while old components were being replaced with the new component. The application recovered and the final build resolves all imports. No error overlay remains in the inspected page.

Local proof images follow the existing ignored-artifacts policy: `artifacts/homepage/classical-desktop.png` and `classical-mobile.png`. Reduced-motion handling is implemented in the existing preference listeners, scoped GSAP media context and CSS. The operating-system setting was not changed during QA, and no external frame-time profiler was used.
