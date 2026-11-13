# ArtCraft, provenance, and editable assets

Use the installed `artcraft-mcp` skill at `C:/Users/Legion/.codex/skills/artcraft-mcp/SKILL.md` for the actual app connection. Its `scripts/mcp.cjs` helper runs the installed CLI with `withMcp`. Start by calling `listTools()`, inspect the returned schemas, and query the app's command catalog before using command IDs. Never invent an API from these examples.

Keep dependent operations in one `withMcp` callback: document IDs belong to that process. Use the narrowest read/write roots, headless mode for file tasks, fresh output paths, and save/export before closing. Release the task-owned CLI/session through its supported lifecycle when finished; do not terminate shared services.

## Generated base plus real brushwork

The painterly base may already look brushed because it was generated. That is not evidence of app-authored brush strokes. Import and lock the base, then author any real bristle or paint strokes on named editable layers. Keep brush settings, stroke geometry, object IDs, and a stroke ledger. Export a transparent stroke overlay for source-preserving compositing when possible. Check that the overlay has nonzero alpha, changes the intended areas, leaves uncovered regions unchanged, and survives reopen/export.

Use a bounded paint proof for shadow planes, reflected halftones, cloth folds, hair accents, or existing catchlights. Report the actual number of authored paths and layers. A few corrective strokes are an accent pass, not a full hand-painted reconstruction. Discuss cost before a full repaint; use measured timing or accounting if making quantitative claims.

Local worked example, not a universal coordinate template:

- `D:/Hustle/Games/Historical Lives/artwork/cards/alexander-painterly-v3/source/paint-brushwork.cjs` — actual 30-stroke VectorCraft pass with four paint layers and QA ledger. Its coordinates and brush choices belong to that portrait.

## Card masters and components

Separate portrait, clipping/window geometry, frame, typography, rarity treatment, and icons. Reuse approved components; name layers and retain the native master. Generated clothes or equipment inside one raster layer do not become separately editable or rigged by importing them. If independently editable parts are required, actually extract/build and verify them.

For clothing, equipment, or rarity swaps, preserve a common canvas, pose, crop, anchors, occlusion order, lighting direction, and logical pixel grid across variants. Produce actual transparent components and any needed body/garment masks on separate named layers. Keep eyes, hands, and shared anatomy aligned. Check representative swaps in the assembled artwork, including overlaps and seams at card size. A native card frame does not make a flattened portrait's clothing modular. State exactly which components are available and which remain flattened. Event art can retain its own scene composition; do not force a card frame onto it.

Local implementation examples (inspect and adapt; do not copy subject-specific content as defaults):

- `D:/Hustle/Games/Historical Lives/artwork/cards/alexander-equipment-v5/source/build-card.cjs` — native card frame/type construction.
- `D:/Hustle/Games/Historical Lives/artwork/cards/alexander-equipment-v5/source/export-composite-layers.cjs` — native base and transparent overlay exports.
- `D:/Hustle/Games/Historical Lives/artwork/cards/alexander-equipment-v5/source/export-crisp-card.cjs` — exact portrait composite and uncovered-pixel QA; geometry is specific to that card. See the pixel reference for adaptation criteria.
- `D:/Hustle/Games/Historical Lives/artwork/cards/alexander-aura-v6/` — latest aura-led revision, with a deliberately larger blade and flying cape. Its exaggerations express that brief; they are not universal historical proportions. The v5 folder retains the preceding equipment source/reference workflow.

ArtCraft Studio is the separate generative image/video app and was not installed for this workflow. The built-in image generator made the base; VectorCraft performed the actual native editing. Verify capability anew before claiming a different tool.
