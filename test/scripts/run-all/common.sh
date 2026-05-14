RUN_ALL_LIB_DIR="${RUN_ALL_LIB_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

print_help() {
    cat <<EOF
Usage: ./test/scripts/run-all.sh [--quick] [--no-unit] [--no-cli] [--no-fixtures] [--fast] [--filter <pattern>] [--resume]

Options:
  --quick                Skip E2E tests (unit + golden + fixture typecheck only).
  --no-unit              Skip unit + golden tests (fixtures only). Intended for iteration.
  --no-cli               Skip CLI tests only. Intended for iteration.
  --no-fixtures          Skip fixture typecheck and all fixture execution phases.
  --fast                 Shorthand for --no-cli --no-fixtures.
  --filter <pattern>     Only run E2E fixtures whose directory name contains <pattern>.
                         Can be repeated, or comma-separated (e.g. --filter linq,efcore).
  --resume               Resume from a previous (aborted) run for the same commit+args.
                         Skips already-passed unit/golden tests and already-passed fixtures.
  -h, --help             Show this help.

Notes:
  - --filter is intended for iteration. Final verification must run without --filter.
  - --no-unit is intended for iteration. Final verification must include unit + golden tests.
  - --no-cli, --no-fixtures, and --fast are intended for iteration.
  - E2E concurrency is controlled via TEST_CONCURRENCY
    (default: 75% of available CPU count).
  - Parallel unit/golden concurrency is controlled via TSONIC_UNIT_CONCURRENCY
    (default: 75% of available CPU count).
  - Parallel unit/golden per-title splitting is controlled via
    TSONIC_UNIT_TEST_SHARD_THRESHOLD and TSONIC_UNIT_FILE_SHARD_MS.
  - Heavy/compiler shard timeout guardrails are controlled via
    TSONIC_UNIT_HEAVY_TIMEOUT_MS and TSONIC_UNIT_HEAVY_TIMEOUT_SHARD_MS.
  - E2E fixture runs share NUGET_PACKAGES via TSONIC_E2E_NUGET_PACKAGES_DIR
    (default: .tests/nuget/packages) and clean per-fixture build artifacts.
  - Set TSONIC_E2E_KEEP_ARTIFACTS=1 for a focused debug rerun when artifacts
    need to be inspected after a fixture completes.
EOF
}

now_ms() {
    local ns
    ns="$(date +%s%N 2>/dev/null || true)"
    if [[ "$ns" =~ ^[0-9]+$ ]]; then
        printf '%s' "$((ns / 1000000))"
        return
    fi

    printf '%s000' "$(date +%s)"
}

format_duration_ms() {
    local total_ms="${1:-0}"
    if [ "$total_ms" -lt 1000 ]; then
        printf '%sms' "$total_ms"
        return
    fi

    local total_s=$((total_ms / 1000))
    local ms=$((total_ms % 1000))
    local s=$((total_s % 60))
    local total_m=$((total_s / 60))
    local m=$((total_m % 60))
    local h=$((total_m / 60))

    if [ "$h" -gt 0 ]; then
        printf '%dh %dm %02ds' "$h" "$m" "$s"
        return
    fi

    if [ "$m" -gt 0 ]; then
        printf '%dm %02ds' "$m" "$s"
        return
    fi

    if [ "$ms" -gt 0 ]; then
        printf '%d.%03ds' "$s" "$ms"
        return
    fi

    printf '%ds' "$s"
}

average_ms() {
    local total_ms="${1:-0}"
    local count="${2:-0}"
    if [ "$count" -le 0 ]; then
        printf '0'
        return
    fi
    printf '%s' $((total_ms / count))
}

load_mocha_stats() {
    local package_name="$1"
    local prefix="$2"
    node "$RUN_ALL_LIB_DIR/mocha-stats.mjs" --shell "$CACHE_DIR" "$package_name" "$prefix"
}

trace_event() {
    local event_name="${1:-}"
    shift || true

    local trace_file="${TSONIC_TEST_TRACE_FILE:-}"
    local run_id="${TSONIC_TEST_RUN_ID:-}"
    if [ -z "$event_name" ] || [ -z "$trace_file" ] || [ -z "$run_id" ]; then
        return 0
    fi

    node "$RUN_ALL_LIB_DIR/trace-event.mjs" "$trace_file" "$run_id" "$event_name" "$@" >/dev/null 2>&1 || true
}

ensure_tsonic_bin() {
    if [[ -f "$TSONIC_BIN" ]]; then
        return 0
    fi

    echo "FAIL: tsonic CLI not found at: $TSONIC_BIN" >&2
    echo "Set TSONIC_BIN to a built tsonic CLI path, or build packages/cli so the default path exists." >&2
    exit 1
}

stabilize_tsonic_bin() {
    ensure_tsonic_bin

    local source_bin="$TSONIC_BIN"
    local source_dir
    source_dir="$(cd "$(dirname "$source_bin")" && pwd)"
    local package_root
    package_root="$(cd "$source_dir/.." && pwd)"
    local source_stamp
    source_stamp="$(stat -c %Y "$source_bin" 2>/dev/null || echo 0)"
    local snapshot_root="$CACHE_DIR/tsonic-cli/${BASHPID:-$$}-$source_stamp"
    local snapshot_dir="$snapshot_root/dist"
    local snapshot_entry="$snapshot_root/index.js"

    if [[ ! -f "$snapshot_entry" ]]; then
        mkdir -p "$snapshot_root"
        cp "$package_root/package.json" "$snapshot_root/package.json"
        cp -R "$source_dir" "$snapshot_dir"
        if [[ -d "$package_root/runtime" ]]; then
            cp -R "$package_root/runtime" "$snapshot_root/runtime"
        fi

        cat >"$snapshot_entry" <<EOF
#!/usr/bin/env node
process.env.TSONIC_REPO_ROOT ??= ${ROOT_DIR@Q};
import "./dist/index.js";
EOF
    fi

    TSONIC_BIN="$snapshot_entry"
}

resolve_local_tsonic_package_dest() {
    local package_name="$1"
    local dotnet_major="$2"

    if [[ ! "$package_name" =~ ^@tsonic/ ]]; then
        return 1
    fi

    local name="${package_name#@tsonic/}"
    local sibling="$ROOT_DIR/../$name"

    if [ -f "$sibling/versions/$dotnet_major/package.json" ]; then
        printf '%s\n' "$sibling/versions/$dotnet_major"
        return 0
    fi

    if [ -f "$sibling/package.json" ]; then
        printf '%s\n' "$sibling"
        return 0
    fi

    local root_pkg="$ROOT_DIR/node_modules/@tsonic/$name"
    if [ -e "$root_pkg" ]; then
        printf '%s\n' "$root_pkg"
        return 0
    fi

    return 1
}

collect_fixture_tsonic_packages() {
    local fixture_dir="$1"

    node - "$fixture_dir" "$ROOT_DIR" <<'EOF'
const fs = require("node:fs");
const path = require("node:path");

const fixtureDir = process.argv[2];
const rootDir = process.argv[3];
const workspacePath = path.join(fixtureDir, "tsonic.workspace.json");
const packagePath = path.join(fixtureDir, "package.json");
const monorepoParent = path.dirname(rootDir);
const results = new Set();

const addPackage = (name) => {
  if (typeof name !== "string" || !name.startsWith("@tsonic/")) return;
  results.add(name);
};

const resolveSurfaceRoot = (mode) => {
  if (!mode) return undefined;
  if (mode === "clr") {
    const sibling = path.join(monorepoParent, "globals", "versions", "10");
    if (fs.existsSync(path.join(sibling, "package.json"))) return sibling;
    const installed = path.join(rootDir, "node_modules", "@tsonic", "globals");
    if (fs.existsSync(path.join(installed, "package.json"))) return installed;
    return undefined;
  }

  const scoped = mode.match(/^@tsonic\/([^/]+)$/);
  if (scoped?.[1]) {
    const sibling = path.join(monorepoParent, scoped[1], "versions", "10");
    if (fs.existsSync(path.join(sibling, "package.json"))) return sibling;
  }

  const installed = path.join(rootDir, "node_modules", ...mode.split("/"));
  if (fs.existsSync(path.join(installed, "package.json"))) return installed;
  return undefined;
};

const visitSurface = (mode, seen = new Set()) => {
  if (!mode || seen.has(mode)) return;
  seen.add(mode);
  if (mode === "clr") {
    addPackage("@tsonic/globals");
    return;
  }

  addPackage(mode);
  const packageRoot = resolveSurfaceRoot(mode);
  if (!packageRoot) return;
  const manifestPath = path.join(packageRoot, "tsonic.surface.json");
  if (!fs.existsSync(manifestPath)) return;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const parents = Array.isArray(manifest.extends)
    ? manifest.extends.filter((entry) => typeof entry === "string")
    : [];
  for (const parent of parents) visitSurface(parent, seen);
};

if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  for (const key of Object.keys(deps)) addPackage(key);
}

if (fs.existsSync(workspacePath)) {
  const cfg = JSON.parse(fs.readFileSync(workspacePath, "utf8"));
  visitSurface(typeof cfg.surface === "string" ? cfg.surface : "clr");
  const typeRoots = Array.isArray(cfg?.dotnet?.typeRoots)
    ? cfg.dotnet.typeRoots.filter((entry) => typeof entry === "string")
    : [];
  for (const entry of typeRoots) {
    if (entry.startsWith("node_modules/@tsonic/")) {
      addPackage(entry.replace(/^node_modules\//, ""));
    }
  }
}

process.stdout.write(Array.from(results).sort().join("\n"));
EOF
}

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

find_linker_library() {
    local base="$1"
    local path

    for path in \
        "/usr/lib/x86_64-linux-gnu/$base" \
        "/usr/lib64/$base" \
        "/usr/lib/$base"; do
        if [ -e "$path" ]; then
            printf '%s\n' "$path"
            return 0
        fi
    done

    for path in \
        "/usr/lib/x86_64-linux-gnu/$base".* \
        "/usr/lib64/$base".* \
        "/usr/lib/$base".*; do
        if [ -e "$path" ]; then
            printf '%s\n' "$path"
            return 0
        fi
    done

    if command -v ldconfig >/dev/null 2>&1; then
        path="$(ldconfig -p 2>/dev/null | awk -v base="$base" '$1 ~ "^" base "\\." { print $NF; exit }')"
        if [ -n "$path" ] && [ -e "$path" ]; then
            printf '%s\n' "$path"
            return 0
        fi
    fi

    return 1
}

prepare_nativeaot_linker_library_path() {
    local root="$1"
    local link_dir="$root/.tests/native-aot-linker-libs"
    local created=0
    local missing=0
    local lib
    local found

    mkdir -p "$link_dir"

    for lib in libssl.so libcrypto.so libz.so libbrotlienc.so libbrotlidec.so libbrotlicommon.so; do
        found="$(find_linker_library "$lib" || true)"
        if [ -z "$found" ]; then
            missing=1
            continue
        fi

        if [ "$found" != "$link_dir/$lib" ]; then
            ln -sfn "$found" "$link_dir/$lib"
            created=1
        fi
    done

    if [ "$created" -eq 1 ]; then
        case ":${LIBRARY_PATH:-}:" in
            *":$link_dir:"*) ;;
            *) export LIBRARY_PATH="$link_dir${LIBRARY_PATH:+:$LIBRARY_PATH}" ;;
        esac
    fi

    [ "$missing" -eq 0 ]
}

nativeaot_preflight_check() {
    local log_file="$1"
    local rid
    rid="$(dotnet --info 2>/dev/null | awk '/^ RID:/{print $2; exit}')"
    if [ -z "$rid" ]; then
        rid="linux-x64"
    fi

    local tmp_dir
    local preflight_root
    preflight_root="${ROOT_DIR:-$(cd "$RUN_ALL_LIB_DIR/../../.." && pwd)}"
    mkdir -p "$preflight_root/.tests"
    prepare_nativeaot_linker_library_path "$preflight_root" || true
    tmp_dir="$(mktemp -d "$preflight_root/.tests/native-aot-preflight-XXXXXX")"
    local probe_dir="$tmp_dir/AotPreflight"
    local probe_log="$tmp_dir/preflight.log"

    local ok=0
    if dotnet new console --framework net10.0 --use-program-main --name AotPreflight --output "$probe_dir" --no-restore --force >/dev/null 2>>"$probe_log"; then
        if dotnet publish "$probe_dir/AotPreflight.csproj" -c Release -r "$rid" --self-contained true /p:PublishAot=true /p:PublishTrimmed=true /p:PublishSingleFile=true --nologo >"$probe_log" 2>&1; then
            ok=1
        fi
    fi

    if [ "$ok" -eq 1 ]; then
        rm -rf "$tmp_dir" 2>/dev/null || true
        return 0
    fi

    echo -e "${RED}NativeAOT preflight failed for RID '$rid'.${NC}" | tee -a "$log_file"
    echo "Preflight output:" | tee -a "$log_file"
    sed -n '1,80p' "$probe_log" | tee -a "$log_file"

    rm -rf "$tmp_dir" 2>/dev/null || true
    return 1
}
