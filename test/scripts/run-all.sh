#!/bin/bash
# Run all tests: unit tests, golden tests, and E2E tests

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Running All Tests ==="
echo ""

# Run unit and golden tests
echo "--- Running Unit & Golden Tests (npm test) ---"
cd "$ROOT_DIR"
npm test
echo ""

# Run E2E tests
"$SCRIPT_DIR/run-e2e.sh"

echo "=== All Tests Complete ==="
