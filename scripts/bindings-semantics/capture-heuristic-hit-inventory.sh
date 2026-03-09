#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TRACE_FILE="$ROOT/.tests/bindings-semantics-heuristics.jsonl"
OUTPUT_JSON="$ROOT/.analysis/bindings-semantics-metadata/08-heuristic-hit-inventory.json"
OUTPUT_MD="$ROOT/.analysis/bindings-semantics-metadata/08-heuristic-hit-inventory.md"
FAIL_FAMILIES="${TSONIC_BINDINGS_SEMANTICS_FAIL_FAMILIES:-}"
INSTALL_LOCAL_WAVE="$ROOT/scripts/bindings-semantics/install-local-wave.sh"

: > "$TRACE_FILE"

for repo_root in \
  "$ROOT" \
  "/home/jester/repos/tsoniclang/proof-is-in-the-pudding" \
  "/home/jester/repos/tsoniclang/tsumo" \
  "/home/jester/repos/agilehead/clickmeter"
do
  "$INSTALL_LOCAL_WAVE" "$repo_root"
done

run_with_trace() {
  local suite="$1"
  shift
  TSONIC_BINDINGS_SEMANTICS_TRACE_FILE="$TRACE_FILE" \
  TSONIC_BINDINGS_SEMANTICS_TRACE_SUITE="$suite" \
  TSONIC_BINDINGS_SEMANTICS_FAIL_FAMILIES="$FAIL_FAMILIES" \
  "$@"
}

run_with_trace "tsonic:run-all" "$ROOT/test/scripts/run-all.sh"

TSONIC_BIN="$ROOT/packages/cli/dist/index.js" \
  run_with_trace "proof-is-in-the-pudding" \
  bash /home/jester/repos/tsoniclang/proof-is-in-the-pudding/scripts/verify-all.sh

TSONIC_BIN="$ROOT/packages/cli/dist/index.js" \
  run_with_trace "tsumo" \
  bash /home/jester/repos/tsoniclang/tsumo/scripts/selftest.sh

TSONIC_BIN="$ROOT/packages/cli/dist/index.js" \
  run_with_trace "clickmeter" \
  bash /home/jester/repos/agilehead/clickmeter/scripts/selftest.sh

node "$ROOT/scripts/bindings-semantics/generate-heuristic-hit-inventory.mjs" \
  "$TRACE_FILE" \
  "$OUTPUT_JSON" \
  "$OUTPUT_MD"

echo "Heuristic hit inventory written to:"
echo "  $OUTPUT_JSON"
echo "  $OUTPUT_MD"
