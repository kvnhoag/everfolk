# Contributing to Everfolk

**Live another story.** Alexandria is the first playable world choice. Future worlds are independent settings, rather than a sequence players must unlock.

Read the [README](README.md) and [ROADMAP](ROADMAP.md) before choosing work. Keep implemented behavior distinct from proposed features in code, documentation and demonstrations.

## Set up a checkout

Use Node.js 24 or newer and pnpm 11.25.0. The package manager version is recorded in `package.json`; dependencies are pinned by `pnpm-lock.yaml`.

If pnpm is not available, install the required version:

```sh
npm install --global pnpm@11.25.0
```

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by the server. Normal play can use the bundled Alexandria world without a hosted content service. Player saves and completed lives are stored in the browser; JSON export/import transfers a life between installations.

A clean checkout uses the portable Vinext build path. Local `.sites-runtime` configuration and machine-specific dependency caches are unnecessary. Keep `pnpm-workspace.yaml`: it records the native dependency build approvals needed for esbuild, sharp and workerd.

## Verify a change

```sh
pnpm check
pnpm test
pnpm build
```

CI runs these commands on Ubuntu with Node.js 24 and the pinned pnpm version. It installs with `--frozen-lockfile` and checks that verification does not change tracked source. The regression suite uses shipped world packs, research inputs, web assets and editable banner masters. Include those files in a checkout; an ArtCraft installation is not needed to run the suite.

To inspect a built application locally:

```sh
pnpm preview
```

The preview command runs Wrangler in local mode. CI builds the application; it does not deploy it, apply hosted database migrations or enable wallet services.

## Work within the architecture

- `src/` owns deterministic simulation rules. Keep browser, storage, network and wall-clock behavior outside the core.
- `client/` separates views, hooks, queries, mutations, pure models, storage adapters, shared state and styles. Previews must use actual rules without consuming randomness. Follow [ARCHITECTURE.md](ARCHITECTURE.md) for folder ownership and dependency rules; `pnpm check` enforces them.
- `scripts/`, `research/` and `worlds/` own content generation, evidence and immutable world revisions.
- `server/`, `db/`, `drizzle/`, `app/` and `worker/` own the content service and application routing.
- `public/` contains delivered artwork and fonts; `artwork/` contains editable native banner masters.

Keep commits focused on a reviewable behavior and its required data, interface and verification. Explain the trigger, resulting behavior, checks run and any remaining limitation. Run focused checks while iterating, then the full commands above for an integrated change.

## Change historical content safely

Edit the generator modules, then regenerate the current pack:

```sh
pnpm content
```

Preserve the previous exact world pack, increment the new pack version and register retained revisions in both `client/lib/world-session.ts` and `server/content.ts`. Begun lives retain their original rules and text; do not silently reinterpret saves or rewrite custom worlds. Simulation changes must preserve replay semantics or explicitly version the save contract.

Documented history, historically inspired fiction and numerical game balance are separate evidence categories. Preserve source dates, geography and limitations. A citation supporting a historical practice does not establish a character's biography, success probability, prices or mortality. Add behavior checks for changed rules and meaningful pacing evidence for changed routes.

## Optional local content studio

Building and testing require no credentials or environment file. To work on the content studio, use local D1 storage and apply the checked-in schema migration after a build:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_special_blob.sql
```

Apply each migration once to a local database. Generate later schema migrations with `pnpm db:generate`. The D1 identifier in `vite.config.ts` is a placeholder for local development; hosted resources and credentials are configured separately.

The development server supplies a loopback-only sign-in simulation for `seedy@sites.test`. To enable that identity as an administrator locally, create an ignored `.dev.vars` containing:

```dotenv
ADMIN_EMAIL=seedy@sites.test
```

This is optional and does not configure hosted authentication. An empty admin allowlist grants no admin access. Hosted deployments provide their own resource bindings and trusted identity boundary. Browser-supplied identity must not grant administrative access.

Keep environment files, credentials, local databases, runtime caches and preview artifacts out of commits. Installation-specific hosting configuration stays local and is unnecessary for a normal build.

## Optional artwork authoring

The delivered assets and editable masters are included in source. Rebuilding ArtCraft banner masters or proof galleries requires a local ArtCraft installation and the helper path supplied through `ARTCRAFT_MCP_HELPER`; it is separate from the application build. Preserve native layers, web exports, provenance and existing third-party license notices.

## Local documentation

Internal design documents, research notes, QA records and installation configuration are intentionally excluded from Git. Keep them under the ignored local documentation paths. Required source/citation JSON and license notices remain versioned.
