#!/bin/bash
# Unified test runner: unit tests, golden tests, E2E tests, and summary report
#
# Usage: ./test/scripts/run-all.sh [--quick]
#   --quick: Skip E2E tests, only run unit/golden tests

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

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
    # 2. E2E Dotnet Tests
    # ============================================================
    echo -e "${BLUE}--- Running E2E Dotnet Tests ---${NC}" | tee -a "$LOG_FILE"

    FIXTURES_DIR="$SCRIPT_DIR/../fixtures"
    CLI_PATH="$ROOT_DIR/packages/cli/dist/index.js"

    for fixture_dir in "$FIXTURES_DIR"/*/; do
        fixture_name=$(basename "$fixture_dir")
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

        echo -n "  $fixture_name: " | tee -a "$LOG_FILE"

        cd "$fixture_dir"

        # Install dependencies
        if [ -f "package.json" ]; then
            npm install --silent 2>/dev/null || true
        fi

        # Build and run
        if node "$CLI_PATH" build src/index.ts --config tsonic.dotnet.json >/dev/null 2>&1; then
            # Find executable
            exe_path=$(find out -type f -executable 2>/dev/null | head -1 || true)
            if [ -z "$exe_path" ]; then
                exe_path=$(find generated -type f -executable 2>/dev/null | grep -v '\.dll$' | head -1 || true)
            fi

            if [ -n "$exe_path" ] && [ -x "$exe_path" ]; then
                # Check for expected output
                if [ -f "expected-output.txt" ]; then
                    actual=$("$exe_path" 2>&1 || true)
                    expected=$(cat expected-output.txt)
                    if [ "$actual" = "$expected" ]; then
                        echo -e "${GREEN}PASS${NC}" | tee -a "$LOG_FILE"
                        E2E_DOTNET_PASSED=$((E2E_DOTNET_PASSED + 1))
                    else
                        echo -e "${RED}FAIL (output mismatch)${NC}" | tee -a "$LOG_FILE"
                        E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
                    fi
                elif "$exe_path" >/dev/null 2>&1; then
                    echo -e "${GREEN}PASS${NC}" | tee -a "$LOG_FILE"
                    E2E_DOTNET_PASSED=$((E2E_DOTNET_PASSED + 1))
                else
                    echo -e "${RED}FAIL (runtime error)${NC}" | tee -a "$LOG_FILE"
                    E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
                fi
            else
                echo -e "${GREEN}PASS (build only)${NC}" | tee -a "$LOG_FILE"
                E2E_DOTNET_PASSED=$((E2E_DOTNET_PASSED + 1))
            fi
        else
            echo -e "${RED}FAIL (build error)${NC}" | tee -a "$LOG_FILE"
            E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
        fi

        cd "$ROOT_DIR"
    done

    echo "" | tee -a "$LOG_FILE"

    # ============================================================
    # 3. Negative Tests (expected failures)
    # ============================================================
    echo -e "${BLUE}--- Running Negative Tests ---${NC}" | tee -a "$LOG_FILE"

    for fixture_dir in "$FIXTURES_DIR"/*; do
        meta_file="$fixture_dir/e2e.meta.json"

        if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
            fixture_name=$(basename "$fixture_dir")
            echo -n "  $fixture_name: " | tee -a "$LOG_FILE"

            # Find config
            if [ -f "$fixture_dir/tsonic.dotnet.json" ]; then
                config_file="$fixture_dir/tsonic.dotnet.json"
            elif [ -f "$fixture_dir/tsonic.js.json" ]; then
                config_file="$fixture_dir/tsonic.js.json"
            else
                echo -e "${RED}FAIL (no config)${NC}" | tee -a "$LOG_FILE"
                E2E_NEGATIVE_FAILED=$((E2E_NEGATIVE_FAILED + 1))
                continue
            fi

            cd "$fixture_dir"

            if [ -f "package.json" ]; then
                npm install --silent 2>/dev/null || true
            fi

            # Build should FAIL
            if node "$CLI_PATH" build src/index.ts --config "$(basename "$config_file")" >/dev/null 2>&1; then
                echo -e "${RED}FAIL (expected error but succeeded)${NC}" | tee -a "$LOG_FILE"
                E2E_NEGATIVE_FAILED=$((E2E_NEGATIVE_FAILED + 1))
            else
                echo -e "${GREEN}PASS (failed as expected)${NC}" | tee -a "$LOG_FILE"
                E2E_NEGATIVE_PASSED=$((E2E_NEGATIVE_PASSED + 1))
            fi

            cd "$ROOT_DIR"
        fi
    done

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
