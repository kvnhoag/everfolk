# Shared helpers for the ranked testnet scripts. Source this file; do not run it.
NEAR_CLI=(npx -y near-cli-rs@0.31.1)
NETWORK=testnet
WORLD_VERSION=alexandria-ranked-1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WASM="$ROOT/contract/target/near/everfolk_lives.wasm"

near_cli() { "${NEAR_CLI[@]}" "$@"; }

account_exists() {
  near_cli account view-account-summary "$1" network-config "$NETWORK" now >/dev/null 2>&1
}

faucet_account() {
  echo "→ creating $1 from the testnet faucet"
  near_cli account create-account sponsor-by-faucet-service "$1" autogenerate-new-keypair save-to-legacy-keychain \
    network-config "$NETWORK" create
}

# call <signer> <contract> <method> <json-args> [deposit, default "0 NEAR"]
call() {
  echo "→ $1: $3" >&2
  near_cli contract call-function as-transaction "$2" "$3" json-args "$4" prepaid-gas '300.0 Tgas' \
    attached-deposit "${5:-0 NEAR}" sign-as "$1" network-config "$NETWORK" sign-with-legacy-keychain send
}

# view <contract> <method> <json-args> — prints the JSON return value only
view() {
  near_cli contract call-function as-read-only "$1" "$2" json-args "$3" network-config "$NETWORK" now 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const i=s.search(/[\[{"0-9tfn]/m);process.stdout.write(s.slice(i).trim())})'
}

json_field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s)'"$1"';process.stdout.write(typeof v==="string"?v:JSON.stringify(v))})'; }
