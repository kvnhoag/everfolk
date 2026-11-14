# Artwork storage

Artwork source libraries and public media are stored separately from the application repository. Normal development, application builds and CI use delivered assets, compact provenance and bounded test fixtures. Authoring tools retrieve the large source archive explicitly.

## VPS layout and pinned releases

The root account has these directory links:

```text
~/everfolk/ -> /opt/everfolk/source-dev
~/assets/   -> /srv/everfolk-art
  private/releases/<source-id>/
    manifest.json
    payload/                 # Complete original artwork directory contents
  public/releases/<media-id>/
    manifest.json
    payload/assets/          # Runtime images, audio, CSS and media metadata
    payload/fonts/           # Runtime fonts and licenses
  incoming/                  # Unpublished uploads
```

Only `public/` is mounted into the public static origin. Private originals, editable files, prompts, QA records, older dependency libraries and local authoring backups are accessed through authorized SSH; they do not receive public CDN URLs.

The authoritative release references are in [`assets/storage/media-lock.json`](../assets/storage/media-lock.json):

| Release | Files | Bytes | Verification |
|---|---:|---:|---|
| Private `source-20261114-prune-v1` | 16,936 | 6,035,871,272 | Published, independently restored and fully hash-verified |
| Public `media-20261114-v1` | 2,151 | 171,496,583 | Published; every file matched its trusted hash and reached a Cloudflare cache HIT at the checked edge |

The public base is `https://everfolk.life/releases/media-20261114-v1/payload/`. The source manifest SHA-256 is `cf0dde42160e812334ea3b2079be2d08793f6e3759101479b8cb57d585e09608`; the public manifest SHA-256 is `d95558c21215683b768bbf759e8991ada71c7c769c4fdd0b39fcc9644618579a`.

These receipts preserve bytes and provenance. They do not change recorded artwork approval states. Cache entries can expire or be evicted, and a cache is not a source backup.

## Explicit authoring-source retrieval

Normal `pnpm dev`, `pnpm check`, `pnpm test`, `pnpm test:art` and application builds do not download the complete source library. The repository retains reviewed card/portrait metadata, machine-verified banner provenance and the small fixtures needed to validate delivered media. Source regeneration commands such as `pnpm art:cards` and `pnpm portraits:sync` require a materialized authoring library.

From an authorized authoring machine, copy the complete immutable release outside the checkout. Use your configured SSH identity; the following uses this deployment's existing root SSH identity. It does not disable host-key verification.

```bash
archive="$HOME/assets/source-20261114-prune-v1"
mkdir -p "$archive"
rsync -a --partial --info=progress2 \
  -e 'ssh -i ~/.ssh/kvn_hoag -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes' \
  root@139.180.190.154:/root/assets/private/releases/source-20261114-prune-v1/ \
  "$archive/"

node tools/artwork-vps/bin/asset-pack.mjs verify \
  --dir "$archive" \
  --manifest-sha256 cf0dde42160e812334ea3b2079be2d08793f6e3759101479b8cb57d585e09608

export EVERFOLK_ARTWORK_DIR="$archive/payload"
pnpm portraits:sync
# Or, with the required native rendering tools installed:
pnpm art:cards
```

`EVERFOLK_ARTWORK_DIR` names the directory containing `portraits/`, `cards/`, branding sources and the other original `artwork/` contents. Without that variable, existing authoring machines may keep using their ignored local `artwork/` directory. A missing source produces an actionable restore message; ordinary application and delivery checks continue to work without it.

Keep the downloaded release as an immutable reference. For editing, copy the necessary source and dependency libraries to a separate authoring workspace, set `EVERFOLK_ARTWORK_DIR` to that workspace, and publish a new source release after review. Do not overwrite a published release or edit the sole verified archive. Preserve sidecars, source hashes, exact prompts, licenses and older source dependencies when creating the workspace.

## Public delivery and updates

React images can use the pinned `VITE_EVERFOLK_ASSET_BASE_URL` and retry their original local file on failure. The production media adapter maps existing `/assets/` and `/fonts/` paths to the pinned public release, covering CSS backgrounds, audio and fonts as well. See [Artwork Delivery](artwork-delivery.md) for cache policy, deployment validation and rollback.

To change media, generate the reviewed delivery files, build a new immutable public release using the packaging tools, upload and verify it against its trusted manifest, then change the selected release. A new release ID changes the versioned URLs. Private source files stay outside the public export inventory. Retained local delivery files provide a transition fallback; deleting those fallback exports is a separate verified step.
