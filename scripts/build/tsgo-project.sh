#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/build/tsgo-project.sh <tsconfig-path> [compiler-args...]" >&2
  exit 2
fi

CONFIG_PATH="$1"
shift

if [[ "$CONFIG_PATH" != /* ]]; then
  CONFIG_PATH="$PWD/$CONFIG_PATH"
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TSGO_BIN="$REPO_ROOT/node_modules/.bin/tsgo"

if [[ ! -x "$TSGO_BIN" ]]; then
  echo "FAIL: TS-Go v7 compiler is missing: $TSGO_BIN" >&2
  echo "Run npm install in the repo root." >&2
  exit 1
fi

cd "$REPO_ROOT"
exec "$TSGO_BIN" -p "$CONFIG_PATH" "$@"
