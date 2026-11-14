# CDN images with local fallback

Runtime images share `client/lib/artwork-delivery.ts` and `ArtworkImage`. The optional public build setting `VITE_EVERFOLK_ASSET_BASE_URL` points to an immutable public-root release, for example:

```dotenv
VITE_EVERFOLK_ASSET_BASE_URL=https://everfolk.life/releases/media-20261114-v1/payload/
```

The local `.env.local` now selects the published `media-20261114-v1` release. This changes development image requests to versioned CDN URLs while retaining the same repository image as fallback. Source files and delivered fallback files are retained during migration verification. Production uses the independently pinned Caddy adapter below until a reviewed application build enables this same client setting.

With a valid release configured, authored image paths first use that CDN release. A failed request or an eight-second initiated-request timeout retries the exact original repo image once. If the local image also fails, the wrapper invokes the view's existing `onError` handler. Existing semantic portrait/banner fallbacks therefore run after transport recovery. Lazy images do not start a timeout merely because they are mounted offscreen. A source or release change resets the attempt state.

The booster canvas uses the same URL plan and bounded retry policy. It requests anonymous CORS before assigning each URL; a failed CDN image never becomes the returned canvas source. External NFT URLs, data URLs and blob URLs are left unchanged by the URL retriever. Canvas callers still require CORS-capable external images.

The shared React wrapper covers game portraits, banners/actors, collection and figure cards, roster images, logos, help screenshots and NFT portrait views. It retains the authored pixel path in a data attribute so pixel-rendering CSS survives a CDN URL. CSS backgrounds, font files and audio retain their authored `/assets/` or `/fonts/` URLs. In production, the Caddy media adapter serves those URLs from external storage. Local development still retains its repository delivery files for those paths. Registry and save identities are unchanged.

Keep the base URL public, HTTPS, credential-free and ending in `/releases/<release-id>/payload/`. Loopback HTTP is accepted for local checks. Invalid configuration falls back to local delivery. The origin/CDN must return correct MIME types and `Access-Control-Allow-Origin: *` for public images. Query-string cache busters are dropped from CDN requests because the release pins the bytes; the local fallback retains the original URL.

Validation covers a temporary mock CDN and real browser image decoding. The selected real release is public and immutable; deleting local fallback files remains a separate step after successful CDN, fallback and recovery checks.

## Production media storage adapter

`tools/artwork-vps/runtime/pin-media-release.py` pins legacy `/assets/*` and `/fonts/*` GET/HEAD requests to a verified external public release. It strips lookup query strings and credentials only for those public media requests. Missing files, upstream 5xx responses, connection failures and header timeouts recover through the existing anonymous app asset route using the original path and query; fallback responses receive `no-store`. Non-media app routes retain their existing routing.

Mutable legacy aliases receive `Cache-Control: public, max-age=300, s-maxage=3600, no-transform`; the versioned `/releases/<id>/payload/` files retain one-year immutable caching. Cloudflare's separate Browser Cache TTL can raise the visible browser TTL, so configure the legacy media rule to respect origin headers if five-minute browser freshness is required. A new app build should use the versioned base directly for images.

On the VPS, copy the helper to `/opt/everfolk-art/bin/pin-media-release.py`, then validate before applying:

```bash
python3 /opt/everfolk-art/bin/pin-media-release.py \
  --release-id media-20261114-v1 \
  --manifest-sha256 d95558c21215683b768bbf759e8991ada71c7c769c4fdd0b39fcc9644618579a

# Repeat with --apply after reviewing the candidate and full-release verification.
```

The helper validates root-owned paths, the trusted manifest, container ownership/mounts/network and the candidate Caddy configuration. Apply reloads Caddy in place, checks the game, media hashes, query handling, missing-file fallback and audio range delivery, and writes `/opt/everfolk-art/media-pin.json` only after those checks pass. Failed apply restores the previous Caddyfile and reloads it. Each run records the prior config under `/opt/everfolk-art/integration-backups/`.

For manual rollback, use the exact recorded backup: copy its `Caddyfile.before` contents into `/opt/everfolk/app/Caddyfile` **in place**, validate and reload Caddy, then restore `media-pin.before.json` (or remove the current pin only if the recorded backup had no previous pin). Do not replace the bind-mounted Caddyfile inode. Full source archives live under `~/assets/private/`; only `~/assets/public/` is mounted into the public origin.

The isolated real-Caddy integration test is `python3 tools/artwork-vps/test/media-pin.integration.py`; it uses loopback mock upstreams and a temporary labelled Caddy container, then cleans up its workers. It requires the existing official `caddy:2` image and Docker on Linux.
