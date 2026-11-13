# Everfolk ordinary portraits v3

Player, ordinary NPC and relationship portraits, rebuilt from complete anatomical models. Historical figures, titles and TCG artwork use the separate card workflow. This directory is an artwork library; runtime integration is separate.

**Runtime integration is implemented.** The [runtime state and asset map](../RUNTIME_MAP.md) documents the shared `PortraitState` resolver, random birth assignment, clothing selection and all game consumers. The immutable authoring manifest below retains its original staging metadata; current runtime status is recorded separately in [runtime-integration.json](../runtime-integration.json).

Start with [AGENT_MAP.md](AGENT_MAP.md). The [manifest](manifest.json) identifies every actual final export and its source, face mask, skin palette, garment and PixelOE passes. The [gallery](review/index.html) filters the set by identity, age and clothing.

The indexed source inventory contains 12 complete models, 24 internal face edits, four new royal/aristocrat garments and 18 retained wardrobe dependencies: 58 original PNGs with recorded prompts, provenance and hashes. The 36 retained v1 face/skin-colour references are additionally identified and hashed in each manifest skin-palette record.

## Portrait report

| Age stage | Live age range | Clothing groups per identity | Portraits across six identities |
| --- | --- | --- | ---: |
| Infant | 0–2 | Original complete-model wrap | 6 |
| Child | 3–12 | Child everyday; work for age-12 apprentices | 12 |
| Youth | 13–17 | Youth everyday, work, maritime, scholarly, performance; aristocrat/royalty from 16 | 42 |
| Adult | 18–39 | Ten adult groups | 60 |
| Middle | 40–59 | Ten adult groups | 60 |
| Elder | 60+ | Ten adult groups | 60 |
| **Total** | | | **240** |

The ten adult groups are everyday, work, maritime, commerce, scholarly, military, elite, performance, aristocrat and royalty. The shared content map covers 33 jobs, 16 origins and 16 encounter templates. Relationship labels retain the same person's identity. Recorded ordinary occupation selects its job clothing; explicit aristocratic or royal role selects the additional role outfit.

| Clothing group | Authored clothing treatment | Current jobs covered |
| --- | --- | ---: |
| Everyday | Cream linen tunic and belt | 1 |
| Work | Practical tunic with ochre work wrap | 12 |
| Maritime | Muted blue/teal shirt or shoulder wrap | 3 |
| Commerce | Ochre drape over the base tunic | 3 |
| Scholarly | Dark jade drape | 7 |
| Military | Red mantle and diagonal strap | 4 |
| Elite | Ochre mantle with border detail | 2 |
| Performance | Teal diagonal drape and decorative cord | 1 |
| Aristocrat | Indigo mantle, narrow wine-red and bronze borders, small bronze clasp | Explicit social role |
| Royalty | Royal-purple mantle, broad gold borders, gold clasp and woven sash | Explicit royal role |

Exact job IDs, names and minimum ages are in the [shared mapping](../ordinary-v1/mappings.json). [Role aliases](role-wardrobe-bindings.json) explicitly identify scholar, warrior, aristocrat and royalty wardrobes. Every group has M/F garment sources. These are game clothing families rather than exact historical uniforms.

The [retained compatibility snapshot](content-compatibility.json) checks the 0.43 map against 0.46 content. The [latest compatibility audit](qa/content-compatibility-current.json) additionally verifies current 0.47 content. Job IDs, titles and minimum ages, all 16 origin IDs and all encounter occupations still match. The records include the estate-origin display-title update and the explicit royal/aristocrat world opt-ins. Their route minimum is age 16, so the additional 12 youth outfits cover ages 16–17.

## Anatomy and style

Two M/F model families have six age-specific complete paintings each: 12 canonical models. Every painting already includes the head, natural neck, shoulders, arms and clothed torso, or the infant's complete swaddled body. Each age uses its own proportions. All identities of the same sex and age share that complete model geometry.

The 24 generated face edits supply internal facial features for identities 02 and 03; identity 01 retains the original model face. The builder takes only the internal feature oval from each edit, then restores the original complete-model alpha. Original pixels outside the feature mask, including the jaw/neck/body, remain exact before the explicit colour and clothing steps. It never cuts a head below the jaw, builds a replacement neck, narrows a torso or stretches a head onto a shirt.

The 36 identity/age skin palettes recolour reviewed skin regions, including neck and arms, while preserving painted lighting and source alpha. Clothing is fitted to the original shoulders and waist; the model itself is never warped. Original skin is protected from garment overpainting. Everyday clothes and infant wraps come from their complete model painting.

The smooth source is uniformly scaled as one complete frame onto 800 × 1000, then finished with the agreed PixelOE brush treatment: 3px coarse body and 2px finer face on a 384 × 480 export. Selection uses aligned whole 6px cells, including the eye band. Mixed portraits have no single logical grid. Both pixel passes, mask, configuration, deterministic rerender and PNG readback checks are preserved.

## Storage and verification

| Material | Location |
| --- | --- |
| Complete original models | [source/models](source/models/) |
| Complete generated edits, used only inside face | [source/faces](source/faces/) |
| New royalty and aristocrat garment originals | [source/wardrobe](source/wardrobe/) |
| Original provenance, hashes and ignored exact prompts | [source-index.json](source-index.json) |
| Native landmarks and reviewed skin masks | [model-annotations.json](model-annotations.json) |
| Derived feature models, skin variants and clothing | [components](components/) |
| Selected final exports | [portraits/mixed-3px-body-2px-face](portraits/mixed-3px-body-2px-face/) |
| All-age review sheet | [review/lifetimes-6x6.png](review/lifetimes-6x6.png) |
| Adult clothing sheet | [review/adult-wardrobe-6x10.png](review/adult-wardrobe-6x10.png) |
| Royalty, aristocrat, scholar and warrior comparison | [review/role-clothing-comparison.png](review/role-clothing-comparison.png) |
| Independent readback audit | [qa/library-audit.json](qa/library-audit.json) |
| Visual review and its limits | [qa/anatomy-visual-review.json](qa/anatomy-visual-review.json) |

The rejected v1/v2 exports are retained as history. V1 supplies the shared content map, facial feature/colour references and PixelOE engine. V2 supplies raw clothing and the regional pixel selection helper. Its anatomical assembly, narrowed necks and derived body components are excluded. The approved [two-model proof](../ordinary-v3-neck-proof/README.md) remains the record of the corrected approach.

Museum photographs in [references](references/) are unchanged comparators with credits. Generated colours and occupation groups are artistic interpretation; they are not attested professional uniforms.
