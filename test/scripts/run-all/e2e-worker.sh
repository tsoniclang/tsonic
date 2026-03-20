#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"

source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/e2e.sh"

MODE="${1:-}"
FIXTURE_DIR="${2:-}"
RESULTS_DIR="${3:-}"

if [ -z "$MODE" ] || [ -z "$FIXTURE_DIR" ] || [ -z "$RESULTS_DIR" ]; then
  echo "usage: e2e-worker.sh <dotnet|negative> <fixture-dir> <results-dir>" >&2
  exit 2
fi

RESUME_MODE="${RESUME_MODE:-false}"
TSONIC_BIN="${TSONIC_BIN:-$ROOT_DIR/packages/cli/dist/index.js}"
E2E_NPM_INSTALL="${E2E_NPM_INSTALL:-0}"

case "$MODE" in
  dotnet)
    run_dotnet_test "$FIXTURE_DIR" "$RESULTS_DIR"
    ;;
  negative)
    run_negative_test "$FIXTURE_DIR" "$RESULTS_DIR"
    ;;
  *)
    echo "unknown mode: $MODE" >&2
    exit 2
    ;;
esac
