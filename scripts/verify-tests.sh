#!/bin/bash
# Test verification script
# Runs all tests and verifies zero failures

set -e

echo "=== Running all tests ==="
mkdir -p .tests

# Run tests and capture output
npm test 2>&1 | tee .tests/verify-$(date +%Y%m%d-%H%M%S).log > .tests/latest.log

# Extract pass/fail counts
RESULTS=$(grep -E "passing|failing" .tests/latest.log)

echo ""
echo "=== Test Results ==="
echo "$RESULTS"
echo ""

# Check for any failures
FAILURES=$(echo "$RESULTS" | grep -E "[0-9]+ failing" || true)

if [ -n "$FAILURES" ]; then
    echo "❌ TESTS FAILED"
    echo "$FAILURES"
    echo ""
    echo "See .tests/latest.log for details"
    exit 1
else
    TOTAL=$(echo "$RESULTS" | grep -oE "[0-9]+ passing" | awk '{sum += $1} END {print sum}')
    echo "✅ ALL $TOTAL TESTS PASSED"
    exit 0
fi
