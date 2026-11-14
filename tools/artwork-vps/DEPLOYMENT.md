# Deployed artwork storage and delivery

Verified migration: 14 November 2026.

## VPS layout

The root account uses these directory links:

```text
~/everfolk -> /opt/everfolk/source-dev
~/assets   -> /srv/everfolk-art
~/assets/artwork -> private/releases/source-20261114-prune-v1/payload
~/assets/media   -> public/releases/media-20261114-v1/payload
```

`artwork` is an immutable archive reference, not an authoring workspace. Restore a working copy before editing. The application deployment remains `/opt/everfolk/app`; the existing game container and database were not rebuilt or replaced for this cutover.

## Verified releases

| Release | Contents | Verification |
|---|---|---|
| `source-20261114-prune-v1` | 16,936 private source files, 6,035,871,272 bytes, including original images, editable projects, prompts, sidecars, older dependencies, untracked backups and four hydrated LFS ZIPs | Full SHA-256 checks passed for a complete local backup, private VPS publication and an independent restore copy |
| `media-20261114-v1` | All 2,151 runtime public files, 171,496,583 bytes; images, audio, fonts, CSS, manifests and licenses | Every full GET matched its source hash and every file reached Cloudflare HIT at the checked CDG edge |

Trusted manifest SHA-256 values:

```text
private: cf0dde42160e812334ea3b2079be2d08793f6e3759101479b8cb57d585e09608
public:  d95558c21215683b768bbf759e8991ada71c7c769c4fdd0b39fcc9644618579a
```

The tracked [media lock](../../assets/storage/media-lock.json) pins both releases. A complete verified independent copy is on the authoring machine at `/home/wdrag/workspace/kvn_hoag/everfolk-artwork-archive/source-20261114-prune-v1/payload`. Scheduled remote backups are not configured.

Private release permissions are 700/600. Nginx mounts only `/srv/everfolk-art/public` read-only; private archive URLs return 404/no-store. Source files are never published as web assets.

## Live routing and caching

The runtime is `/opt/everfolk-art`; `everfolk-art-origin-1` serves the public tree as nonroot Nginx with a read-only container, a 1 CPU / 256 MiB ceiling, loopback host port 8788 and Docker network `everfolk-art_artwork`.

Caddy serves these paths:

- `/releases/*` goes to the static origin. Immutable successful releases use `public, max-age=31536000, immutable, no-transform` and anonymous CORS.
- GET/HEAD `/assets/*` and `/fonts/*` resolve against the pinned full public release. Mutable aliases use `public, max-age=300, s-maxage=3600, no-transform`.
- Missing files, upstream errors and bounded timeouts fall back anonymously to the existing application, preserving the original URI/query. Fallback/error responses use `no-store`.
- Other application routes retain their previous behavior.

Cloudflare Free uses Full (strict) TLS. Both apex A and www CNAME records are proxied. Porkbun delegates to `nelci.ns.cloudflare.com` and `yoxall.ns.cloudflare.com`.

Two active Cloudflare rules respect origin edge/browser TTLs: `Everfolk immutable artwork` covers apex `/releases/` with no query; `Everfolk runtime media` covers apex GET/HEAD `/assets/` and `/fonts/`. The latter prevents the zone's default four-hour browser TTL from overriding the shorter alias policy. No paid cache add-on or Tunnel is enabled.

TTF/OTF MIME mappings are explicit. After correction, only the two affected versioned TTF URLs were purged; both returned correct font/ttf bytes and MISS then HIT. Canonical missing/query/POST/hidden-path tests remain uncached. A HIT at one checked edge is not a guarantee of global or permanent retention.

## Pinning and rollback

The validated helper is `/opt/everfolk-art/bin/pin-media-release.py`; it writes `/opt/everfolk-art/media-pin.json` only after candidate validation, graceful Caddy reload, game health, asset hash and audio range checks. Its real-Caddy integration suite covers source failures, timeouts, credentials and unchanged non-media error behavior.

Current media-pin backup:

```text
/opt/everfolk-art/integration-backups/20261114T152842-media-218169
```

The original network integration backup remains `/opt/everfolk-art/integration-backups/20261114T133903-209908`. The font MIME backup is `/opt/everfolk-art/config-backups/20261114T152633Z-ttf-mime/nginx.conf`.

To change a public release, publish and verify a new immutable ID, then run the pin helper with its trusted authoring manifest hash. Review the candidate first; add `--apply` for the validated cutover. Preserve the current pin/config first. For rollback, restore the prior Caddyfile in place to preserve its bind mount, validate it and reload Caddy. Restore its corresponding pin receipt. Do not prune Docker or stop unrelated game services.

## Repository and local development

Bulk `artwork/` sources are archived externally and excluded from normal application images. The source-removal change retains compact reviewed metadata, renderer code and bounded test fixtures; public delivery files remain as the requested local fallback. Existing Git history is retained.

Authoring commands use ignored local `artwork/` or `EVERFOLK_ARTWORK_DIR`. Normal checks and art tests run without the complete source library. See [source storage](../../guide/artwork-storage.md) for explicit restore instructions.

Local `.env.local` now selects `https://everfolk.life/releases/media-20261114-v1/payload/` for CDN-first image loading with the identical repo image as fallback. Actual browser decoding and canvas/CORS checks passed. Production uses the Caddy adapter for all media; no unrelated frontend/audio changes were deployed.

Proofs remain under ignored `artifacts/full-public-migration/`, `artifacts/artwork-prune/source-20261114-prune-v1/` and `artifacts/media-pin/`. The public source tree was unchanged by packing, publication and CDN verification.
