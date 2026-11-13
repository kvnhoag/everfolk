# PixelOE finish and crisp card export

Read this for pixel art or a card export. PixelOE's contrast-aware downsampler preserves local light/dark structure after an outline-aware prepass. It is not a blur, a generic nearest-neighbour mosaic, or an instruction to paint a pixel-looking generated image. Nearest neighbour is used only for the final integer enlargement; it is not a substitute for the PixelOE transformation.

## Runtime and command

Do not bundle dependency installations into the skill. This workspace already has PixelOE 1.0.0 legacy CPU dependencies at:

`D:/Hustle/Games/Historical Lives/artifacts/pixeloe-runtime/site-packages`

The working Python is:

`C:/Users/Legion/.codex/runtimes/nature-skills/venv/Scripts/python.exe`

Example (replace output with a fresh versioned destination):

```powershell
& 'C:/Users/Legion/.codex/runtimes/nature-skills/venv/Scripts/python.exe' 'C:/path/to/everfolk-asset-workflow/scripts/pixelate.py' --input 'C:/art/source.png' --output 'C:/art/v2/portrait-pixel.png' --runtime 'D:/Hustle/Games/Historical Lives/artifacts/pixeloe-runtime/site-packages' --logical-width 420 --logical-height 525 --scale 2 --qa 'C:/art/v2/pixel-qa.json'
```

The default 420 × 525 logical grid and integer scale 2 reproduce one approved card preset. Select another grid for other assets. Choose it by intended display size, eye/pupil readability, face structure, equipment edges, and stylistic chunk size. Integer enlargement cannot recover a lost eye; revise the base or logical grid instead of smoothing the finish. Review candidate grids at the intended size before committing.

The helper writes an enlarged PNG, a `.logical.png` PNG, and QA JSON. `--logical-output` and `--qa` can choose their paths. Existing outputs require `--overwrite`; the source can never be an output. It accepts 8-bit opaque RGB or fully opaque RGBA. Meaningful alpha is rejected with an explicit error: this helper does not preserve transparent cutouts. Keep modular RGBA source components and masks editable, assemble the selected variant, then deliberately composite onto its opaque background before pixelating the art. Isolated transparent pixel cutouts require a separate alpha-safe process and validation. Input aspect ratio is fitted to the chosen logical ratio by upstream PixelOE; crop/compose beforehand when stretching would distort the figure.

Optional `--config` accepts JSON keys `patch_size` (default 4), `thickness` (1), `color_matching` (true), and `palette_colors` (null). Palette reduction is off by default. A specified integer palette count applies deterministic seeded k-means to the logical image, then verifies the actual unique-colour count. Compare skin, hair, pupils, and shadows before accepting a reduced palette. The helper does not silently apply colour styling or smoothing.

## Exact-grid guarantees

The helper uses upstream `pixelize(... no_downscale=True)` followed by upstream `contrast_based_downscale`. PixelOE's area-to-width/height float conversion can truncate a requested logical grid by one row/column. The downsampler target is `sqrt(width * height) + 1e-6`; this retains upstream behaviour while avoiding that rounding error. The script verifies the resulting dimensions rather than padding, cropping, or interpolating a mismatch away.

It renders twice and compares every logical pixel, enlarges only with `INTER_NEAREST`, reads both PNGs back, checks every integer block, and verifies the source SHA-256 is unchanged. QA records settings, runtime versions, dimensions, hashes, and the checks. The default settings have been compared byte-for-byte with the existing v5 approved pixel PNG. Determinism is verified in the current runtime, not promised across every library version.

## Optional regional detail while preserving a coarse base

Use `scripts/pixelate_regions.py` only when the brief calls for selected finer detail while keeping the approved coarse finish elsewhere. It uses the identical painting as the verified coarse pass. It makes a full finer PixelOE contrast pass, then chooses complete aligned cells from either pass; it does not regenerate, sharpen, paint eyes, or mix colours/alpha. For the tested 3-pixel coarse and 2-pixel detail profile, the common cell is 6 × 6 output pixels. Both underlying grids start at (0,0), and the output is explicitly a **mixed-grid image**, not one logical grid.

Required arguments are `--input` (original painting), `--base` (approved coarse PNG), `--base-qa` (its `pixelate.py` QA JSON), `--config`, `--runtime`, and `--output` (fresh PNG). Optional `--qa` changes the QA path; `--mask` saves the binary selection mask, and `--detail-output` saves the full finer pass for review. `--overwrite` permits replacing destinations but never the painting, coarse base, metadata, or config. The same opaque 8-bit RGB/RGBA boundary applies.

The required JSON configuration contains exactly these keys:

- `base_pixel_size`: positive integer, matching the verified coarse PNG and QA scale.
- `detail_pixel_size`: smaller positive integer; output width and height must be divisible by the least common multiple of both pixel sizes.
- `detail_outline_thickness`: nonnegative integer. The tested face-detail profile uses 0 so the finer pass does not thicken small eyes.
- `regions`: nonempty list of `{ "name": "...", "center": [x,y], "radius": [rx,ry], "inner_scale": 0.82 }`. Coordinates and positive radii are in **output pixels**, with a finite inner scale strictly between 0 and 1. Define regions for each actual composition; do not copy portrait coordinates onto another pose.
- `critical_boxes`: list of `{ "name": "...", "box": [x0,y0,x1,y1] }`, using exclusive x1/y1 output coordinates. Every pixel of each box must select the finer pass; an empty list is allowed when no critical ROI is required.

For each common-cell centre, elliptical distance gives full finer weight inside `inner_scale`, a linear transition to zero at the ellipse, and zero outside. Overlapping regions take the maximum weight. A globally registered 4 × 4 Bayer threshold `(entry + 0.5) / 16` selects whole common cells, creating a hard-choice transition without a soft face patch. The selected cells may straddle the mathematical ellipse edge because selection operates at cell centres; the saved binary mask is the exact changed-area boundary.

The helper verifies the painting and base hashes against base QA, dimensions and registered coarse blocks, repeated fine rendering, finer integer blocks, whole common-cell selection, critical-box coverage, lossless readback, and unchanged protected files. It requires every unselected pixel to equal the approved base and every selected pixel to equal the finer pass. QA records the affected and actually changed pixel counts, zero outside-mask differences, hashes, region configuration, and mixed-grid provenance. It does not claim a single logical grid or apply any global change to the coarse base. Review the face and transition at actual card size before acceptance.

## Frame, type, and the native export

Keep frame and type outside the PixelOE transformation. Preserve the native editable card master and separate native base and transparent frame/type overlay exports. In this installation, VectorCraft's image placement/export slightly interpolates the portrait even at its intended size. Inspect a native export before assuming it preserves a pixel grid.

For the delivery PNG, composite the original pixel PNG at 100% onto the native base, then place the transparent native overlay above it. Match integer portrait size and position to the window; apply only the required clipping mask (e.g. hard outer corners), never an interpolating resize. Confirm source and export dimensions first. Compare every fully opaque portrait pixel not covered by the overlay against the original portrait, and require zero differing channels. Check intended outer transparency and keep native-export versus delivery-export provenance clear.

Use the local `export-crisp-card.cjs` example linked in the ArtCraft reference for geometry and QA mechanics. Its 900 × 1260 canvas, 840 × 1050 portrait, position (30,30), radius 10, subject, and filename are example-specific. Derive these from each actual native master; do not transfer them blindly. No generic compositor is bundled because window geometry, clipping, layer visibility, and blend behaviour must be read from the current master.

When making thumbnails or review sheets, retain an exact full-resolution PNG and state the review scale. Use nearest-neighbour only when resizing the pixel artwork. Review type legibility and overall balance at true card size in addition to checking the raw pixels.
