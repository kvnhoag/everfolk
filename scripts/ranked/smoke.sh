#!/usr/bin/env bash
# End-to-end testnet smoke run against a deployed contract whose owner key is in ~/.near-credentials:
# start a life → draw → checkpoint → mint with test-signed evidence → list → buy from a second account → withdraw.
#   CONTRACT_ID=everfolk-lives-demo.testnet [OWNER_ID=...] [KEEP_VERIFIER_KEY=ed25519:...] scripts/ranked/smoke.sh
# Registers a throwaway smoke verifier key next to KEEP_VERIFIER_KEY (pass the real verifier's key to keep it).
set -euo pipefail
source "$(dirname "$0")/near.sh"

: "${CONTRACT_ID:?Set CONTRACT_ID}"
OWNER_ID="${OWNER_ID:-$CONTRACT_ID}"
STAMP="$(date +%s)"
A="smoke-a-$STAMP.testnet"
B="smoke-b-$STAMP.testnet"
KEY_FILE="$(mktemp -t everfolk-smoke-key).pem"
trap 'rm -f "$KEY_FILE"' EXIT
EMPTY_HASH="4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" # sha256("[]")
HALF_NEAR="500000000000000000000000"

SMOKE_KEY="$(node "$ROOT/scripts/ranked/smoke-signer.ts" keygen "$KEY_FILE")"
KEYS="\"$SMOKE_KEY\"${KEEP_VERIFIER_KEY:+,\"$KEEP_VERIFIER_KEY\"}"
call "$OWNER_ID" "$CONTRACT_ID" set_verifier_keys "{\"keys\":[$KEYS]}"

faucet_account "$A"
faucet_account "$B"

call "$A" "$CONTRACT_ID" start_life "{\"world_version\":\"$WORLD_VERSION\"}"
LIFE="$(view "$CONTRACT_ID" active_life_of "{\"account_id\":\"$A\"}")"
LIFE_ID="$(printf '%s' "$LIFE" | json_field '.life_id')"
LIFE_SEED="$(printf '%s' "$LIFE" | json_field '.seed')"
echo "  life $LIFE_ID"
call "$A" "$CONTRACT_ID" draw_npc "{\"life_id\":\"$LIFE_ID\",\"step\":0,\"category\":\"education\",\"commands_hash\":\"$EMPTY_HASH\"}"
call "$A" "$CONTRACT_ID" checkpoint "{\"life_id\":\"$LIFE_ID\",\"step\":0,\"commands_hash\":\"$EMPTY_HASH\"}"

SIGNED="$(node "$ROOT/scripts/ranked/smoke-signer.ts" sign "$KEY_FILE" "$LIFE_ID" "$LIFE_SEED" "$A" euclid)"
MINT_ARGS="$(node -e 'const s=JSON.parse(process.argv[1]);process.stdout.write(JSON.stringify({life_id:process.argv[2],evidence_json:s.evidence_json,signature:s.signature,npc_action_id:"letters.teach"}))' "$SIGNED" "$LIFE_ID")"
call "$A" "$CONTRACT_ID" mint_life "$MINT_ARGS" '1 NEAR'
TOKEN_ID="$(view "$CONTRACT_ID" nft_tokens_for_owner "{\"account_id\":\"$A\"}" | json_field '[0].token_id')"
echo "  minted token $TOKEN_ID: $(view "$CONTRACT_ID" nft_token "{\"token_id\":\"$TOKEN_ID\"}" | json_field '.metadata.title')"

call "$A" "$CONTRACT_ID" list "{\"token_id\":\"$TOKEN_ID\",\"price\":\"$HALF_NEAR\"}" '1 yoctoNEAR'
call "$B" "$CONTRACT_ID" buy "{\"token_id\":\"$TOKEN_ID\"}" '0.5 NEAR'
NEW_OWNER="$(view "$CONTRACT_ID" nft_token "{\"token_id\":\"$TOKEN_ID\"}" | json_field '.owner_id')"
[ "$NEW_OWNER" = "$B" ] || { echo "✗ token owner is $NEW_OWNER, expected $B"; exit 1; }

echo "  treasury balance: $(view "$CONTRACT_ID" balance_of "{\"account_id\":\"$OWNER_ID\"}") yocto"
call "$OWNER_ID" "$CONTRACT_ID" withdraw '{}'
echo "  explorer: https://testnet.nearblocks.io/address/$CONTRACT_ID"
echo "SMOKE OK"
