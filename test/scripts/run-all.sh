#!/bin/bash
# Unified test runner: unit tests, golden tests, E2E tests, and summary report
#
# Usage: ./test/scripts/run-all.sh [--quick]
#   --quick: Skip E2E tests, only run unit/golden tests
#
# Environment variables:
#   TEST_CONCURRENCY: Number of parallel E2E tests (default: 4)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

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
E2E_DOTNET_PASSED=0
E2E_DOTNET_FAILED=0
E2E_NEGATIVE_PASSED=0
E2E_NEGATIVE_FAILED=0

QUICK_MODE=false
if [ "${1:-}" = "--quick" ]; then
    QUICK_MODE=true
fi

# Create logs directory
mkdir -p "$ROOT_DIR/.tests"
LOG_FILE="$ROOT_DIR/.tests/run-all-$(date +%Y%m%d-%H%M%S).log"

echo "=== Tsonic Test Suite ===" | tee "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ============================================================
# 1. Unit & Golden Tests (npm test)
# ============================================================
echo -e "${BLUE}--- Running Unit & Golden Tests ---${NC}" | tee -a "$LOG_FILE"
cd "$ROOT_DIR"

if npm test 2>&1 | tee -a "$LOG_FILE"; then
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

echo "" | tee -a "$LOG_FILE"

if [ "$QUICK_MODE" = true ]; then
    echo -e "${YELLOW}--- Skipping E2E Tests (--quick mode) ---${NC}" | tee -a "$LOG_FILE"
else
    # ============================================================
    # 1.5 Runtime DLL sync (required for generator runtime)
    # ============================================================
    echo -e "${BLUE}--- Syncing Runtime DLLs ---${NC}" | tee -a "$LOG_FILE"
    "$ROOT_DIR/scripts/sync-runtime-dlls.sh" 2>&1 | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    # ============================================================
    # 2. E2E Dotnet Tests (Parallel)
    # ============================================================
    echo -e "${BLUE}--- Running E2E Dotnet Tests (concurrency: $TEST_CONCURRENCY) ---${NC}" | tee -a "$LOG_FILE"

    FIXTURES_DIR="$SCRIPT_DIR/../fixtures"
    CLI_PATH="$ROOT_DIR/packages/cli/dist/index.js"

    # Temp directory for parallel results
    RESULTS_DIR=$(mktemp -d)
    trap "rm -rf $RESULTS_DIR" EXIT

    # Function to run a single E2E dotnet test (prints result immediately)
    run_dotnet_test() {
        local fixture_dir="$1"
        local cli_path="$2"
        local results_dir="$3"
        local fixture_name=$(basename "$fixture_dir")
        local result_file="$results_dir/$fixture_name"
        local error_file="$results_dir/${fixture_name}.error"
        local result=""

        cd "$fixture_dir"

        # Optional per-fixture dependency install (off by default).
        # E2E fixtures live inside the monorepo, so they can resolve @tsonic/*
        # from the repo root node_modules without local installs.
        if [ -f "package.json" ] && [ "${E2E_NPM_INSTALL:-0}" = "1" ]; then
            npm install --silent --no-package-lock
        fi

        # Build and run - capture errors to file
        if node "$cli_path" build src/index.ts --config tsonic.dotnet.json 2>"$error_file"; then
            # Find executable
            # Some .NET publish outputs mark DLLs as executable; filter those out.
            exe_path=$(find out -type f -executable 2>/dev/null | grep -v '\.dll$' | head -1 || true)
            if [ -z "$exe_path" ]; then
                exe_path=$(find generated -type f -executable 2>/dev/null | grep -v '\.dll$' | head -1 || true)
            fi

            if [ -n "$exe_path" ] && [ -x "$exe_path" ]; then
                # Check for expected output
                if [ -f "expected-output.txt" ]; then
                    actual=$("$exe_path" 2>&1 || true)
                    expected=$(cat expected-output.txt)
                    if [ "$actual" = "$expected" ]; then
                        result="PASS"
                    else
                        result="FAIL (output mismatch)"
                    fi
                elif "$exe_path" >/dev/null 2>&1; then
                    result="PASS"
                else
                    result="FAIL (runtime error)"
                fi
            else
                result="PASS (build only)"
            fi
        else
            result="FAIL (build error)"
        fi

        # Save result to file
        echo "$result" > "$result_file"

        # Print result immediately (with colors)
        if [[ "$result" == PASS* ]]; then
            echo -e "  $fixture_name: \033[0;32m$result\033[0m"
        else
            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
        fi
    }

    # Collect fixture directories for dotnet tests
    DOTNET_FIXTURES=()
    for fixture_dir in "$FIXTURES_DIR"/*/; do
        config_file="$fixture_dir/tsonic.dotnet.json"
        # Skip if no dotnet config
        if [ ! -f "$config_file" ]; then
            continue
        fi
        # Skip negative tests
        meta_file="$fixture_dir/e2e.meta.json"
        if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
            continue
        fi
        DOTNET_FIXTURES+=("$fixture_dir")
    done

    # Run tests in parallel using background jobs
    for fixture_dir in "${DOTNET_FIXTURES[@]}"; do
        # Wait if we have too many background jobs
        while [ $(jobs -r | wc -l) -ge "$TEST_CONCURRENCY" ]; do
            sleep 0.1
        done

        # Run test in background
        (run_dotnet_test "$fixture_dir" "$CLI_PATH" "$RESULTS_DIR") &
    done

    # Wait for all to complete
    wait

    # Count results (for summary)
    for fixture_dir in "${DOTNET_FIXTURES[@]}"; do
        fixture_name=$(basename "$fixture_dir")
        result_file="$RESULTS_DIR/$fixture_name"
        error_file="$RESULTS_DIR/${fixture_name}.error"
        if [ -f "$result_file" ]; then
            result=$(cat "$result_file")
            echo "  $fixture_name: $result" >> "$LOG_FILE"
            # Include error details if build failed
            if [[ "$result" == *"build error"* ]] && [ -f "$error_file" ] && [ -s "$error_file" ]; then
                echo "    --- Error details ---" >> "$LOG_FILE"
                cat "$error_file" >> "$LOG_FILE"
                echo "    --- End error ---" >> "$LOG_FILE"
            fi
            if [[ "$result" == PASS* ]]; then
                E2E_DOTNET_PASSED=$((E2E_DOTNET_PASSED + 1))
            else
                E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
            fi
        else
            echo "  $fixture_name: FAIL (no result)" >> "$LOG_FILE"
            E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
        fi
    done

    echo "" | tee -a "$LOG_FILE"

    # ============================================================
    # 3. Negative Tests (expected failures) - Parallel
    # ============================================================
    echo -e "${BLUE}--- Running Negative Tests (concurrency: $TEST_CONCURRENCY) ---${NC}" | tee -a "$LOG_FILE"

    # Function to run a single negative test (prints result immediately)
    run_negative_test() {
        local fixture_dir="$1"
        local cli_path="$2"
        local results_dir="$3"
        local fixture_name=$(basename "$fixture_dir")
        local result_file="$results_dir/neg_$fixture_name"
        local result=""

        # Find config
        if [ -f "$fixture_dir/tsonic.dotnet.json" ]; then
            config_file="tsonic.dotnet.json"
        elif [ -f "$fixture_dir/tsonic.js.json" ]; then
            config_file="tsonic.js.json"
        else
            result="FAIL (no config)"
            echo "$result" > "$result_file"
            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
            return
        fi

        cd "$fixture_dir"

        if [ -f "package.json" ] && [ "${E2E_NPM_INSTALL:-0}" = "1" ]; then
            npm install --silent --no-package-lock
        fi

        # Build should FAIL
        if node "$cli_path" build src/index.ts --config "$config_file" >/dev/null 2>&1; then
            result="FAIL (expected error but succeeded)"
        else
            result="PASS (failed as expected)"
        fi

        # Save result to file
        echo "$result" > "$result_file"

        # Print result immediately (with colors)
        if [[ "$result" == PASS* ]]; then
            echo -e "  $fixture_name: \033[0;32m$result\033[0m"
        else
            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
        fi
    }

    # Collect negative test fixtures
    NEGATIVE_FIXTURES=()
    for fixture_dir in "$FIXTURES_DIR"/*; do
        meta_file="$fixture_dir/e2e.meta.json"
        if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
            NEGATIVE_FIXTURES+=("$fixture_dir")
        fi
    done

    # Run negative tests in parallel
    if [ ${#NEGATIVE_FIXTURES[@]} -gt 0 ]; then
        # Run all negative tests in parallel with limited concurrency
        for fixture_dir in "${NEGATIVE_FIXTURES[@]}"; do
            while [ $(jobs -r | wc -l) -ge "$TEST_CONCURRENCY" ]; do
                sleep 0.1
            done
            (run_negative_test "$fixture_dir" "$CLI_PATH" "$RESULTS_DIR") &
        done

        # Wait for all to complete
        wait

        # Count results (for summary)
        for fixture_dir in "${NEGATIVE_FIXTURES[@]}"; do
            fixture_name=$(basename "$fixture_dir")
            result_file="$RESULTS_DIR/neg_$fixture_name"
            if [ -f "$result_file" ]; then
                result=$(cat "$result_file")
                echo "  $fixture_name: $result" >> "$LOG_FILE"
                if [[ "$result" == PASS* ]]; then
                    E2E_NEGATIVE_PASSED=$((E2E_NEGATIVE_PASSED + 1))
                else
                    E2E_NEGATIVE_FAILED=$((E2E_NEGATIVE_FAILED + 1))
                fi
            else
                echo "  $fixture_name: FAIL (no result)" >> "$LOG_FILE"
                E2E_NEGATIVE_FAILED=$((E2E_NEGATIVE_FAILED + 1))
            fi
        done
    fi

    echo "" | tee -a "$LOG_FILE"
fi

# ============================================================
# Summary Report
# ============================================================
echo "" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "           TEST SUMMARY REPORT          " | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

TOTAL_PASSED=$((UNIT_PASSED + E2E_DOTNET_PASSED + E2E_NEGATIVE_PASSED))
TOTAL_FAILED=$((UNIT_FAILED + E2E_DOTNET_FAILED + E2E_NEGATIVE_FAILED))

echo "Unit & Golden Tests:" | tee -a "$LOG_FILE"
echo -e "  ${GREEN}Passed: $UNIT_PASSED${NC}" | tee -a "$LOG_FILE"
if [ $UNIT_FAILED -gt 0 ]; then
    echo -e "  ${RED}Failed: $UNIT_FAILED${NC}" | tee -a "$LOG_FILE"
else
    echo "  Failed: 0" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

if [ "$QUICK_MODE" = false ]; then
    echo "E2E Dotnet Tests:" | tee -a "$LOG_FILE"
    echo -e "  ${GREEN}Passed: $E2E_DOTNET_PASSED${NC}" | tee -a "$LOG_FILE"
    if [ $E2E_DOTNET_FAILED -gt 0 ]; then
        echo -e "  ${RED}Failed: $E2E_DOTNET_FAILED${NC}" | tee -a "$LOG_FILE"
    else
        echo "  Failed: 0" | tee -a "$LOG_FILE"
    fi
    echo "" | tee -a "$LOG_FILE"

    echo "Negative Tests:" | tee -a "$LOG_FILE"
    echo -e "  ${GREEN}Passed: $E2E_NEGATIVE_PASSED${NC}" | tee -a "$LOG_FILE"
    if [ $E2E_NEGATIVE_FAILED -gt 0 ]; then
        echo -e "  ${RED}Failed: $E2E_NEGATIVE_FAILED${NC}" | tee -a "$LOG_FILE"
    else
        echo "  Failed: 0" | tee -a "$LOG_FILE"
    fi
    echo "" | tee -a "$LOG_FILE"
fi

echo "========================================" | tee -a "$LOG_FILE"
echo -e "TOTAL: ${GREEN}$TOTAL_PASSED passed${NC}, ${RED}$TOTAL_FAILED failed${NC}" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Completed: $(date)" | tee -a "$LOG_FILE"

if [ $TOTAL_FAILED -gt 0 ]; then
    echo "" | tee -a "$LOG_FILE"
    echo -e "${RED}SOME TESTS FAILED${NC}" | tee -a "$LOG_FILE"
    exit 1
else
    echo "" | tee -a "$LOG_FILE"
    echo -e "${GREEN}ALL TESTS PASSED${NC}" | tee -a "$LOG_FILE"
    exit 0
fi
