# Artwork retrieval editing and VPS publication

Use this handoff when an agent needs to retrieve Everfolk artwork, change it locally, and publish the updated sources and web exports to the VPS. Finish with verified release IDs, working application URLs, and a rollback path. Uploading files alone does not activate them.

Read [the media lock](../../assets/storage/media-lock.json), [the source-storage notes](../../guide/artwork-storage.md), [the artwork deployment record](DEPLOYMENT.md), [the branch deployment record](../app-vps/DEPLOYMENT.md), and the relevant library metadata before starting. If a tracked guide is not present locally, read it with `git show HEAD:guide/artwork-storage.md`. These describe the recorded installation; confirm the live state before changing it. The commands below use PowerShell on the authoring machine and Bash on the Linux VPS.

## Establish the task and connection

Record the requested artwork changes, asset IDs, affected libraries, and target environment. Use beta for initial validation. Promote to production when that is within the user's requested scope. Preserve other agents' uncommitted work; never include unrelated artwork or audio in a release.

Use the owner's configured SSH alias/account and existing authentication. The source-storage notes record `root@139.180.190.154` and the original authoring machine's `~/.ssh/kvn_hoag` identity. Confirm that this is still the intended server and use the key or SSH agent configured on your machine; do not assume that machine-specific key path exists on Windows. Verify a new SSH host key through a trusted owner-provided fingerprint. Private retrieval requires root or an owner-approved privileged transfer because private releases use directory mode 700 and file mode 600. Do not loosen archive permissions to make downloads work.

Local tools: Node.js 24+, the repository's pinned pnpm version, OpenSSH, and Python 3.10+ for public text-export validation. On Windows, set `ARTWORK_PYTHON` to the actual Python executable if `python3` resolves to a Store alias. ArtCraft or image-generation tools are needed only for the chosen artwork workflow; load their applicable skills when editing. Keep credentials out of files, logs, prompts, and Git.

| Purpose | Canonical VPS location |
|---|---|
| Editable source releases | `/srv/everfolk-art/private/releases/<source-release>/` |
| Public delivery releases | `/srv/everfolk-art/public/releases/<media-release>/` |
| Upload staging | `/srv/everfolk-art/incoming/<new-release>/` |
| Publisher and verifier | `/opt/everfolk-art/bin/` |
| Media pin helper | `/opt/everfolk-art/bin/pin-media-release.py` |
| Live Caddyfile | `/opt/everfolk/app/Caddyfile` |
| Per-branch alias records | `/opt/everfolk/deploy/config/media-releases.json` |
| Application deployment settings | `/opt/everfolk/deploy/config.json` |

Each release contains exactly `manifest.json` and `payload/`. Use canonical paths with the verifier and publisher: they reject symlink ancestors. The convenient `~/assets/artwork` and `~/assets/media` links are archive references, not editing destinations.

The tracked lock records private `source-20261114-prune-v1` and public `media-20261114-v1`. The later branch deployment record has beta aliases on `media-dev-ce7027dd` while production remains on v1. Thus the lock alone does not describe every live branch pin. Read the selected hostname's Caddy block and per-branch records, and record its frontend image base too.

## Retrieve and verify a working copy

The complete source snapshot is about 6 GB. The recipe below keeps a verified baseline and a separate editable copy so older portrait/card dependencies remain available. Allow space for both copies, a newly packed source release, exports, and transfer staging. On the VPS, publication retains the upload and creates another verified copy; check free space before uploading.

For a well-understood library, a selective retrieval is possible after downloading and authenticating its release manifest. Retrieve every dependency and compare each selected file's SHA-256 and byte count to that manifest. There is no automatic dependency-retrieval command in this package. A partial download cannot pass full-release verification and must not replace the complete private-source pin. Use the complete recipe when the dependency set is uncertain.

Start in the repository root. Replace the SSH alias before running anything. Stop after any failed native command; do not proceed to publication with a failed check.

```powershell
$ErrorActionPreference = 'Stop'
$Vps = 'OWNER_CONFIGURED_SSH_ALIAS'
$repo = (Get-Location).Path
$lock = Get-Content -LiteralPath 'assets/storage/media-lock.json' -Raw | ConvertFrom-Json
$taskId = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-v1'
$taskRoot = Join-Path $repo "artifacts/artwork-handoff/$taskId"
$baselineRoot = Join-Path $taskRoot 'baseline'
New-Item -ItemType Directory -Path $baselineRoot -Force | Out-Null

scp -r "${Vps}:/srv/everfolk-art/private/releases/$($lock.privateSource.releaseId)" "$baselineRoot"
if ($LASTEXITCODE -ne 0) { throw 'Private source download failed' }
$baseline = Join-Path $baselineRoot $lock.privateSource.releaseId
node tools/artwork-vps/bin/asset-pack.mjs verify --dir "$baseline" --manifest-sha256 $lock.privateSource.manifestSha256
if ($LASTEXITCODE -ne 0) { throw 'Private source verification failed' }

$workPayload = Join-Path $taskRoot 'work-payload'
if (Test-Path -LiteralPath $workPayload) { throw 'Choose a fresh working-copy path' }
Copy-Item -LiteralPath (Join-Path $baseline 'payload') -Destination $workPayload -Recurse
```

The expected hash comes from the reviewed local lock, not from hashing whatever arrived from the server. If a newer source pin is needed, first reconcile its trusted authoring receipt and deployment record. Do not bypass a mismatch by substituting the downloaded manifest's hash.

The recorded complete source release puts the original artwork directory's contents directly in `payload/`. Set the source environment variable to the directory containing libraries such as `cards/`, `portraits/`, and `life-banners/`. Inspect a successor archive before assuming the same layout; never accidentally point one level too high.

```powershell
$nestedArtwork = Join-Path $workPayload 'artwork'
$env:EVERFOLK_ARTWORK_DIR = if (Test-Path -LiteralPath $nestedArtwork -PathType Container) { $nestedArtwork } else { $workPayload }
Get-ChildItem -LiteralPath $env:EVERFOLK_ARTWORK_DIR -Directory
```

Keep the baseline untouched. Store logs, receipts and screenshots under `$taskRoot`, outside release directories and source payloads. Do not add downloaded masters or archives to Git; `artwork/` and `artifacts/` are ignored.

## Edit sources and regenerate delivery files

Inspect the existing master and reference images before editing. Preserve editable layers, asset identities, library structure, licenses, prompts, provenance, and dependencies. Use the existing library's visual workflow and approval requirements. An existing approval record does not approve newly changed pixels; rerun the required review and record its actual result.

Update the relevant native masters and source manifests, then regenerate their runtime exports. Retain the agreed dimensions, transparency, pixel finish, typography and image formats unless the brief changes them. Inspect full-size exports and their actual in-game crop or thumbnail.

| Artwork | Existing entry point or metadata |
|---|---|
| Framed collection cards | `pnpm art:cards`; `scripts/sync-card-assets.mjs`; source `cards/framed-collection-v14` |
| Imported card illustrations | `pnpm art:cards:kit` and `pnpm art:cards:import`; inspect their inputs first and preserve active replacements |
| Ordinary v3 portraits | `pnpm portraits:sync`; source `portraits/ordinary-v3`, its QA records, and `portraits/libraries.json` |
| Concept 1 raster portraits/scenes | `scripts/sync-concept1-assets.mjs`; inspect its delivered-file requirements before invoking it |
| Native life banners | `assets/source/banners/native-provenance.json`, the public banner manifest, and native ArtCraft masters |

These are separate pipelines, not commands to run indiscriminately. Some regenerate a whole library. Review their resulting diff and keep only the intended changes. Update affected runtime registries, compact source metadata, hashes and license notices together with the exports under `public/`.

Run the affected art tests and the normal checks required by [CONTRIBUTING.md](../../CONTRIBUTING.md). `pnpm test:art` is the specialist suite; `node --test test/artwork-delivery.test.ts` covers CDN selection and fallback. Integrated application changes also require the repository's normal test/build checks. A successful pack verifies bytes and export policy, not visual quality.

## Pack new private and public releases

Use new IDs matching `[a-z0-9][a-z0-9-]{0,63}`. Never overwrite an old release. The commands below publish a complete successor source snapshot with the same payload layout, followed by a full public release containing `assets/`, `fonts/` and `favicon.svg` at their existing paths.

Before packing public files, ensure the tree contains the selected target branch's current media plus only the requested edits. Compare against that branch's deployed manifest, especially when beta and production differ. If the checkout contains unrelated media changes, prepare a separate public staging tree with the intended contents and use it instead of `public`. Packing from `public/assets` would lose the `assets/` prefix needed by the deployed adapter.

```powershell
$SourceRelease = "source-$taskId"
$PublicRelease = "media-$taskId"
$releaseRoot = Join-Path $taskRoot 'releases'

node tools/artwork-vps/bin/asset-pack.mjs build --kind private --source "$workPayload" --out "$releaseRoot" --release $SourceRelease
if ($LASTEXITCODE -ne 0) { throw 'Private packing failed' }
node tools/artwork-vps/bin/asset-pack.mjs build --kind public --select-public --source public --out "$releaseRoot" --release $PublicRelease
if ($LASTEXITCODE -ne 0) { throw 'Public packing failed' }

$SourceDir = Join-Path $releaseRoot $SourceRelease
$PublicDir = Join-Path $releaseRoot $PublicRelease
$SourceSha = (Get-FileHash -LiteralPath (Join-Path $SourceDir 'manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
$PublicSha = (Get-FileHash -LiteralPath (Join-Path $PublicDir 'manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
node tools/artwork-vps/bin/asset-pack.mjs verify --dir "$SourceDir" --manifest-sha256 $SourceSha
if ($LASTEXITCODE -ne 0) { throw 'Private release verification failed' }
node tools/artwork-vps/bin/asset-pack.mjs verify --dir "$PublicDir" --manifest-sha256 $PublicSha
if ($LASTEXITCODE -ne 0) { throw 'Public release verification failed' }
```

Save both successful pack/verification receipts, including IDs, manifest hashes, file counts and byte totals. Review every `excluded.paths` entry from `--select-public`; exclusions are reported, not silently approved. Public packing preserves bytes and rejects unsupported or unsafe exports. Never put editable projects, private source libraries or credentials in the public payload. Do not upload a failed build containing `.incomplete` or put receipt files inside a release root.

Compare the candidate manifests with the verified baselines: list added, removed and changed paths and confirm every change belongs to the brief. A complete source successor must retain unchanged dependencies. If you intentionally archive only one edited library, retain the full baseline pin and record that additional release separately with its dependency mapping.

## Upload and publish on the VPS

First check available disk space and that the new IDs do not already exist. Use the configured uploader's approved incoming path; its account may differ from the account used for private retrieval. In the PowerShell example, `$Vps` must have upload access to the incoming directory.

```powershell
scp -r "$SourceDir" "${Vps}:/srv/everfolk-art/incoming/"
if ($LASTEXITCODE -ne 0) { throw 'Private upload failed' }
scp -r "$PublicDir" "${Vps}:/srv/everfolk-art/incoming/"
if ($LASTEXITCODE -ne 0) { throw 'Public upload failed' }
```

Open a Bash session on the VPS. Paste the new IDs and hashes from the authoring machine's verified receipts. These variables do not carry over from PowerShell.

```bash
set -euo pipefail
SOURCE_RELEASE='REPLACE_WITH_NEW_SOURCE_ID'
SOURCE_SHA='REPLACE_WITH_LOCAL_SOURCE_MANIFEST_SHA256'
PUBLIC_RELEASE='REPLACE_WITH_NEW_MEDIA_ID'
PUBLIC_SHA='REPLACE_WITH_LOCAL_PUBLIC_MANIFEST_SHA256'

df -h /srv/everfolk-art
sudo bash /opt/everfolk-art/bin/publish-release.sh --kind private --release "$SOURCE_RELEASE" --incoming "/srv/everfolk-art/incoming/$SOURCE_RELEASE" --manifest-sha256 "$SOURCE_SHA"
sudo bash /opt/everfolk-art/bin/publish-release.sh --kind public --release "$PUBLIC_RELEASE" --incoming "/srv/everfolk-art/incoming/$PUBLIC_RELEASE" --manifest-sha256 "$PUBLIC_SHA"
```

The publisher verifies a protected copy and atomically creates a release; it retains the incoming upload. A pre-existing ID is an error, not permission to replace it. Preserve both server publication receipts. Never derive the trusted publication hash from the VPS upload itself.

Retrieve each newly published release into a fresh local restore directory and verify it against its saved authoring hash. Keep a verified independent source copy off the VPS. The deployment record says scheduled remote backups are not configured; do not claim automatic backup protection or delete the local originals after uploading.

## Activate the selected environment

Publication makes the immutable URL available, for example `https://beta.everfolk.life/releases/<media-release>/payload/assets/<actual-file>`. The application's `/assets/` aliases and its compiled image base are separate settings. Check both.

Back up the live Caddyfile, `/opt/everfolk-art/media-pin.json`, per-branch alias records and any deployment settings you will change to a protected directory. Record the selected branch's previous release, trusted manifest hash and frontend base. Keep the other hostname's routes and pin intact.

For beta, use this candidate validation in the same VPS Bash session:

```bash
sudo python3 /opt/everfolk-art/bin/pin-media-release.py --hostname beta.everfolk.life --app-upstream everfolk-beta:8787 --release-id "$PUBLIC_RELEASE" --manifest-sha256 "$PUBLIC_SHA"
```

Review the returned backup path and `Caddyfile.candidate` diff. Then apply the reviewed cutover:

```bash
sudo python3 /opt/everfolk-art/bin/pin-media-release.py --hostname beta.everfolk.life --app-upstream everfolk-beta:8787 --release-id "$PUBLIC_RELEASE" --manifest-sha256 "$PUBLIC_SHA" --apply
```

For an authorized production cutover, use `--hostname everfolk.life --app-upstream everfolk-main:8787` in both commands. Always supply both arguments: the helper defaults to production and an older upstream name. Do not regenerate the entire Caddyfile from the generic two-site template, which can reset the other environment's pin.

After successful activation, update only the selected entry in `/opt/everfolk/deploy/config/media-releases.json`, preserving its existing schema and the other branch's values. Reconcile it with the active Caddyfile and saved receipts. The helper writes a single `/opt/everfolk-art/media-pin.json` receipt for its last invocation; that file is not a complete record of both environments.

For images loaded through the frontend CDN resolver, set `VITE_EVERFOLK_ASSET_BASE_URL` to the new versioned `https://<hostname>/releases/<media-release>/payload/` base and rebuild the target application. An alias update cannot change a URL already compiled into an image. For local preview, set this variable before starting/building the app and verify the requested images.

**Deployment limitation:** the repository's current `tools/app-vps/deploy.py` reads one shared `assetBaseUrl` from `/opt/everfolk/deploy/config.json`. Changing it can cause the automatic tracker to rebuild both branches. A beta-only build-base change requires reviewed branch-specific deployment support, or another verified branch-specific build mechanism, before activation is complete. Do not temporarily change the shared setting and assume the timer will preserve it. Continue publication and local visual verification while resolving this requirement; report the exact remaining activation step if it cannot be completed within the task.

Use [the application deployment workflow](../app-vps/README.md) for necessary application builds. Preserve databases and branch separation. Keep repository public fallbacks synchronized with the new exports so CDN failures still display the correct art.

## Verify delivery and record the result

Perform full GETs from outside the VPS for the new manifest and every changed export. Compare downloaded bytes to the trusted local hashes. Check representative unchanged media too. Use exact manifest paths and canonical URLs without cache-busting query strings.

- Immutable URLs must return correct bytes and MIME type, anonymous CORS, and `public, max-age=31536000, immutable, no-transform`.
- Aliases must return the intended `X-Everfolk-Media-Release` and `public, max-age=300, s-maxage=3600, no-transform`. An edge may retain the previous alias for its existing TTL; use a targeted purge of changed alias URLs when immediate visibility is required and the task authorizes it. Never purge or rewrite retained immutable releases.
- Missing public files must remain uncached; private source paths must remain inaccessible over HTTP. Keep anonymous application fallback behavior working.
- Open the affected application screen, inspect the browser's actual image URL and displayed pixels, and check crops, sharpness, transparency and canvas/CORS use where applicable. Verify the other environment still serves its previous release. A CDN HIT or HTTP 200 alone does not prove the new art is displayed.

Update `assets/storage/media-lock.json` only to reflect the verified releases intended for that repository branch, with real hashes, totals, paths and base URL. Preserve separate beta/production records. For a complete successor private pin, also reconcile provenance that cites it: `assets/source/banners/native-provenance.json` is explicitly checked against the private lock by `test/art/banner-assets-ui.test.ts`. Confirm every referenced master is present and matches before changing those archive references; regenerate structural evidence when a master changes. Rerun affected checks after final metadata changes.

Record publication and activation separately in the deployment notes. Include the edited asset IDs, source/public release IDs and hashes, exact target hostname, actual frontend base, checks passed, independent restore location, backup paths and any remaining approval or deployment requirement. Never describe a published-but-unpinned release as live.

## Roll back and clean up

For an ordinary media rollback, validate and apply the retained previous release with its trusted hash using the same explicit hostname and upstream arguments. Restore that branch's alias record and its frontend/build pin if changed, then repeat delivery and browser checks. Account for alias/browser cache TTLs or purge only the affected mutable URLs.

If automatic rollback reports a Caddy reload failure, restore the backed-up Caddyfile's contents **in place** to preserve its bind mount, validate it with the existing Caddy container, then reload it. Restore the corresponding saved pin/branch records. Do not restart or replace unrelated containers, restore a database for an artwork-only issue, run Docker prune, rewrite Git history, or delete old releases referenced by retained builds or metadata.

Stop task-owned previews and background workers and release directory handles when finished. Remove only the specific incoming uploads or local staging copies that are no longer needed, after publication, independent backup and restore checks pass. Retain the baseline, final masters, verification evidence and rollback releases needed for recovery. Close delegated agents if any were explicitly authorized and used.
