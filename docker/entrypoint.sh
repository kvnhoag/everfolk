#!/usr/bin/env bash
# Writes runtime secrets for the worker, applies database migrations, then serves Everfolk on port 8787.
set -euo pipefail
cd /app
STATE=/data/state
VARS=dist/server/.dev.vars
: > "$VARS"
chmod 600 "$VARS"
for name in RANKED_VERIFIER_SECRET RANKED_VERIFIER_PUBLIC_KEY RANKED_CONTRACT_ID NEAR_RPC_URL \
  VITE_EVERFOLK_PRIVY_APP_ID EVERFOLK_FUNDER_ACCOUNT_ID EVERFOLK_FUNDER_PRIVATE_KEY \
  EVERFOLK_DRIP_YOCTO EVERFOLK_DRIP_DAILY_CAP ADMIN_EMAIL ADMIN_EMAILS \
  NPC_PROVIDER NPC_LAYA_ENDPOINT NPC_LAYA_KEY NPC_LLM_ENDPOINT NPC_LLM_KEY NPC_LLM_MODEL; do
  if [ -n "${!name:-}" ]; then printf '%s=%s\n' "$name" "${!name}" >> "$VARS"; fi
done
echo "Everfolk: applying database migrations"
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local \
  --config scripts/npc/wrangler.local.jsonc --persist-to "$STATE"
echo "Everfolk: serving on port 8787"
exec node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev \
  --config dist/server/wrangler.json --local --persist-to "$STATE" --ip 0.0.0.0 --port 8787 --inspector-port 0
