#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/build/tsgo-project.sh <tsconfig-path> [compiler-args...]" >&2
  exit 2
fi

CONFIG_PATH="$1"
shift

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_PATH="$REPO_ROOT/scripts/build/tsgo-project.sh"

if [[ "${TSONIC_BUILD_LOCK_HELD:-0}" != "1" ]]; then
  exec "$REPO_ROOT/scripts/build/with-lock.sh" "$SCRIPT_PATH" "$CONFIG_PATH" "$@"
fi

if [[ "$CONFIG_PATH" != /* ]]; then
  CONFIG_PATH="$PWD/$CONFIG_PATH"
fi

TSGO_BIN="$REPO_ROOT/node_modules/.bin/tsgo"
CONFIG_DIR="$(dirname "$CONFIG_PATH")"

if [[ ! -x "$TSGO_BIN" ]]; then
  echo "FAIL: TS-Go v7 compiler is missing: $TSGO_BIN" >&2
  echo "Run npm install in the repo root." >&2
  exit 1
fi

rm -rf "$CONFIG_DIR/dist"
find "$CONFIG_DIR" -maxdepth 1 -name '*.tsbuildinfo' -type f -delete

cd "$REPO_ROOT"
exec "$TSGO_BIN" -p "$CONFIG_PATH" "$@"
