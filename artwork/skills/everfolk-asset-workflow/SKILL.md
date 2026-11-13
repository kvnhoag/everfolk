---
name: everfolk-asset-workflow
description: Create or revise reference-led historical game portraits, event scenes, and TCG art through the Everfolk workflow, with painterly generation, optional editable ArtCraft brushwork, modular assets, and a verified PixelOE finish. Use for this game asset workflow, not general image editing or historical reconstruction alone.
---

# Everfolk Asset Workflow

Create compelling historical game art with traceable forms and an editable, reproducible finish. Apply this workflow automatically when the task fits. Portraits, event scenes, and TCG illustrations can use it independently; card layout is optional.

## Direction and evidence

- Read [references/direction-and-references.md](references/direction-and-references.md) when choosing sources, a pose, clothing, weapons, or a character's aura.
- Define the character's aura, silhouette, action, gaze, and focal hierarchy before generating. Default to mature anime character design with realistic anatomy, materials, and painterly chiaroscuro; follow any supplied art direction.
- Research real museum objects and suitable painterly references. Reference the pose, clothing, and weapons; distinguish evidence, interpretation, and creative exaggeration. Do not turn one historical figure's traits into requirements for every character.
- When the user prioritizes aura, let scale and movement serve it: a deliberately enlarged reference-derived blade or flying cape can be appropriate. Label those choices as creative exaggeration rather than an exact historical reconstruction.
- Keep visible pupils and a readable gaze. Avoid generic actor likenesses and oversized Hollywood hair unless requested.
- For review, always show the actual unmodified reference photos or clearly labelled crops beside the result, with source credit. Never generate imitation reference photographs.

## Build and finish

- Use the image generation tool for the painterly base; read the installed `imagegen` skill when generating or editing. Keep the actual prompt and source image. ArtCraft Studio is a separate product: verify its installation and tools before claiming to use it; this installation has used the built-in image generator.
- For requested editable ArtCraft work, read [references/artcraft-and-editability.md](references/artcraft-and-editability.md) and the installed `artcraft-mcp` skill. Real brushwork belongs on separate named editable layers. Describe a generated base and any actual authored stroke count honestly.
- For pixel art, read [references/pixel-workflow.md](references/pixel-workflow.md) and run [scripts/pixelate.py](scripts/pixelate.py). Choose the logical grid for the asset's intended viewing size and readable eyes; 420 × 525 at scale 2 is a card preset, not a universal size. Keep the frame and type separate.
- When requested to restore detail in selected areas while preserving an approved coarse finish elsewhere, use the optional [scripts/pixelate_regions.py](scripts/pixelate_regions.py) and the regional guidance in the pixel reference. This is a mixed-grid finish; it does not change the ordinary whole-image default.
- Reuse approved frame geometry, typography, rarity treatments, icons, and components; retain editable masters. Change these only as the brief requires.
- If clothing, equipment, or rarity swaps are requested, actually build aligned transparent components or masks on separate layers with compatible pose, canvas, anchors, light, and pixel grid. Follow the component guidance in the ArtCraft reference.
- Use versioned sibling outputs. Keep references/credits, prompts, original base, source scripts/configuration, editable master, final exports, and pixel QA. Preserve source artwork and app code.

## Review and delivery

Review at full resolution and at intended display size (actual card size for cards): aura, silhouette, gaze/pupils, hands, pose, historical forms, material claims, readable type, frame alignment, and pixel integrity. Iterate the identified problem instead of replacing the whole direction without cause.

Start expensive techniques with a bounded proof. Notify the user before a full stroke-by-stroke repaint or manual-paint automation; respect their preference for bounded token use and do not invent savings. Deliver the result and reference comparison with precise provenance and limits. An editable image layer is not a rigged or independently editable outfit unless those parts were actually built.
