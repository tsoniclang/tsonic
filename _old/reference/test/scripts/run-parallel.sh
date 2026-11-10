#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
exec bash test/scripts/bounded-run.sh host node test/scripts/run-parallel.mjs "$@"
