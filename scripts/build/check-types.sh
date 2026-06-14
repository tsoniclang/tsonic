#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

CONFIGS=(
  "packages/tsts/tsconfig.json"
  "packages/frontend/tsconfig.json"
  "packages/targets/csharp/emitter/tsconfig.json"
  "packages/targets/csharp/backend/tsconfig.json"
  "packages/cli/tsconfig.json"
)

for config in "${CONFIGS[@]}"; do
  echo "Checking $config with TSTS…"
  if [[ "$config" == "packages/tsts/tsconfig.json" ]]; then
    TSTS_NODE_HEAP_MB=6144 bash scripts/build/tsts-project.sh "$config" --noEmit --pretty false
  else
    bash scripts/build/tsts-project.sh "$config" --noEmit --pretty false
  fi
done
