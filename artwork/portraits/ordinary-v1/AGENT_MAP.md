# Ordinary-v1 agent map

## Scope and authorities

This library covers fictional player, ordinary NPC and relation portraits for the current Rhakotis/Alexandria world. It contains no historical-figure portraits or TCG assets and has no runtime binding yet. The shared style is mature anime anatomical design with painterly chiaroscuro: warm upper-left light, cool jade/umber shadows, readable eyes and restrained earth colors. Smooth source components are composed before the PixelOE finish.

Read these files in order when resuming work:

1. [contract.json](contract.json): stable identity IDs, stages, source names, 800 × 1000 composition canvas and anchors.
2. [mappings.json](mappings.json): exact current-world IDs and authored wardrobe assignments. It records 33 jobs, 16 origins and 16 encounter templates from world version 0.43.0, with references and separate household cues.
3. [manifest.json](manifest.json): main machine index of built components and exports. Follow its paths rather than inventing output filenames.
4. [source-index.json](source-index.json): all 47 immutable generated originals, exact local prompts, provenance files, dimensions and hashes. Original tool copies were verified byte for byte.
5. [README.md](README.md) and [review/index.html](review/index.html): delivery notes and the offline filterable gallery, including authentic museum photographs beside generated interpretations.

The full build is complete: 192 pixel-finished portraits, 36 normalized head components and 16 normalized garment placements derived from 11 source garments. The selected profile is 128 x 160 logical pixels, scale 3, outline thickness 0; final PNGs are 384 x 480. [scripts/build-library.py](scripts/build-library.py) is the build entry point. Read its supported arguments before invoking it. QA records establish the exact build and source integrity.

## Stable asset identifiers

| Item | Identifier or path |
| --- | --- |
| Face identity | `m01`, `m02`, `m03`, `f01`, `f02`, `f03`; three variants per recorded sex. |
| Age stage | `infant`, `child`, `youth`, `adult`, `middle`, `elder`. |
| Original head | `source/heads/ef-h-{identityId}-{stage}-v1.png`. |
| Original garment | `source/wardrobe/ef-w-{wardrobeId}-v1.png`. |
| Wardrobe family | `everyday`, `work`, `maritime`, `commerce`, `scholarly`, `military`, `elite`, `performance`. |
| Age garment source | `ef-w-infant-v1.png` is the infant swaddle; `ef-w-child-v1.png` and `ef-w-youth-v1.png` provide age-specific everyday clothing. |
| Exact prompt | `source/prompts/{assetId}-prompt.txt`; ignored by the repository's prompt rule. |
| Source provenance | Follow each `provenance` list in [source-index.json](source-index.json); records are retained in their original `source/heads`, `source/prompts`, `source/wardrobe` or `source/provenance` folders. |
| Normalized component / assembled export | Exact path in [manifest.json](manifest.json), under [components/](components/) or [portraits/](portraits/). |
| Selected final portrait | `portraits/128x160-s3-t0/ef-p-{identityId}-{stage}-{wardrobeId}-v1.png`; `.logical.png` is its native 128 x 160 image. |
| Normalized head | `components/heads/ef-h-{identityId}-{stage}-v1.png`. |
| Normalized garment | `components/wardrobe/ef-w-{wardrobeId}-{placementStage}-v1.png`; adult, middle and elder reuse the adult placement. |

The existing UI age boundaries are infant 0–2, child 3–12, youth 13–17, adult 18–39, middle 40–59 and elder 60+. Generation exemplars are ages 1, 8, 16, 28, 49 and 72. Preserve each person's recognizable face across those stages. Hair may gray and anatomy may age; changing clothes or roles must retain the same identity.

## Production counts

The delivered sources are 36 heads and 11 garments. The 192 distinct assembled export combinations are:

| Coverage | Calculation | Exports |
| --- | --- | ---: |
| Everyday across all ages | 6 identities × 6 stages | 36 |
| Child work clothing | 6 identities × 1 additional family | 6 |
| Youth profession clothing | 6 identities × 4 additional families: work, maritime, scholarly, performance | 24 |
| Adult, middle and elder professions | 6 identities × 3 stages × 7 additional families | 126 |
| Total | | 192 |

The child work exception supports a workshop apprentice beginning at age 12. Do not produce infant profession portraits. Commerce, military and elite job outfits start in the adult stage under the current job requirements. These counts refer to wardrobe/identity/stage combinations, not additional people or individual job uniforms.

## Selection and identity rules

Resolve the person's stable face identity first, then stage, then wardrobe. The current recorded player job or recorded NPC/family occupation selects a wardrobe family through [mappings.json](mappings.json). Use `everyday` when occupation is missing, unsupported or not applicable at that age. An encounter's `jobId` is a closest library association, not a change to simulation state; a null value is allowed when no current player job matches its occupation.

All 16 origins have `defaultWardrobeId: everyday`. `originHouseholdCues` provides context for authored family looks and does not override a person's actual work. Being born to a soldier, royal relative or temple worker does not equip a child in military, royal or priestly clothes. The wardrobe groups are visual interpretations, not evidence of ancient occupational uniforms.

Friend, business partner, teacher, disciple, enemy, courting partner, spouse, former partner and family relation are labels attached to the same person. They never request a new face. A change in social role, outfit or household alias must preserve the face ID and variant. Existing origin aliases in [life-background.ts](../../../client/models/life-background.ts) are artwork routing, not new identities or historical clothing claims.

## Build and verification paths

| Path | Work performed there |
| --- | --- |
| [source/heads/](source/heads/) | Immutable original generated PNGs. Adult heads anchor the age-edit identity. |
| [source/wardrobe/](source/wardrobe/) | Immutable original generated clothing PNGs and wardrobe provenance. |
| [source/prompts/](source/prompts/) | Exact prompts and per-head generation provenance. Keep local prompt text out of commits. |
| [references/](references/) | Actual museum reference images; credit and limitations are recorded in mappings and delivery notes. |
| [components/](components/) | Normalized heads and clothing, preserving real alpha transparency and compatible anchors. |
| [scripts/build-library.py](scripts/build-library.py) | Normalize, assemble and export the library; inspect the supported CLI. |
| [portraits/](portraits/) | Opaque assembled portraits and pixel-finished outputs, with exact names in the manifest. |
| [qa/](qa/) | Checks and results. [heads-f01-f02-source-qa.json](qa/heads-f01-f02-source-qa.json) records alpha bounds, PNG dimensions and copy integrity for those 12 head sources. |
| [review/](review/) | Contact sheets and review gallery. Review identity continuity, age anatomy, eyes, head/garment joins and actual display-size readability. |

Never overwrite generated source PNGs to normalize them. Write derived components separately and keep the original generated-image location in provenance. Sources may have different native sizes; the composition canvas in the contract applies to normalized components and assembled portraits. Match face/neck anchors rather than blindly aligning the alpha bounding box: a side braid can extend below the neck. Preserve actual alpha in components, assemble against an opaque background, then run PixelOE on the complete image. Keep final pixel QA with the build.

## Runtime handoff and save gaps

The existing game still uses its original SVG portrait pipeline. This library does not update [PixelPortrait.tsx](../../../client/components/PixelPortrait.tsx), [life-background.ts](../../../client/models/life-background.ts), [avatar-appearance.ts](../../../client/models/avatar-appearance.ts), world packs or saves.

| Current authority | Existing state / integration gap |
| --- | --- |
| [src/types.ts](../../../src/types.ts), `CharacterState` and `EncounteredPerson` | Player and encountered people can carry recorded sex and `avatarVariant`. Preserve those values; do not reroll identity during rendering. |
| [src/types.ts](../../../src/types.ts), `FamilyMember` | Natal relatives have sex, age offset and occupation, but no stored avatar variant. A future adapter needs a stable cosmetic identity assignment. |
| [src/types.ts](../../../src/types.ts), `CharacterState.children` | Children record ID, name, birth age and other parent, but no sex or avatar variant. Do not claim either is recorded or infer sex from a name. |
| [relationship-table.ts](../../../client/models/relationship-table.ts) and [CharacterPanel.tsx](../../../client/components/CharacterPanel.tsx) | Family and social tables currently project text records. The existing spouse/partner detail has a portrait where a procedural identity is available; general table portrait binding is separate work. |
| [src/people.ts](../../../src/people.ts), [src/family.ts](../../../src/family.ts) | Simulation identity and family creation remain authoritative. Asset generation must not alter their RNG streams or historic replay. |

A future adapter may use a deterministic cosmetic hash of the life seed plus stable person ID for missing visual variants. Keep that projection independent of gameplay RNG and stable across views, role changes and origin aliases. Missing child sex requires an explicit presentation/data decision; hashing is not evidence that a sex was recorded. Any save migration, schema extension or runtime binding must be implemented and verified as its own change.
