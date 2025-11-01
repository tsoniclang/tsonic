#!/usr/bin/env bash
# -------------------------------------------------------------------
# lint-all.sh – Run ESLint across all packages
# -------------------------------------------------------------------
set -euo pipefail

# Change to the project root directory
cd "$(dirname "$0")/.."

echo "=== Running ESLint across all packages ==="

# Define packages to lint
PACKAGES=(
  "runtime"
  "frontend"
  "emitter"
  "backend"
  "cli"
)

# Check for --fix flag
FIX_FLAG=""
if [[ "${1:-}" == "--fix" ]]; then
  FIX_FLAG="--fix"
  echo "Running ESLint with auto-fix..."
else
  echo "Running ESLint (no auto-fix)..."
fi

# First ensure eslint is available
if [[ ! -f "./node_modules/.bin/eslint" ]]; then
  echo "ESLint not found. Please run: npm install"
  exit 1
fi

# Run eslint on all packages
ERRORS=0

for pkg_name in "${PACKAGES[@]}"; do
  pkg="packages/$pkg_name"

  # Skip if package doesn't exist yet
  if [[ ! -d "$pkg" ]]; then
    continue
  fi

  # Check if src directory exists
  if [[ ! -d "$pkg/src" ]]; then
    echo "Skipping $pkg (no src directory)"
    continue
  fi

  echo "Linting $pkg..."

  if [ -n "$FIX_FLAG" ]; then
    ./node_modules/.bin/eslint "$pkg/src/**/*.ts" "$pkg/src/**/*.tsx" $FIX_FLAG --config eslint.config.js || ERRORS=$?
  else
    ./node_modules/.bin/eslint "$pkg/src/**/*.ts" "$pkg/src/**/*.tsx" --config eslint.config.js || ERRORS=$?
  fi
done

if [ $ERRORS -ne 0 ]; then
  echo "=== ESLint found errors ==="
  exit $ERRORS
fi

echo "=== ESLint completed successfully ===="