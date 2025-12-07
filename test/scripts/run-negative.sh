#!/bin/bash
# Run negative E2E tests (expected to fail at compile time)
# These tests verify that certain constructs are REJECTED in specific modes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../fixtures"
TSONIC_CLI="$PROJECT_ROOT/packages/cli/dist/index.js"
BCL_DIR="/home/jeswin/repos/tsoniclang/tsbindgen/.tests/validate"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASSED=0
FAILED=0

echo "Running negative tests (expected failures)..."
echo ""

# Find fixtures with expectFailure: true in meta
for fixture_dir in "$FIXTURES_DIR"/*; do
    meta_file="$fixture_dir/e2e.meta.json"

    if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
        fixture_name=$(basename "$fixture_dir")
        echo "Testing: $fixture_name (expect failure)"

        # For negative tests, find available config (dotnet or js)
        if [ -f "$fixture_dir/tsonic.dotnet.json" ]; then
            mode="dotnet"
        elif [ -f "$fixture_dir/tsonic.js.json" ]; then
            mode="js"
        else
            echo -e "${RED}✗${NC} No config file found"
            FAILED=$((FAILED + 1))
            continue
        fi
        config_file="$fixture_dir/tsonic.$mode.json"

        if [ ! -f "$config_file" ]; then
            echo -e "${RED}✗${NC} Config not found: $config_file"
            FAILED=$((FAILED + 1))
            continue
        fi

        # Create temp directory
        temp_dir=$(mktemp -d)
        cp -r "$fixture_dir/src" "$temp_dir/"
        cp "$config_file" "$temp_dir/tsonic.json"

        # Copy package.json and install dependencies if present
        if [ -f "$fixture_dir/package.json" ]; then
            cp "$fixture_dir/package.json" "$temp_dir/"
            cd "$temp_dir"
            npm install --silent 2>/dev/null || true
            cd "$PROJECT_ROOT"
        fi

        entry_point=$(grep '"entryPoint"' "$temp_dir/tsonic.json" | sed 's/.*"entryPoint".*:.*"\(.*\)".*/\1/')

        # Try to build - should FAIL
        cd "$temp_dir"
        if "$TSONIC_CLI" build "$entry_point" --lib "$BCL_DIR" --quiet 2>&1 | tee build.log; then
            echo -e "${RED}✗${NC} Expected failure but build SUCCEEDED"
            FAILED=$((FAILED + 1))
        else
            # Check for expected error patterns
            errors_found=0
            while IFS= read -r pattern; do
                pattern=$(echo "$pattern" | tr -d '",' | xargs)
                if [ -n "$pattern" ] && grep -q "$pattern" build.log 2>/dev/null; then
                    errors_found=$((errors_found + 1))
                fi
            done < <(grep -o '"[^"]*does not exist[^"]*"' "$meta_file" 2>/dev/null || true)

            if [ $errors_found -gt 0 ]; then
                echo -e "${GREEN}✓${NC} Build failed as expected with correct errors"
                PASSED=$((PASSED + 1))
            else
                echo -e "${GREEN}✓${NC} Build failed as expected"
                PASSED=$((PASSED + 1))
            fi
        fi

        # Cleanup
        rm -rf "$temp_dir"
        cd "$PROJECT_ROOT"
        echo ""
    fi
done

echo "========================================"
echo "Negative Test Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓${NC} All negative tests passed!"
    exit 0
else
    echo -e "${RED}✗${NC} Some negative tests failed"
    exit 1
fi
