#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RUNTIME_REPO="$ROOT_DIR/../runtime"
NODEJS_CLR_REPO="$ROOT_DIR/../nodejs-clr"

DEST_DIR="$ROOT_DIR/packages/cli/runtime"
mkdir -p "$DEST_DIR"

RUNTIME_DLL="$RUNTIME_REPO/artifacts/bin/Tsonic.Runtime/Release/net10.0/Tsonic.Runtime.dll"
if [[ ! -f "$RUNTIME_DLL" ]]; then
  echo "ERROR: Missing runtime DLL: $RUNTIME_DLL"
  echo "Build it with:"
  echo "  cd \"$RUNTIME_REPO\" && dotnet build -c Release"
  exit 1
fi

cp "$RUNTIME_DLL" "$DEST_DIR/Tsonic.Runtime.dll"
echo "Copied: packages/cli/runtime/Tsonic.Runtime.dll"

NODEJS_DLL="$NODEJS_CLR_REPO/artifacts/bin/nodejs/Release/net10.0/nodejs.dll"
if [[ -f "$NODEJS_DLL" ]]; then
  cp "$NODEJS_DLL" "$DEST_DIR/nodejs.dll"
  echo "Copied: packages/cli/runtime/nodejs.dll"
fi

