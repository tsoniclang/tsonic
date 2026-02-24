#!/usr/bin/env bash
# -------------------------------------------------------------------
# capture-baselines.sh – capture golden-test + API baseline checksums
#
# Stores results in .plan-blue-baselines/ (gitignored).
# Run once on unmodified main, then use verify.sh to compare.
# -------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/../.."

BASELINES_DIR=".plan-blue-baselines"
GOLDEN_DIR="packages/emitter/testcases/common/expected"

mkdir -p "$BASELINES_DIR"

echo "=== Capturing Plan-Blue Baselines ==="

# 1 ▸ Build all packages
echo "Building all packages…"
./scripts/build/all.sh --no-format

# 2 ▸ SHA256 checksums of all golden .cs files
echo "Capturing golden file checksums…"
find "$GOLDEN_DIR" -name '*.cs' -type f | sort | while read -r f; do
  sha256sum "$f"
done > "$BASELINES_DIR/golden-checksums.txt"

GOLDEN_COUNT=$(wc -l < "$BASELINES_DIR/golden-checksums.txt")
echo "  → $GOLDEN_COUNT golden files captured"

# 3 ▸ LOC inventory of all source .ts files (non-test)
echo "Capturing LOC inventory…"
find packages/*/src -name '*.ts' -not -name '*.test.ts' -not -name '*.spec.ts' -type f | sort | while read -r f; do
  lines=$(wc -l < "$f")
  printf "%6d %s\n" "$lines" "$f"
done > "$BASELINES_DIR/loc-inventory.txt"

TOTAL_LOC=$(awk '{s+=$1} END{print s}' "$BASELINES_DIR/loc-inventory.txt")
echo "  → $TOTAL_LOC total LOC across source files"

# 4 ▸ API snapshot: SHA256 of dist/index.d.ts files
echo "Capturing API snapshots…"
find packages/*/dist -name 'index.d.ts' -type f 2>/dev/null | sort | while read -r f; do
  sha256sum "$f"
done > "$BASELINES_DIR/api-snapshots.txt"

# 5 ▸ Git HEAD commit
echo "Capturing git HEAD…"
git rev-parse HEAD > "$BASELINES_DIR/git-head.txt"
echo "  → $(cat "$BASELINES_DIR/git-head.txt")"

echo ""
echo "=== Baselines captured in $BASELINES_DIR/ ==="
echo "  golden-checksums.txt  ($GOLDEN_COUNT files)"
echo "  loc-inventory.txt     ($TOTAL_LOC LOC)"
echo "  api-snapshots.txt"
echo "  git-head.txt"
