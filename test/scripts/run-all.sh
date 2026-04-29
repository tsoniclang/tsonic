#!/bin/bash
# Unified test runner: unit tests, golden tests, E2E tests, and summary report
#
# Usage: ./test/scripts/run-all.sh [--quick] [--no-cli] [--no-fixtures] [--fast] [--filter <pattern>]
#   --quick: Skip E2E tests, only run unit/golden tests
#   --no-unit: Skip unit/golden tests (fixtures only). Intended for iteration.
#   --no-cli: Skip CLI tests only. Intended for iteration.
#   --no-fixtures: Skip fixture typecheck and all fixture execution phases.
#   --fast: Shorthand for --no-cli --no-fixtures.
#   --filter: Run only matching E2E fixtures (substring match on fixture name).
#             Can be repeated, or use comma-separated patterns.
#   --resume: Resume from a previous (aborted) run for the same commit+args by
#             skipping already-passed unit/golden tests and already-passed fixtures.
#
# Environment variables:
#   TEST_CONCURRENCY: Number of parallel E2E tests (default: 4)
#   TSONIC_BIN: Optional override for the tsonic CLI path.
#   TSONIC_E2E_NUGET_PACKAGES_DIR: Shared E2E NuGet package cache.
#   TSONIC_E2E_KEEP_ARTIFACTS=1: Preserve per-fixture generated/.tsonic/out artifacts.

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
TSC_PASSED=0
TSC_FAILED=0
E2E_DOTNET_PASSED=0
E2E_DOTNET_FAILED=0
E2E_NEGATIVE_PASSED=0
E2E_NEGATIVE_FAILED=0
FRESH_BUILD_PASSED=0
FRESH_BUILD_FAILED=0
RELEASE_SMOKE_PASSED=0
RELEASE_SMOKE_FAILED=0

# Package/unit phase tracking
FRONTEND_STATUS="not-run"
FRONTEND_ALL_PASSED=0
FRONTEND_ALL_FAILED=0
FRONTEND_ALL_SKIPPED=0
FRONTEND_ALL_COUNT=0
FRONTEND_ALL_EXECUTED_COUNT=0
FRONTEND_ALL_TEST_DURATION_SUM_MS=0
FRONTEND_ALL_TEST_AVG_MS=0
FRONTEND_DURATION_MS=0

BACKEND_STATUS="not-run"
BACKEND_ALL_PASSED=0
BACKEND_ALL_FAILED=0
BACKEND_ALL_SKIPPED=0
BACKEND_ALL_COUNT=0
BACKEND_ALL_EXECUTED_COUNT=0
BACKEND_ALL_TEST_DURATION_SUM_MS=0
BACKEND_ALL_TEST_AVG_MS=0
BACKEND_DURATION_MS=0

EMITTER_STATUS="not-run"
EMITTER_ALL_PASSED=0
EMITTER_ALL_FAILED=0
EMITTER_ALL_SKIPPED=0
EMITTER_ALL_COUNT=0
EMITTER_ALL_EXECUTED_COUNT=0
EMITTER_ALL_TEST_DURATION_SUM_MS=0
EMITTER_ALL_TEST_AVG_MS=0
EMITTER_REGULAR_PASSED=0
EMITTER_REGULAR_FAILED=0
EMITTER_REGULAR_SKIPPED=0
EMITTER_REGULAR_COUNT=0
EMITTER_REGULAR_EXECUTED_COUNT=0
EMITTER_REGULAR_TEST_DURATION_SUM_MS=0
EMITTER_REGULAR_TEST_AVG_MS=0
EMITTER_GOLDEN_PASSED=0
EMITTER_GOLDEN_FAILED=0
EMITTER_GOLDEN_SKIPPED=0
EMITTER_GOLDEN_COUNT=0
EMITTER_GOLDEN_EXECUTED_COUNT=0
EMITTER_GOLDEN_TEST_DURATION_SUM_MS=0
EMITTER_GOLDEN_TEST_AVG_MS=0
EMITTER_DURATION_MS=0

CLI_STATUS="not-run"
CLI_ALL_PASSED=0
CLI_ALL_FAILED=0
CLI_ALL_SKIPPED=0
CLI_ALL_COUNT=0
CLI_ALL_EXECUTED_COUNT=0
CLI_ALL_TEST_DURATION_SUM_MS=0
CLI_ALL_TEST_AVG_MS=0
CLI_DURATION_MS=0

# Step status
FRESH_BUILD_STATUS="unknown"
RELEASE_SMOKE_STATUS="unknown"
UNIT_STATUS="unknown"
TSC_STATUS="unknown"
RUNTIME_SYNC_STATUS="unknown"
AOT_PREFLIGHT_STATUS="not-run"
FRESH_BUILD_DURATION_MS=0
RELEASE_SMOKE_DURATION_MS=0
UNIT_DURATION_MS=0
TSC_DURATION_MS=0
RUNTIME_SYNC_DURATION_MS=0
AOT_PREFLIGHT_DURATION_MS=0
E2E_DOTNET_DURATION_MS=0
E2E_NEGATIVE_DURATION_MS=0

QUICK_MODE=false
SKIP_UNIT=false
SKIP_CLI=false
SKIP_FIXTURES=false
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
        --no-cli)
            SKIP_CLI=true
            shift
            ;;
        --no-fixtures)
            SKIP_FIXTURES=true
            shift
            ;;
        --fast)
            SKIP_CLI=true
            SKIP_FIXTURES=true
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
RUN_STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_HEAD="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "nogit")"
RUN_ID="${RUN_STAMP}-${RUN_HEAD}"
LOG_FILE="$ROOT_DIR/.tests/run-all-${RUN_ID}.log"
TRACE_FILE="$ROOT_DIR/.tests/run-all-${RUN_ID}.trace.jsonl"
export TSONIC_TEST_RUN_ID="$RUN_ID"
export TSONIC_TEST_TRACE_FILE="$TRACE_FILE"

if [ -z "${NUGET_PACKAGES:-}" ]; then
    export NUGET_PACKAGES="${TSONIC_E2E_NUGET_PACKAGES_DIR:-$ROOT_DIR/.tests/nuget/packages}"
else
    export NUGET_PACKAGES
fi
mkdir -p "$NUGET_PACKAGES"

if [ ! -x "$ROOT_DIR/node_modules/.bin/tsc" ]; then
    echo "FAIL: Node dependencies are not installed."
    echo "Run npm ci in the repo root before ./test/scripts/run-all.sh."
    exit 1
fi

if [ -x "$ROOT_DIR/scripts/bindings-semantics/install-local-wave.sh" ]; then
    echo -e "${BLUE}--- Installing Local First-Party Source Packages ---${NC}" | tee -a "$LOG_FILE"
    if ! "$ROOT_DIR/scripts/bindings-semantics/install-local-wave.sh" "$ROOT_DIR" 2>&1 | tee -a "$LOG_FILE"; then
        echo -e "${RED}FAIL: local first-party source package installation failed${NC}" | tee -a "$LOG_FILE"
        exit 1
    fi
    echo "" | tee -a "$LOG_FILE"
fi

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
      const skipCli = process.argv[3] === "1";
      const skipFixtures = process.argv[4] === "1";
      const filters = JSON.parse(process.argv[5] ?? "[]");
      const args = { quick, skipUnit, skipCli, skipFixtures, filters };
      process.stdout.write(crypto.createHash("sha256").update(JSON.stringify(args)).digest("hex"));
    ' "$([ "$QUICK_MODE" = true ] && echo 1 || echo 0)" "$([ "$SKIP_UNIT" = true ] && echo 1 || echo 0)" "$([ "$SKIP_CLI" = true ] && echo 1 || echo 0)" "$([ "$SKIP_FIXTURES" = true ] && echo 1 || echo 0)" "$FILTERS_CANON_JSON" 2>/dev/null || echo ""
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

run_mocha_phase() {
    local prefix="$1"
    local label="$2"
    local npm_script="$3"
    local package_name="$4"

    echo -e "${BLUE}--- Running $label ---${NC}" | tee -a "$LOG_FILE"
    local started_ms
    started_ms="$(now_ms)"
    trace_event phase-start scope package package "$package_name" label "$label"

    if TSONIC_TEST_CHECKPOINT_DIR="$CACHE_DIR" TSONIC_TEST_PROGRESS=1 TSONIC_MOCHA_PROGRESS_REPORTER=1 TSONIC_TEST_RESUME="$([ "$RESUME_MODE" = true ] && echo 1 || echo 0)" npm run "$npm_script" -- --reporter "$ROOT_DIR/test/mocha/progress-reporter.cjs" 2>&1 | tee -a "$LOG_FILE"; then
        eval "${prefix}_STATUS='passed'"
    else
        eval "${prefix}_STATUS='failed'"
    fi

    eval "${prefix}_DURATION_MS=$(( $(now_ms) - started_ms ))"
    eval "$(load_mocha_stats "$package_name" "$prefix")"

    if [ "$(eval "printf '%s' \"\${${prefix}_STATUS}\"")" = "failed" ] && [ "$(eval "printf '%s' \"\${${prefix}_ALL_FAILED}\"")" -eq 0 ]; then
        eval "${prefix}_ALL_FAILED=1"
    fi

    local count executed_count passed failed skipped wall_ms test_sum_ms test_avg_ms
    count="$(eval "printf '%s' \"\${${prefix}_ALL_COUNT}\"")"
    executed_count="$(eval "printf '%s' \"\${${prefix}_ALL_EXECUTED_COUNT}\"")"
    passed="$(eval "printf '%s' \"\${${prefix}_ALL_PASSED}\"")"
    failed="$(eval "printf '%s' \"\${${prefix}_ALL_FAILED}\"")"
    skipped="$(eval "printf '%s' \"\${${prefix}_ALL_SKIPPED}\"")"
    wall_ms="$(eval "printf '%s' \"\${${prefix}_DURATION_MS}\"")"
    test_sum_ms="$(eval "printf '%s' \"\${${prefix}_ALL_TEST_DURATION_SUM_MS}\"")"
    test_avg_ms="$(eval "printf '%s' \"\${${prefix}_ALL_TEST_AVG_MS}\"")"

    echo "Duration: $(format_duration_ms "$(eval "printf '%s' \"\${${prefix}_DURATION_MS}\"")")" | tee -a "$LOG_FILE"
    echo "Count: $count (executed: $executed_count, skipped: $skipped)" | tee -a "$LOG_FILE"
    echo "Pass/Fail: $passed/$failed" | tee -a "$LOG_FILE"
    if [ "$executed_count" -gt 0 ]; then
        echo "Avg wall / executed test: $(format_duration_ms "$(average_ms "$wall_ms" "$executed_count")")" | tee -a "$LOG_FILE"
        echo "Measured test duration sum: $(format_duration_ms "$test_sum_ms")" | tee -a "$LOG_FILE"
        echo "Measured avg test duration: $(format_duration_ms "$test_avg_ms")" | tee -a "$LOG_FILE"
    fi
    if [ "$prefix" = "EMITTER" ]; then
        echo "Emitter regular count: $EMITTER_REGULAR_COUNT, golden count: $EMITTER_GOLDEN_COUNT" | tee -a "$LOG_FILE"
        if [ "$EMITTER_GOLDEN_EXECUTED_COUNT" -gt 0 ]; then
            echo "Emitter golden avg test duration: $(format_duration_ms "$EMITTER_GOLDEN_TEST_AVG_MS")" | tee -a "$LOG_FILE"
        fi
    fi
    trace_event phase-done scope package package "$package_name" label "$label" status "$(eval "printf '%s' \"\${${prefix}_STATUS}\"")" wallMs "$wall_ms" executed "$executed_count" passed "$passed" failed "$failed" skipped "$skipped"
    echo "" | tee -a "$LOG_FILE"
}

echo "=== Tsonic Test Suite ===" | tee "$LOG_FILE"
echo "Run ID:  $RUN_ID" | tee -a "$LOG_FILE"
echo "Branch:  $(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || echo 'unknown')" | tee -a "$LOG_FILE"
echo "Commit:  $(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')" | tee -a "$LOG_FILE"
echo "Trace:   $TRACE_FILE" | tee -a "$LOG_FILE"
echo "NuGet:   $NUGET_PACKAGES" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
trace_event run-start scope run quick "$QUICK_MODE" skipUnit "$SKIP_UNIT" skipCli "$SKIP_CLI" skipFixtures "$SKIP_FIXTURES" resume "$RESUME_MODE" filters "$FILTERS_CANON_JSON"
if [ "$RESUME_MODE" = true ]; then
    echo -e "${YELLOW}NOTE: RESUME MODE. Already-passed unit/golden tests and fixtures will be skipped.${NC}" | tee -a "$LOG_FILE"
fi
if [ ${#FILTER_PATTERNS[@]} -gt 0 ]; then
    echo -e "${YELLOW}NOTE: FILTERED RUN (${FILTER_PATTERNS[*]}). Do not use this as the final verification.${NC}" | tee -a "$LOG_FILE"
fi
if [ "$SKIP_UNIT" = true ]; then
    echo -e "${YELLOW}NOTE: UNIT TESTS SKIPPED (--no-unit). Do not use this as the final verification.${NC}" | tee -a "$LOG_FILE"
fi
if [ "$SKIP_CLI" = true ]; then
    echo -e "${YELLOW}NOTE: CLI TESTS SKIPPED (--no-cli/--fast). Do not use this as the final verification.${NC}" | tee -a "$LOG_FILE"
fi
if [ "$SKIP_FIXTURES" = true ]; then
    echo -e "${YELLOW}NOTE: FIXTURE TYPECHECK + E2E SKIPPED (--no-fixtures/--fast). Do not use this as the final verification.${NC}" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

RUNTIME_SYNC_REQUIRED=false
if { [ "$SKIP_UNIT" = false ] && [ "$SKIP_CLI" = false ]; } || \
   { [ "$SKIP_FIXTURES" = false ] && [ "$QUICK_MODE" = false ]; }; then
    RUNTIME_SYNC_REQUIRED=true
fi

run_runtime_sync_phase() {
    if [ "$RUNTIME_SYNC_REQUIRED" != true ]; then
        RUNTIME_SYNC_STATUS="skipped"
        trace_event phase-done scope phase phase runtime-sync status skipped durationMs 0
        return
    fi

    echo -e "${BLUE}--- Syncing Core Runtime DLL ---${NC}" | tee -a "$LOG_FILE"
    runtime_sync_started_ms="$(now_ms)"
    trace_event phase-start scope phase phase runtime-sync
    if "$ROOT_DIR/scripts/sync-runtime-dlls.sh" 2>&1 | tee -a "$LOG_FILE"; then
        RUNTIME_SYNC_STATUS="passed"
    else
        RUNTIME_SYNC_STATUS="failed"
        if [ "$SKIP_FIXTURES" = false ] && [ "$QUICK_MODE" = false ]; then
            E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
        fi
        echo -e "${RED}FAIL: core runtime DLL sync failed${NC}" | tee -a "$LOG_FILE"
    fi
    RUNTIME_SYNC_DURATION_MS=$(( $(now_ms) - runtime_sync_started_ms ))
    trace_event phase-done scope phase phase runtime-sync status "$RUNTIME_SYNC_STATUS" durationMs "$RUNTIME_SYNC_DURATION_MS"
    echo "Duration: $(format_duration_ms "$RUNTIME_SYNC_DURATION_MS")" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# ============================================================
# 0.5 Fresh workspace build
# ============================================================
echo -e "${BLUE}--- Running Fresh Workspace Build ---${NC}" | tee -a "$LOG_FILE"
cd "$ROOT_DIR"
fresh_build_started_ms="$(now_ms)"
trace_event phase-start scope phase phase fresh-build

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
FRESH_BUILD_DURATION_MS=$(( $(now_ms) - fresh_build_started_ms ))
trace_event phase-done scope phase phase fresh-build status "$FRESH_BUILD_STATUS" durationMs "$FRESH_BUILD_DURATION_MS" passed "$FRESH_BUILD_PASSED" failed "$FRESH_BUILD_FAILED"
echo "Duration: $(format_duration_ms "$FRESH_BUILD_DURATION_MS")" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================================
# 0.6 Release package smoke
# ============================================================
echo -e "${BLUE}--- Running Release Package Smoke ---${NC}" | tee -a "$LOG_FILE"
release_smoke_started_ms="$(now_ms)"
trace_event phase-start scope phase phase release-package-smoke

if [ "$SKIP_UNIT" = true ]; then
    echo -e "${YELLOW}SKIP: release package smoke (--no-unit)${NC}" | tee -a "$LOG_FILE"
    RELEASE_SMOKE_STATUS="skipped"
elif [ "$FRESH_BUILD_STATUS" != "passed" ]; then
    echo -e "${YELLOW}SKIP: release package smoke (fresh build did not pass)${NC}" | tee -a "$LOG_FILE"
    RELEASE_SMOKE_STATUS="skipped"
else
    if bash "$ROOT_DIR/test/scripts/release-package-smoke.sh" 2>&1 | tee -a "$LOG_FILE"; then
        RELEASE_SMOKE_STATUS="passed"
        RELEASE_SMOKE_PASSED=1
    else
        RELEASE_SMOKE_STATUS="failed"
        RELEASE_SMOKE_FAILED=1
    fi
fi

RELEASE_SMOKE_DURATION_MS=$(( $(now_ms) - release_smoke_started_ms ))
trace_event phase-done scope phase phase release-package-smoke status "$RELEASE_SMOKE_STATUS" durationMs "$RELEASE_SMOKE_DURATION_MS" passed "$RELEASE_SMOKE_PASSED" failed "$RELEASE_SMOKE_FAILED"
echo "Duration: $(format_duration_ms "$RELEASE_SMOKE_DURATION_MS")" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================================
# 0.75 Core runtime DLL sync
# ============================================================
run_runtime_sync_phase

# ============================================================
# 1. Package Tests
# ============================================================
echo -e "${BLUE}--- Running Unit & Golden Tests ---${NC}" | tee -a "$LOG_FILE"
cd "$ROOT_DIR"
unit_started_ms="$(now_ms)"
trace_event phase-start scope phase phase unit-and-golden

if [ "$SKIP_UNIT" = true ]; then
    echo -e "${YELLOW}SKIP: unit + golden tests (--no-unit)${NC}" | tee -a "$LOG_FILE"
    UNIT_STATUS="skipped"
    FRONTEND_STATUS="skipped"
    BACKEND_STATUS="skipped"
    EMITTER_STATUS="skipped"
    CLI_STATUS="skipped"
    echo "" | tee -a "$LOG_FILE"
else
    run_mocha_phase "FRONTEND" "Frontend Tests" "test:frontend" "@tsonic/frontend"
    run_mocha_phase "BACKEND" "Backend Tests" "test:backend" "@tsonic/backend"
    run_mocha_phase "EMITTER" "Emitter Tests" "test:emitter" "@tsonic/emitter"
    if [ "$SKIP_CLI" = true ]; then
        echo -e "${YELLOW}SKIP: CLI tests (--no-cli/--fast)${NC}" | tee -a "$LOG_FILE"
        CLI_STATUS="skipped"
        trace_event phase-done scope package package "@tsonic/cli" label "CLI Tests" status skipped wallMs 0 executed 0 passed 0 failed 0 skipped 0
        echo "" | tee -a "$LOG_FILE"
    elif [ "$RUNTIME_SYNC_STATUS" = "failed" ]; then
        echo -e "${RED}FAIL: CLI tests require core runtime DLL sync; skipping to avoid cascading build failures.${NC}" | tee -a "$LOG_FILE"
        CLI_STATUS="failed"
        CLI_ALL_FAILED=1
        CLI_ALL_COUNT=1
        trace_event phase-done scope package package "@tsonic/cli" label "CLI Tests" status failed wallMs 0 executed 0 passed 0 failed 1 skipped 0
        echo "" | tee -a "$LOG_FILE"
    else
        run_mocha_phase "CLI" "CLI Tests" "test:cli" "@tsonic/cli"
    fi

    UNIT_PASSED=$((FRONTEND_ALL_PASSED + BACKEND_ALL_PASSED + EMITTER_ALL_PASSED + CLI_ALL_PASSED))
    UNIT_FAILED=$((FRONTEND_ALL_FAILED + BACKEND_ALL_FAILED + EMITTER_ALL_FAILED + CLI_ALL_FAILED))

    if [ "$FRONTEND_STATUS" = "passed" ] && \
       [ "$BACKEND_STATUS" = "passed" ] && \
       [ "$EMITTER_STATUS" = "passed" ] && \
       { [ "$CLI_STATUS" = "passed" ] || [ "$CLI_STATUS" = "skipped" ]; }; then
        UNIT_STATUS="passed"
    else
        UNIT_STATUS="failed"
    fi
fi
UNIT_DURATION_MS=$(( $(now_ms) - unit_started_ms ))
trace_event phase-done scope phase phase unit-and-golden status "$UNIT_STATUS" durationMs "$UNIT_DURATION_MS" passed "$UNIT_PASSED" failed "$UNIT_FAILED"
echo "Unit + golden wall duration: $(format_duration_ms "$UNIT_DURATION_MS")" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================================
# 1.25 TypeScript typecheck (fixtures must pass vanilla tsc)
# ============================================================
echo -e "${BLUE}--- Running TypeScript Typecheck (E2E fixtures) ---${NC}" | tee -a "$LOG_FILE"
tccheck_started_ms="$(now_ms)"
trace_event phase-start scope phase phase typescript-typecheck
if [ "$SKIP_FIXTURES" = true ]; then
    echo -e "${YELLOW}SKIP: fixture typecheck (--no-fixtures/--fast)${NC}" | tee -a "$LOG_FILE"
    TSC_STATUS="skipped"
else
    typecheck_cmd=(bash "$ROOT_DIR/test/scripts/typecheck-fixtures.sh")
    for pat in "${FILTER_PATTERNS[@]}"; do
        typecheck_cmd+=(--filter "$pat")
    done

    if TSONIC_TEST_CHECKPOINT_DIR="$CACHE_DIR" TSONIC_TEST_RESUME="$([ "$RESUME_MODE" = true ] && echo 1 || echo 0)" "${typecheck_cmd[@]}" 2>&1 | tee -a "$LOG_FILE"; then
        TSC_STATUS="passed"
    else
        TSC_STATUS="failed"
    fi
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
TSC_DURATION_MS=$(( $(now_ms) - tccheck_started_ms ))
trace_event phase-done scope phase phase typescript-typecheck status "$TSC_STATUS" durationMs "$TSC_DURATION_MS" passed "$TSC_PASSED" failed "$TSC_FAILED"
echo "Duration: $(format_duration_ms "$TSC_DURATION_MS")" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

if [ "$SKIP_FIXTURES" = true ]; then
    echo -e "${YELLOW}--- Skipping Fixture Phases (--no-fixtures/--fast) ---${NC}" | tee -a "$LOG_FILE"
    AOT_PREFLIGHT_STATUS="skipped"
    trace_event phase-done scope phase phase nativeaot-preflight status skipped durationMs 0
    trace_event phase-done scope phase phase e2e-dotnet status skipped durationMs 0 passed 0 failed 0
    trace_event phase-done scope phase phase e2e-negative status skipped durationMs 0 passed 0 failed 0
elif [ "$QUICK_MODE" = true ]; then
    echo -e "${YELLOW}--- Skipping E2E Tests (--quick mode) ---${NC}" | tee -a "$LOG_FILE"
    AOT_PREFLIGHT_STATUS="skipped"
    trace_event phase-done scope phase phase nativeaot-preflight status skipped durationMs 0
    trace_event phase-done scope phase phase e2e-dotnet status skipped durationMs 0 passed 0 failed 0
    trace_event phase-done scope phase phase e2e-negative status skipped durationMs 0 passed 0 failed 0
else
    RUN_E2E_FIXTURES=true
    if [ "$RUNTIME_SYNC_STATUS" = "passed" ]; then
        echo -e "${BLUE}--- NativeAOT Preflight ---${NC}" | tee -a "$LOG_FILE"
        aot_preflight_started_ms="$(now_ms)"
        trace_event phase-start scope phase phase nativeaot-preflight
        if nativeaot_preflight_check "$LOG_FILE"; then
            AOT_PREFLIGHT_STATUS="passed"
        else
            AOT_PREFLIGHT_STATUS="failed"
            RUN_E2E_FIXTURES=false
            # Count once so the run fails clearly without cascading noise.
            E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
            echo -e "${RED}FAIL: NativeAOT preflight failed; skipping fixture execution.${NC}" | tee -a "$LOG_FILE"
        fi
        AOT_PREFLIGHT_DURATION_MS=$(( $(now_ms) - aot_preflight_started_ms ))
        trace_event phase-done scope phase phase nativeaot-preflight status "$AOT_PREFLIGHT_STATUS" durationMs "$AOT_PREFLIGHT_DURATION_MS"
        echo "Duration: $(format_duration_ms "$AOT_PREFLIGHT_DURATION_MS")" | tee -a "$LOG_FILE"
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
    e2e_dotnet_started_ms="$(now_ms)"
    trace_event phase-start scope phase phase e2e-dotnet concurrency "$TEST_CONCURRENCY"
    stabilize_tsonic_bin

    FIXTURES_DIR="$SCRIPT_DIR/../fixtures"
    # Persistent directory for per-fixture results (enables --resume).
    RESULTS_DIR="$CACHE_DIR/e2e"
    mkdir -p "$RESULTS_DIR"

    DOTNET_FIXTURES=()
    run_dotnet_test_batch
    E2E_DOTNET_DURATION_MS=$(( $(now_ms) - e2e_dotnet_started_ms ))
    trace_event phase-done scope phase phase e2e-dotnet status "$([ "$E2E_DOTNET_FAILED" -gt 0 ] && echo failed || echo passed)" durationMs "$E2E_DOTNET_DURATION_MS" passed "$E2E_DOTNET_PASSED" failed "$E2E_DOTNET_FAILED"
    echo "Duration: $(format_duration_ms "$E2E_DOTNET_DURATION_MS")" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    # ============================================================
    # 3. Negative Tests (expected failures) - Parallel
    # ============================================================
    echo -e "${BLUE}--- Running Negative Tests (concurrency: $TEST_CONCURRENCY) ---${NC}" | tee -a "$LOG_FILE"
    e2e_negative_started_ms="$(now_ms)"
    trace_event phase-start scope phase phase e2e-negative concurrency "$TEST_CONCURRENCY"
    NEGATIVE_FIXTURES=()
    run_negative_test_batch
    E2E_NEGATIVE_DURATION_MS=$(( $(now_ms) - e2e_negative_started_ms ))
    trace_event phase-done scope phase phase e2e-negative status "$([ "$E2E_NEGATIVE_FAILED" -gt 0 ] && echo failed || echo passed)" durationMs "$E2E_NEGATIVE_DURATION_MS" passed "$E2E_NEGATIVE_PASSED" failed "$E2E_NEGATIVE_FAILED"
    echo "Duration: $(format_duration_ms "$E2E_NEGATIVE_DURATION_MS")" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    else
        echo -e "${YELLOW}--- Skipping E2E fixture execution (NativeAOT preflight/runtime sync not available) ---${NC}" | tee -a "$LOG_FILE"
        trace_event phase-done scope phase phase e2e-dotnet status skipped durationMs 0 passed "$E2E_DOTNET_PASSED" failed "$E2E_DOTNET_FAILED"
        trace_event phase-done scope phase phase e2e-negative status skipped durationMs 0 passed "$E2E_NEGATIVE_PASSED" failed "$E2E_NEGATIVE_FAILED"
        echo "" | tee -a "$LOG_FILE"
    fi
fi

print_summary_and_exit
