#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/build/tsts-project.sh <tsconfig-path> [compiler-args...]" >&2
  exit 2
fi

CONFIG_PATH="$1"
shift

if [[ "$CONFIG_PATH" != /* ]]; then
  CONFIG_PATH="$PWD/$CONFIG_PATH"
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI_PATH="$REPO_ROOT/packages/tsts/dist/src/cli/index.js"

if [[ ! -f "$CLI_PATH" ]]; then
  echo "FAIL: vendored TSTS bootstrap CLI is missing: $CLI_PATH" >&2
  echo "Restore packages/tsts/dist from the repository before building." >&2
  exit 1
fi

HEAP_MB="${TSTS_NODE_HEAP_MB:-2048}"

cd "$REPO_ROOT"
exec node "--max-old-space-size=$HEAP_MB" "$CLI_PATH" -p "$CONFIG_PATH" "$@"
