# Everfolk branch deployments

| Host | Tracked Git branch | Runtime | Persistent data |
|---|---|---|---|
| `https://beta.everfolk.life` | `dev` | `everfolk-beta` | `everfolk-beta-data` |
| `https://everfolk.life` | `main` | `everfolk-main` | Existing `app_everfolk-data` |

The beta site is the testing environment. Nothing in this package merges, rebases or pushes a Git branch. Production changes only when `main` changes. Browser saves are origin-specific; beta and production do not share a writable database. Both builds use the already verified immutable artwork release on the apex CDN, with repository public assets retained as fallbacks.

## Installation

This package assumes the existing VPS Docker/Compose installation, the `app_default` network, the independent artwork origin and the existing Caddy service. It does not install Docker, change the firewall, create accounts or configure DNS. The public DNS record for beta must point to the existing proxied origin.

Install `deploy.py` as `/opt/everfolk/deploy/bin/deploy.py` and an edited `config.example.json` as `/opt/everfolk/deploy/config.json`. The deployment root and config must remain root-owned and writable only by root. Create the two configured env files with mode `600`. Keep production secrets in `env/main.env`; configure beta separately. Do not commit real env files. Privy email sign-in needs the beta URL in the Privy application's allowed origins.

Install `everfolk-deploy.service` and `everfolk-deploy.timer` under `/etc/systemd/system/`, then run `systemctl daemon-reload`. Build and verify the initial deployments manually before enabling the timer:

```bash
python3 /opt/everfolk/deploy/bin/deploy.py --branch main --build-only
python3 /opt/everfolk/deploy/bin/deploy.py --branch dev --build-only
python3 /opt/everfolk/deploy/bin/deploy.py --branch dev
python3 /opt/everfolk/deploy/bin/deploy.py --branch main
python3 /opt/everfolk/deploy/bin/deploy.py --status
```

The first main deployment stops only the verified legacy `app-everfolk-1` container after its new image finishes building. It preserves the old container and image, snapshots its production data volume, and starts `everfolk-main` using that same volume. The old Caddy upstream must then be switched to `everfolk-main:8787`. Install and validate the separately supplied `render-caddy.py` output at that cutover; it preserves the verified artwork routes, strips externally supplied trusted identity headers, and sets `no-store` on API and build-info responses. Caddy remains the only public application ingress; health ports `8789` and `8790` bind to loopback.

After checking both HTTPS sites and the expected branch/commit in `/build-info.json`, enable continuous tracking:

```bash
systemctl enable --now everfolk-deploy.timer
systemctl list-timers everfolk-deploy.timer
journalctl -u everfolk-deploy.service -n 100 --no-pager
```

The timer checks both branches every two minutes after the preceding run finishes, with up to ten seconds of jitter. Deployment latency also includes image build and startup time. A global file lock prevents overlapping manual/timer deployments. The runner itself is root-owned infrastructure and is updated explicitly; fetching application code does not replace the installed runner.

## What a deployment does

The runner shallow-fetches each branch through credential-free public HTTPS into a bare partial repository. It enumerates and bulk-fetches only allowed application blobs, then exports an immutable commit context. Source `artwork/`, local staging, dependencies, generated builds and private env files never enter that context. Selected Git paths and modes are validated against traversal, links and special files before exact object streaming. Git archive is deliberately avoided: in a partial clone it can prefetch excluded source blobs before applying its path filters. The bulk prefetch retains `blob:none` and passes only explicit blob object IDs; the exporter streams only those cached objects through `git cat-file --batch` with lazy fetch disabled.

Current `main` predates the new Docker build arguments. For that branch, the generated build context receives a deployment Dockerfile overlay for the public CDN argument, plus `public/build-info.json`; the Git branch and runtime application source remain unchanged. Newer dev Dockerfiles already accept the public arguments and generate the same metadata themselves. Dependencies remain pinned by `pnpm-lock.yaml`.

Older main revisions also infer enormous literal types from retained world JSON and can fail with TypeScript's `Map maximum size exceeded`. When only main lacks `allowArbitraryExtensions`, the disposable build context receives generated `worlds/*.d.json.ts` declarations referring to that revision's own `WorldPack`, plus the compiler option. The `main-world-types-v1` overlay changes no runtime TypeScript or JSON bytes and does not alter the main Git branch. Its receipt is `releases/main/<commit>/type-overlay.json`; context/deployment receipts and the `io.everfolk.build-overlays` image label record its identity. Already typed main revisions and all dev contexts are left untouched. No Vite or runtime behavior overlay is applied.

Each image is named `everfolk-app:<branch>-<full-commit>` and labelled with its Git commit, branch, package version and public asset base. The image builds and type checks before an existing application is stopped. Runtime secrets are supplied only through the branch's env file. Each application has a 4 GiB memory limit, 2 CPU limit and bounded Docker logs. Source build contexts, images and database backups are retained for review and rollback; nothing prunes Docker or Git history automatically.

Before replacement, the runner stops the relevant application and makes a compressed archive of its persistent volume under `backups/<branch>/`. It then starts the image and waits up to five minutes for successful homepage, session, worlds, sign-in configuration and exact build-info commit checks. Each homepage probe consumes the full SSR body with up to 120 seconds per request; JSON probes allow 20 seconds, bounded by the remaining readiness budget. This also applies when checking unchanged apps and restoring a previous image. A successful receipt is written atomically to `state/<branch>.json`.

An unchanged, running commit is health-checked before being skipped. A new branch head that changes only `tools/app-vps/**` is also skipped after checking the existing app: these operator files are absent from the runtime image, and the installed runner is updated explicitly. The receipt's `commit`, image and public build-info continue to identify the actual application build; `trackedCommit` records the observed branch head. The full tree diff is checked against the application commit, with rename detection disabled so moves across the boundary cannot hide an app change. An empty or unavailable diff, a changed CDN base, a stopped/unhealthy app, `--force`, or `--build-only` follows the normal build path.

## Failure and rollback

A failed image build leaves the running application alone. A failed application start attempts to restore the previous successful image; a first-main failure restarts the preserved legacy container. Database migrations are **not automatically reversed**. If a migration made the old image incompatible, stop the application and review the preserved volume backup before restoring it. Rewinding a database after it has accepted new writes can lose those writes; do not restore a backup casually.

Pause automatic deployments before a manual rollback:

```bash
systemctl stop everfolk-deploy.timer
python3 /opt/everfolk/deploy/bin/deploy.py --status
```

Use the previous immutable image with the branch runtime Compose file, check database compatibility and run the HTTP smoke checks before returning traffic. The timer follows the branch head and would redeploy it if re-enabled; a lasting rollback should normally revert the offending Git commit through the normal review process. No force-push is required.

To keep production frozen while beta is being tested, leave `main` unchanged. Merge into `main` only after beta acceptance; that later merge is outside this setup task.

## Local package validation

```bash
python3 -m unittest discover -s tools/app-vps -p 'test_deploy.py' -v
```

The isolated unit tests cover export exclusions, safe export paths, old-main build overlay, exact branch mappings, distinct data/ports, private env boundaries and rejected credentials in public build URLs. A real local `file://` upload-pack fixture tests multiple prefetch batches against a packed repository containing a private 1 MiB master, a related public binary preview and a private env file. The cached blob inventory must exactly match the permitted application files; it must contain neither private blob. This test failed under the former Git archive exporter and passes with exact object streaming. Local Git fixtures also cover operator-only changes, app/public changes and moves across the deployment boundary. Deployment checks verify that an operator-only head preserves the running image and truthful build commit, and a streaming HTTP fixture verifies that readiness waits for the complete homepage. These tests do not replace the real server build, Caddy validation or HTTPS checks.
