# Code structure

Keep each responsibility in its owning layer. Import the specific module that owns an operation; avoid catch-all barrels that combine reads, writes and React state.

```text
app/                         Framework routes, layouts and API entry points
client/
  GameClient.tsx             Client boundary for the game route
  AdminClient.tsx            Client boundary for the editor route
  screens/                   Composed screens and their presentation state
  components/                Reusable React views
    admin/                   Content editor controls
  hooks/                     React controllers, effects, timers and subscriptions
  queries/                   Named API and browser-storage reads
  mutations/                 Named API writes, life commands and persistence
  models/                    Pure projections, previews and formatting
    admin/                   Pure editor transformations and validation
  lib/                       HTTP transport, world registry and storage compatibility
  state/                     Shared external stores
  storage/                   Browser persistence adapters and record validation
  styles/                    Application stylesheets
  types/                     Shared client contracts
server/
  queries/                   Database reads
  mutations/                 Draft writes and atomic publication
  db/                        Database interfaces and row contracts
  errors/                    Shared service errors
  handler.ts                 Routing, authorization and request validation
  content.ts                 Serializable content contracts and pure compilation
  identity.ts                Trusted identity interpretation
  seeded-play.ts             Seeded-play service and request handling
src/                         Deterministic simulation and world validation
db/                          Drizzle schema
drizzle/                     Versioned database migrations
worker/                      Worker entry point
worlds/                      Immutable, replayable world revisions
scripts/                     Build, content generation and development checks
test/                        Regression and architecture tests
public/                      Delivered assets and fonts
artwork/                     Editable artwork sources
research/                    Required research data and citations
```

## Dependency rules

- Screens and components render data and keep local presentation state. Hooks coordinate loading, accepted commands, persistence and cleanup. Small UI effects such as dialog focus remain with their views.
- Queries expose reads. Mutations expose writes and may read the result back. Queries never import mutations. Neither layer imports React or views.
- Use `client/lib/http.ts` for browser HTTP transport. Put each endpoint behind a named query or mutation rather than passing URLs from a component.
- Models transform supplied inputs without accessing React, browser storage, network services or controller state. Import shared interfaces with `import type` when a model needs a record contract.
- The simulation in `src/` has no dependencies on the application, browser or service layers. A client controller commits the engine's returned snapshot; views do not keep duplicate simulation state.
- Shared stores in `state/` and adapters in `storage/` own their existing persistence contracts. The compatibility adapter may migrate an old storage key during a read. Keep that behavior outside pure models.
- `lib/world-session.ts` owns the engine registry and live selected-world bindings. Keep `sampleEngine`, `SAVE_KEY` and `PRESENTATION_KEY` as live imports. Storage keys, retained pack revisions and replay semantics must survive refactors.
- `server/content.ts` is a shared, browser-safe content contract/compiler. It may depend on pure presentation metadata; it must not acquire database, request or secret dependencies. Database access belongs in server queries and mutations.
- Server mutations preserve optimistic revision checks and atomic publication. Routing and identity checks stay at the request boundary.

## Adding code

For a new data-driven feature, add its read function to `queries/`, its write function to `mutations/`, and its React orchestration to `hooks/useFeature.ts`. Render the result with a component or screen. Put deterministic calculations in `models/`, shared contracts in `types/`, and CSS in `styles/`. Group feature-specific files within those folders when the feature grows.

Use explicit relative imports with file extensions for modules exercised directly by Node tests. Keep the two route client boundaries at the client root; put new views in `screens/` or `components/`.

Run `pnpm check:structure` for folder and dependency checks. `pnpm check` and `pnpm build` also run it, so CI enforces the boundaries alongside TypeScript. The check covers module placement, relative import resolution, React dependencies, browser HTTP access, model purity, query writes and the simulation dependency boundary.
