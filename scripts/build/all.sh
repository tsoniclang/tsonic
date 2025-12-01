#!/usr/bin/env bash
# -------------------------------------------------------------------
# build.sh – monorepo-aware build helper for Tsonic
#
# Flags:
#   --clean      Clean build artifacts (dist, node_modules) and install dependencies
#   --install    Force npm install without cleaning
#   --no-format  Skip prettier formatting (faster builds during development)
# -------------------------------------------------------------------
set -euo pipefail

# Change to the project root directory
cd "$(dirname "$0")/../.."

echo "=== Building Tsonic ==="

# Define the build order (dependencies first)
PACKAGES=(
  "runtime"       # Runtime library (no dependencies)
  "frontend"      # TypeScript parser and IR builder
  "emitter"       # C# code generator
  "backend"       # dotnet CLI orchestration
  "cli"           # CLI (depends on all others)
)

# 1 ▸ clean if --clean flag present
if [[ "$*" == *--clean* ]]; then
  ./scripts/build/clean.sh
fi

# 2 ▸ install dependencies if --clean or --install flag present
if [[ "$*" == *--clean* || "$*" == *--install* ]]; then
  npm install
fi

# 3 ▸ build each package that defines a build script, in order
for pkg_name in "${PACKAGES[@]}"; do
  pkg="packages/$pkg_name"
  if [[ ! -f "$pkg/package.json" ]]; then
    continue
  fi
  # Use node to check for build script instead of jq
  if node -e "process.exit(require('./$pkg/package.json').scripts?.build ? 0 : 1)"; then
    echo "Building $pkg…"
    (cd "$pkg" && npm run build)
  else
    echo "No build script for $pkg, skipping"
  fi
done

# 4 ▸ format all code unless --no-format is passed
if [[ "$*" != *--no-format* ]]; then
  echo "Running prettier…"
  ./scripts/build/format.sh
fi

echo "=== Build completed ===="