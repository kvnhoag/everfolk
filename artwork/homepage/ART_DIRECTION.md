# Everfolk — The Last Light over Rhakotis

## Historical frame

The starting year is 350 BCE. Rhakotis precedes the foundation of Alexandria in 331 BCE. The menu depicts an imagined, modest coastal settlement rather than a reconstruction of later monumental Alexandria. There is no Pharos lighthouse, royal palace, Museum, or Great Library. The existing world pack remains authoritative for dates, player history, and selectable worlds.

## Visual system

A warm limestone and clay settlement faces a cool Mediterranean sea beneath a dusty rose evening sky. The original harbor silhouettes are reinterpreted as pixel volumes: light upper surfaces, cool shaded side walls, narrow contact occlusion, and long shadows falling away from the upper-right sun. Ordered transition pixels and nearest-neighbor sampling preserve the pixel grid. Text uses the project's DM Sans and Libre Caslon Display families, with restrained dimensional shadows on the title.

The full-viewport coast is the environment, not a static hero image. Quiet space on the left provides contrast for the menu; the settlement occupies the right and recedes toward the horizon. On phones, the environment forms an upper scene and fades into the menu surface. All interactive controls remain regular accessible HTML.

## Asset provenance

- `scripts/banner-art-scenes.mjs`: original low coastal storehouses, harbor cargo, ship, architectural palette, and waterfront.
- `scripts/banner-art-actors.mjs`: existing fishing-household adult geometry, identity features, tunics, limbs, and sandals.
- `client/PaperScene.tsx`: existing pixel birds and atmospheric vocabulary.
- `scripts/build-homepage-assets.mjs`: deterministic extraction of four sail frames and four walking frames per character. Run with Node.js 24 or later.
- `client/homepage/scene-assets.json`: derived pixel sprite geometry. No external or generated bitmap art.
- `client/homepage/coastal-scene.ts`: original recomposition, pixel geometry, lighting, depth, independent animation, and cached scenery.

The source masters remain unchanged. New frames alter cloth or leg positions in fixed frame boxes. People, boats, clouds, sea glints, birds and dust have independent clocks. Reflections move with their corresponding boats.

## Rendering and accessibility

Canvas 2D at 768 × 480; nearest-neighbor CSS scaling; a 30 FPS cap. Static scenery and sprite frames are cached in small offscreen canvases. Fixed particle pools avoid unbounded allocation. Pointer parallax is limited to five stage pixels and enabled only for fine pointers. The RAF loop stops while hidden, outside the viewport, covered by a menu overlay, manually paused, or under a reduced-motion preference. Cleanup cancels the loop and releases cached canvas storage.

No HDRI, PBR, WebGL post-processing, or actual 3D engine is claimed. Directional light, ambient fill, occlusion, reflections and selective atmospheric glow are deliberately represented in pixel geometry and lightweight compositing. Broad blur and depth-of-field filters would undermine the chosen pixel language and are omitted.

All existing begin, resume, pending-birth, last-life, world-selection, past-life, legacy, sources and ranked interactions retain their controller callbacks. The environment cannot dispatch simulation commands or touch life saves. Only its own motion preference is persisted.

## Consulted references and technology decision

- [Game UI/UX](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md): responsive containers, safe areas, focus and separation from game state.
- [Create Game Assets](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/create-game-assets/SKILL.md): inspect existing assets, derive cohesive families, stable pivots and provenance.
- [PixiJS sprite skill](https://github.com/pixijs/pixijs-skills/blob/main/skills/pixijs-scene-sprite/SKILL.md) and performance skill: independent frame animation, caches, bounded resources and cleanup. Applied as engine-neutral principles; PixiJS is not installed.
- [Three.js scenes](https://github.com/tuomashatakka/threejs-scenes-skill): reviewed the lighting hierarchy and contrast between directional sun and ambient fill. A new WebGL engine is unnecessary for this existing pixel-vector project.
- [GSAP](https://github.com/greensock/GSAP): consulted for motion architecture. The luminous upgrade uses lazily imported GSAP core for masked text reflections, sparse glints, button sheen and light variation. Scoped contexts and media queries clean up timelines on pause, reduced motion and unmount.

Products and reports are written in English. User communication remains in Vietnamese.

## Luminous gold upgrade

The original composition, typography metrics, 350 BCE scenery, sprite geometry and gameplay callbacks remain unchanged. Champagne-gold lettering combines a clipped metallic gradient, a fine illuminated edge, crisp offset depth and restrained amber drop shadows. A second aria-hidden reflection layer is clipped to the same glyphs; the heading has one accessible name. GSAP moves the reflection over 6.5 seconds with a 7.5-second rest. Three small pixel glints use staggered, slow envelopes; eight bounded light motes float independently. The subtitle receives a softer reflection. Existing buttons, separators and frame edges receive selective warm highlights. A separate screen-blended aureole follows the existing sun's screen position; no artwork or environmental object is replaced.

The existing motion switch controls the decorative timelines as well as the coastal scene. A GSAP media-query context and CSS reduced-motion overrides disable sweeps, glints and motes when reduced motion is requested. Document visibility and intersection guards pause the timelines. Static gold lettering stays readable without JavaScript; forced-color mode restores system text colors. Only GSAP core is added, pinned in the lockfile. No PixiJS filters, Three.js renderer or post-processing engine is installed.

Additional reference: [GSAP React skill](https://github.com/greensock/gsap-skills/blob/main/skills/gsap-react/SKILL.md), using a scoped `gsap.context` with explicit cleanup and lazy client-only import. [PixiJS filters](https://github.com/pixijs/pixijs-skills/tree/main/skills/pixijs-filters) and the Three.js post-processing reference informed the selective rather than full-scene glow decision.
