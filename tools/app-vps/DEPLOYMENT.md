# Branch deployment record

Configured 14 November 2026. Main application code is not merged from dev as part of this setup.

| Host | Git branch | Compose project/container | Data volume | Loopback health port |
|---|---|---|---|---|
| `beta.everfolk.life` | `dev` | `everfolk-beta` | `everfolk-beta-data` | `127.0.0.1:8789` |
| `everfolk.life` | `main` | `everfolk-main` | existing `app_everfolk-data` | `127.0.0.1:8790` |

The protected operator installation is `/opt/everfolk/deploy`; its installed runner is deliberately independent of the app checkout. Configuration is `config.json`, runtime environment files are `config/main.env` and `config/beta.env` (mode 600), and successful receipts are `state/main.json` and `state/dev.json`.

`everfolk-deploy.timer` polls both branch heads two minutes after the previous check completes, with up to ten seconds of jitter. Changes build sequentially before replacing their branch container. An unchanged healthy commit is skipped. Build failures keep the existing container. The package records each image's branch, full Git revision, package version and public CDN pin; `/build-info.json` exposes only version, branch and commit with `no-store`.

The current main revision requires the documented `main-world-types-v1` type-only build-context overlay to avoid unbounded world-JSON type inference. It adds declaration files and `allowArbitraryExtensions` only; runtime TypeScript, world JSON and the main Git branch stay unchanged. The context receipt, image label and deployment receipt identify this compatibility overlay.

Main retains the original production D1 volume. Beta starts with its own empty database and origin-local browser saves. Both initially use the existing testnet integrations; the beta database does not isolate shared testnet contracts, wallets or external service quotas. Email login requires the Privy app to permit `https://beta.everfolk.life`.

The existing Caddy deployment stays at `/opt/everfolk/app`. Its host configuration uses `everfolk-main:8787` and `everfolk-beta:8787`, removes incoming `oai-authenticated-user-*`, and preserves all verified artwork routes and anonymous fallback behavior. Beta sends `X-Robots-Tag: noindex, nofollow`. Cloudflare's immutable and runtime media rules include both hosts and respect origin cache TTLs. Main media aliases remain pinned to `media-20261114-v1`. Beta aliases use `media-dev-ce7027dd` (2,152 files, 181,100,244 bytes; manifest SHA-256 `3ff6d9d4ccf650f4930078f541eb340ccb33620bf5fa73e334b4cfaba752ff88`) from dev application revision `ce7027dd`. Only four audio paths changed; all 2,092 images are identical, so the existing immutable v1 image build base remains valid. Both releases live on the independent static origin. Per-branch alias pins are recorded in `/opt/everfolk/deploy/config/media-releases.json`; preserve them when regenerating Caddy, whose generic template defaults both hosts to v1.

The initial legacy container `app-everfolk-1` is retained stopped after main adopts its volume. Do not start both applications against the same writable volume. Each deployment backs up its stopped data volume under `backups/<branch>/` before starting the new image. Recovery attempts the previous image; database migrations are not silently reversed. Inspect the recorded backup before any manual database restore.

After testing beta, merge dev into main through the normal review process. The main tracker will then deploy the new main commit; no hostname or database swap is required. Nothing in this deployment automatically merges branches.

Readiness allows five minutes for startup and consumes the complete streamed homepage with a 120-second request budget. JSON probes allow 20 seconds. Changes confined to `tools/app-vps/` update the observed branch head without rebuilding or restarting an unchanged healthy application; the served application commit remains truthful in `/build-info.json`. Beta and main have passed public HTTPS/version/API/media checks; the testnet integrations remain shared.
