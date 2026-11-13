# Everfolk ordinary portraits v2

**Rejected by the user for neck anatomy.** The earlier fit-review pass did not establish correct anatomy. Preserve these sources, but do not treat these 192 exports as approved. See the [face-only whole-model proof](../ordinary-v3-neck-proof/README.md) for the corrected method.

Complete waist-up portraits with **two shared physical body templates**, male and female. Younger ages use scaled versions of the same templates. Neck, shoulder, sleeve and waist registration belong to the body; clothes fit that body. Original faces and the agreed painterly / PixelOE language are retained.

**Delivered: 192 final portraits.** Open the [browsable gallery](review/index.html), [body and skin overview](review/adult-identities.png), [lifetime sheet](review/lifetimes-6x6.png) or [wardrobe sheet](review/adult-wardrobe-6x8.png). The [handoff audit](qa/library-audit.json) passes: 58 source assets, two fixed body geometries, 36 identity/age skin palettes, exact mixed-grid selection and complete current-content mapping.

Start with [AGENT_MAP.md](AGENT_MAP.md). [source-index.json](source-index.json) tracks the 58 source assets and their original-file hashes, exact local prompts and generation provenance. [contract.json](contract.json) defines the two bodies, age transforms, skin masks and layer order. [head-anchors.json](head-anchors.json) provides measured native eye/chin positions and original-neck removal masks. The completed [manifest.json](manifest.json) is the authority for derived component and portrait paths.

## Bodies, skin and clothes

- **Two body shapes:** one male and one female waist-up master with anatomical neck, collarbones, shoulders, arms and torso. Body size and silhouette are identical for all identities of the same sex and age scale.
- **Skin variations:** skin-only masks calibrate the neck, collarbones and arms to the selected character's actual complexion. Head-stage sampling can change skin shade without changing body geometry, garment color or belt pixels. The manifest records the actual body palette and placement used by every portrait.
- **Six face identities across six ages:** 36 unchanged v1 head sources are reused. Original long necks are removed from the face component; a short natural underjaw transition overlaps the shared anatomical neck. Front hair and braids have separate protection masks.
- **Sixteen fitted adult garments:** eight household/profession families, each fitted to both M/F templates. Two additional swaddles cover infant bodies and arms. Children and youths use the same sex-specific fitted garments under the approved age scale.
- **Continuous finished figures:** layer order includes a real skin-calibrated body, trimmed face, fitted garment/front collar and protected front hair. Smooth complete portraits are reviewed before pixel conversion.

The eight wardrobe families remain everyday, work, maritime, commerce, scholarly, military, elite and performance. Their visual groupings are authored interpretation, not attested occupational uniforms. Current jobs and relationship roles follow the [existing content mappings](../ordinary-v1/mappings.json). Relationships never create a new face, and natal household alone does not assign a profession.

## Portrait count

The library retains 192 identity/stage/wardrobe combinations: 36 everyday portraits, 6 child work portraits, 24 additional youth profession portraits and 126 additional adult/middle/elder profession portraits. Body and garment reuse replaces independent head/shirt positioning; the number of people does not increase.

V2 adds 22 generated sources: two complete-body registration references, two extracted canonical bodies and 18 garment overlays. It reuses the 36 original head sources in v1. Do not count skin palette copies or age placements as newly generated body types.

## Pixel finish and review

Use the agreed **PixelOE coarse finish with finer face and eye detail**. The smooth assembled painting remains the source. Regional face detail derives from the actual current eye/chin placement; never copy the Alexander card's source-specific mask coordinates onto these portraits. Coarse and fine grids are registered to the same output origin, and QA identifies the final as mixed-grid artwork.

The coarse pass uses 128 x 160 logical pixels enlarged 3x; the finer pass uses 192 x 240 enlarged 2x. Both are 384 x 480. Face and eye regions select entire registered 6 x 6 common cells from the finer pass; unselected pixels remain identical to the coarse painting. Outline thickening is disabled to preserve the gaze. No color blending, sharpening or newly painted pupils are part of this filter. [scripts/regional-finish.py](scripts/regional-finish.py) implements the installed regional PixelOE selection method.

Review the actual 100% smooth neck/collar crops as well as final pixel portraits and small UI-size sheets. A hash, an overlap count or the absence of transparent gaps does not prove anatomical fit. [The v1 diagnosis](qa/body-fit-diagnosis.json) records why the earlier independent head/shirt assembly was inadequate.

The [independent fit review](qa/body-fit-visual-review.json) covers 78 distinct smooth assemblies, including all 36 age portraits and all 48 adult outfit samples, plus native-size neck crops and bounded mixed-pixel previews. The two-template rule produces stylized younger bodies through scaling and skin-surface adjustments; it is not a separate infant/child anatomical model. Whole waist-up thumbnails naturally show less facial detail than the full-resolution files.

Authentic museum photographs and object credits remain preserved in [v1 references](../ordinary-v1/references/); the review gallery places them beside interpretations. They inform cloth forms, not fictional facial likenesses, skin colors or occupational rank. The new complete-body references are generated art and are labelled accordingly.

## Storage and rebuild

| Location | Contents |
| --- | --- |
| `source/body-references/` | Generated complete M/F figures used to establish consistent registration |
| `source/bodies/` | The two immutable extracted waist-up body masters |
| `source/wardrobe/` | 18 immutable garment sources: 16 adult family/sex combinations and two infant wraps |
| `source/prompts/` | Exact built-in generation prompts; local-only under the existing ignore rule |
| `components/` | Derived registered bodies, skin masks, face masks, fitted garments and hair overlays |
| `portraits/` | Smooth complete assemblies and final pixel-finished PNGs |
| `review/` | Complete portraits, 100% join crops, age/clothing sheets and the browsing gallery |
| `qa/` | Source, anatomy-registration, skin, pixel and handoff records |

[scripts/build-library.py](scripts/build-library.py) builds proofs and full outputs, using the existing local CPU PixelOE runtime without installing dependencies. Read `--help` before invoking it. [scripts/index-sources.py](scripts/index-sources.py) regenerates the source index. After a full build, [scripts/build-review.py](scripts/build-review.py) builds the offline gallery and [scripts/verify-library.py](scripts/verify-library.py) checks source links, shared body alpha, every final's exact coarse/fine selection and the live content map. Keep v1 sources and helpers available because v2 references them explicitly. New revisions should preserve this version's immutable generated PNGs.

The artwork remains staged separately. This task does not change the live app, saved identity schema, family-table UI or scene actors.
