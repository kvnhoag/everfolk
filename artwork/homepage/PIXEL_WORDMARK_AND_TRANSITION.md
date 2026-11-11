# Pixel wordmark and Across the Ages

## Direction and scope

The opening screen keeps its camera, shoreline, sunrise, water renderer, menu layout and game callbacks. Only the five stationary listeners that formed the central crowd were removed. All five independent waterfront walkers, the seated musician and the ancient decorative textiles remain.

The wordmark is original bitmap geometry: eight hand-authored glyph matrices on a shared integer grid, with stepped terminals, varied ascenders, dark outlines and offset pixel shadows. Each letter has its own five-color jewel ramp. SVG square paths render the artwork; no font, SVG text or text-gradient mask draws the logo. Twelve interleaved illumination cohorts span all letters, avoiding a typing reveal. A narrow clipped reflection and small glints provide restrained movement through the existing scoped GSAP controller.

## Cinematic

The user explicitly requested a new modern interpretation of the same homepage coast after the meteor. The repository did not contain a modern simulation world. The modern preview therefore reuses the shoreline geometry, perspective, sunrise and animated sea, with new windowed buildings, a distant skyline, promenade lights, cabin boats and adapted pedestrian colors. It is presentation artwork, not a new gameplay world or a historical claim about ancient Rhakotis.

Select **Cross the ages** in the header to start. It never starts automatically on page load.

- 0–1.5 seconds: the ancient scene pauses and dims.
- 1.5–5 seconds: an accelerating meteor descends with independent pixel fragments, a faceted core and stepped light shells.
- 5–6.5 seconds: an expanding pixel flare, fragments, shockwave and brief camera shake cover the coast.
- 6.5–7.1 seconds: the modern renderer replaces the ancient renderer under full-screen light.
- 7.1–10.8 seconds: the light recedes and the modern coast appears; ambient animation resumes.

**Return to antiquity** restores the ancient presentation. **Skip cinematic** or Escape reveals the modern preview immediately. The dialog contains keyboard focus and returns focus to the era button. The underlying menu is inert during the sequence. A reduced-motion preference bypasses the moving/bright sequence; live preference changes end it immediately. The timeline pauses while the document is hidden and is reverted on unmount. The cinematic canvas follows viewport proportions to retain a visible meteor path on portrait screens.

Neither era selection nor the cinematic advances game time, writes a life, resets a character or changes the world pack. Existing Begin/Continue, world selection, history, legacy and ranked controls retain their previous behavior.

## Technical references consulted

- [PixiJS skills](https://github.com/pixijs/pixijs-skills): bitmap lettering, sprite and bounded particle principles. The existing SVG/Canvas architecture handles these requirements without adding PixiJS.
- [Animaxxing skills](https://github.com/johnpolacek/animaxxing-skills): lifecycle-controlled timelines, cleanup and reduced-motion handling.
- [Shader skills](https://github.com/gokayfem/shader-skills): procedural effect composition adapted to crisp Canvas pixels. No shader runtime was required.

The existing GSAP dependency drives the cinematic and light reflections. No dependency was added for this change.

## Validation

- TypeScript checking passed.
- Eight focused tests passed across `pixel-wordmark.test.ts`, `homepage.test.ts` and `dawn-water.test.ts`, including grid bounds, interleaved illumination, full-screen cover before swapping, menu states, sprite frames and animated water.
- Production framework build passed.
- The real homepage was inspected at 1440 × 900 and 390 × 844. Both preserve readable artwork and menu controls; the phone layout has no horizontal overflow.
- Desktop captures cover all five cinematic phases and the final modern reveal. The phone path was inspected and adjusted to stay visible in portrait orientation.
- Returning to antiquity and skipping with Escape were exercised; the overlay and inert state clear, and keyboard focus returns to the era control.
- Reloading shows the ancient coast without starting a cinematic. The existing saved character remains visible at age 0, 350 BCE after transitions.

Local proof images are in ignored `artifacts/homepage/`: `pixel-ancient-desktop.png`, `pixel-modern-desktop.png`, `pixel-ancient-mobile.png`, `pixel-modern-mobile.png`, and `meteor-*.png`. Reduced-motion handling was reviewed in code; the operating-system preference was not changed. No external frame-time profiler or full modern simulation was introduced.
