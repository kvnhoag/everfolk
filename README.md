# Everfolk

[![CI](https://github.com/kvnhoag/everfolk/actions/workflows/ci.yml/badge.svg)](https://github.com/kvnhoag/everfolk/actions/workflows/ci.yml)

Everfolk is a browser-based historical life simulation. Be born into different circumstances, learn a trade, form relationships and discover what your choices make possible. Alexandria is the first playable world choice; future worlds will be independent settings.

Historical context is sourced. Individual lives are fictional, and prices, probabilities and progression values are authored game design.

## Run locally

Use Node.js 24+ and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by the server. Ordinary play needs no account or hosted content service. Lives save in the browser, with JSON import/export for transfer.

## Play

Begin a life near Rhakotis in 350 BCE and experience the world around the emerging city of Alexandria. Develop skills, find work, maintain relationships and manage health and household finances. Accepted work can lead to named accomplishments and later career opportunities. At the end, review the life record or begin again.

The engine uses a recorded seed and accepted commands for deterministic replay. Existing saves retain their exact world revisions.

## Development

```sh
pnpm check
pnpm test
pnpm build
pnpm preview
```

Edit content generator modules and run `pnpm content` to rebuild the current world. Keep earlier packs available for their saves.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and architecture, and [ROADMAP.md](ROADMAP.md) for development phases.

## Source and assets

The TypeScript simulation lives in `src/`, the React interface in `client/`, and the application/content service in `app/`, `server/`, `db/` and `worker/`. World packs, required research inputs and their citations are included.

Original pixel/vector artwork, source geometry and editable native masters are retained with the project. These scenes are fictional illustrations, not archaeological reconstructions. Font copyright and SIL Open Font License notices remain under `public/fonts/`; the vendored Sites plugin retains its upstream license notice.
