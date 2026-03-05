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

  surface_mode="$(
    node -e '
      const fs = require("node:fs");
      const p = process.argv[1];
      try {
        const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
        process.stdout.write(String(cfg.surface ?? "clr"));
      } catch {
        process.stdout.write("clr");
      }
    ' "$fixture_dir/tsonic.workspace.json"
  )"

  no_lib_value="true"
  js_surface_globals_shim=""
  js_surface_shim=""
  if [ "$surface_mode" = "js" ] || [ "$surface_mode" = "nodejs" ]; then
    js_surface_globals_shim="$tmp_dir/$fixture_name.js-surface-globals.d.ts"
    cat >"$js_surface_globals_shim" <<EOF
import type { int, long, double } from "@tsonic/core/types.js";
import type { List } from "@tsonic/dotnet/System.Collections.Generic.js";

declare global {
  interface String {
    readonly length: int;
    trim(): string;
    toUpperCase(): string;
    toLowerCase(): string;
    indexOf(searchString: string, position?: int): int;
    split(separator: string, limit?: int): List<string>;
    includes(searchString: string, position?: int): boolean;
    startsWith(searchString: string, position?: int): boolean;
    endsWith(searchString: string, endPosition?: int): boolean;
    slice(start?: int, end?: int): string;
    substring(start: int, end?: int): string;
    replace(searchValue: string, replaceValue: string): string;
    charAt(index: int): string;
    charCodeAt(index: int): int;
  }
  interface Array<T> {
    readonly length: int;
    at(index: int): T;
    concat(...items: T[]): T[];
    every(callback: (value: T) => boolean): boolean;
    filter(callback: (value: T) => boolean): T[];
    filter(callback: (value: T, index: int) => boolean): T[];
    find(callback: (value: T) => boolean): T | undefined;
    find(callback: (value: T, index: int) => boolean): T | undefined;
    findIndex(callback: (value: T) => boolean): int;
    findIndex(callback: (value: T, index: int) => boolean): int;
    findLast(callback: (value: T) => boolean): T | undefined;
    findLast(callback: (value: T, index: int) => boolean): T | undefined;
    findLastIndex(callback: (value: T) => boolean): int;
    findLastIndex(callback: (value: T, index: int) => boolean): int;
    flat(depth?: int): unknown[];
    forEach(callback: (value: T) => void): void;
    forEach(callback: (value: T, index: int) => void): void;
    includes(searchElement: T): boolean;
    includes(searchElement: T, fromIndex?: int): boolean;
    indexOf(searchElement: T, fromIndex?: int): int;
    join(separator?: string): string;
    lastIndexOf(searchElement: T, fromIndex?: int): int;
    map<TResult>(callback: (value: T) => TResult): TResult[];
    map<TResult>(callback: (value: T, index: int) => TResult): TResult[];
    reduce(callback: (previousValue: T, currentValue: T) => T): T;
    reduce<TResult>(callback: (previousValue: TResult, currentValue: T) => TResult, initialValue: TResult): TResult;
    reduceRight<TResult>(callback: (previousValue: TResult, currentValue: T) => TResult, initialValue: TResult): TResult;
    slice(start?: int, end?: int): T[];
    some(callback: (value: T) => boolean): boolean;
  }
  interface ReadonlyArray<T> {
    readonly length: int;
    at(index: int): T;
    concat(...items: T[]): T[];
    every(callback: (value: T) => boolean): boolean;
    filter(callback: (value: T) => boolean): T[];
    filter(callback: (value: T, index: int) => boolean): T[];
    find(callback: (value: T) => boolean): T | undefined;
    find(callback: (value: T, index: int) => boolean): T | undefined;
    findIndex(callback: (value: T) => boolean): int;
    findIndex(callback: (value: T, index: int) => boolean): int;
    findLast(callback: (value: T) => boolean): T | undefined;
    findLast(callback: (value: T, index: int) => boolean): T | undefined;
    findLastIndex(callback: (value: T) => boolean): int;
    findLastIndex(callback: (value: T, index: int) => boolean): int;
    flat(depth?: int): unknown[];
    forEach(callback: (value: T) => void): void;
    forEach(callback: (value: T, index: int) => void): void;
    includes(searchElement: T): boolean;
    includes(searchElement: T, fromIndex?: int): boolean;
    indexOf(searchElement: T, fromIndex?: int): int;
    join(separator?: string): string;
    lastIndexOf(searchElement: T, fromIndex?: int): int;
    map<TResult>(callback: (value: T) => TResult): TResult[];
    map<TResult>(callback: (value: T, index: int) => TResult): TResult[];
    reduce(callback: (previousValue: T, currentValue: T) => T): T;
    reduce<TResult>(callback: (previousValue: TResult, currentValue: T) => TResult, initialValue: TResult): TResult;
    reduceRight<TResult>(callback: (previousValue: TResult, currentValue: T) => TResult, initialValue: TResult): TResult;
    slice(start?: int, end?: int): T[];
    some(callback: (value: T) => boolean): boolean;
  }
  interface Console {
    log(...data: unknown[]): void;
    error(...data: unknown[]): void;
    warn(...data: unknown[]): void;
    info(...data: unknown[]): void;
    debug(...data: unknown[]): void;
  }
  const console: Console;
  interface Date {
    toISOString(): string;
    getTime(): long;
  }
  interface DateConstructor {
    new (): Date;
    new (value: string | number | long): Date;
    now(): long;
    parse(s: string): long;
  }
  const Date: DateConstructor;
  interface JSON {
    parse<T = unknown>(text: string): T;
    stringify(value: unknown, replacer?: unknown, space?: string | number | int): string;
  }
  const JSON: JSON;
  interface Math {
    round(x: double): double;
    max(...values: double[]): double;
    min(...values: double[]): double;
    random(): double;
  }
  const Math: Math;
  interface RegExpMatchArray extends Array<string> {
    index?: int;
    input?: string;
  }
  interface RegExp {
    exec(string: string): RegExpMatchArray | null;
    test(string: string): boolean;
  }
  interface RegExpConstructor {
    new (pattern: string | RegExp, flags?: string): RegExp;
    (pattern: string | RegExp, flags?: string): RegExp;
  }
  const RegExp: RegExpConstructor;
  interface Map<K, V> {
    readonly size: int;
    clear(): void;
    delete(key: K): boolean;
    get(key: K): V | undefined;
    has(key: K): boolean;
    set(key: K, value: V): this;
  }
  interface MapConstructor {
    new <K, V>(entries?: readonly (readonly [K, V])[] | null): Map<K, V>;
  }
  const Map: MapConstructor;
  interface Set<T> {
    readonly size: int;
    add(value: T): this;
    clear(): void;
    delete(value: T): boolean;
    has(value: T): boolean;
  }
  interface SetConstructor {
    new <T = unknown>(values?: readonly T[] | null): Set<T>;
  }
  const Set: SetConstructor;
  function parseInt(str: string, radix?: int): long | undefined;
  function parseFloat(str: string): double;
  function isFinite(value: double): boolean;
  function isNaN(value: double): boolean;
  function setTimeout(handler: (...args: unknown[]) => void, timeout?: int, ...args: unknown[]): int;
  function clearTimeout(id: int): void;
  function setInterval(handler: (...args: unknown[]) => void, timeout?: int, ...args: unknown[]): int;
  function clearInterval(id: int): void;
}

export {};
EOF
  fi
  if [ "$surface_mode" = "nodejs" ]; then
    js_surface_shim="$tmp_dir/$fixture_name.js-surface-shim.d.ts"
    cat >"$js_surface_shim" <<EOF
declare module "node:assert" { export { assert } from "@tsonic/nodejs/index.js"; }
declare module "assert" { export { assert } from "@tsonic/nodejs/index.js"; }
declare module "node:buffer" { export { buffer } from "@tsonic/nodejs/index.js"; }
declare module "buffer" { export { buffer } from "@tsonic/nodejs/index.js"; }
declare module "node:child_process" { export { child_process } from "@tsonic/nodejs/index.js"; }
declare module "child_process" { export { child_process } from "@tsonic/nodejs/index.js"; }
declare module "node:fs" {
  export { fs } from "@tsonic/nodejs/index.js";
  export const existsSync: typeof import("@tsonic/nodejs/index.js").fs.existsSync;
  export const readFileSync: typeof import("@tsonic/nodejs/index.js").fs.readFileSync;
  export const mkdirSync: typeof import("@tsonic/nodejs/index.js").fs.mkdirSync;
}
declare module "fs" { export { fs } from "@tsonic/nodejs/index.js"; }
declare module "node:path" {
  export { path } from "@tsonic/nodejs/index.js";
  export const join: typeof import("@tsonic/nodejs/index.js").path.join;
  export const extname: typeof import("@tsonic/nodejs/index.js").path.extname;
  export const basename: typeof import("@tsonic/nodejs/index.js").path.basename;
  export const dirname: typeof import("@tsonic/nodejs/index.js").path.dirname;
  export const parse: typeof import("@tsonic/nodejs/index.js").path.parse;
  export const resolve: typeof import("@tsonic/nodejs/index.js").path.resolve;
}
declare module "path" { export { path } from "@tsonic/nodejs/index.js"; }
declare module "node:crypto" {
  export { crypto } from "@tsonic/nodejs/index.js";
  export const randomUUID: typeof import("@tsonic/nodejs/index.js").crypto.randomUUID;
}
declare module "crypto" { export { crypto } from "@tsonic/nodejs/index.js"; }
declare module "node:dgram" { export { dgram } from "@tsonic/nodejs/index.js"; }
declare module "dgram" { export { dgram } from "@tsonic/nodejs/index.js"; }
declare module "node:dns" { export { dns } from "@tsonic/nodejs/index.js"; }
declare module "dns" { export { dns } from "@tsonic/nodejs/index.js"; }
declare module "node:events" { export { events } from "@tsonic/nodejs/index.js"; }
declare module "events" { export { events } from "@tsonic/nodejs/index.js"; }
declare module "node:net" { export { net } from "@tsonic/nodejs/index.js"; }
declare module "net" { export { net } from "@tsonic/nodejs/index.js"; }
declare module "node:os" {
  export { os } from "@tsonic/nodejs/index.js";
  export const homedir: typeof import("@tsonic/nodejs/index.js").os.homedir;
  export const tmpdir: typeof import("@tsonic/nodejs/index.js").os.tmpdir;
}
declare module "os" { export { os } from "@tsonic/nodejs/index.js"; }
declare module "node:process" {
  export { process } from "@tsonic/nodejs/index.js";
  export const cwd: typeof import("@tsonic/nodejs/index.js").process.cwd;
}
declare module "process" { export { process } from "@tsonic/nodejs/index.js"; }
declare module "node:querystring" { export { querystring } from "@tsonic/nodejs/index.js"; }
declare module "querystring" { export { querystring } from "@tsonic/nodejs/index.js"; }
declare module "node:readline" { export { readline } from "@tsonic/nodejs/index.js"; }
declare module "readline" { export { readline } from "@tsonic/nodejs/index.js"; }
declare module "node:stream" { export { stream } from "@tsonic/nodejs/index.js"; }
declare module "stream" { export { stream } from "@tsonic/nodejs/index.js"; }
declare module "node:timers" { export { timers } from "@tsonic/nodejs/index.js"; }
declare module "timers" { export { timers } from "@tsonic/nodejs/index.js"; }
declare module "node:tls" { export { tls } from "@tsonic/nodejs/index.js"; }
declare module "tls" { export { tls } from "@tsonic/nodejs/index.js"; }
declare module "node:url" { export { url } from "@tsonic/nodejs/index.js"; }
declare module "url" { export { url } from "@tsonic/nodejs/index.js"; }
declare module "node:util" { export { util } from "@tsonic/nodejs/index.js"; }
declare module "util" { export { util } from "@tsonic/nodejs/index.js"; }
declare module "node:zlib" { export { zlib } from "@tsonic/nodejs/index.js"; }
declare module "zlib" { export { zlib } from "@tsonic/nodejs/index.js"; }
EOF
  fi

  # Build a minimal per-fixture tsconfig that:
  # - Uses noLib mode (Tsonic environment)
  # - Includes @tsonic/globals explicitly (no automatic @types/* pickup)
  # - Prefers sibling checkouts for @tsonic/* when present
  tsconfig_file="$tmp_dir/$fixture_name.tsconfig.json"

  cat >"$tsconfig_file" <<EOF
{
  "compilerOptions": {
    "noEmit": true,
    "noLib": $no_lib_value,
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
    "$entry"$(
      if [ -n "$js_surface_globals_shim" ]; then
        printf ',\n    "%s"' "$js_surface_globals_shim"
      fi
    )$(
      if [ -n "$js_surface_shim" ]; then
        printf ',\n    "%s"' "$js_surface_shim"
      fi
    )
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
