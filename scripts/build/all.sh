#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_PATH="$REPO_ROOT/scripts/build/all.sh"

if [[ "${TSONIC_TEST_PREPARED:-0}" == "1" && "${TSONIC_PREPARE_BUILD:-0}" != "1" ]]; then
  echo "FAIL: shared package build attempted while TSONIC_TEST_PREPARED=1." >&2
  echo "Prepared test shards must run against prepared artifacts and must not rebuild shared packages." >&2
  exit 1
fi

if [[ "${TSONIC_BUILD_LOCK_HELD:-0}" != "1" ]]; then
  exec "$REPO_ROOT/scripts/build/with-lock.sh" "$SCRIPT_PATH" "$@"
fi

cd "$REPO_ROOT"

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
  if node -e "process.exit(require('./$pkg/package.json').scripts?.build ? 0 : 1)"; then
    echo "Building $pkg..."
    (cd "$pkg" && npm run build)
  fi
done
