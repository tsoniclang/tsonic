#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROOF_ROOT="$ROOT/../proof-is-in-the-pudding"
TSUMO_ROOT="$ROOT/../tsumo"
CLICKMETER_ROOT="$ROOT/../../agilehead/clickmeter"
INSTALL_LOCAL_WAVE="$ROOT/scripts/bindings-semantics/install-local-wave.sh"

for repo_root in "$PROOF_ROOT" "$TSUMO_ROOT" "$CLICKMETER_ROOT"; do
  if [[ ! -d "$repo_root" ]]; then
    echo "FAIL: required downstream repo not found: $repo_root" >&2
    exit 1
  fi
done

for repo_root in "$ROOT" "$PROOF_ROOT" "$TSUMO_ROOT" "$CLICKMETER_ROOT"; do
  "$INSTALL_LOCAL_WAVE" "$repo_root"
done

TSONIC_BIN="${TSONIC_BIN:-$ROOT/packages/cli/dist/index.js}"
if [[ ! -f "$TSONIC_BIN" ]]; then
  echo "FAIL: TSONIC_BIN does not exist: $TSONIC_BIN" >&2
  exit 1
fi

export TSONIC_BIN

echo "=== bindings-semantics migrated-family gate ==="

(
  cd "$ROOT"
  ./test/scripts/run-all.sh
)

bash "$PROOF_ROOT/scripts/verify-all.sh"
bash "$TSUMO_ROOT/scripts/selftest.sh"
bash "$CLICKMETER_ROOT/scripts/selftest.sh"

echo
echo "=== migrated-family gate passed ==="
