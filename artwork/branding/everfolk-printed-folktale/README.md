# Everfolk — Printed Folktale brand kit

The approved logo uses **Eczar 600**, title case, **−0.025 em letter spacing**, and a clay-coloured terminal period. The subtle ink wear belongs to the logo treatment; the font itself is unmodified.

## Use

- `public/fonts/eczar-latin-variable.woff2`: locally hosted Eczar, weights **400–800**.
- `public/fonts/eczar-latin-ext-variable.woff2`: additional Latin characters for names and international text.
- `public/fonts/eczar.css`: standalone font-face declarations. Use the local font for headings, with DM Sans for prose and controls.
- `public/fonts/OFL-Eczar.txt`: original copyright and SIL Open Font License 1.1.
- `public/assets/branding/everfolk-wordmark-cream.svg`: transparent outlined primary logo for dark surfaces.
- `public/assets/branding/everfolk-wordmark-ink.svg`: transparent outlined primary logo for light parchment.
- `*-clean.svg`: matching silhouettes without ink wear, useful at very small sizes.
- `everfolk-monogram.svg`: compact E-and-period companion on a dark square, suitable for the favicon.
- `*@2x.png`: transparent 2560 × 582 px exports.
- `everfolk-ink-mask.png`: seamless 256 px alpha mask for the live text wordmark.
- `everfolk-parchment-grain.png`: seamless 256 px transparent paper-grain tile.

Cream logo: lettering `#e7e0c9`, period `#db9c78`. Light-surface logo: lettering `#284744`, period `#9b553e`. The SVGs contain native paths rather than live font text. Preserve their proportions and keep the period with the name.

## Source and licensing

Eczar was designed by Rosetta / Vaibhav Singh. Original copyright: **Copyright 2014 The Eczar Project Authors (https://github.com/rosettatype/eczar)**. The unmodified font files are redistributed under SIL OFL 1.1; the complete license accompanies this kit. The logo artwork is a document produced with the font and does not change the font's license.

Official sources, retrieved 11 November 2026:

- Font project: https://github.com/rosettatype/eczar
- Google Fonts source TTF: https://github.com/google/fonts/blob/main/ofl/eczar/Eczar%5Bwght%5D.ttf
- Google Fonts license: https://github.com/google/fonts/blob/main/ofl/eczar/OFL.txt
- Webfont CSS request: https://fonts.googleapis.com/css2?family=Eczar:wght@400..800&display=swap
- Latin WOFF2: https://fonts.gstatic.com/s/eczar/v27/BXRlvF3Pi-DLmz0lDO4.woff2
- Latin-extended WOFF2: https://fonts.gstatic.com/s/eczar/v27/BXRlvF3Pi-DLmz0rDO5C8A.woff2

`google-fonts-source.css` preserves the response used for the downloads. `Eczar-variable.ttf` is the upstream authoring source. `manifest.json` records the source hash, dimensions and lettering settings.

## Rebuild in the repository

Run `build-brand.py` with Python, fontTools and Pillow. It instances the source TTF at weight 600, applies GPOS kerning and −0.025 em tracking, and rebuilds the outlined SVGs and deterministic grain tiles. Run `export-brand.mjs` with Node and sharp to render the PNG exports and proof. The exporter resolves sharp directly or through this project's Next.js installation.

The downloadable `everfolk-brand-kit.zip` contains the fonts, license, logo exports, textures, authoring source and these notes. All game runtime paths are local; no Google Fonts request is needed while playing.
