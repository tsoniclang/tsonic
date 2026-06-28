#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

if [[ ! -d "./node_modules" ]]; then
  echo "FAIL: Node dependencies are not installed." >&2
  echo "Run npm install in the repo root." >&2
  exit 1
fi

PACKAGES=(
  "packages/source-core"
  "packages/target-api"
  "packages/host"
  "packages/cli"
)

for pkg in "${PACKAGES[@]}"; do
  if [[ "$pkg" == "packages/cli" && -d "../tsonic-csharp" ]]; then
    if [[ ! -e "../tsonic-csharp/node_modules/@tsonic/tsts" || ! -e "../tsonic-csharp/node_modules/@tsonic/target-api" || ! -e "../tsonic-csharp/node_modules/@tsonic/source-core" ]]; then
      echo "Installing ../tsonic-csharp dependencies..."
      (cd "../tsonic-csharp" && npm install)
    fi
    echo "Building ../tsonic-csharp..."
    (cd "../tsonic-csharp" && npm run build)
  fi
  if node -e "process.exit(require('./$pkg/package.json').scripts?.build ? 0 : 1)"; then
    echo "Building $pkg..."
    (cd "$pkg" && npm run build)
  fi
done
