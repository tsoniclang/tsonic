#!/usr/bin/env bash
set -euo pipefail
script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
snapshot="$(node "$script_root/guard-snapshot.mjs")"
export TSONIC_TEST_GUARD_SNAPSHOT="$snapshot"
exec bash "$snapshot/bounded-test-scope.sh" "$@"
