#!/bin/bash
# Typecheck all positive E2E fixtures with vanilla `tsc`.
#
# This is a guardrail: all supported Tsonic programs must also typecheck under
# standard TypeScript (no compiler-owned shims).
#
# Notes:
# - Uses `noLib` + `@tsonic/globals` (same baseline environment as Tsonic).
# - Ignores negative fixtures (`e2e.meta.json` with expectFailure=true).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURES_DIR="$ROOT_DIR/test/fixtures"

TSC="$ROOT_DIR/node_modules/.bin/tsc"
if [ ! -x "$TSC" ]; then
  echo "FAIL: tsc not found at $TSC (run npm install in repo root)"
  exit 1
fi

MONOREPO_PARENT="$(cd "$ROOT_DIR/.." && pwd)"

resolve_pkg_root() {
  local dir_name="$1"
  local sibling="$MONOREPO_PARENT/$dir_name"
  if [ -f "$sibling/package.json" ]; then
    echo "$sibling"
    return 0
  fi
  echo ""
  return 1
}

# Prefer sibling checkouts when present (dev workflow), otherwise fall back to
# installed node_modules packages.
GLOBALS_ROOT="$(resolve_pkg_root "globals" || true)"
if [ -n "$GLOBALS_ROOT" ] && [ -f "$GLOBALS_ROOT/index.d.ts" ]; then
  GLOBALS_INDEX="$GLOBALS_ROOT/index.d.ts"
else
  GLOBALS_INDEX="$ROOT_DIR/node_modules/@tsonic/globals/index.d.ts"
fi

if [ ! -f "$GLOBALS_INDEX" ]; then
  echo "FAIL: globals definitions not found (expected $GLOBALS_INDEX)"
  exit 1
fi

# Ensure stale per-fixture node_modules don't shadow resolution.
find "$FIXTURES_DIR" -mindepth 2 -maxdepth 2 -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true

passed=0
failed=0

tmp_dir="$(mktemp -d)"
trap "rm -rf \"$tmp_dir\"" EXIT

echo "=== TypeScript Typecheck (E2E fixtures) ==="

for fixture_dir in "$FIXTURES_DIR"/*/; do
  [ -d "$fixture_dir" ] || continue
  fixture_name="$(basename "$fixture_dir")"

  # Only workspace fixtures (dotnet E2E)
  if [ ! -f "$fixture_dir/tsonic.workspace.json" ]; then
    continue
  fi

  # Skip negative fixtures
  meta_file="$fixture_dir/e2e.meta.json"
  if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
    continue
  fi

  entry="$fixture_dir/packages/$fixture_name/src/index.ts"
  if [ ! -f "$entry" ]; then
    echo "  $fixture_name: SKIP (no packages/<project>/src/index.ts)"
    continue
  fi

  out_file="$tmp_dir/$fixture_name.log"

  # Build a minimal per-fixture tsconfig that:
  # - Uses noLib mode (Tsonic environment)
  # - Includes @tsonic/globals explicitly (no automatic @types/* pickup)
  # - Prefers sibling checkouts for @tsonic/* when present
  tsconfig_file="$tmp_dir/$fixture_name.tsconfig.json"

  cat >"$tsconfig_file" <<EOF
{
  "compilerOptions": {
    "noEmit": true,
    "noLib": true,
    "types": [],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2022",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowJs": false,
    "checkJs": false,
    "noImplicitAny": false,
    "resolveJsonModule": false,
    "verbatimModuleSyntax": false,
    "allowImportingTsExtensions": true,
    "baseUrl": "$ROOT_DIR",
    "paths": {
      "@tsonic/core/*": ["../core/*"],
      "@tsonic/dotnet/*": ["../dotnet/*"],
      "@tsonic/globals": ["../globals/index.d.ts"],
      "@tsonic/js": ["../js/index.d.ts"],
      "@tsonic/js/*": ["../js/*"],
      "@tsonic/nodejs": ["../nodejs/index.d.ts"],
      "@tsonic/nodejs/*": ["../nodejs/*"],
      "@tsonic/aspnetcore/*": ["../aspnetcore/*"],
      "@tsonic/efcore/*": ["../efcore/*"],
      "@tsonic/efcore-sqlite/*": ["../efcore-sqlite/*"],
      "@tsonic/microsoft-extensions/*": ["../microsoft-extensions/*"]
    }
  },
  "files": [
    "$GLOBALS_INDEX",
    "$entry"
  ]
}
EOF

  if "$TSC" -p "$tsconfig_file" >"$out_file" 2>&1; then
    echo "  $fixture_name: PASS"
    passed=$((passed + 1))
  else
    echo "  $fixture_name: FAIL"
    failed=$((failed + 1))
    sed -n '1,200p' "$out_file"
  fi
done

echo ""
echo "Typecheck summary: $passed passed, $failed failed"

if [ "$failed" -gt 0 ]; then
  exit 1
fi
