#!/bin/bash
# Legacy full-suite runner: package-by-package unit/golden Mocha execution.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export TSONIC_PARALLEL_UNIT=0
export TEST_CONCURRENCY="${TEST_CONCURRENCY:-4}"

exec "$SCRIPT_DIR/run-all.sh" "$@"
