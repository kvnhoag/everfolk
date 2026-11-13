# Portrait authoring instructions

Read [libraries.json](libraries.json) and the selected library's `AGENT_MAP.md` before editing. Follow the actual manifest and QA records; a target count or partial proof does not establish a completed export. User acceptance is separate from agent/machine checks.

- The user rejected v1/v2 head and neck assembly. Keep each canonical complete model's head, jaw, natural neck, shoulders and clothed body together. Never reconstruct, cut, taper, cap or independently resize a neck/head onto a torso.
- Use shared M/F geometry for each age, with age-appropriate complete models. Every portrait includes a body; infants have complete swaddled bodies. Vary internal facial features within the approved mask, then match skin colour across face, neck and arms.
- Fit clothing to the model. Preserve the original model anatomy and skin; tailor garments rather than reshaping the person. The authoring role map distinguishes scholar, warrior, aristocrat and royalty clothing.
- Keep the agreed painterly source style and verified PixelOE finish: 3px coarse body, 2px finer face, whole aligned 6px selection cells and preserved source/pass provenance. Review anatomy and shade continuity before pixel export.
- Preserve immutable original PNGs, exact local prompts, sidecars, native landmarks, source hashes and map dependencies. Retained older libraries supply raw references, clothing, mappings and pixel helpers; their rejected anatomical assembly is excluded.
- Scope is player, ordinary NPC and relationship portraits. Historical figure likenesses, title and TCG artwork use the separate card workflow. Runtime integration requires its own task scope.

When a source, face mask, skin mask or garment changes, render the bounded proof first. After visual review, rebuild the required set, read back the exported pixels, verify the maps/hashes and update the registry only when the complete set is actually present.
