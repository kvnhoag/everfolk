# Everfolk artwork VPS setup

This package prepares private artwork storage and an isolated public image origin behind a CDN. It includes a detailed [system design](SYSTEM_DESIGN.md), a [design critique](REVIEW.md), an editable workload model, packing/publishing tools, a bounded load probe and optional independent backups.

For an agent changing existing artwork, follow the [retrieval, editing and VPS publication guide](AGENT_WORKFLOW.md). It covers verified source restoration, local edits, immutable publication, separate beta/production pins, frontend delivery and rollback.

The target is a Linux VPS with Bash, Docker Engine, Docker Compose v2, Python 3.10+, curl, iproute2 and GNU coreutils. The scripts do not install Docker, change SSH/firewall settings or replace an existing host web server. The package includes an optional Cloudflare Tunnel adapter. The deployed pilot uses the existing Caddy HTTPS origin instead; see the [deployment record](DEPLOYMENT.md) for its actual routes and activation status. A public CDN hostname needs appropriate DNS configuration and a suitable media-delivery service entitlement. A different CDN can use the same release layout through a separately configured origin adapter.

## What is ready and what remains

The package can prepare the VPS origin, validate configuration, pack source/public releases, verify and atomically publish releases, model traffic and run a bounded probe. The current VPS pilot and Cloudflare account settings are recorded in [DEPLOYMENT.md](DEPLOYMENT.md). Backup activation requires an independent destination. Actual capacity and public cache behavior must be measured on that server.

Local CDN-first image loading with repository fallback is implemented but its CDN base remains unset. The complete private source archive and full public delivery release are now published and verified; see DEPLOYMENT.md and ../../guide/artwork-storage.md for the active pins and source retrieval. Bulk source removal retains local originals, and existing Git history remains intact. Do not remove the only copy of an asset after an upload; first verify publication, independent backup and a successful restore.

## 1 Prepare the server

Ask the server owner to confirm that this workload and Docker are acceptable alongside their existing services. Reserve approximately 30 GB of free data space and at least 1 GiB of free RAM, with more room if backups overlap other applications. These are initial planning budgets. Read the operating system's supported [Docker installation instructions](https://docs.docker.com/engine/install/ubuntu/) if Docker is absent; installation is intentionally separate because this is a shared VPS.

Copy and extract the small setup package into a normal working directory. From that extracted `artwork-vps` directory, prepare the local origin:

```bash
sudo bash runtime/setup-vps.sh --upload-user "$(id -un)" --min-free-gib 25
curl --fail http://127.0.0.1:8788/healthz
```

This creates `/opt/everfolk-art` and `/srv/everfolk-art`. It binds only the host's loopback interface on port 8788. If occupied, select a different `--origin-port`. The supplied upload user must already exist; it receives access only to the `incoming` directory. Installer markers prevent adoption of unrelated nonempty directories. Existing releases are preserved on reruns.

First installation resolves container references to immutable digests. To use reviewed versions, pass `--nginx-image` and `--tunnel-image` with specific version tags or digests. Do not treat the default tag as a long-term patch policy. The installer retains resolved digests until an explicit refresh.

## 2 Connect the CDN

1. In Cloudflare, create a dedicated remotely managed tunnel for the artwork service. Keep its connector token private.
2. On the VPS, save that token in a temporary protected file without putting it into shell history:

```bash
umask 077
read -r -s -p 'Tunnel connector token: ' ART_TOKEN
printf '\n'
printf '%s' "$ART_TOKEN" > "$HOME/everfolk-tunnel-token"
unset ART_TOKEN
sudo bash runtime/setup-vps.sh --enable-tunnel \
  --token-file "$HOME/everfolk-tunnel-token" --reconfigure
```

3. Configure the tunnel's public application hostname, for example `media.example.com`, with service **HTTP** and URL **`origin:8080`**. The connector runs inside Compose, so `localhost:8788` is the wrong address for that route. Give this tunnel only the intended public media hostname. The connector uses outbound connections; restrictive firewalls must permit its documented connectivity. [Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/)
4. After confirming the installed connector works, remove the temporary token file from your home directory. A root-protected installed copy is used as a container secret.

The connector token is passed as a file, not a process argument or Compose environment variable. [Token-file support](https://developers.cloudflare.com/tunnel/reference/run-parameters/)

## 3 Configure cache behavior

For the dedicated media hostname, create a Cache Rule with this expression after substituting the real hostname:

```text
(http.host eq "media.example.com" and starts_with(http.request.uri.path, "/releases/"))
```

Set **Eligible for cache**. For Edge TTL, choose **Use cache-control header if present, bypass cache if not**; keep Browser TTL respecting origin headers. Do not force a one-year TTL for every status. Versioned successful files receive a one-year lifetime; errors receive `no-store`. JSON manifests need this explicit eligibility rule because default extension caching is insufficient. Public URLs must have no query string: the origin rejects query-bearing requests, and this package does not implement signed-query delivery URLs.

If available in the selected service, enable tiered caching/origin shielding. Keep the image URL stable between releases, avoid random query strings, and disable transformations that change approved pixel artwork. A long TTL does not prevent edge eviction. Confirm any account-specific settings and feature availability in [Cache Rules documentation](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/).

Cloudflare's current general CDN terms address disproportionate picture/audio/large-file use. Confirm an appropriate service or agreement for this media workload; this package does not assume that a Free, Pro or Business website plan provides unrestricted media delivery. [Service terms](https://www.cloudflare.com/service-specific-terms-application-services/)

## 4 Pack and upload an initial public release

On the development machine, from the application repository root with Node.js 24+:

```bash
node tools/artwork-vps/bin/asset-pack.mjs build \
  --kind public --select-public --source public/assets \
  --out artifacts/artwork-releases --release web-20261113-v1

node tools/artwork-vps/bin/asset-pack.mjs verify \
  --dir artifacts/artwork-releases/web-20261113-v1

scp -r artifacts/artwork-releases/web-20261113-v1 \
  uploader@YOUR_VPS:/srv/everfolk-art/incoming/
```

Replace the SSH user/host, verify the server's SSH fingerprint, and choose a new unique release ID for each publication. The multiline commands above use Bash continuation syntax; in PowerShell, put each command on one line or use PowerShell's continuation syntax.

The packer preserves bytes and relative paths. Public exports support raster images, fonts (WOFF/WOFF2/TTF/OTF), audio, parser-validated geometry/text SVG, CSS, JSON, static HTML credits and TXT/Markdown notices. Python 3.10+ is required when packing text-based public exports; Node invokes the same Python policy that the server publisher uses. `--select-public` reports unsupported formats such as JavaScript and native artwork. To include every shipped asset and font, pack `--source public` and retain its `assets/` and `fonts/` path prefixes. No public file bytes are rewritten.

On the VPS:

```bash
sudo bash /opt/everfolk-art/bin/publish-release.sh \
  --kind public --release web-20261113-v1 \
  --incoming /srv/everfolk-art/incoming/web-20261113-v1 \
  --manifest-sha256 REPLACE_WITH_AUTHORING_RECEIPT_SHA256
```

Replace the digest placeholder with `manifestSha256` from the trusted local pack/verification receipt. Obtain it from the authoring machine or a reviewed Git lock, not by hashing the uploaded copy on the VPS. The publisher requires that digest, rechecks all hashes, copies into protected staging, verifies the copy, checks free space and atomically creates a new release. Existing IDs cannot be overwritten. The uploaded copy is preserved; after publication/backup verification, remove only the specific staging upload you no longer need. The tools do not run automatic cleanup.

A file originally at `public/assets/cards/collection-v14/example.webp` becomes:

```text
https://media.example.com/releases/web-20261113-v1/payload/cards/collection-v14/example.webp
```

The filename above is illustrative; use an actual manifest entry. The release manifest is at `/releases/web-20261113-v1/manifest.json`.

## 5 Pack private source libraries

Use one source library per release and preserve its dependencies. For example, from the application root:

```bash
node tools/artwork-vps/bin/asset-pack.mjs build \
  --kind private --source artwork/portraits/ordinary-v3 \
  --out artifacts/artwork-releases --release portraits-v3-20261113-v1

scp -r artifacts/artwork-releases/portraits-v3-20261113-v1 \
  uploader@YOUR_VPS:/srv/everfolk-art/incoming/
```

Then publish on the VPS with `--kind private`, the corresponding ID and `--manifest-sha256` from that source release's authoring receipt. Source releases are placed under `/srv/everfolk-art/private/releases`, which is never mounted into the web server. Private packing accepts source code and editable formats but rejects links, known credential files and local runtime/cache directories. It does not inspect arbitrary file contents for secrets; review the inventory before sending it anywhere.

Current portrait V3 depends on material from V1/V2. Current cards also use earlier illustration libraries. Archive that complete dependency set, preserve approval states and retain necessary licenses before removing any source from Git. The current package verifies an individual release; cross-library dependency resolution is application integration work.

## 6 Verify the deployed service

On the VPS, set a real published file path:

```bash
curl -sSI http://127.0.0.1:8788/releases/web-20261113-v1/payload/cards/collection-v14/ACTUAL_FILE.webp
curl -sSI http://127.0.0.1:8788/releases/missing/manifest.json
sudo docker compose --project-name everfolk-art \
  --env-file /opt/everfolk-art/runtime.env \
  -f /opt/everfolk-art/compose.yaml ps
```

Expect a 200 image response with correct MIME type, `Access-Control-Allow-Origin: *` and long-lived immutable cache control. The missing file must have 404 and `Cache-Control: no-store`. Check a private path, a directory path and a POST: they must not expose files or accept uploads. Read the manifest and independently verify retrieved image hashes.

From another machine, request the same HTTPS image twice using GET:

```bash
curl -sS -D headers-first.txt -o image-first.webp 'https://media.example.com/releases/RELEASE/payload/ACTUAL_FILE.webp'
curl -sS -D headers-second.txt -o image-second.webp 'https://media.example.com/releases/RELEASE/payload/ACTUAL_FILE.webp'
```

Inspect `CF-Cache-Status`, `Age`, response bytes and origin logs. A later request should hit a cache, but the first request may already be warm and different edge locations can behave differently. Do not claim a guaranteed cache hit rate from two requests. Run the app's image, canvas/WebGL and font checks before switching its URLs.

## 7 Estimate and measure load

Edit the placeholder link, transfer allowance, usage and hit rates in `workload.example.json`, then run:

```bash
node tools/artwork-vps/bin/capacity-model.mjs --config tools/artwork-vps/workload.example.json
```

This is arithmetic, not a measured capacity result. It separates byte hit rate from request hit rate and includes warm, degraded and cold-cache scenarios. Source downloads, backup traffic, protocol overhead and validation requests need additional allowance.

For a bounded single-image check from a separate Node.js 24+ machine:

```bash
node tools/artwork-vps/load-probe.mjs \
  --url 'https://media.example.com/releases/RELEASE/payload/ACTUAL_FILE.webp' \
  --seconds 15 --rps 5 --concurrency 4
```

For origin-only measurement, use an SSH local forward from the test machine to `127.0.0.1:8788` on the VPS and point the probe at the forwarded URL. This includes SSH overhead and does not test the tunnel. Test CDN delivery separately and monitor provider transfer counters during both. Gradually increase rate below the owner's agreed resource budget. The probe caps duration/rate/concurrency, preserves the cache key, records status/cache counts and reports successful and all-response p95 timings. It has no browser disk cache. It is a smoke/load probe, not a comprehensive benchmark or stress generator.

## 8 Enable independent backups

Install restic through the VPS operating system's package manager if required. Select a repository on a different server or storage provider, with credentials controlled by you. Create `/etc/everfolk-art` mode 0700; copy `backup/backup.env.example` to `backup.env` there as root, mode 0600, and create a root-owned 0600 password file at the configured location. Save the password independently too. Pin backup SSH host keys and verify connectivity.

```bash
sudo bash backup/backup.sh init
sudo bash backup/backup.sh backup
sudo bash backup/backup.sh check-full
sudo bash backup/install-backup-timer.sh
```

`init` is for a new repository only. The timer runs twice daily at 03:20 and 15:20 UTC plus up to 30 minutes randomized delay. Inspect `systemctl status everfolk-art-backup.timer` and `journalctl -u everfolk-art-backup.service`. Nothing automatically deletes snapshots. A sampled check is available through `backup.sh check`; full checks read all stored data.

Use restic's restore command with the configured repository/password to restore a selected snapshot to a separate empty destination. Then run `verify-release.py verify --dir ...` on restored public and private releases. Record the snapshot ID and successful manifest hashes. A snapshot list or a repository check alone does not prove your complete recovery procedure.

## Routine changes and rollback

Publish a new ID, verify it, then update the application's pinned URLs/lock. Rollback points the application to a retained previous release; no in-place file replacement is needed. Keep releases referenced by retained app deployments, world revisions and collection metadata.

To update runtime images after reviewing the chosen versions, run the original setup script with `--refresh-images --reconfigure` and any explicit image references. Back up `/opt/everfolk-art` configuration first. Restarting a connector can temporarily interrupt misses; already cached images can still work. Preserve and review the previous digest values for rollback.

To stop only this deployment:

```bash
sudo docker compose --project-name everfolk-art \
  --env-file /opt/everfolk-art/runtime.env \
  -f /opt/everfolk-art/compose.yaml --profile tunnel stop
```

This retains releases and configuration. It does not stop other Compose projects. Do not run global Docker prune commands on a shared VPS.

## Local package checks

```bash
node --test tools/artwork-vps/test/*.test.mjs tools/artwork-vps/checks/*.test.mjs
bash -n tools/artwork-vps/runtime/setup-vps.sh
bash -n tools/artwork-vps/bin/publish-release.sh
bash -n tools/artwork-vps/backup/backup.sh
bash -n tools/artwork-vps/backup/install-backup-timer.sh
```

Set `ARTWORK_PYTHON` to a real Python 3.10+ executable when running cross-language tests on Windows if `python3` resolves to the Windows Store alias. Read [VALIDATION.md](VALIDATION.md) for the checks actually completed during preparation and checks still requiring Linux/Docker/the VPS.

## Trusted web export policy

This package validates known, pinned application exports; it is not a general untrusted-upload sanitizer. SVG accepts the reviewed geometry/text element set and local fragment paint references. It rejects scripts, foreign namespaces, `foreignObject`, event attributes, href/src, animation, stylesheets, processing instructions and declarations/entities. Current shipped SVGs need none of those features. CSS rejects imports, executable declarations and escape-obfuscated tokens; HTTPS font URLs and ordinary relative URLs are retained. Static HTML credits reject active tags, event attributes, base URLs and meta refresh, while keeping HTTPS license links and relative images. JSON must be valid and contain no duplicate keys or non-finite constants.

The origin applies a script-free sandbox policy with inline styles enabled for static credits, anonymous CORS, correct MIME mappings and long-lived successful-release caching. Private source libraries continue to accept editable formats but are never web-mounted.
