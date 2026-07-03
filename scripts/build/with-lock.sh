#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 1 ]]; then
  echo "Usage: scripts/build/with-lock.sh <command> [args...]" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${TSONIC_TEST_PREPARED:-0}" == "1" && "${TSONIC_PREPARE_BUILD:-0}" != "1" ]]; then
  echo "FAIL: shared package build attempted while TSONIC_TEST_PREPARED=1." >&2
  echo "Prepared test shards must consume existing artifacts and must not rebuild shared packages." >&2
  exit 1
fi

if [[ "${TSONIC_BUILD_LOCK_HELD:-0}" == "1" ]]; then
  exec "$@"
fi

mkdir -p "$REPO_ROOT/.temp/locks"
exec 9>"$REPO_ROOT/.temp/locks/build.lock"
flock 9
export TSONIC_BUILD_LOCK_HELD=1
exec "$@"
