#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 1 ]]; then
  echo "Usage: scripts/build/with-lock.sh <command> [args...]" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${TSONIC_BUILD_LOCK_HELD:-0}" == "1" ]]; then
  exec "$@"
fi

mkdir -p "$REPO_ROOT/.temp/locks"
exec 9>"$REPO_ROOT/.temp/locks/build.lock"
flock 9
export TSONIC_BUILD_LOCK_HELD=1
exec "$@"
