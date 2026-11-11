# Homepage validation

Validated locally on 11 November 2026, on branch `j0kerH1-next`.

## Checks

- TypeScript: `pnpm check` passed.
- Regression tests: 23 tests passed across `homepage.test.ts`, `chain-ui-screens.test.ts`, and `scene-model.test.ts`.
- Homepage tests cover fresh, pending-birth, continuing and ended-life presentation; all existing navigation destinations; an unchanged life after menu rendering; fixed sprite pivots; distinct frames; and bounded integer sprite geometry.
- `pnpm build` passed. A final framework build was run after the last visual adjustment.
- Regenerating `scene-assets.json` produced an identical SHA-256 hash.
- Browser console inspection found no JavaScript errors.

## Browser observations

The actual local application was inspected through the in-app browser, including full-page captures at desktop and mobile sizes.

- 1440 × 900 desktop: the menu fits the viewport height; no horizontal overflow.
- 1366 × 768 desktop: the compact-height layout fits the viewport; no horizontal overflow.
- 768 × 1024 tablet: no horizontal overflow.
- 390 × 844 and 320 × 740 phones: content flows vertically with a separate scenic upper area; the primary button and all navigation destinations remain accessible without horizontal overflow.
- Continuing the saved life returns to the existing character, at age 0 in 350 BCE, with reading pause retained.
- History & sources opens the existing historical-sources panel.
- The animation switch changes its pressed state and stops the environmental rendering. Two paused captures have identical sky, water and settlement regions. Running captures show different environmental pixels.
- Desktop and phone compositions were revised after inspecting the live site. Caption visibility, compact desktop height, architectural detailing, water grading and the quay walking route were corrected.

Local proof images are stored under `artifacts/homepage/`, including `homepage-desktop.png`, `homepage-mobile.png`, and running/paused capture pairs. These QA files follow the repository's existing ignored-artifacts policy.

## Scope and verification limits

The gameplay controller, simulation, NFT collection and character editor are unchanged. Existing ranked availability remains governed by the current backend configuration; ranked play was unavailable in this local preview, as before.

Reduced-motion support is implemented with a live `prefers-reduced-motion` listener, a render-loop guard and CSS overrides. The operating system's accessibility setting was not changed during validation. Visibility and intersection guards are present; the browser's background-tab scheduling was not profiled with an external performance recorder.

Lighting and depth are stylized 2.5D pixel effects implemented in Canvas 2D and CSS. There is no HDRI, PBR rendering, WebGL dependency, or claim of true 3D lighting.
