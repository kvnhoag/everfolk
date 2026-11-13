# Everfolk portrait libraries

The current authoring library is [ordinary-v3](ordinary-v3/README.md): **240 rebuilt player, ordinary NPC and relationship portraits** from 12 complete anatomical age models. The set has independent readback and documented visual review and is awaiting the user's review. Historical figures, titles and TCG art remain in the separate card workflow.

Start with [ordinary-v3/AGENT_MAP.md](ordinary-v3/AGENT_MAP.md). The [version registry](libraries.json) identifies the current library programmatically. Use the [manifest](ordinary-v3/manifest.json) for actual final paths and dependencies.

| Authority | Location |
| --- | --- |
| Scope and portrait report | [ordinary-v3/README.md](ordinary-v3/README.md) |
| Complete-model and style contract | [ordinary-v3/contract.json](ordinary-v3/contract.json) |
| Native face regions, skin masks and garment landmarks | [ordinary-v3/model-annotations.json](ordinary-v3/model-annotations.json) |
| Original PNGs, exact local prompts and provenance | [ordinary-v3/source-index.json](ordinary-v3/source-index.json) |
| Selected final portraits | [ordinary-v3/portraits/mixed-3px-body-2px-face](ordinary-v3/portraits/mixed-3px-body-2px-face/) |
| Filterable gallery | [ordinary-v3/review/index.html](ordinary-v3/review/index.html) |
| Source, anatomy-preservation and pixel readback | [ordinary-v3/qa/library-audit.json](ordinary-v3/qa/library-audit.json) |
| Visual review scope and limits | [ordinary-v3/qa/anatomy-visual-review.json](ordinary-v3/qa/anatomy-visual-review.json) |
| Shared jobs, origins and encounter mapping | [ordinary-v1/mappings.json](ordinary-v1/mappings.json) |
| Scholar, warrior, aristocrat and royalty wardrobe aliases | [ordinary-v3/role-wardrobe-bindings.json](ordinary-v3/role-wardrobe-bindings.json) |
| Current world and privileged-route compatibility | [ordinary-v3/qa/content-compatibility-current.json](ordinary-v3/qa/content-compatibility-current.json) |

V3 keeps the original whole model's jaw, neck, shoulders and body together. Generated variants contribute internal face features; matching skin colours and fitted clothing follow, then the agreed PixelOE 3px body / 2px face finish. The native source silhouette is preserved. Pixel and hash checks complement visual inspection; they do not establish user acceptance.

The [v3 two-model proof](ordinary-v3-neck-proof/README.md) records the approved method. [V2](ordinary-v2/README.md) remains rejected for neck anatomy. V1 final exports are superseded. Keep both older directories because V3 uses their raw face/colour references, clothing, mappings, PixelOE engine and regional selection helper. Their anatomical assembly is excluded.

The [runtime integration map](RUNTIME_MAP.md) now documents the game's portrait state and delivered assets. Player, NPC and family views use the v3 PNGs. The existing seeded birth/encounter identity is retained, with no portrait chooser. The source authoring manifest remains unchanged historical evidence; [runtime-integration.json](runtime-integration.json) records current integration separately.
