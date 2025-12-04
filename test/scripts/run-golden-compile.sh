#!/bin/bash
# Compile-only golden check: Verifies that golden .cs outputs actually compile
#
# This catches bugs where the golden text looks correct but produces invalid C#
# (e.g., accessing properties on Union<T1,T2> that don't exist)
#
# Currently uses P0BugsDemo.cs to demonstrate known bugs that need fixing.
# Once fixes are implemented, the _BROKEN methods should be removed or renamed.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GOLDEN_COMPILE_DIR="$SCRIPT_DIR/../golden-compile"

echo "=== Golden Compile Check ==="
echo ""

cd "$GOLDEN_COMPILE_DIR"

# Ensure P0BugsDemo.cs exists
if [ ! -f "P0BugsDemo.cs" ]; then
  echo "ERROR: P0BugsDemo.cs not found in $GOLDEN_COMPILE_DIR"
  exit 1
fi

echo "Checking: P0BugsDemo.cs"
echo ""

echo "Running dotnet restore..."
if ! dotnet restore 2>&1; then
  echo ""
  echo "  FAILED: dotnet restore failed"
  exit 1
fi

echo ""
echo "Running dotnet build..."
if dotnet build --no-restore 2>&1; then
  echo ""
  echo "=== SUCCESS: All golden files compile ==="
  exit 0
else
  echo ""
  echo "=== EXPECTED FAILURE: P0 bugs demonstrated ==="
  echo ""
  echo "The P0BugsDemo.cs file contains _BROKEN methods that intentionally"
  echo "demonstrate the bugs we need to fix:"
  echo ""
  echo "  P0-A: isUser_BROKEN - accesses .kind on Union<User, Admin>"
  echo "  P0-B: handleNotUser_BROKEN - accesses .adminId on Union in THEN branch"
  echo ""
  echo "Once the emitter fixes are implemented, remove the _BROKEN methods"
  echo "and this check should pass."
  exit 1
fi
