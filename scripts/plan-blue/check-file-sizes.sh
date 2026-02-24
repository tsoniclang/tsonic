#!/usr/bin/env bash
# -------------------------------------------------------------------
# check-file-sizes.sh – enforce LOC limits on source files
#
# Soft limit: 800 LOC (warning)
# Hard limit: 1000 LOC (error)
# -------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/../.."

SOFT_LIMIT=800
HARD_LIMIT=1000
WARNINGS=0
ERRORS=0

echo "=== File Size Check (soft: ${SOFT_LIMIT}, hard: ${HARD_LIMIT}) ==="

while IFS= read -r f; do
  lines=$(wc -l < "$f")
  if [[ $lines -gt $HARD_LIMIT ]]; then
    echo "ERROR: $f ($lines LOC > $HARD_LIMIT hard limit)"
    ERRORS=$((ERRORS + 1))
  elif [[ $lines -gt $SOFT_LIMIT ]]; then
    echo "WARN:  $f ($lines LOC > $SOFT_LIMIT soft limit)"
    WARNINGS=$((WARNINGS + 1))
  fi
done < <(find packages/*/src -name '*.ts' -not -name '*.test.ts' -not -name '*.spec.ts' -type f | sort)

echo ""
echo "=== Summary ==="
echo "Hard violations (>$HARD_LIMIT LOC): $ERRORS"
echo "Soft violations (>$SOFT_LIMIT LOC): $WARNINGS"

if [[ $ERRORS -gt 0 ]]; then
  exit 1
fi
