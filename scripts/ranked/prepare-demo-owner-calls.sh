#!/usr/bin/env bash
# Prints the owner calls for the demo contract. Does not send them.
# Run only after the user approves a release step.
#
# The catalog update is additive: existing action ids stay. World versions keep
# alexandria-ranked-1 and add alexandria-demo-1. The main contract is not called.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEMO_CONTRACT="${DEMO_CONTRACT:-demo.genesis-1794297139-6.testnet}"
OWNER_ID="${OWNER_ID:-$DEMO_CONTRACT}"
CATALOG="$(node "$ROOT/scripts/ranked/contract-catalog.ts")"
cat << CALLS
# Demo contract only. Do not run until the user says go.
# Owner: $OWNER_ID
# Contract: $DEMO_CONTRACT

# 1. Upload the catalog (Farming group, harvest and road categories, three new deeds).
near contract call-function as-transaction $DEMO_CONTRACT set_catalog \\
  json-args '{"catalog":$CATALOG}' \\
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \\
  sign-as $OWNER_ID network-config testnet sign-with-legacy-keychain send

# 2. Open the demo world without closing the existing ranked world.
near contract call-function as-transaction $DEMO_CONTRACT set_world_versions \\
  json-args '{"versions":["alexandria-ranked-1","alexandria-demo-1"]}' \\
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \\
  sign-as $OWNER_ID network-config testnet sign-with-legacy-keychain send
CALLS
