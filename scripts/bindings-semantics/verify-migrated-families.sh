#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INVENTORY_FILE="$ROOT/.analysis/bindings-semantics-metadata/08-heuristic-hit-inventory.json"
PROOF_ROOT="$ROOT/../proof-is-in-the-pudding"
TSUMO_ROOT="$ROOT/../tsumo"
CLICKMETER_ROOT="$ROOT/../../agilehead/clickmeter"
INSTALL_LOCAL_WAVE="$ROOT/scripts/bindings-semantics/install-local-wave.sh"

if [[ ! -f "$INVENTORY_FILE" ]]; then
  echo "FAIL: missing heuristic inventory artifact: $INVENTORY_FILE" >&2
  exit 1
fi

for repo_root in "$PROOF_ROOT" "$TSUMO_ROOT" "$CLICKMETER_ROOT"; do
  if [[ ! -d "$repo_root" ]]; then
    echo "FAIL: required downstream repo not found: $repo_root" >&2
    exit 1
  fi
done

for repo_root in "$ROOT" "$PROOF_ROOT" "$TSUMO_ROOT" "$CLICKMETER_ROOT"; do
  "$INSTALL_LOCAL_WAVE" "$repo_root"
done

FAMILIES="$(
  node -e '
    const fs = require("fs");
    const inventory = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const rows = Array.isArray(inventory.summaryRows) ? inventory.summaryRows : [];
    const families = [...new Set(rows.map((row) => row.family).filter((value) => typeof value === "string" && value.length > 0))].sort();
    process.stdout.write(families.join(","));
  ' "$INVENTORY_FILE"
)"

if [[ -z "$FAMILIES" ]]; then
  echo "FAIL: heuristic inventory artifact did not contain any migrated families" >&2
  exit 1
fi

TSONIC_BIN="${TSONIC_BIN:-$ROOT/packages/cli/dist/index.js}"
if [[ ! -f "$TSONIC_BIN" ]]; then
  echo "FAIL: TSONIC_BIN does not exist: $TSONIC_BIN" >&2
  exit 1
fi

export TSONIC_BIN
export TSONIC_BINDINGS_SEMANTICS_FAIL_FAMILIES="$FAMILIES"

echo "=== bindings-semantics migrated-family gate ==="
echo "families: $TSONIC_BINDINGS_SEMANTICS_FAIL_FAMILIES"

(
  cd "$ROOT"
  ./test/scripts/run-all.sh
)

bash "$PROOF_ROOT/scripts/verify-all.sh"
bash "$TSUMO_ROOT/scripts/selftest.sh"
bash "$CLICKMETER_ROOT/scripts/selftest.sh"

echo
echo "=== migrated-family gate passed ==="
