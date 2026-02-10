#!/bin/bash
# E2E-only runner (fixtures + typecheck). Intended for fast iteration.
#
# Usage: ./test/scripts/run-e2e.sh [--filter <pattern>]
#
# Notes:
# - Skips unit + golden tests. Final verification must run:
#     ./test/scripts/run-all.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/run-all.sh" --no-unit "$@"

