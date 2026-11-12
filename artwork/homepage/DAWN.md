# First Light — ocean and community gathering

## Historical and artistic scope

The setting remains Rhakotis around 350 BCE, before the foundation of Alexandria. The world pack's `musician-household` describes traveling musicians performing at coastal gatherings. Existing `music` scenery supplies a lyre player, a woven rug and leafy hanging decoration. These are deterministically extracted into the homepage asset manifest. The scene depicts an imagined community celebration, without assigning it to a named historical feast, god, calendar date or reconstructed ritual. No modern flags, electric lights, later Alexandrian monuments or new buildings are introduced.

Five walkers share the existing clear quay route. Five listeners and a musician gather in the existing open space. Sparse garlands move in a light breeze. Their restrained scale was adjusted after viewing the application. Sprite origins, layered geometry and existing character identities remain intact.

## Dawn light

A cooler pale-blue upper sky transitions to peach and champagne at the horizon. The sun is low, partially meeting the horizon, rather than high in an evening sky. Warm upper building surfaces contrast with cool long shadows cast away from the upper-right light direction. The sky aureole and restrained rays are anchored to the revised solar position. The existing world caption reads “First light on the coast.” Luminous typography and the established menu hierarchy remain unchanged.

## Animated ocean

`dawn-water.ts` evaluates a software surface shader into one reusable 384 × 155 RGBA buffer, scaled to the existing 768 × 480 pixel stage with nearest-neighbor sampling. It uses overlapping analytic swell, chop and capillary terms. Shared wave slopes control specular breakup, refraction displacement and golden glints. Depth colors combine deep Mediterranean teal, turquoise shallows and reflected dawn colors. The reflection lobe widens toward the viewer and is naturally occluded by the existing settlement.

The shallow shelf transmits a procedurally sampled sandy-bottom pattern, displaced by the wave slope. A bounded interference mask supplies stylized caustics. Cached settlement pixels and the current animated boat frames are reflected through independently displaced horizontal strips. Wake ripples follow each moving hull; swash and small reflected-light marks follow the quay.

This is an intentionally art-directed 2.5D model, not ray-traced optics, a measured bathymetric reconstruction or a fluid simulation. Caustics approximate light convergence; transparency represents bottom transmission in the rendered color, rather than making the canvas itself transparent. No static ocean texture, scrolling gradient, WebGL renderer or new dependency is used. Fixed buffers and separable wave terms keep work bounded. The existing 30 FPS cap, scene pause, visibility guards and reduced-motion support apply to the entire environment.

## Technical references consulted

- [ThreeJS Water](https://github.com/jeantimex/threejs-water): separated wave simulation, reflection/refraction and caustic concepts; the project’s pool scene and ray-traced implementation are not copied into this coastal renderer.
- [Shader Skills](https://github.com/gokayfem/shader-skills), including its water library and water-quality guidance: analytic wave derivatives, scale separation and a distinction between physically simulated and stylized effects. This implementation uses TypeScript/Canvas rather than shipping a GLSL shader.
- [Create Game Assets](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/disciplines/create-game-assets): cohesive source-derived asset families, stable frame pivots and provenance.
- [GSAP Skills](https://github.com/greensock/gsap-skills): the existing scoped light timelines remain; environmental and frame-based actor motion use the renderer's single scene clock.

## Validation

TypeScript checking and production builds passed. Five tests passed in `dawn-water.test.ts` and `homepage.test.ts`. The surface test observed 41,347 of 59,520 samples changing between scene times; repeating a stopped time produced an identical buffer. The bounded buffer remained opaque and correctly sized. Three software-water draws took approximately 50 ms in the local cold test; this is a CPU microbenchmark, not a mobile-device FPS measurement. Regenerating scene assets produced an identical hash.

The running application was visually inspected at 1440 × 900 desktop and 390 × 844 phone sizes. The original composition remains, with no phone horizontal overflow. The motion switch was tested off and restored to on. Local proof images are `artifacts/homepage/dawn-desktop.png` and `artifacts/homepage/dawn-mobile.png`. Operating-system reduced-motion settings were not changed; the existing preference guards are retained. Gameplay, NFT logic and the character editor are unchanged.
