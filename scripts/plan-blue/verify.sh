#!/usr/bin/env bash
# -------------------------------------------------------------------
# verify.sh – build, compare golden checksums to baseline
#
# Usage:
#   ./scripts/plan-blue/verify.sh           # fast: build + checksums
#   ./scripts/plan-blue/verify.sh --unit    # + unit/golden tests
#   ./scripts/plan-blue/verify.sh --full    # + full run-all.sh (45 min)
#
# Prerequisites: capture-baselines.sh must have been run.
# -------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/../.."

BASELINES_DIR=".plan-blue-baselines"
GOLDEN_DIR="packages/emitter/testcases/common/expected"
ERRORS=0
MODE="fast"

if [[ "${1:-}" == "--unit" ]]; then
  MODE="unit"
elif [[ "${1:-}" == "--full" ]]; then
  MODE="full"
fi

echo "=== Plan-Blue Verification (mode: $MODE) ==="

# 0 ▸ Check baselines exist
if [[ ! -f "$BASELINES_DIR/golden-checksums.txt" ]]; then
  echo "ERROR: No baselines found. Run capture-baselines.sh first."
  exit 1
fi

# 1 ▸ Build all packages
echo ""
echo "--- Step 1: Build ---"
./scripts/build/all.sh --no-format

# 2 ▸ Run tests (only if requested)
if [[ "$MODE" == "unit" ]]; then
  echo ""
  echo "--- Step 2: Unit + Golden Tests ---"
  mkdir -p .tests
  npm test 2>&1 | tee .tests/plan-blue-verify.log
  if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
    echo "ERROR: Tests failed. See .tests/plan-blue-verify.log"
    ERRORS=$((ERRORS + 1))
  fi
elif [[ "$MODE" == "full" ]]; then
  echo ""
  echo "--- Step 2: Full Test Suite (run-all.sh) ---"
  mkdir -p .tests
  ./test/scripts/run-all.sh 2>&1 | tee .tests/plan-blue-verify-full.log
  if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
    echo "ERROR: Full test suite failed. See .tests/plan-blue-verify-full.log"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo ""
  echo "--- Step 2: Skipped (fast mode, use --unit or --full) ---"
fi

# 3 ▸ Compare golden checksums to baseline (byte-identical)
echo ""
echo "--- Step 3: Golden Checksum Comparison ---"
CURRENT_CHECKSUMS=$(mktemp)
find "$GOLDEN_DIR" -name '*.cs' -type f | sort | while read -r f; do
  sha256sum "$f"
done > "$CURRENT_CHECKSUMS"

if diff -q "$BASELINES_DIR/golden-checksums.txt" "$CURRENT_CHECKSUMS" > /dev/null 2>&1; then
  BASELINE_COUNT=$(wc -l < "$BASELINES_DIR/golden-checksums.txt")
  echo "OK: All $BASELINE_COUNT golden checksums match baseline"
else
  echo "ERROR: Golden checksums differ from baseline!"
  echo ""
  diff --unified "$BASELINES_DIR/golden-checksums.txt" "$CURRENT_CHECKSUMS" || true
  ERRORS=$((ERRORS + 1))
fi
rm -f "$CURRENT_CHECKSUMS"

# 4 ▸ Check for circular dependencies
echo ""
echo "--- Step 4: Circular Dependency Check ---"
for pkg in packages/frontend packages/emitter packages/backend packages/cli; do
  if [[ -d "$pkg/src" ]]; then
    echo "Checking $pkg…"
    if npx madge --circular --extensions ts "$pkg/src" 2>/dev/null | grep -q "Found circular"; then
      echo "ERROR: Circular dependencies in $pkg"
      npx madge --circular --extensions ts "$pkg/src" 2>/dev/null
      ERRORS=$((ERRORS + 1))
    else
      echo "  OK: No circular dependencies"
    fi
  fi
done

# 5 ▸ API snapshot drift check
echo ""
echo "--- Step 5: API Snapshot Drift ---"
CURRENT_API=$(mktemp)
find packages/*/dist -name 'index.d.ts' -type f 2>/dev/null | sort | while read -r f; do
  sha256sum "$f"
done > "$CURRENT_API"

if diff -q "$BASELINES_DIR/api-snapshots.txt" "$CURRENT_API" > /dev/null 2>&1; then
  echo "OK: API snapshots unchanged"
else
  echo "WARN: API snapshots changed (expected during Phase 6)"
  diff --unified "$BASELINES_DIR/api-snapshots.txt" "$CURRENT_API" || true
fi
rm -f "$CURRENT_API"

# Summary
echo ""
echo "=== Verification Summary ==="
if [[ $ERRORS -eq 0 ]]; then
  echo "ALL CHECKS PASSED"
  exit 0
else
  echo "FAILED: $ERRORS error(s) detected"
  exit 1
fi
