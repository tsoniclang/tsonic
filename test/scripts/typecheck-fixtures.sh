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

FILTER_PATTERNS=()

CHECKPOINT_ROOT="${TSONIC_TEST_CHECKPOINT_DIR:-}"
RESUME_MODE="${TSONIC_TEST_RESUME:-0}"
TYPECHECK_CACHE_DIR=""
if [ -n "$CHECKPOINT_ROOT" ]; then
  TYPECHECK_CACHE_DIR="$CHECKPOINT_ROOT/typecheck"
  mkdir -p "$TYPECHECK_CACHE_DIR"
fi

print_help() {
  cat <<EOF
Usage: ./test/scripts/typecheck-fixtures.sh [--filter <pattern>]

Options:
  --filter <pattern>   Only typecheck fixtures whose directory name contains <pattern>.
                       Can be repeated, or comma-separated (e.g. --filter linq,efcore).
  -h, --help           Show this help.
EOF
}

while [ $# -gt 0 ]; do
  case "${1:-}" in
    --filter)
      shift
      if [ -z "${1:-}" ]; then
        echo "FAIL: --filter requires a value"
        exit 2
      fi
      FILTER_PATTERNS+=("$1")
      shift
      ;;
    --filter=*)
      FILTER_PATTERNS+=("${1#*=}")
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "FAIL: unknown argument: $1"
      print_help
      exit 2
      ;;
  esac
done

matches_filter() {
  local name="$1"
  if [ ${#FILTER_PATTERNS[@]} -eq 0 ]; then
    return 0
  fi

  local raw
  for raw in "${FILTER_PATTERNS[@]}"; do
    local IFS=','
    local -a parts
    read -ra parts <<<"$raw"
    local pat
    for pat in "${parts[@]}"; do
      [ -n "$pat" ] || continue
      if [[ "$name" == *"$pat"* ]]; then
        return 0
      fi
    done
  done

  return 1
}

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
if [ ${#FILTER_PATTERNS[@]} -gt 0 ]; then
  echo "Filter: ${FILTER_PATTERNS[*]}"
fi

for fixture_dir in "$FIXTURES_DIR"/*/; do
  [ -d "$fixture_dir" ] || continue
  fixture_name="$(basename "$fixture_dir")"

  if ! matches_filter "$fixture_name"; then
    continue
  fi

  # Only workspace fixtures (dotnet E2E)
  if [ ! -f "$fixture_dir/tsonic.workspace.json" ]; then
    continue
  fi

  # Skip negative fixtures
  meta_file="$fixture_dir/e2e.meta.json"
  if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
    continue
  fi

  if [ "$RESUME_MODE" = "1" ] && [ -n "$TYPECHECK_CACHE_DIR" ] && [ -f "$TYPECHECK_CACHE_DIR/$fixture_name.pass" ]; then
    echo "  $fixture_name: SKIP (cached PASS)"
    passed=$((passed + 1))
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
      "@tsonic/core/*": ["../core/versions/10/*"],
      "@tsonic/dotnet/*": ["../dotnet/versions/10/*"],
      "@tsonic/globals": ["../globals/versions/10/index.d.ts"],
      "@tsonic/js": ["../js/versions/10/index.d.ts"],
      "@tsonic/js/*": ["../js/versions/10/*"],
      "@tsonic/nodejs": ["../nodejs/versions/10/index.d.ts"],
      "@tsonic/nodejs/*": ["../nodejs/versions/10/*"],
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
    if [ -n "$TYPECHECK_CACHE_DIR" ]; then
      tmp="$TYPECHECK_CACHE_DIR/$fixture_name.pass.tmp"
      printf "%s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >"$tmp"
      mv "$tmp" "$TYPECHECK_CACHE_DIR/$fixture_name.pass"
      rm -f "$TYPECHECK_CACHE_DIR/$fixture_name.fail" 2>/dev/null || true
    fi
  else
    echo "  $fixture_name: FAIL"
    failed=$((failed + 1))
    sed -n '1,200p' "$out_file"
    if [ -n "$TYPECHECK_CACHE_DIR" ]; then
      tmp="$TYPECHECK_CACHE_DIR/$fixture_name.fail.tmp"
      printf "%s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >"$tmp"
      mv "$tmp" "$TYPECHECK_CACHE_DIR/$fixture_name.fail"
      rm -f "$TYPECHECK_CACHE_DIR/$fixture_name.pass" 2>/dev/null || true
    fi
  fi
done

echo ""
echo "Typecheck summary: $passed passed, $failed failed"

if [ "$failed" -gt 0 ]; then
  exit 1
fi
