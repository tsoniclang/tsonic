#!/bin/bash
# scripts/verify-invariants.sh
#
# Verifies Alice's compiler-grade invariants for TypeSystem as single type authority.
# Run this script to ensure no regressions in the type system architecture.
#
# Invariants enforced:
# - INV-0: No TS computed type APIs outside Binding
# - INV-1: No getHandleRegistry/convertType outside TypeSystem
# - INV-2: (Enforced by TypeRegistry pure IR - not checked here)
# - INV-3: (Enforced by TypeSystem diagnostics - not checked here)

set -e

FRONTEND_SRC="packages/frontend/src"
ERRORS=0

echo "=== TypeSystem Invariant Verification ==="
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# INV-0: No banned TS APIs outside Binding
# ─────────────────────────────────────────────────────────────────────────────

echo "Checking INV-0: No banned TS APIs outside Binding..."

# Note: We look for actual API calls (with parentheses or dot), not just mentions in comments
# Exceptions: binding/index.ts (allowed), test files, test-harness.ts (test infrastructure)
BANNED_VIOLATIONS=$(grep -rE "\.(getTypeAtLocation|getTypeOfSymbolAtLocation|getContextualType|typeToTypeNode)\(" "$FRONTEND_SRC" --include="*.ts" \
  | grep -v "binding/index.ts" \
  | grep -v "\.test\.ts" \
  | grep -v "test-harness\.ts" \
  | grep -v "// INV-0 exception:" \
  || true)

if [ -n "$BANNED_VIOLATIONS" ]; then
  echo "FAIL: Banned TS APIs used outside Binding:"
  echo "$BANNED_VIOLATIONS"
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS: No banned TS APIs outside Binding"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# INV-1a: No getHandleRegistry outside TypeSystem
# ─────────────────────────────────────────────────────────────────────────────

echo "Checking INV-1a: No getHandleRegistry outside TypeSystem..."

REGISTRY_VIOLATIONS=$(grep -r "getHandleRegistry" "$FRONTEND_SRC" --include="*.ts" \
  | grep -v "type-system" \
  | grep -v "_getHandleRegistry" \
  | grep -v "binding/index.ts" \
  | grep -v "\.test\.ts" \
  | grep -v "// INV-1 exception:" \
  || true)

if [ -n "$REGISTRY_VIOLATIONS" ]; then
  echo "FAIL: getHandleRegistry used outside TypeSystem:"
  echo "$REGISTRY_VIOLATIONS"
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS: No getHandleRegistry outside TypeSystem"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# INV-1b: No convertType outside TypeSystem/type-converter
# ─────────────────────────────────────────────────────────────────────────────

echo "Checking INV-1b: No convertType outside TypeSystem..."

CONVERT_VIOLATIONS=$(grep -r "convertType(" "$FRONTEND_SRC" --include="*.ts" \
  | grep -v "type-system" \
  | grep -v "type-converter" \
  | grep -v "\.test\.ts" \
  | grep -v "// INV-1 exception:" \
  || true)

if [ -n "$CONVERT_VIOLATIONS" ]; then
  echo "FAIL: convertType used outside TypeSystem/type-converter:"
  echo "$CONVERT_VIOLATIONS"
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS: No convertType outside TypeSystem/type-converter"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# INV-1c: No unsafe ts.TypeNode casts outside TypeSystem
# ─────────────────────────────────────────────────────────────────────────────

echo "Checking INV-1c: No 'as ts.TypeNode' casts outside TypeSystem..."

CAST_VIOLATIONS=$(grep -r "as ts\.TypeNode" "$FRONTEND_SRC" --include="*.ts" \
  | grep -v "type-system" \
  | grep -v "type-converter" \
  | grep -v "binding/index.ts" \
  | grep -v "\.test\.ts" \
  | grep -v "// INV-1 exception:" \
  || true)

if [ -n "$CAST_VIOLATIONS" ]; then
  echo "FAIL: 'as ts.TypeNode' casts outside TypeSystem:"
  echo "$CAST_VIOLATIONS"
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS: No 'as ts.TypeNode' casts outside TypeSystem"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# WARN: Deprecated singleton accessor usage (tracking for Step 7 migration)
# ─────────────────────────────────────────────────────────────────────────────

echo "Checking deprecated singleton accessors (getTypeRegistry/getNominalEnv)..."

# Count usages outside registry.ts (where they're defined)
SINGLETON_USAGES=$(grep -rE "(getTypeRegistry|getNominalEnv)\(" "$FRONTEND_SRC" --include="*.ts" \
  | grep -v "registry.ts" \
  | grep -v "_internalGet" \
  | grep -v "\.test\.ts" \
  || true)

if [ -n "$SINGLETON_USAGES" ]; then
  COUNT=$(echo "$SINGLETON_USAGES" | wc -l)
  echo "  WARN: $COUNT deprecated singleton accessor(s) still in use (to be migrated in Step 7):"
  echo "$SINGLETON_USAGES" | head -10
  if [ "$COUNT" -gt 10 ]; then
    echo "  ... and $((COUNT - 10)) more"
  fi
else
  echo "  PASS: No deprecated singleton accessors in use"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

echo "=== Summary ==="
if [ $ERRORS -eq 0 ]; then
  echo "All invariants verified successfully!"
  exit 0
else
  echo "FAILED: $ERRORS invariant violation(s) found"
  exit 1
fi
