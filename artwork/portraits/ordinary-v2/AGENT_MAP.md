# Ordinary-v2 agent map

**STOP: the user rejected these exports for neck anatomy.** Previous automated and visual pass records did not establish correct anatomy. `manifest.json` now records `userReviewStatus: rejected-neck-anatomy`. Preserve the complete model references; use the [v3 face-only proof](../ordinary-v3-neck-proof/README.md), keeping original neck and shoulders intact. This map remains a record of the rejected assembly method, not final-art approval.

This is the body-fit correction to ordinary-v1. Scope: player, ordinary NPC and relation portraits. Historical figures and TCG/title artwork remain in the separate card workflow.

## Read first

1. [README.md](README.md): scope, physical body requirement, counts and delivery limits.
2. [contract.json](contract.json): canonical M/F sources, age scales, body/skin masks, actual registration and layer order.
3. [source-index.json](source-index.json): all 22 new generated sources and the 36 reused v1 heads, with hashes and prompt/provenance links.
4. [head-anchors.json](head-anchors.json): native eye/chin landmarks, neck removal and hair/braid protection for all 36 age heads.
5. [female-wardrobe-anchors.json](female-wardrobe-anchors.json): measured registration for garment sources whose canvas differs from the body reference.
6. [manifest.json](manifest.json): exact derived paths, selected body palette, head, clothes and QA for each final portrait. If this is absent, the full build is incomplete.

The full 192-portrait build is complete. Selected final PNGs are in `portraits/mixed-3px-body-2px-face/`, at 384 x 480. They have no single logical grid: the coarse 3px pass and fine 2px pass remain separately indexed in each record, together with the exact regional mask/configuration and QA. [qa/library-audit.json](qa/library-audit.json) verifies body alpha invariance across the 36 skin palettes, all selected pixels, source hashes and content coverage. [qa/body-fit-visual-review.json](qa/body-fit-visual-review.json) records the precise human-style review coverage and limits.

## Fixed identities and naming

Face IDs remain `m01`, `m02`, `m03`, `f01`, `f02`, `f03`; these match recorded sex and zero-based avatar variants 0, 1, 2. The six stages remain infant, child, youth, adult, middle and elder. The live age boundaries are 0–2, 3–12, 13–17, 18–39, 40–59 and 60+.

| Asset | Naming / authority |
| --- | --- |
| Shared body geometry | `source/bodies/ef-b-{male,female}-v2.png` |
| Complete generated registration figure | `source/body-references/ef-r-{male,female}-waist-v2.png` |
| Fitted garment original | `source/wardrobe/ef-w-{male,female}-{family}-v2.png` |
| Infant wrap | Family `infant`, one per M/F body template |
| Reused original head | `../ordinary-v1/source/heads/ef-h-{identity}-{stage}-v1.png` |
| Final portrait ID | `ef-p-{identity}-{stage}-{wardrobe}-v2` |
| Derived component/final filename | Follow its manifest record; do not infer registration from a filename |

Two physical body geometries are the invariant. Skin palette adjustments are color variations, and age placements are transforms; neither creates a new body shape. Torso/body geometry cannot change merely because a person changes occupation, relationship role or skin tone.

## Assembly rules

Use the body master's whole registered canvas. Do not independently resize a head and garment to their alpha bounding boxes: that caused the v1 mismatch. Face transforms preserve facial aspect and use measured eye/chin anchors. Remove the original long neck, retain a short underjaw transition and preserve all hair with explicit masks.

Professional clothing fits the sex-specific body. Reapply its front collar above the neck/throat layer, with front braid above clothing. A straight source neck cut must never remain exposed. Body skin masks include neck/collarbones and arms; shirt/belt pixels stay outside color transfer. Verify both light and dark identities before mass export.

Infants use swaddles covering torso and arms. Children and youths use the approved smaller placements of the same M/F body templates. Respect actual job minimum ages: the child work portrait supports age-12 apprentices, not occupational dress for every child.

## Content mapping and runtime handoff

The canonical content map remains [v1/mappings.json](../ordinary-v1/mappings.json): 33 current jobs, 16 origins, 16 procedural encounter templates and eight wardrobe families. A recorded occupation selects clothes. Unknown work uses the age-appropriate everyday fallback. Natal origins are upbringing, not automatic uniforms.

Friend, enemy, business partner, teacher, disciple, romantic partner, spouse and family labels preserve the same person's face. Family records still lack persisted avatar variants, children lack recorded sex/variant, and family tables currently have no portrait cell. The library does not silently fill these simulation-data gaps. A future presentation adapter must use stable recorded identities without consuming simulation RNG or inferring sex from names.

Existing live assets are retained. No runtime selector, save migration or scene-actor implementation is part of this correction.

## Verification and rebuild

Run the builder's bounded smooth proof first. Inspect actual 100% chin/neck/collar crops and the complete shoulders, arms and torso. Pixel conversion must follow anatomical review. Quantitative checks include unchanged canonical body alpha across skin variants, clothes within the body envelope, continuous head/body overlap and source integrity; visual checks remain required.

Apply the agreed coarse/fine PixelOE finish only after assembly. Derive face regions from current landmarks. Keep coarse pixels outside the face unchanged, document mixed-grid provenance and verify registered whole-cell selection, repeat rendering and PNG readback.

Use [scripts/build-library.py](scripts/build-library.py) and [scripts/index-sources.py](scripts/index-sources.py). Keep exact prompts ignored. Preserve all original source PNGs, registration records and source/provenance dependencies when editing or transferring this library.
