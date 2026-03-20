#!/bin/bash
# Typecheck all positive E2E fixtures with vanilla `tsc`.
#
# This is a guardrail: all supported Tsonic programs must also typecheck under
# standard TypeScript (no compiler-owned shims).
#
# Notes:
# - Uses `noLib` + the exact surface package root that the fixture declares.
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

ensure_typecheck_cache_dir() {
  if [ -n "$TYPECHECK_CACHE_DIR" ]; then
    mkdir -p "$TYPECHECK_CACHE_DIR"
  fi
}

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
resolve_surface_package_root() {
  local package_name="$1"
  local repo_hint=""

  case "$package_name" in
    @tsonic/*)
      repo_hint="${package_name#@tsonic/}"
      ;;
  esac

  if [ -n "$repo_hint" ]; then
    local sibling_root
    sibling_root="$(resolve_pkg_root "$repo_hint" || true)"
    if [ -n "$sibling_root" ] && [ -f "$sibling_root/versions/10/package.json" ]; then
      echo "$sibling_root/versions/10"
      return 0
    fi
  fi

  local installed_root="$ROOT_DIR/node_modules/$package_name"
  if [ -f "$installed_root/package.json" ]; then
    echo "$installed_root"
    return 0
  fi

  echo ""
  return 1
}

resolve_declaration_entry_files() {
  local candidate="$1"

  if [ -f "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  if [ ! -d "$candidate" ]; then
    return 0
  fi

  if [ -f "$candidate/index.d.ts" ]; then
    printf '%s\n' "$candidate/index.d.ts"
    return 0
  fi

  if [ -f "$candidate/package.json" ]; then
    local declared
    declared="$(
      node - "$candidate/package.json" <<'EOF'
const fs = require("node:fs");
const path = require("node:path");

const packageJsonPath = process.argv[2];
try {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const entry = typeof pkg.types === "string"
    ? pkg.types
    : typeof pkg.typings === "string"
      ? pkg.typings
      : "";
  if (!entry) {
    process.stdout.write("");
    process.exit(0);
  }
  if (path.isAbsolute(entry)) {
    process.stdout.write("");
    process.exit(0);
  }
  process.stdout.write(path.join(path.dirname(packageJsonPath), entry));
} catch {
  process.stdout.write("");
}
EOF
    )"
    if [ -n "$declared" ] && [ -f "$declared" ]; then
      printf '%s\n' "$declared"
      return 0
    fi
  fi

  return 0
}

resolve_surface_files() {
  local surface_mode="$1"
  if [ "$surface_mode" = "clr" ]; then
    local globals_root
    globals_root="$(resolve_surface_package_root "@tsonic/globals" || true)"
    if [ -z "$globals_root" ]; then
      return 1
    fi
    resolve_declaration_entry_files "$globals_root"
    return 0
  fi

  local output
  output="$(
    node - "$surface_mode" "$ROOT_DIR" <<'EOF'
const fs = require("node:fs");
const path = require("node:path");

const surfaceMode = process.argv[2];
const rootDir = process.argv[3];
const monorepoParent = path.dirname(rootDir);

const resolveSurfacePackageRoot = (packageName) => {
  const scoped = packageName.match(/^@tsonic\/([^/]+)$/);
  if (scoped?.[1]) {
    const siblingRoot = path.join(monorepoParent, scoped[1], "versions", "10");
    if (fs.existsSync(path.join(siblingRoot, "package.json"))) {
      return siblingRoot;
    }
  }

  const installedRoot = path.join(rootDir, "node_modules", packageName);
  if (fs.existsSync(path.join(installedRoot, "package.json"))) {
    return installedRoot;
  }

  return undefined;
};

const seen = new Set();
const ordered = [];

const visit = (mode) => {
  if (!mode || seen.has(mode)) return;
  seen.add(mode);
  if (mode === "clr") {
    const globalsRoot = resolveSurfacePackageRoot("@tsonic/globals");
    if (!globalsRoot) {
      throw new Error("missing @tsonic/globals");
    }
    ordered.push(path.join(globalsRoot, "index.d.ts"));
    return;
  }

  const packageRoot = resolveSurfacePackageRoot(mode);
  if (!packageRoot) {
    throw new Error(`missing surface package: ${mode}`);
  }

  const manifestPath = path.join(packageRoot, "tsonic.surface.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const extendsList = Array.isArray(manifest.extends)
      ? manifest.extends.filter((entry) => typeof entry === "string")
      : [];
    for (const parent of extendsList) {
      visit(parent);
    }
  }

  ordered.push(path.join(packageRoot, "index.d.ts"));
};

visit(surfaceMode);
process.stdout.write(ordered.join("\n"));
EOF
  )"
  if [ -z "$output" ]; then
    return 1
  fi
  printf '%s\n' "$output"
}

resolve_workspace_type_root_files() {
  local workspace_dir="$1"
  local output
  output="$(
      node - "$workspace_dir/tsonic.workspace.json" <<'EOF'
const fs = require("node:fs");
const path = require("node:path");

const configPath = process.argv[2];
try {
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const roots = Array.isArray(cfg?.dotnet?.typeRoots)
    ? cfg.dotnet.typeRoots.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    : [];
  process.stdout.write(roots.join("\n"));
} catch {
  process.stdout.write("");
}
EOF
  )"

  if [ -z "$output" ]; then
    return 0
  fi

  local root
  while IFS= read -r root; do
    [ -n "$root" ] || continue

    case "$root" in
      node_modules/@tsonic/*)
        local package_name="${root#node_modules/}"
        local package_root
        package_root="$(resolve_surface_package_root "$package_name" || true)"
        if [ -z "$package_root" ]; then
          echo "FAIL: typeRoot package not found: $package_name" >&2
          return 1
        fi
        resolve_declaration_entry_files "$package_root"
        ;;
      *)
        local resolved_root
        if [[ "$root" = /* ]]; then
          resolved_root="$root"
        else
          resolved_root="$workspace_dir/$root"
        fi
        if [ -f "$resolved_root" ] || [ -d "$resolved_root" ]; then
          resolve_declaration_entry_files "$resolved_root"
        else
          echo "FAIL: typeRoot path not found: $root" >&2
          return 1
        fi
        ;;
    esac
  done <<<"$output"
}

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
  mapfile -t surface_files < <(resolve_surface_files "$surface_mode")
  mapfile -t workspace_type_root_files < <(
    resolve_workspace_type_root_files "$fixture_dir"
  )

  declaration_files=()
  declare -A declaration_seen=()
  for declaration_file in "${surface_files[@]}" "${workspace_type_root_files[@]}"; do
    [ -n "$declaration_file" ] || continue
    if [ -n "${declaration_seen[$declaration_file]:-}" ]; then
      continue
    fi
    declaration_seen[$declaration_file]=1
    declaration_files+=("$declaration_file")
  done

  if [ ${#declaration_files[@]} -eq 0 ]; then
    echo "FAIL: surface definitions not found for $surface_mode"
    exit 1
  fi

  # Build a minimal per-fixture tsconfig that:
  # - Uses noLib mode (Tsonic environment)
  # - Includes the exact surface root explicitly (no automatic @types/* pickup)
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
$(for declaration_file in "${declaration_files[@]}"; do
    printf '    "%s",\n' "$declaration_file"
  done)    "$entry"
  ]
}
EOF

  if "$TSC" -p "$tsconfig_file" >"$out_file" 2>&1; then
    echo "  $fixture_name: PASS"
    passed=$((passed + 1))
    if [ -n "$TYPECHECK_CACHE_DIR" ]; then
      ensure_typecheck_cache_dir
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
      ensure_typecheck_cache_dir
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
