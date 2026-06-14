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

# Define the build order (dependencies first).
PACKAGES=(
  "packages/tsts"                     # Vendored TSTS compiler substrate
  "packages/frontend"                 # TypeScript parser and IR builder
  "packages/targets/csharp/emitter"   # C# code generator
  "packages/targets/csharp/backend"   # dotnet CLI orchestration
  "packages/cli"                      # CLI (depends on all others)
)

# 1 ▸ clean if --clean flag present
if [[ "$*" == *--clean* ]]; then
  ./scripts/build/clean.sh
fi

# 2 ▸ install dependencies if --clean or --install flag present
if [[ "$*" == *--clean* || "$*" == *--install* ]]; then
  npm install
elif [[ ! -d "./node_modules" ]]; then
  echo "FAIL: Node dependencies are not installed."
  echo "Run npm ci in the repo root, or run ./scripts/build/all.sh --install."
  exit 1
fi

# 3 ▸ build each package that defines a build script, in order
for pkg in "${PACKAGES[@]}"; do
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
