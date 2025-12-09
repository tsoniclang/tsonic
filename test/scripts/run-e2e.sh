#!/bin/bash
# Run E2E tests (dotnet and negative)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Running E2E Tests ==="
echo ""

# Run dotnet tests
echo "--- Running Dotnet Tests ---"
"$SCRIPT_DIR/run-dotnet.sh"
echo ""

# Run negative tests
echo "--- Running Negative Tests ---"
"$SCRIPT_DIR/run-negative.sh"
echo ""

echo "=== E2E Tests Complete ==="
