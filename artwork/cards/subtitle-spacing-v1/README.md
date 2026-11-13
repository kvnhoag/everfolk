# Contributor header spacing v1

This focused migration moves the 104 contributor title baselines up 10 native pixels and their subtitle baselines down 8 native pixels. Parent cards and variants keep their existing layout. The native canvas is 900 × 1260; the subtitle baseline becomes 171 and the title baseline becomes `93 + titleSize * .43`.

`source/migrate-header-spacing.cjs` discovers each existing glyph's occupied row bands in the approved frame overlay, retains the original antialiasing, and translates the pixels without resampling. It changes only `x=80..819, y=50..184`, leaving all illustration, lower text, edition, ornament and outer border pixels intact. All title bands, including dots and descenders, move together. There are 52 unique headers, shared by male/female pairs. Source and kit SVGs move both the `<text>` and `<tspan>` coordinates; the future frame generator uses the same baselines. Native `.vectorcraft` masters and their inspection JSON are migrated separately.

Run from either checkout using Node and that checkout's existing Sharp dependency:

```sh
node artwork/cards/subtitle-spacing-v1/source/migrate-header-spacing.cjs --repo /absolute/checkout --scan
node artwork/cards/subtitle-spacing-v1/source/migrate-header-spacing.cjs --repo /absolute/checkout
node artwork/cards/subtitle-spacing-v1/source/migrate-header-spacing.cjs --repo /absolute/checkout --apply
node artwork/cards/subtitle-spacing-v1/source/verify-migration.cjs --repo /absolute/checkout
```

The default command is a complete dry-run. It validates the reviewed source catalogue, active override fingerprints, all glyph bands and every native-size input header before mutation. The apply command backs up each changed existing file under `backup/files/`, records per-file old/new hashes, updates only contributor records in each target's own metadata, and preserves target parent variants. It does not copy a source checkout's registry wholesale. The script can run directly from the Windows-mounted path against the WSL checkout; embedded source SVGs are edited locally and need not be transferred.

The two active illustration replacements receive a new `subtitle-spacing-v1` public version. Prior immutable public files remain untouched. Portrait files are copied byte-for-byte into the new version. The ordinary importer is unchanged. `bundle/replacement.json` is a standard replacement bundle that can be independently recomposited with `checkBundle` against the updated protected frames; its real SHA-256 is recorded in active metadata. `headerMigration` retains prior version, protected-frame, bundle and file fingerprints.

The migration report and backup manifest are in `qa/` and `backup/raster-metadata-manifest.json`. Where bodyless runtime faces exist, their existing header pixels receive the same shift while biography-region pixels remain intact. Their fingerprints are updated according to the unchanged bodyless generator's input formula.

The independent verifier compares all changed rasters against their backups outside the header mask (including the correctly scaled thumbnail mask), checks every changed file's SHA-256, checks unchanged parents and original override files, validates the real replacement bundle with both public validation APIs, and reproduces the runtime registry from the canonical delivery manifest plus active overrides.

Validation completed in both checkouts. All 104 native masters reopen correctly; four native render samples cover Common through Epic and both genders. The smallest native text-box gap is 10.63 pixels, and the smallest visible glyph gap is 20 blank rows. Windows verification compared 1,248 backed-up raster files; WSL compared 1,144. Both found zero changed pixels outside the header. All 16 delivery, kit and replacement tests pass in both copies. WSL additionally passed all 117 collection source/export checks. The Windows bodyless generator reused all 136 faces without regeneration.

The running preview was refreshed and visually checked with an enlarged Campaign Soldier card. HTTP checks confirmed the served bytes for Campaign Soldier and both custom illustration replacements match their current delivery hashes. Preview screenshots are saved under `artifacts/subtitle-spacing-v1/`; WSL verification records are mirrored under `qa/wsl/`. Native transfer staging and its temporary tar archive were removed after verification.
