# Ordinary-v3 agent map

This is the complete-model rebuild following the user's rejection of v2 neck anatomy. Every portrait must retain a complete age-specific person's jaw, neck, shoulders and body. The generated face frame is a feature donor only. Never reuse v2's anatomical assembly or infer approval from geometry checks alone.

## Read in this order

1. [README.md](README.md): scope and the 240-portrait report.
2. [contract.json](contract.json): complete-model rules, naming, palette and clothing policies.
3. [source-index.json](source-index.json): originals, exact local prompt paths, provenance and hashes.
4. [model-annotations.json](model-annotations.json): native dimensions, internal face oval, protected neck row, eyes/chin, skin masks and garment landmarks for all 12 models.
5. [manifest.json](manifest.json): actual final paths and every source/component/PixelOE dependency. An absent or partial manifest is not a complete build.
6. [qa/library-audit.json](qa/library-audit.json) and [qa/anatomy-visual-review.json](qa/anatomy-visual-review.json): readback checks and the actual visual review scope.
7. [role-wardrobe-bindings.json](role-wardrobe-bindings.json): explicit scholar, warrior, aristocrat and royalty aliases. The latter two add youth/adult/middle/elder outfits from age16 beyond the 33 ordinary job bindings.

## Identity, naming and lookup

The stable identities are `m01`, `m02`, `m03`, `f01`, `f02`, `f03`, corresponding to recorded sex and zero-based avatar variants 0, 1, 2. The stages are infant, child, youth, adult, middle and elder; use the live age boundaries in the report. Changing profession or relationship role must preserve the identity.

| Asset | Naming or authority |
| --- | --- |
| Complete anatomical original | `source/models/ef-model-{male,female}-{stage}-v3.png` |
| Internal face edit donor | `source/faces/ef-face-{identity}-{stage}-v3.png` for 02/03 |
| Feature-preserved complete model | `components/feature-models/ef-features-{identity}-{stage}-v3.png` |
| Skin-matched complete model | `components/models/ef-model-{identity}-{stage}-v3.png` |
| New role clothing originals | `source/wardrobe/ef-w-{male,female}-{aristocrat,royalty}-v3.png` |
| Outfit and portrait | `ef-p-{identity}-{stage}-{wardrobe}-v3` |
| Final selected image | Manifest `portraits[].path` |
| Content map | [ordinary-v1/mappings.json](../ordinary-v1/mappings.json) |

Each final record includes its complete-model binding, assembly, coarse/fine passes, region mask/configuration, source hashes and QA. Follow recorded paths instead of reconstructing component names. All final PNGs are RGB, 384 × 480, with an authored jade background. Native complete models and intermediate outfits retain transparent RGBA silhouettes.

The 58-entry source index covers this library's 40 primary originals and 18 raw clothing dependencies. The additional 36 retained v1 colour/feature references are traced through `skinPaletteModels[].skinReference` / `skinReferenceSha256` and generation reference paths. Keep those v1 heads even though no detached head is used in the v3 anatomy.

## Rebuild sequence

Use the existing local Python environment with Pillow, NumPy, OpenCV, Torch and the existing PixelOE runtime. Nothing needs installing. In PowerShell from the repository root:

```powershell
$portraitPython = 'C:/Users/Legion/.codex/runtimes/nature-skills/venv/Scripts/python.exe'
& $portraitPython artwork/portraits/ordinary-v3/scripts/index-sources.py
& $portraitPython artwork/portraits/ordinary-v3/scripts/build-library.py --proof --overwrite
```

Inspect the smooth 36 lifetime variants and 60 adult clothing views, plus native close-ups. Confirm actual anatomy, clean colour transitions, matching neck/arm shades and garment fit. The complete source painting is the anatomical authority; a hash match cannot establish that the source was anatomically correct.

```powershell
& $portraitPython artwork/portraits/ordinary-v3/scripts/build-library.py --build --overwrite
& $portraitPython artwork/portraits/ordinary-v3/scripts/build-review.py
& $portraitPython artwork/portraits/ordinary-v3/scripts/verify-content.py
& $portraitPython artwork/portraits/ordinary-v3/scripts/verify-library.py
& $portraitPython artwork/portraits/ordinary-v3/scripts/register-library.py
```

`--overwrite` applies only to task-owned derived outputs. Preserve original source PNGs and their exact prompts/provenance. `--runtime` can point to the existing PixelOE site-packages directory. Run the proof again after any new source, mask, palette or clothing change.

The pixel engine dependency is [v1/scripts/build-library.py](../ordinary-v1/scripts/build-library.py); only its upstream PixelOE and review helpers are used. The regional composition dependency is [v2/scripts/regional-finish.py](../ordinary-v2/scripts/regional-finish.py). No v2 body/neck assembly is imported.

## Content and runtime handoff

The manifest covers 33 jobs, 16 origins, 16 encounter templates and 288 existing SVG portrait slots. These bridges are data for a later adapter. A recorded job selects its wardrobe. Origin is upbringing, not a uniform. Unknown occupation uses age-appropriate everyday clothing. The child work asset supports age-12 apprentices.

Check [content-compatibility.json](content-compatibility.json) for current content and privileged route gates. In 0.46, `world.royalty` / `world.aristocracy` plus the life's matching origin ID explicitly identify those routes; use the life's own immutable world revision. Royal/aristocrat wardrobes are available from age 16, including youth portraits. The retained 0.43 map stays unchanged; the compatibility record documents the estate-origin title override.

The manifest's compatibility snapshot is retained unchanged at 0.46. [qa/content-compatibility-current.json](qa/content-compatibility-current.json) separately tracks the latest successful current-world audit (0.47 at completion). `verify-content.py` refreshes only that audit, preserving the source snapshot and final manifest hashes.

Compatibility fingerprints the actual portrait inputs: job IDs/titles/minimum ages, origin IDs/titles, encounter occupations and the royal/aristocrat route origin/age gates. Unrelated story or economy edits can change the full world hash while preserving these checked portrait inputs.

The 12 youth role additions were rendered with `--proof --proof-roles-youth`, then `--extend`, using the verified archived 228-image manifest. [qa/incremental-reuse-240.json](qa/incremental-reuse-240.json) proves all old images, palettes and records remained exact. This cache is only valid while its input hashes match; use the full `--build` for a complete source rebuild.

Friends, enemies, business partners, teachers, disciples, romantic partners, spouses and family members keep the same person's face. Use stable saved identity data; do not consume simulation RNG during rendering or infer sex from names. The library does not invent missing simulation identity fields.

The authoring rebuild originally staged these assets. Runtime integration is now implemented and documented in [RUNTIME_MAP.md](../RUNTIME_MAP.md). The game uses a pure `PortraitState` projection and the delivered PNG registry across player, NPC and family views. Portraits are assigned by the existing seeded birth/encounter engine, with no chooser or new simulation state. Historical figures and title/TCG artwork remain outside this library.
