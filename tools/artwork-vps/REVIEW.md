# Artwork VPS design critique

The design is suitable for a small team's artwork archive and a static origin with effective CDN caching. Its strongest property is the separation between private authoring material, immutable public exports and application code. Its main operational weakness is dependence on a single origin and on the CDN's real cache efficiency. The 300 MB Git goal is realistic; a guaranteed player count is not established without the future VPS and measured traffic.

An independent review checked the workload arithmetic, cache assumptions, release verification, shared-server boundaries and backup behavior after the initial design was written. The resulting corrections are incorporated in the package.

## Findings corrected before handoff

| Finding | Why it mattered | Final treatment |
|---|---|---|
| Installer could adopt directories owned or replaceable by another user | A root-run setup could leave configuration/token paths under another account's control | Canonical paths, protected root-owned ancestors and managed-directory checks; incoming is the explicit upload-user exception |
| Fixed Compose project name could collide with another installation | A shared VPS must not adopt another deployment | Existing project/container ownership and host-port checks before replacement |
| Packer accepted uppercase file extensions that origin routing rejected | A verified image could publish and then return 404 | Case-insensitive extension matching at the origin |
| Real game exports included `@2x` filenames outside the initial path contract | The documented pack command could fail on existing assets | Node/Python validation and origin routing share the same safe path alphabet; real-input packing and regression checks pass |
| Initial private release directory was absent | Backup initialization depended on the first private publication | Runtime creates public/private release roots and protected staging up front |
| Uploaded manifest was the only integrity reference | An upload could change both content and its declared hashes | Publisher requires the trusted manifest digest from the authoring receipt and checks it on the protected snapshot |
| Query variants could force full-image cache misses | Random query strings could increase origin transfer | Canonical query-free URLs; origin rejects query-bearing requests with uncached errors |
| Multipart ranges could increase request work | Unnecessary response complexity for image delivery | One range per request; GET/HEAD/OPTIONS and global origin limits |
| Backup script sourced configuration without protecting its parents | A writable parent could allow replacement before root reads the configuration | Root ownership, canonical paths and non-writable ancestors for configuration/password paths |
| A lock under shared `/run/lock` could be precreated by another account | A root shell redirect could follow an attacker-owned lock link | Backup lock lives inside the protected data root; links and non-root lock files are rejected |
| Daily backup scheduling did not support a strict 24-hour target | Jitter and completion time extend the interval | Twice daily schedule, bounded run time and explicit conditional recovery target |

## Architecture limits and decisions

**Cache failure can dominate capacity.** At 100,000 sessions/day, the illustrative 99% byte-hit scenario needs 180 GB/month and about 5.56 Mbps at peak from the origin. A cold cache at the same peak needs about 556 Mbps, almost eight times the example usable 70 Mbps link. A CDN purge, eviction or eligibility mistake can change the outcome sharply. The origin limits protect the friend’s server by rejecting excess work; they cannot preserve full delivery under overload. Use tiered caching/shielding when supported, retain old URLs, avoid full purges and monitor actual transfer.

**Provider entitlement is unresolved.** Cloudflare's current general CDN terms address disproportionate media delivery. Treat an image-heavy public hostname as a workload requiring a suitable service or agreement. A generic paid website plan is not assumed to resolve that. The supplied Cloudflare Tunnel adapter is technically convenient; suitability of the commercial service must be settled before cutover. An explicitly supported origin-pull media CDN is an alternative. [Current terms](https://www.cloudflare.com/service-specific-terms-application-services/)

**One VPS remains one origin failure domain.** A friend can reboot, repurpose, lose or stop paying for the server. CDN caches can evict content and cache misses still need the origin. Independent backups under the user's control are necessary. A warm fallback origin or managed object-store mirror is a future availability improvement if the game needs stronger uptime. Availability targets are not SLAs.

**Full-tree releases amplify disk use.** The initial archive is about 5.2 GB. New complete snapshots can duplicate most of it, and incoming plus protected staging temporarily increases space requirements. This version intentionally uses inspectable filesystem trees instead of implementing an object-storage service or deduplication database. Publish individual libraries; retain references and dependencies. Introduce content-addressed storage only when measured growth justifies that additional operational surface.

**Source dependencies need project integration.** Current portrait and card versions reference older source material. A pack verifies its own bytes; it does not prove that all cross-library dependencies were archived. The Git lock schema, dependency resolver, authoring retrieval command and application URL resolver are specified but not implemented in this setup package. An archive inventory and recovery exercise must cover those links before any Git pruning.

**Default backup credentials do not guarantee resistance to server compromise.** Offsite encrypted storage protects against loss of the VPS. Credentials accessible to the VPS may also permit remote deletion. For stronger recovery, use independently enforced retention, append-only credentials or a backup pulled from outside the server. Backups are useful only if passwords and access survive independently, and actual restores have been verified.

**Resource ceilings are not benchmarks.** The origin/connector CPU and RAM settings protect a shared host; they do not establish throughput. The model assumes link speed, cache rates, response size and session behavior. Small cold images, large popular images, browser reuse, geographic distribution and cache-key fragmentation can produce different request/byte hit rates. Replace placeholders with telemetry and use the supplied bounded probe before committing to traffic capacity.

**Public web exports are constrained to reviewed static content.** The publisher now accepts geometry/text SVG, CSS, JSON, static HTML credits and license notices through a shared parser-backed policy. It preserves source bytes and rejects active SVG/HTML features; it does not promise to sanitize arbitrary uploads. Cross-origin canvas/WebGL behavior, retained mappings and missing-image handling still require application integration and browser verification.

**Operational work remains.** The package emits origin logs and supplies backup timers and load tools. It does not provision external uptime alerts, a metrics dashboard, CDN account rules, a disaster-recovery server, or a Git-history rewrite. Configuration checks are performed by the installer on Linux; this Windows authoring environment cannot establish live Docker/Nginx behavior. The runbook states those acceptance checks explicitly.

## Conditions for moving forward

Proceed with a private archive and a small public pilot after confirming VPS resources, owner agreement, CDN service suitability and independent backup storage. Measure serving behavior and perform a complete source restore. Then integrate pinned application URLs and project manifests. Remove the old tracked sources and rewrite history only after those preservation checks pass. Validate the resulting fresh remote clone, not just the current checkout size.
