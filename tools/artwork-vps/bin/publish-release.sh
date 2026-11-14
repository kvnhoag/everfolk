#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [[ "${1:-}" == "--help" || $# -eq 0 ]]; then
  printf '%s\n' 'Publish an immutable, verified release. Requires root on Linux and Python 3.10+.' \
    'sudo bash publish-release.sh --kind public --release web-20261113-v1 --incoming /srv/everfolk-art/incoming/web-20261113-v1 --manifest-sha256 TRUSTED_LOCAL_RECEIPT_HASH [--data-root /srv/everfolk-art]' \
    'Incoming files are preserved. Existing releases are never overwritten. Source archives stay outside the public mount.'
  exit 0
fi
command -v python3 >/dev/null || { printf '%s\n' 'Python 3.10+ is required.' >&2; exit 1; }
exec python3 "$SCRIPT_DIR/verify-release.py" publish "$@"
