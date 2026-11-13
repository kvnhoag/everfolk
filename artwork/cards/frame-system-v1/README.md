# Everfolk card frames — first layout study

The generated concept in `review/Everfolk-frame-concept.png` is the visual study. The reusable templates are separately authored SVG geometry; they do not embed that generated raster. Both variants are **900 × 1260 pixels**, with transparent rounded outer corners. These are digital exports without print bleed.

- **Standard:** deep jade body, bronze double rule, restrained laurel corners, title rail, and an independent ivory text panel. The chamfered artwork window occupies **x50, y190, width800, height740** and is genuinely transparent. Place illustration beneath the frame.
- **Legendary / full art:** illustration underlays the entire 900 × 1260 canvas. The overlay has a fine gold rule, tiny corner ornaments and transparent jade fades for readable floating type. There is no opaque border mat or lower text panel. Keep faces and important objects clear of the top name and lower copy zones.

`templates/*-frame-only.svg` and `exports/*-frame-only.png` contain no text. `templates/*-layout.svg` and `exports/*-layout.png` add editable placeholder type, the existing Everfolk wordmark and catalogue placeholder. The existing crowned scarab is native vector geometry in all variants. SVG groups separate `frame`, `readability`, `emblem`, `type` and `footer`.

SVG layouts embed the project's Eczar and DM Sans WOFF2 fonts for browsers that support SVG webfonts. PNGs use installed Georgia/Arial fallbacks because the sharp/librsvg renderer does not load CSS webfonts; no fonts were installed. The approved Eczar wordmark is exact vector geometry. Open the SVG in a supporting browser/editor to use the embedded font or select installed Eczar/DM Sans there.

The copy is placeholder content. No combat statistics or game rules are proposed, and this study does not establish a rarity hierarchy beyond the requested legendary full-art treatment. Existing source artwork and earlier card versions are preserved.

Rebuild from the project directory:

```powershell
node artwork/cards/frame-system-v1/source/build-templates.cjs
```

No dependencies are installed. The builder uses the project's existing sharp package, writes four SVGs, four transparent PNGs, a checkerboard review proof, and `source/template-export-qa.json`. Checkerboard is present only in the labelled review proof, never in the usable exports. Alpha checks verify outer corners and the entire central art field. The script exits after rendering and owns no persistent worker.
