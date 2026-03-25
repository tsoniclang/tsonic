#!/bin/bash
# Unified test runner: unit tests, golden tests, E2E tests, and summary report
#
# Usage: ./test/scripts/run-all.sh [--quick] [--filter <pattern>]
#   --quick: Skip E2E tests, only run unit/golden tests
#   --no-unit: Skip unit/golden tests (fixtures only). Intended for iteration.
#   --filter: Run only matching E2E fixtures (substring match on fixture name).
#             Can be repeated, or use comma-separated patterns.
#   --resume: Resume from a previous (aborted) run for the same commit+args by
#             skipping already-passed unit/golden tests and already-passed fixtures.
#
# Environment variables:
#   TEST_CONCURRENCY: Number of parallel E2E tests (default: 4)
#   TSONIC_BIN: Optional override for the tsonic CLI path.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUN_ALL_LIB_DIR="$SCRIPT_DIR/run-all"

source "$RUN_ALL_LIB_DIR/common.sh"
source "$RUN_ALL_LIB_DIR/e2e.sh"
source "$RUN_ALL_LIB_DIR/summary.sh"

# Parallelism (default to 4)
TEST_CONCURRENCY="${TEST_CONCURRENCY:-4}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Results tracking
UNIT_PASSED=0
UNIT_FAILED=0
GOLDEN_PASSED=0
GOLDEN_FAILED=0
TSC_PASSED=0
TSC_FAILED=0
E2E_DOTNET_PASSED=0
E2E_DOTNET_FAILED=0
E2E_NEGATIVE_PASSED=0
E2E_NEGATIVE_FAILED=0
FRESH_BUILD_PASSED=0
FRESH_BUILD_FAILED=0

# Step status (some failures don't produce mocha "failing" lines)
FRESH_BUILD_STATUS="unknown"
UNIT_STATUS="unknown"
TSC_STATUS="unknown"
RUNTIME_SYNC_STATUS="unknown"
AOT_PREFLIGHT_STATUS="not-run"

QUICK_MODE=false
SKIP_UNIT=false
RESUME_MODE=false
FILTER_PATTERNS=()

while [ $# -gt 0 ]; do
    case "${1:-}" in
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --no-unit)
            SKIP_UNIT=true
            shift
            ;;
        --resume)
            RESUME_MODE=true
            shift
            ;;
        --filter)
            shift
            if [ -z "${1:-}" ]; then
                echo "FAIL: --filter requires a value"
                exit 2
            fi
            FILTER_PATTERNS+=("$1")
            shift
            ;;
        --filter=*)
            FILTER_PATTERNS+=("${1#*=}")
            shift
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            echo "FAIL: unknown argument: $1"
            print_help
            exit 2
            ;;
    esac
done

DEFAULT_TSONIC_BIN="$ROOT_DIR/packages/cli/dist/index.js"
TSONIC_BIN="${TSONIC_BIN:-$DEFAULT_TSONIC_BIN}"

# Create logs directory
mkdir -p "$ROOT_DIR/.tests"
LOG_FILE="$ROOT_DIR/.tests/run-all-$(date +%Y%m%d-%H%M%S).log"

# ============================================================
# Resume/Checkpoint cache (per commit + args)
# ============================================================
GIT_HEAD="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
FILTERS_CANON_JSON="$(
    node -e '
      const raws = process.argv.slice(1);
      const parts = [];
      for (const r of raws) {
        for (const p of String(r).split(",")) {
          const t = p.trim();
          if (t) parts.push(t);
        }
      }
      const uniq = [...new Set(parts)].sort();
      process.stdout.write(JSON.stringify(uniq));
    ' "${FILTER_PATTERNS[@]}" 2>/dev/null || echo "[]"
)"

ARGS_HASH="$(
    node -e '
      const crypto = require("node:crypto");
      const quick = process.argv[1] === "1";
      const skipUnit = process.argv[2] === "1";
      const filters = JSON.parse(process.argv[3] ?? "[]");
      const args = { quick, skipUnit, filters };
      process.stdout.write(crypto.createHash("sha256").update(JSON.stringify(args)).digest("hex"));
    ' "$([ "$QUICK_MODE" = true ] && echo 1 || echo 0)" "$([ "$SKIP_UNIT" = true ] && echo 1 || echo 0)" "$FILTERS_CANON_JSON" 2>/dev/null || echo ""
)"

if [ -n "$GIT_HEAD" ] && [ -n "$ARGS_HASH" ]; then
    CACHE_DIR="$ROOT_DIR/.tests/run-all-cache/$GIT_HEAD/$ARGS_HASH"
    if [ "$RESUME_MODE" = true ]; then
        mkdir -p "$CACHE_DIR"
    else
        rm -rf "$CACHE_DIR" 2>/dev/null || true
        mkdir -p "$CACHE_DIR"
    fi
else
    # Non-git/dev environments: resume isn't safe/meaningful.
    RESUME_MODE=false
    CACHE_DIR="$ROOT_DIR/.tests/run-all-cache/_nogit/$(date +%s)"
    rm -rf "$CACHE_DIR" 2>/dev/null || true
    mkdir -p "$CACHE_DIR"
fi

echo "=== Tsonic Test Suite ===" | tee "$LOG_FILE"
echo "Branch:  $(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || echo 'unknown')" | tee -a "$LOG_FILE"
echo "Commit:  $(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
if [ "$RESUME_MODE" = true ]; then
    echo -e "${YELLOW}NOTE: RESUME MODE. Already-passed unit/golden tests and fixtures will be skipped.${NC}" | tee -a "$LOG_FILE"
fi
if [ ${#FILTER_PATTERNS[@]} -gt 0 ]; then
    echo -e "${YELLOW}NOTE: FILTERED RUN (${FILTER_PATTERNS[*]}). Do not use this as the final verification.${NC}" | tee -a "$LOG_FILE"
fi
if [ "$SKIP_UNIT" = true ]; then
    echo -e "${YELLOW}NOTE: UNIT TESTS SKIPPED (--no-unit). Do not use this as the final verification.${NC}" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ============================================================
# 0.5 Fresh workspace build
# ============================================================
echo -e "${BLUE}--- Running Fresh Workspace Build ---${NC}" | tee -a "$LOG_FILE"
cd "$ROOT_DIR"

if [ "$SKIP_UNIT" = true ]; then
    echo -e "${YELLOW}SKIP: fresh workspace build (--no-unit)${NC}" | tee -a "$LOG_FILE"
    FRESH_BUILD_STATUS="skipped"
else
    if bash "$ROOT_DIR/scripts/build/clean.sh" 2>&1 | tee -a "$LOG_FILE" && \
       bash "$ROOT_DIR/scripts/build/all.sh" --no-format 2>&1 | tee -a "$LOG_FILE"; then
        FRESH_BUILD_STATUS="passed"
        FRESH_BUILD_PASSED=1
    else
        FRESH_BUILD_STATUS="failed"
        FRESH_BUILD_FAILED=1
    fi
fi

echo "" | tee -a "$LOG_FILE"

# ============================================================
# 1. Unit & Golden Tests (npm test)
# ============================================================
echo -e "${BLUE}--- Running Unit & Golden Tests ---${NC}" | tee -a "$LOG_FILE"
cd "$ROOT_DIR"

if [ "$SKIP_UNIT" = true ]; then
    echo -e "${YELLOW}SKIP: unit + golden tests (--no-unit)${NC}" | tee -a "$LOG_FILE"
    UNIT_STATUS="skipped"
else
    if TSONIC_TEST_CHECKPOINT_DIR="$CACHE_DIR" TSONIC_TEST_RESUME="$([ "$RESUME_MODE" = true ] && echo 1 || echo 0)" npm test 2>&1 | tee -a "$LOG_FILE"; then
        UNIT_STATUS="passed"
    else
        UNIT_STATUS="failed"
    fi

    # Extract pass/fail counts from npm test output
    while IFS= read -r line; do
        if [[ "$line" =~ ([0-9]+)\ passing ]]; then
            count="${BASH_REMATCH[1]}"
            UNIT_PASSED=$((UNIT_PASSED + count))
        fi
        if [[ "$line" =~ ([0-9]+)\ failing ]]; then
            count="${BASH_REMATCH[1]}"
            UNIT_FAILED=$((UNIT_FAILED + count))
        fi
    done < <(grep -E "passing|failing" "$LOG_FILE" || true)

    # Ensure failures are surfaced even when a workspace fails to build before running mocha.
    if [ "$UNIT_STATUS" = "failed" ] && [ "$UNIT_FAILED" -eq 0 ]; then
        UNIT_FAILED=1
    fi
fi

echo "" | tee -a "$LOG_FILE"

# ============================================================
# 1.25 TypeScript typecheck (fixtures must pass vanilla tsc)
# ============================================================
echo -e "${BLUE}--- Running TypeScript Typecheck (E2E fixtures) ---${NC}" | tee -a "$LOG_FILE"
typecheck_cmd=(bash "$ROOT_DIR/test/scripts/typecheck-fixtures.sh")
for pat in "${FILTER_PATTERNS[@]}"; do
    typecheck_cmd+=(--filter "$pat")
done

if TSONIC_TEST_CHECKPOINT_DIR="$CACHE_DIR" TSONIC_TEST_RESUME="$([ "$RESUME_MODE" = true ] && echo 1 || echo 0)" "${typecheck_cmd[@]}" 2>&1 | tee -a "$LOG_FILE"; then
    TSC_STATUS="passed"
else
    TSC_STATUS="failed"
fi

# Extract tsc pass/fail counts from script output
tsc_summary_line=$(grep -E "Typecheck summary:" "$LOG_FILE" | tail -1 || true)
if [[ "$tsc_summary_line" =~ Typecheck\ summary:\ ([0-9]+)\ passed,\ ([0-9]+)\ failed ]]; then
    TSC_PASSED="${BASH_REMATCH[1]}"
    TSC_FAILED="${BASH_REMATCH[2]}"
fi

# Ensure failures are surfaced even when the typecheck script fails before printing a summary.
if [ "$TSC_STATUS" = "failed" ] && [ "$TSC_FAILED" -eq 0 ]; then
    TSC_FAILED=1
fi

echo "" | tee -a "$LOG_FILE"

if [ "$QUICK_MODE" = true ]; then
    echo -e "${YELLOW}--- Skipping E2E Tests (--quick mode) ---${NC}" | tee -a "$LOG_FILE"
else
    # ============================================================
    # 1.5 Core runtime DLL sync
    # ============================================================
    echo -e "${BLUE}--- Syncing Core Runtime DLL ---${NC}" | tee -a "$LOG_FILE"
    if "$ROOT_DIR/scripts/sync-runtime-dlls.sh" 2>&1 | tee -a "$LOG_FILE"; then
        RUNTIME_SYNC_STATUS="passed"
    else
        RUNTIME_SYNC_STATUS="failed"
        # Count as an E2E failure so the overall run fails.
        E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
        echo -e "${RED}FAIL: core runtime DLL sync failed${NC}" | tee -a "$LOG_FILE"
    fi
    echo "" | tee -a "$LOG_FILE"

    RUN_E2E_FIXTURES=true
    if [ "$RUNTIME_SYNC_STATUS" = "passed" ]; then
        echo -e "${BLUE}--- NativeAOT Preflight ---${NC}" | tee -a "$LOG_FILE"
        if nativeaot_preflight_check "$LOG_FILE"; then
            AOT_PREFLIGHT_STATUS="passed"
        else
            AOT_PREFLIGHT_STATUS="failed"
            RUN_E2E_FIXTURES=false
            # Count once so the run fails clearly without cascading noise.
            E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
            echo -e "${RED}FAIL: NativeAOT preflight failed; skipping fixture execution.${NC}" | tee -a "$LOG_FILE"
        fi
        echo "" | tee -a "$LOG_FILE"
    else
        AOT_PREFLIGHT_STATUS="skipped"
        RUN_E2E_FIXTURES=false
    fi

    if [ "$RUN_E2E_FIXTURES" = true ]; then
    # ============================================================
    # 2. E2E Dotnet Tests (Parallel)
    # ============================================================
    echo -e "${BLUE}--- Running E2E Dotnet Tests (concurrency: $TEST_CONCURRENCY) ---${NC}" | tee -a "$LOG_FILE"
    stabilize_tsonic_bin

    FIXTURES_DIR="$SCRIPT_DIR/../fixtures"
    # Persistent directory for per-fixture results (enables --resume).
    RESULTS_DIR="$CACHE_DIR/e2e"
    mkdir -p "$RESULTS_DIR"

    DOTNET_FIXTURES=()
    run_dotnet_test_batch
    echo "" | tee -a "$LOG_FILE"

    # ============================================================
    # 3. Negative Tests (expected failures) - Parallel
    # ============================================================
    echo -e "${BLUE}--- Running Negative Tests (concurrency: $TEST_CONCURRENCY) ---${NC}" | tee -a "$LOG_FILE"
    NEGATIVE_FIXTURES=()
    run_negative_test_batch
    echo "" | tee -a "$LOG_FILE"
    else
        echo -e "${YELLOW}--- Skipping E2E fixture execution (NativeAOT preflight/runtime sync not available) ---${NC}" | tee -a "$LOG_FILE"
        echo "" | tee -a "$LOG_FILE"
    fi
fi

print_summary_and_exit
