# NPC companions

Open `/npc` from **NPC companions** on the main menu. This is an opt-in online free-play session using the bundled Alexandria household world. Ordinary browser saves and ranked lives continue to use their existing engines.

Each life has five core slots: two caregivers, a mentor, a merchant and a peer. The peer becomes relevant at age 3, the mentor at 6 and the merchant at 12. People age, consume resources, suffer from poor floods and war, and keep private memories. Departed people remain in the record; a new person can fill their slot. These are bounded NPC simulations, with work, study, training and offers, rather than complete copies of the player's career engine.

Parents use the actual family records and shared household purse. The merchant uses the existing shop stock and cash. Other characters receive declared starting capital from the existing workshop account and pay for food from their own funds. NPCs cannot mint, trade NFTs, sign transactions or call arbitrary server actions. A finished player life can still open the offline booster preview.

## Start locally

Use the repository's Node 24+ and pnpm setup. Apply migrations to the same local D1 store used by Vite:

```sh
pnpm install --frozen-lockfile
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config scripts/npc/wrangler.local.jsonc --persist-to .wrangler/state
pnpm dev
```

Visit the server's `/npc` URL, begin a life, choose **Let the NPCs decide**, then **Live another year**. Resolve any player choice before continuing. Training and accepted lessons use the normal annual activity allowance. Food, gifts and tuition are real transfers and are checked again when accepted.

Use **Export replay** to download the original world, seed and accepted session commands. The browser keeps the owner connection in tab-scoped session storage; reloading the tab resumes the connection. Closing the browser tab can lose that capability. Export before leaving if you want a permanent replay. The export does not contain control tokens. This first version does not offer account-based session recovery or a save-import screen.

For deployment, apply the checked-in Drizzle migrations to the production D1 database and bind it as `DB`. The local configuration above is for local development only; it is not a production deployment configuration.

## Use local Laya

Laya is the low-cost local option. It runs real model inference to select a legal action or one short authored response. It does not generate free-form dialogue. The selected choice is recorded as `laya`, and the game server still settles every effect. See the [upstream model card](https://huggingface.co/convaiinnovations/laya-typed-decisions).

Keep Python dependencies outside the game checkout:

```sh
uv venv --python 3.12 "$HOME/.local/share/everfolk/npc-laya-env"
uv pip install --python "$HOME/.local/share/everfolk/npc-laya-env/bin/python" -r scripts/npc/laya-requirements.txt
"$HOME/.local/share/everfolk/npc-laya-env/bin/python" scripts/npc/laya-server.py
```

The first model load may download weights; subsequent loads can reuse the cache. To reuse an existing checkpoint explicitly, pass `--model-path /path/to/cached/checkpoint`. The launcher pins Laya 0.4.22 and the package's reviewed checkpoint revision. It binds only to `127.0.0.1:8766` and rejects browser-origin requests. Keep it running alongside the game server.

Put this non-secret local configuration in the ignored `.dev.vars`:

```text
NPC_PROVIDER=laya
NPC_LAYA_ENDPOINT=http://127.0.0.1:8766/v1/systemone
```

Restart the game server after changing environment variables. Laya has no inference API fee; it consumes the machine's CPU and memory. Its limit is 1,000 reservations per life and 5,000 per user or guest address per UTC day. Guests can use this local provider. A queued batch has a ten-second orchestration deadline; individual transport requests allow nine seconds.

For a hosted model service, use an HTTPS `NPC_LAYA_ENDPOINT` and set the server-side `NPC_LAYA_KEY`. The hosted gateway must validate that bearer credential. A cloud game server cannot reach Laya on your Mac through `127.0.0.1`; run the model service on infrastructure reachable by that server. The loopback launcher is a development service, not a public authenticated model host.

Run `pnpm npc:provider-check` for one bounded live inference and a safe status report. It loads `.dev.vars`, never prints credentials, and performs no game action, award or wallet operation. **Check live connection** in `/npc` performs the same kind of check for the current session.

## Configure generative dialogue

Set these variables on the game server, using `.dev.vars` locally or your hosting secret manager:

```text
NPC_PROVIDER=openai-compatible
NPC_LLM_ENDPOINT=https://your-provider.example/v1/chat/completions
NPC_LLM_MODEL=your-model-name
NPC_LLM_KEY=your-server-secret
```

The endpoint is the full Chat Completions URL. It must accept bearer authentication, `messages`, a completion-token budget and `response_format: {"type":"json_object"}`, and return `choices[0].message.content` containing `{ "action": "one-listed-action", "speech": "short dialogue" }`. GPT-5 and GPT-6 model identifiers use `max_completion_tokens` without a temperature override; other compatible models use `max_tokens`. Public endpoints require HTTPS; loopback HTTP supports local model servers. Redirects are not followed. Provider details and keys stay on the server.

Paid calls require an authenticated identity from the existing trusted Sites dispatcher. The local Vite setup supplies its development identity. Guests use rules even when a provider is configured. A self-hosted deployment must supply verified identity through trusted middleware and strip caller-supplied `oai-authenticated-*` headers; do not expose an origin that trusts those headers directly. This module does not add a new login provider.

For this paid-provider mode, the limits are 100 attempted model calls per session, 200 reserved attempts per authenticated user per UTC day across sessions, and 20 new sessions per identity or guest address per UTC day. Provider requests allow 220 output tokens and 3.5 seconds; the orchestration deadline is 4 seconds. A batch that exceeds the remaining daily allowance uses rules. Quota is reserved atomically before calls, so a failed call or conflicting request can consume allowance without a billable completion. There is no automatic paid retry.

Missing configuration, provider errors, invalid actions, oversize replies and timeouts use a recorded rule-based fallback. No real provider key is bundled. The generative transport has mocked and local HTTP failure tests; live quality and provider-specific compatibility require your configured endpoint. The Laya transport is additionally exercised against native local inference.

## Outages and real rewards

A provider is marked live only after a validated response, not merely because credentials exist. Failure or timeout records fallback status and a thirty-second cooldown. Further game decisions use rules during the cooldown. After it expires, a later decision or explicit connection check can establish a fresh live response. A previous live check expires after thirty seconds.

Ordinary in-game cash, food, work and skills continue during an outage. Real NFT/account rewards and credits must remain blocked. `requireLiveProviderForRewards(sessionId, ownerToken)` performs a fresh bounded provider check and rejects when the endpoint fails, times out, is misconfigured or exceeds its allowance. A future issuer must call it immediately before granting a reward, alongside its own authentication, entitlement and replay checks. Do not trust the browser's `providerEligible` field as an award authorization.

**This NPC free-play mode still has no real award issuer.** Its server snapshot explicitly keeps `nftEnabled` and `accountCreditsEnabled` false, including while Laya is live. The end-of-life booster remains a preview. Connecting NPC session evidence to the ranked verifier and real reward issuer is a separate release requirement, detailed in [judge readiness](JUDGE_READINESS.md).

## Attach an external agent through MCP

On a character card, expand **Agent control** and choose **Issue MCP access**. Copy the NPC token. It is shown only through the copy control, expires after ten minutes and grants access to that one character in that one session. **Return to server control** revokes it immediately.

Use Streamable HTTP with:

```text
URL: https://your-game.example/api/npc/mcp?session=SESSION_ID
Authorization: Bearer YOUR_NPC_TOKEN
```

Do not use the owner session token. Keep the NPC token out of query strings, prompts, screenshots and shared configuration. Clients must accept `application/json, text/event-stream`; this stateless server returns JSON responses, does not open a GET event stream and negotiates MCP `2025-11-25`. It has been exercised with the standard TypeScript SDK's `StreamableHTTPClientTransport`.

| Tool          | Purpose                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npc_observe` | Read the assigned character, current conditions, resources, private memories, legal actions and session revision. |
| `npc_actions` | Read legal actions and their real costs.                                                                          |
| `npc_act`     | Queue one action with `revision`, a unique retry `key`, `action` and `speech` (empty speech is allowed).          |
| `npc_events`  | Read recent events visible to the assigned character.                                                             |

The agent observes, chooses an action and queues it before the player resolves that year's NPC turn. It cannot advance time or accept an offer for the player. All choices settle in the fixed caregiver, caregiver, mentor, merchant, peer order. If an earlier actor changes shared resources, the server checks the next actor's legality again and records a fallback if needed. A leased NPC with no queued decision uses rules immediately when the player resolves the turn; the player never waits for an external controller.

On a stale revision, observe again and use a new key for the revised request. Retry an identical request with its original key. One accepted proposal per character per year prevents agents from repeatedly spending the annual action. Reissue a lease if its one-time token was lost.

## Session API and replay

`POST /api/npc/sessions` accepts `{ "seed": "your starting seed" }` from the game origin and returns a new session plus its one-time owner token. Subsequent owner calls use that bearer token:

| Route below `/api/npc/sessions/:id` | Method | Input                                                       |
| ----------------------------------- | ------ | ----------------------------------------------------------- |
| Session snapshot                    | GET    | None                                                        |
| `/check-provider`                   | POST   | `revision`, `key`                                           |
| `/turn`                             | POST   | `revision`, `key`                                           |
| `/step`                             | POST   | `revision`, `key`, `command` (`advance`, `choose` or `act`) |
| `/answer`                           | POST   | `revision`, `key`, `offerId`, `accept`                      |
| `/speak`                            | POST   | `revision`, `key`, `npcId`, `message`                       |
| `/lease`                            | POST   | `revision`, `key`, `npcId`, `revoke`                        |
| `/export`                           | GET    | None                                                        |

The equivalent external REST endpoints are `GET /observe` and `POST /act` with an NPC token. `/act` takes `revision`, `key`, `decision: {action, speech}`.

Server mutations use optimistic revision checks and idempotency receipts. A reserved turn blocks conflicting player actions while model decisions are pending. D1 stores sessions, atomic usage reservations and immutable world revisions, allowing an existing life to continue after new content ships. Tokens are stored only as SHA-256 hashes; plaintext owner access stays in the player's tab and external access is issued once.

Export format `everfolk-npc-session`, version 1, contains the original world and all accepted player/NPC commands, including selected model actions and dialogue. `replayNpcSimulation(world, seed, commands)` replays it without a provider. Live runs with the same seed may differ; a complete exported log replays the same state exactly. This wrapper export must not be imported as an ordinary engine save because ordinary player logs do not contain NPC resource changes.

Run `node --test test/npc-session.test.ts test/npc-provider.test.ts` for accounting, world effects, cast replacement, replay, provider boundaries, deadlines, budgets, concurrency, token scope and HTTP/MCP checks.
