#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$ROOT"

require_tool() {
  local tool="$1"
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "FAIL: required tool '$tool' is not installed or not on PATH." >&2
    exit 1
  fi
}

require_tool git
require_tool node
require_tool npm
require_tool dotnet

echo "== Toolchain =="
echo "git:    $(git --version)"
echo "node:   $(node --version)"
echo "npm:    $(npm --version)"
echo "dotnet: $(dotnet --version)"

echo "== Installing dependencies =="
npm ci

echo "== Building =="
npm run build

echo "== Setup complete =="
