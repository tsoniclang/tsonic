#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec bash "$root/test/scripts/bounded-run.sh" host node "$root/test/scripts/build.mjs" "$@"
