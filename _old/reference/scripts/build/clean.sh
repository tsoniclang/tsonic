#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

find packages -name dist -type d -prune -exec rm -rf {} +
find packages -name '*.tsbuildinfo' -type f -delete
