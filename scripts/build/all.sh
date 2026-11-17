#!/usr/bin/env bash
set -euo pipefail
repository="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository"
node node_modules/@typescript/native-preview/bin/tsgo.js --project packages/host/tsconfig.json --pretty false
printf '%s\n' 'Host modules: strict build passed; current JavaScript and declarations emitted.'
