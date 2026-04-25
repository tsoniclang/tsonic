#!/usr/bin/env bash
# Remove generated E2E fixture artifacts while preserving fixture source inputs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURES_DIR="$ROOT_DIR/test/fixtures"

if [ ! -d "$FIXTURES_DIR" ]; then
  echo "FAIL: fixture directory not found: $FIXTURES_DIR" >&2
  exit 1
fi

clean_fixture() {
  local fixture_dir="$1"
  local abs_fixture_dir
  abs_fixture_dir="$(cd "$fixture_dir" && pwd -P)"

  if [ "$(basename "$(dirname "$abs_fixture_dir")")" != "fixtures" ]; then
    echo "FAIL: refusing to clean outside test/fixtures: $abs_fixture_dir" >&2
    return 1
  fi

  rm -rf \
    "$abs_fixture_dir/.tsonic" \
    "$abs_fixture_dir/generated" \
    "$abs_fixture_dir/out" \
    "$abs_fixture_dir/dist" \
    "$abs_fixture_dir/node_modules"

  if [ -d "$abs_fixture_dir/packages" ]; then
    find "$abs_fixture_dir/packages" -mindepth 2 -maxdepth 2 \
      \( -name generated -o -name out -o -name dist \) \
      -type d -prune -exec rm -rf {} +
  fi
}

count=0
for fixture_dir in "$FIXTURES_DIR"/*; do
  [ -d "$fixture_dir" ] || continue
  clean_fixture "$fixture_dir"
  count=$((count + 1))
done

echo "Cleaned generated artifacts for $count fixture directories."
