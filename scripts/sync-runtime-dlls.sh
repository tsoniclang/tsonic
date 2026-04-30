#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RUNTIME_REPO="$ROOT_DIR/../runtime"

DEST_DIR="$ROOT_DIR/packages/cli/runtime"
mkdir -p "$DEST_DIR"

RUNTIME_DLL="$RUNTIME_REPO/artifacts/bin/Tsonic.Runtime/Release/net10.0/Tsonic.Runtime.dll"
if [[ ! -f "$RUNTIME_DLL" ]]; then
  if [[ ! -d "$RUNTIME_REPO" ]]; then
    echo "ERROR: Missing sibling runtime repo: $RUNTIME_REPO"
    echo "Check out tsoniclang/runtime next to this repo."
    exit 1
  fi

  echo "Runtime DLL missing; building sibling runtime:"
  echo "  $RUNTIME_REPO"
  dotnet build "$RUNTIME_REPO/Tsonic.Runtime.sln" -c Release
fi

cp "$RUNTIME_DLL" "$DEST_DIR/Tsonic.Runtime.dll"
echo "Copied: packages/cli/runtime/Tsonic.Runtime.dll"
