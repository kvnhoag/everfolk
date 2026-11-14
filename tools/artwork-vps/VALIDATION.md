# Artwork VPS package validation

Updated validation date: 14 November 2026. Active authoring host: Ubuntu 26.04 in WSL, Node.js 24.17.0 and Python 3.14. The original package was prepared on Windows on 13 November. The package targets a Linux VPS with Docker Compose and Python 3.10+.

## Completed checks

Current focused suite: **29 tests, 28 passed, 1 skipped, zero failures**. The remaining skipped check requires Linux/root publication; it is not run as the ordinary WSL development user. Source-link and case-sensitive collision tests pass in WSL. Active SVG/CSS/HTML features, obfuscated URIs and malformed/duplicate-key JSON are rejected by the shared public-export policy.

Focused Node tests exercise byte-preserving packing, explicit public selection, immutable release IDs, path traversal, credential/local-cache rejection, manifest pinning, corruption, missing/extra files, incomplete builds, source links, Python interoperability and required publication digests. Capacity tests distinguish request/byte cache hits and detect cold-cache link overload. The load probe is checked against a temporary loopback HTTP server, including non-200 responses and exact cache keys. The test server is closed afterward.

Bash syntax checks cover the installer, publisher wrapper, backup runner and timer installer. Installer help and unknown-argument handling were checked without invoking a deployment. Python source syntax and real Node-produced release verification were checked. These operations created no VPS services or containers.

The workload calculator was run against all six supplied scenarios and checked against the design table. It is an arithmetic estimate and contains no measured VPS throughput claims.

The original Windows public packer was also run against the then-current delivery directory, including ongoing local asset additions: **918 eligible files, 189,208,234 bytes**. Independent Python verification matched every file and the trusted manifest digest. Unsupported formats were reported as exclusions. This real-input check caught and resolved `@2x` filename compatibility; both verifiers and the origin now accept the same path contract. The temporary 189 MB validation payload was removed after verification; the small receipt is retained under ignored artifacts.

The expanded trusted web-export packer was run against the complete current WSL `public/` tree: **2,151 files, 171,494,395 bytes, zero exclusions**. Node and independent Python verification match the pinned manifest digest `a3f443f64442446ce510fb3d2e9e2bfdefb4a73176bbcc7b48ba6cb51df389db` for release `dev-5196c95378`. Geometry/text SVGs, CSS, JSON, static HTML credits, font formats and license notices retain their exact bytes.

## Checks still requiring Linux root or the deployed VPS

- Linux/root publication into a protected data root, atomic promotion, permissions, failure cleanup and refusal to overwrite an existing release.
- Docker Compose rendering and actual Nginx configuration/startup, nonroot permissions, resource limits, restart behavior and connector token mounting. The installer performs configuration validation on the target before starting the service.
- Public Cloudflare hostname/cache configuration, byte hit rate, tunnel connectivity and account entitlement.
- Browser image/font rendering, anonymous CORS, booster canvas export, Three.js textures and application rollback after URL integration.
- Independent backup initialization, timer execution, complete recovery on a different destination and restored manifest verification.
- Real disk, CPU/RAM, network, source-transfer and backup loads alongside the friend's other services.

The local public-export checks do not establish remote deployment status. Actual VPS installation, Caddy/CDN routing and application integration must be recorded and verified separately. No artwork removal or Git-history rewrite is part of these package checks.
