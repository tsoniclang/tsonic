#!/bin/bash
# Unified test runner: unit tests, golden tests, E2E tests, and summary report
#
# Usage: ./test/scripts/run-all.sh [--quick] [--filter <pattern>]
#   --quick: Skip E2E tests, only run unit/golden tests
#   --no-unit: Skip unit/golden tests (fixtures only). Intended for iteration.
#   --filter: Run only matching E2E fixtures (substring match on fixture name).
#             Can be repeated, or use comma-separated patterns.
#   --resume: Resume from a previous (aborted) run for the same commit+args by
#             skipping already-passed unit/golden tests and already-passed fixtures.
#
# Environment variables:
#   TEST_CONCURRENCY: Number of parallel E2E tests (default: 4)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Parallelism (default to 4)
TEST_CONCURRENCY="${TEST_CONCURRENCY:-4}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Results tracking
UNIT_PASSED=0
UNIT_FAILED=0
GOLDEN_PASSED=0
GOLDEN_FAILED=0
TSC_PASSED=0
TSC_FAILED=0
E2E_DOTNET_PASSED=0
E2E_DOTNET_FAILED=0
E2E_NEGATIVE_PASSED=0
E2E_NEGATIVE_FAILED=0

# Step status (some failures don't produce mocha "failing" lines)
UNIT_STATUS="unknown"
TSC_STATUS="unknown"
RUNTIME_SYNC_STATUS="unknown"
AOT_PREFLIGHT_STATUS="not-run"
E2E_FORCE_NO_AOT=false

QUICK_MODE=false
SKIP_UNIT=false
RESUME_MODE=false
FILTER_PATTERNS=()

print_help() {
    cat <<EOF
Usage: ./test/scripts/run-all.sh [--quick] [--no-unit] [--filter <pattern>] [--resume]

Options:
  --quick                Skip E2E tests (unit + golden + fixture typecheck only).
  --no-unit              Skip unit + golden tests (fixtures only). Intended for iteration.
  --filter <pattern>     Only run E2E fixtures whose directory name contains <pattern>.
                         Can be repeated, or comma-separated (e.g. --filter linq,efcore).
  --resume               Resume from a previous (aborted) run for the same commit+args.
                         Skips already-passed unit/golden tests and already-passed fixtures.
  -h, --help             Show this help.

Notes:
  - --filter is intended for iteration. Final verification must run without --filter.
  - --no-unit is intended for iteration. Final verification must include unit + golden tests.
  - Concurrency is controlled via TEST_CONCURRENCY (default: 4).
EOF
}

while [ $# -gt 0 ]; do
    case "${1:-}" in
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --no-unit)
            SKIP_UNIT=true
            shift
            ;;
        --resume)
            RESUME_MODE=true
            shift
            ;;
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

if [[ -z "${TSONIC_BIN:-}" ]]; then
  echo "FAIL: TSONIC_BIN is not set. Set it to the tsonic CLI path." >&2
  exit 1
fi

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

nativeaot_preflight_check() {
    local log_file="$1"
    local rid
    rid="$(dotnet --info 2>/dev/null | awk '/^ RID:/{print $2; exit}')"
    if [ -z "$rid" ]; then
        rid="linux-x64"
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d /tmp/tsonic-aot-preflight-XXXXXX)"
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
    if grep -Eq "MSB4216|MSB4027|ComputeManagedAssemblies" "$probe_log"; then
        echo "Detected host ILLink/MSBuild task-host failure (MSB4216/MSB4027)." | tee -a "$log_file"
        echo "This is an environment/toolchain issue, not a fixture-level regression." | tee -a "$log_file"
        echo "Proceeding with fixture execution in managed mode (--no-aot)." | tee -a "$log_file"
        echo "Preflight output:" | tee -a "$log_file"
        sed -n '1,80p' "$probe_log" | tee -a "$log_file"

        rm -rf "$tmp_dir" 2>/dev/null || true
        return 2
    fi
    echo "Preflight output:" | tee -a "$log_file"
    sed -n '1,80p' "$probe_log" | tee -a "$log_file"

    rm -rf "$tmp_dir" 2>/dev/null || true
    return 1
}

# Create logs directory
mkdir -p "$ROOT_DIR/.tests"
LOG_FILE="$ROOT_DIR/.tests/run-all-$(date +%Y%m%d-%H%M%S).log"

# ============================================================
# Resume/Checkpoint cache (per commit + args)
# ============================================================
GIT_HEAD="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
FILTERS_CANON_JSON="$(
    node -e '
      const raws = process.argv.slice(1);
      const parts = [];
      for (const r of raws) {
        for (const p of String(r).split(",")) {
          const t = p.trim();
          if (t) parts.push(t);
        }
      }
      const uniq = [...new Set(parts)].sort();
      process.stdout.write(JSON.stringify(uniq));
    ' "${FILTER_PATTERNS[@]}" 2>/dev/null || echo "[]"
)"

ARGS_HASH="$(
    node -e '
      const crypto = require("node:crypto");
      const quick = process.argv[1] === "1";
      const skipUnit = process.argv[2] === "1";
      const filters = JSON.parse(process.argv[3] ?? "[]");
      const args = { quick, skipUnit, filters };
      process.stdout.write(crypto.createHash("sha256").update(JSON.stringify(args)).digest("hex"));
    ' "$([ "$QUICK_MODE" = true ] && echo 1 || echo 0)" "$([ "$SKIP_UNIT" = true ] && echo 1 || echo 0)" "$FILTERS_CANON_JSON" 2>/dev/null || echo ""
)"

if [ -n "$GIT_HEAD" ] && [ -n "$ARGS_HASH" ]; then
    CACHE_DIR="$ROOT_DIR/.tests/run-all-cache/$GIT_HEAD/$ARGS_HASH"
    if [ "$RESUME_MODE" = true ]; then
        mkdir -p "$CACHE_DIR"
    else
        rm -rf "$CACHE_DIR" 2>/dev/null || true
        mkdir -p "$CACHE_DIR"
    fi
else
    # Non-git/dev environments: resume isn't safe/meaningful.
    RESUME_MODE=false
    CACHE_DIR="$ROOT_DIR/.tests/run-all-cache/_nogit/$(date +%s)"
    rm -rf "$CACHE_DIR" 2>/dev/null || true
    mkdir -p "$CACHE_DIR"
fi

echo "=== Tsonic Test Suite ===" | tee "$LOG_FILE"
echo "Branch:  $(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || echo 'unknown')" | tee -a "$LOG_FILE"
echo "Commit:  $(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
if [ "$RESUME_MODE" = true ]; then
    echo -e "${YELLOW}NOTE: RESUME MODE. Already-passed unit/golden tests and fixtures will be skipped.${NC}" | tee -a "$LOG_FILE"
fi
if [ ${#FILTER_PATTERNS[@]} -gt 0 ]; then
    echo -e "${YELLOW}NOTE: FILTERED RUN (${FILTER_PATTERNS[*]}). Do not use this as the final verification.${NC}" | tee -a "$LOG_FILE"
fi
if [ "$SKIP_UNIT" = true ]; then
    echo -e "${YELLOW}NOTE: UNIT TESTS SKIPPED (--no-unit). Do not use this as the final verification.${NC}" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ============================================================
# 1. Unit & Golden Tests (npm test)
# ============================================================
echo -e "${BLUE}--- Running Unit & Golden Tests ---${NC}" | tee -a "$LOG_FILE"
cd "$ROOT_DIR"

if [ "$SKIP_UNIT" = true ]; then
    echo -e "${YELLOW}SKIP: unit + golden tests (--no-unit)${NC}" | tee -a "$LOG_FILE"
    UNIT_STATUS="skipped"
else
    if TSONIC_TEST_CHECKPOINT_DIR="$CACHE_DIR" TSONIC_TEST_RESUME="$([ "$RESUME_MODE" = true ] && echo 1 || echo 0)" npm test 2>&1 | tee -a "$LOG_FILE"; then
        UNIT_STATUS="passed"
    else
        UNIT_STATUS="failed"
    fi

    # Extract pass/fail counts from npm test output
    while IFS= read -r line; do
        if [[ "$line" =~ ([0-9]+)\ passing ]]; then
            count="${BASH_REMATCH[1]}"
            UNIT_PASSED=$((UNIT_PASSED + count))
        fi
        if [[ "$line" =~ ([0-9]+)\ failing ]]; then
            count="${BASH_REMATCH[1]}"
            UNIT_FAILED=$((UNIT_FAILED + count))
        fi
    done < <(grep -E "passing|failing" "$LOG_FILE" || true)

    # Ensure failures are surfaced even when a workspace fails to build before running mocha.
    if [ "$UNIT_STATUS" = "failed" ] && [ "$UNIT_FAILED" -eq 0 ]; then
        UNIT_FAILED=1
    fi
fi

echo "" | tee -a "$LOG_FILE"

# ============================================================
# 1.25 TypeScript typecheck (fixtures must pass vanilla tsc)
# ============================================================
echo -e "${BLUE}--- Running TypeScript Typecheck (E2E fixtures) ---${NC}" | tee -a "$LOG_FILE"
typecheck_cmd=(bash "$ROOT_DIR/test/scripts/typecheck-fixtures.sh")
for pat in "${FILTER_PATTERNS[@]}"; do
    typecheck_cmd+=(--filter "$pat")
done

if TSONIC_TEST_CHECKPOINT_DIR="$CACHE_DIR" TSONIC_TEST_RESUME="$([ "$RESUME_MODE" = true ] && echo 1 || echo 0)" "${typecheck_cmd[@]}" 2>&1 | tee -a "$LOG_FILE"; then
    TSC_STATUS="passed"
else
    TSC_STATUS="failed"
fi

# Extract tsc pass/fail counts from script output
tsc_summary_line=$(grep -E "Typecheck summary:" "$LOG_FILE" | tail -1 || true)
if [[ "$tsc_summary_line" =~ Typecheck\ summary:\ ([0-9]+)\ passed,\ ([0-9]+)\ failed ]]; then
    TSC_PASSED="${BASH_REMATCH[1]}"
    TSC_FAILED="${BASH_REMATCH[2]}"
fi

# Ensure failures are surfaced even when the typecheck script fails before printing a summary.
if [ "$TSC_STATUS" = "failed" ] && [ "$TSC_FAILED" -eq 0 ]; then
    TSC_FAILED=1
fi

echo "" | tee -a "$LOG_FILE"

if [ "$QUICK_MODE" = true ]; then
    echo -e "${YELLOW}--- Skipping E2E Tests (--quick mode) ---${NC}" | tee -a "$LOG_FILE"
else
    # ============================================================
    # 1.5 Runtime DLL sync (required for generator runtime)
    # ============================================================
    echo -e "${BLUE}--- Syncing Runtime DLLs ---${NC}" | tee -a "$LOG_FILE"
    if "$ROOT_DIR/scripts/sync-runtime-dlls.sh" 2>&1 | tee -a "$LOG_FILE"; then
        RUNTIME_SYNC_STATUS="passed"
    else
        RUNTIME_SYNC_STATUS="failed"
        # Count as an E2E failure so the overall run fails.
        E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
        echo -e "${RED}FAIL: runtime DLL sync failed${NC}" | tee -a "$LOG_FILE"
    fi
    echo "" | tee -a "$LOG_FILE"

    RUN_E2E_FIXTURES=true
    if [ "$RUNTIME_SYNC_STATUS" = "passed" ]; then
        echo -e "${BLUE}--- NativeAOT Preflight ---${NC}" | tee -a "$LOG_FILE"
        if nativeaot_preflight_check "$LOG_FILE"; then
            AOT_PREFLIGHT_STATUS="passed"
        else
            preflight_rc=$?
            if [ "$preflight_rc" -eq 2 ]; then
                AOT_PREFLIGHT_STATUS="host-toolchain-fallback-noaot"
                E2E_FORCE_NO_AOT=true
            else
                AOT_PREFLIGHT_STATUS="failed"
                RUN_E2E_FIXTURES=false
                # Count once so the run fails clearly without cascading noise.
                E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
                echo -e "${RED}FAIL: NativeAOT preflight failed; skipping fixture execution.${NC}" | tee -a "$LOG_FILE"
            fi
        fi
        echo "" | tee -a "$LOG_FILE"
    else
        AOT_PREFLIGHT_STATUS="skipped"
        RUN_E2E_FIXTURES=false
    fi

    if [ "$RUN_E2E_FIXTURES" = true ]; then
    # ============================================================
    # 2. E2E Dotnet Tests (Parallel)
    # ============================================================
    echo -e "${BLUE}--- Running E2E Dotnet Tests (concurrency: $TEST_CONCURRENCY) ---${NC}" | tee -a "$LOG_FILE"

    FIXTURES_DIR="$SCRIPT_DIR/../fixtures"
    # Persistent directory for per-fixture results (enables --resume).
    RESULTS_DIR="$CACHE_DIR/e2e"
    mkdir -p "$RESULTS_DIR"

    # Function to run a single E2E dotnet test (prints result immediately)
    run_dotnet_test() {
        local fixture_dir="$1"
        local results_dir="$2"
        local fixture_name=$(basename "$fixture_dir")
        local result_file="$results_dir/$fixture_name"
        local error_file="$results_dir/${fixture_name}.error"
        local result=""

        if [ "$RESUME_MODE" = true ] && [ -f "$result_file" ]; then
            prev=$(cat "$result_file" 2>/dev/null || true)
            if [[ "$prev" == PASS* ]]; then
                echo -e "  $fixture_name: \033[1;33mSKIP (cached PASS)\033[0m"
                return
            fi
        fi

        cd "$fixture_dir"

        # E2E fixtures should not rely on pre-existing per-fixture node_modules.
        # Prefer:
        # - npm install (when E2E_NPM_INSTALL=1), OR
        # - symlinked local @tsonic/* checkouts (dev workflow, no network).
        #
        # This keeps tests deterministic and avoids stale shadowing.
        if [ "${E2E_NPM_INSTALL:-0}" != "1" ]; then
            rm -rf node_modules 2>/dev/null || true
        fi

        # Optional per-fixture dependency install (off by default).
        # E2E fixtures live inside the monorepo, so they can resolve @tsonic/*
        # from the repo root node_modules without local installs.
        if [ -f "package.json" ] && [ "${E2E_NPM_INSTALL:-0}" = "1" ]; then
            npm install --silent --no-package-lock
        elif [ -f "package.json" ]; then
            # Offline/dev mode: create minimal node_modules with @tsonic/* symlinks.
            # This is intentionally test-only; production Tsonic must use normal npm
            # resolution and never assume sibling checkouts.
            mkdir -p node_modules/@tsonic

            # Determine .NET major (prefer fixture config, fall back to 10).
            dotnet_major=$(node -e 'const fs=require("fs"); try { const cfg=JSON.parse(fs.readFileSync("tsonic.workspace.json","utf8")); const dv=String(cfg.dotnetVersion ?? "net10.0"); const m=dv.match(/net(\\d+)/); console.log(m ? m[1] : "10"); } catch { console.log("10"); }' 2>/dev/null || echo "10")

            # List @tsonic/* deps from package.json
            deps=$(
                node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8")); const deps=Object.assign({}, p.dependencies||{}, p.devDependencies||{}); for (const k of Object.keys(deps)) { if (k.startsWith("@tsonic/")) console.log(k); }' 2>/dev/null || true
            )

            while IFS= read -r pkg; do
                [ -n "$pkg" ] || continue
                name="${pkg#@tsonic/}"
                dest="node_modules/@tsonic/$name"
                if [ -e "$dest" ]; then
                    continue
                fi

                # Prefer sibling repo checkouts next to this monorepo (dev workflow).
                sibling="$ROOT_DIR/../$name"

                # Versioned repos: <repo>/versions/<major> contains the real package.
                if [ -f "$sibling/versions/$dotnet_major/package.json" ]; then
                    ln -s "$sibling/versions/$dotnet_major" "$dest"
                    continue
                fi

                # Non-versioned repos: <repo>/package.json contains the real package.
                if [ -f "$sibling/package.json" ]; then
                    ln -s "$sibling" "$dest"
                    continue
                fi

                # Fall back to already-installed repo root packages.
                root_pkg="$ROOT_DIR/node_modules/@tsonic/$name"
                if [ -e "$root_pkg" ]; then
                    ln -s "$root_pkg" "$dest"
                    continue
                fi

                echo "FAIL: missing dependency $pkg. Set E2E_NPM_INSTALL=1 to install from npm, or clone the repo at $sibling." >>"$error_file"
                result="FAIL (missing deps)"
                echo "$result" > "$result_file"
                echo -e "  $fixture_name: \033[0;31m$result\033[0m"
                return
            done <<<"$deps"
        fi

        # Build and run - capture errors to file
        build_args=("build" "--project" "$fixture_name" "--config" "tsonic.workspace.json")
        if [ "$E2E_FORCE_NO_AOT" = true ]; then
            build_args+=("--no-aot")
        fi

        if node "$TSONIC_BIN" "${build_args[@]}" 2>"$error_file"; then
            # Optional post-build commands (for fixtures that need extra validation steps).
            # Example: EF Core query precompilation (`dotnet ef dbcontext optimize`).
            meta_file="$fixture_dir/e2e.meta.json"
            if [ -f "$meta_file" ]; then
                postbuild_items=()
                while IFS= read -r -d '' item; do
                    postbuild_items+=("$item")
                done < <(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const pb=m.postBuild; if(!pb||!Array.isArray(pb.commands)||pb.commands.length===0){process.exit(0);} const parts=[String(pb.workingDirectory ?? ""), ...pb.commands.map(String)]; process.stdout.write(parts.join("\\0") + "\\0");' "$meta_file" 2>/dev/null || true)

                if [ "${#postbuild_items[@]}" -gt 1 ]; then
                    postbuild_cwd="${postbuild_items[0]}"
                    postbuild_cmds=("${postbuild_items[@]:1}")

                    # Run post-build commands from the configured working directory.
                    if [ -n "$postbuild_cwd" ]; then
                        pushd "$fixture_dir/$postbuild_cwd" >/dev/null || {
                            echo "FAIL: postBuild workingDirectory not found: $postbuild_cwd" >>"$error_file"
                            result="FAIL (post-build error)"
                            echo "$result" > "$result_file"
                            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
                            return
                        }
                    else
                        pushd "$fixture_dir" >/dev/null
                    fi

                    for cmd in "${postbuild_cmds[@]}"; do
                        echo "=== postBuild: $cmd" >>"$error_file"
                        if ! bash -lc "$cmd" >>"$error_file" 2>&1; then
                            popd >/dev/null
                            result="FAIL (post-build error)"
                            echo "$result" > "$result_file"
                            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
                            return
                        fi
                    done

                    popd >/dev/null
                fi
            fi

            skip_runtime_due_no_aot=false
            if [ "$E2E_FORCE_NO_AOT" = true ] && [ -f "$meta_file" ]; then
                requires_native_aot_runtime=$(
                    node -e 'const fs=require("fs"); try { const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.requiresNativeAotRuntime === true ? "1" : "0"); } catch { process.stdout.write("0"); }' "$meta_file" 2>/dev/null || echo "0"
                )
                if [ "$requires_native_aot_runtime" = "1" ]; then
                    skip_runtime_due_no_aot=true
                fi
            fi

            # Find executable
            # Some .NET publish outputs mark DLLs as executable; filter those out.
            exe_path=""
            project_root="packages/$fixture_name"
            out_dir="$project_root/out"

            output_name="$fixture_name"
            generated_subdir="generated"
            if [ -f "$project_root/tsonic.json" ]; then
                cfg_vals=$(node -e 'const fs=require("fs"); const cfg=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(String(cfg.outputName ?? "")); console.log(String(cfg.outputDirectory ?? ""));' "$project_root/tsonic.json" 2>/dev/null || true)
                cfg_output_name=$(printf "%s" "$cfg_vals" | sed -n '1p')
                cfg_output_dir=$(printf "%s" "$cfg_vals" | sed -n '2p')
                if [ -n "$cfg_output_name" ]; then output_name="$cfg_output_name"; fi
                if [ -n "$cfg_output_dir" ]; then generated_subdir="$cfg_output_dir"; fi
            fi

            generated_dir="$project_root/$generated_subdir"

            # Prefer the top-level binary matching the fixture name when present.
            if [ -f "$out_dir/$output_name" ] && [ -x "$out_dir/$output_name" ]; then
                exe_path="$out_dir/$output_name"
            else
                exe_path=$(find "$out_dir" -type f -executable 2>/dev/null | grep -v '\.dll$' | grep -v '\.dbg$' | grep -v '\.so$' | grep -v '\.dylib$' | head -1 || true)
            fi

            if [ -z "$exe_path" ]; then
                if [ -f "$generated_dir/$output_name" ] && [ -x "$generated_dir/$output_name" ]; then
                    exe_path="$generated_dir/$output_name"
                else
                    exe_path=$(find "$generated_dir" -type f -executable 2>/dev/null | grep -v '\.dll$' | grep -v '\.dbg$' | grep -v '\.so$' | grep -v '\.dylib$' | head -1 || true)
                fi
            fi

            if [ "$skip_runtime_due_no_aot" = true ]; then
                result="PASS (build only; nativeaot runtime skipped)"
            elif [ -n "$exe_path" ] && [ -x "$exe_path" ]; then
                # Check for expected output
                if [ -f "expected-output.txt" ]; then
                    actual=$("$exe_path" 2>&1 || true)
                    expected=$(cat expected-output.txt)
                    if [ "$actual" = "$expected" ]; then
                        result="PASS"
                    else
                        result="FAIL (output mismatch)"
                    fi
                elif "$exe_path" >/dev/null 2>&1; then
                    result="PASS"
                else
                    result="FAIL (runtime error)"
                fi
            else
                result="PASS (build only)"
            fi
        else
            result="FAIL (build error)"
        fi

        # Save result to file
        echo "$result" > "$result_file"

        # Print result immediately (with colors)
        if [[ "$result" == PASS* ]]; then
            echo -e "  $fixture_name: \033[0;32m$result\033[0m"
        else
            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
        fi
    }

    # Collect fixture directories for dotnet tests
    DOTNET_FIXTURES=()
    for fixture_dir in "$FIXTURES_DIR"/*/; do
        config_file="$fixture_dir/tsonic.workspace.json"
        # Skip if no dotnet config
        if [ ! -f "$config_file" ]; then
            continue
        fi
        # Skip negative tests
        meta_file="$fixture_dir/e2e.meta.json"
        if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
            continue
        fi
        if ! matches_filter "$(basename "$fixture_dir")"; then
            continue
        fi
        DOTNET_FIXTURES+=("$fixture_dir")
    done

    # Run tests in parallel using background jobs
    for fixture_dir in "${DOTNET_FIXTURES[@]}"; do
        # Wait if we have too many background jobs
        while [ $(jobs -r | wc -l) -ge "$TEST_CONCURRENCY" ]; do
            sleep 0.1
        done

        # Run test in background
        (run_dotnet_test "$fixture_dir" "$RESULTS_DIR") &
    done

    # Wait for all to complete
    wait

    # Count results (for summary)
    for fixture_dir in "${DOTNET_FIXTURES[@]}"; do
        fixture_name=$(basename "$fixture_dir")
        result_file="$RESULTS_DIR/$fixture_name"
        error_file="$RESULTS_DIR/${fixture_name}.error"
        if [ -f "$result_file" ]; then
            result=$(cat "$result_file")
            echo "  $fixture_name: $result" >> "$LOG_FILE"
            # Include error details if build failed
            if [[ "$result" == *"build error"* ]] && [ -f "$error_file" ] && [ -s "$error_file" ]; then
                echo "    --- Error details ---" >> "$LOG_FILE"
                cat "$error_file" >> "$LOG_FILE"
                echo "    --- End error ---" >> "$LOG_FILE"
            fi
            if [[ "$result" == PASS* ]]; then
                E2E_DOTNET_PASSED=$((E2E_DOTNET_PASSED + 1))
            else
                E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
            fi
        else
            echo "  $fixture_name: FAIL (no result)" >> "$LOG_FILE"
            E2E_DOTNET_FAILED=$((E2E_DOTNET_FAILED + 1))
        fi
    done

    echo "" | tee -a "$LOG_FILE"

    # ============================================================
    # 3. Negative Tests (expected failures) - Parallel
    # ============================================================
    echo -e "${BLUE}--- Running Negative Tests (concurrency: $TEST_CONCURRENCY) ---${NC}" | tee -a "$LOG_FILE"

    # Function to run a single negative test (prints result immediately)
    run_negative_test() {
        local fixture_dir="$1"
        local results_dir="$2"
        local fixture_name=$(basename "$fixture_dir")
        local result_file="$results_dir/neg_$fixture_name"
        local result=""

        if [ "$RESUME_MODE" = true ] && [ -f "$result_file" ]; then
            prev=$(cat "$result_file" 2>/dev/null || true)
            if [[ "$prev" == PASS* ]]; then
                echo -e "  $fixture_name: \033[1;33mSKIP (cached PASS)\033[0m"
                return
            fi
        fi

        # Find config
        if [ ! -f "$fixture_dir/tsonic.workspace.json" ]; then
            result="FAIL (no config)"
            echo "$result" > "$result_file"
            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
            return
        fi

        cd "$fixture_dir"

        if [ -f "package.json" ] && [ "${E2E_NPM_INSTALL:-0}" = "1" ]; then
            npm install --silent --no-package-lock
        fi

        # Build should FAIL
        build_args=("build" "--project" "$fixture_name" "--config" "tsonic.workspace.json")
        if [ "$E2E_FORCE_NO_AOT" = true ]; then
            build_args+=("--no-aot")
        fi

        if node "$TSONIC_BIN" "${build_args[@]}" >/dev/null 2>&1; then
            result="FAIL (expected error but succeeded)"
        else
            result="PASS (failed as expected)"
        fi

        # Save result to file
        echo "$result" > "$result_file"

        # Print result immediately (with colors)
        if [[ "$result" == PASS* ]]; then
            echo -e "  $fixture_name: \033[0;32m$result\033[0m"
        else
            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
        fi
    }

    # Collect negative test fixtures
    NEGATIVE_FIXTURES=()
    for fixture_dir in "$FIXTURES_DIR"/*; do
        meta_file="$fixture_dir/e2e.meta.json"
        if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
            if ! matches_filter "$(basename "$fixture_dir")"; then
                continue
            fi
            NEGATIVE_FIXTURES+=("$fixture_dir")
        fi
    done

    # Run negative tests in parallel
    if [ ${#NEGATIVE_FIXTURES[@]} -gt 0 ]; then
        # Run all negative tests in parallel with limited concurrency
        for fixture_dir in "${NEGATIVE_FIXTURES[@]}"; do
            while [ $(jobs -r | wc -l) -ge "$TEST_CONCURRENCY" ]; do
                sleep 0.1
            done
            (run_negative_test "$fixture_dir" "$RESULTS_DIR") &
        done

        # Wait for all to complete
        wait

        # Count results (for summary)
        for fixture_dir in "${NEGATIVE_FIXTURES[@]}"; do
            fixture_name=$(basename "$fixture_dir")
            result_file="$RESULTS_DIR/neg_$fixture_name"
            if [ -f "$result_file" ]; then
                result=$(cat "$result_file")
                echo "  $fixture_name: $result" >> "$LOG_FILE"
                if [[ "$result" == PASS* ]]; then
                    E2E_NEGATIVE_PASSED=$((E2E_NEGATIVE_PASSED + 1))
                else
                    E2E_NEGATIVE_FAILED=$((E2E_NEGATIVE_FAILED + 1))
                fi
            else
                echo "  $fixture_name: FAIL (no result)" >> "$LOG_FILE"
                E2E_NEGATIVE_FAILED=$((E2E_NEGATIVE_FAILED + 1))
            fi
        done
    fi

    echo "" | tee -a "$LOG_FILE"
    else
        echo -e "${YELLOW}--- Skipping E2E fixture execution (NativeAOT preflight/runtime sync not available) ---${NC}" | tee -a "$LOG_FILE"
        echo "" | tee -a "$LOG_FILE"
    fi
fi

# ============================================================
# Summary Report
# ============================================================
echo "" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "           TEST SUMMARY REPORT          " | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

TOTAL_PASSED=$((UNIT_PASSED + TSC_PASSED + E2E_DOTNET_PASSED + E2E_NEGATIVE_PASSED))
TOTAL_FAILED=$((UNIT_FAILED + TSC_FAILED + E2E_DOTNET_FAILED + E2E_NEGATIVE_FAILED))

echo "Unit & Golden Tests:" | tee -a "$LOG_FILE"
if [ "$UNIT_STATUS" = "skipped" ]; then
    echo -e "  ${YELLOW}Skipped (--no-unit)${NC}" | tee -a "$LOG_FILE"
else
    echo -e "  ${GREEN}Passed: $UNIT_PASSED${NC}" | tee -a "$LOG_FILE"
    if [ $UNIT_FAILED -gt 0 ]; then
        echo -e "  ${RED}Failed: $UNIT_FAILED${NC}" | tee -a "$LOG_FILE"
    else
        echo "  Failed: 0" | tee -a "$LOG_FILE"
    fi
fi
echo "" | tee -a "$LOG_FILE"

echo "TypeScript Typecheck:" | tee -a "$LOG_FILE"
echo -e "  ${GREEN}Passed: $TSC_PASSED${NC}" | tee -a "$LOG_FILE"
if [ $TSC_FAILED -gt 0 ]; then
    echo -e "  ${RED}Failed: $TSC_FAILED${NC}" | tee -a "$LOG_FILE"
else
    echo "  Failed: 0" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

if [ "$QUICK_MODE" = false ]; then
    echo "E2E Dotnet Tests:" | tee -a "$LOG_FILE"
    echo "  NativeAOT preflight: $AOT_PREFLIGHT_STATUS" | tee -a "$LOG_FILE"
    echo -e "  ${GREEN}Passed: $E2E_DOTNET_PASSED${NC}" | tee -a "$LOG_FILE"
    if [ $E2E_DOTNET_FAILED -gt 0 ]; then
        echo -e "  ${RED}Failed: $E2E_DOTNET_FAILED${NC}" | tee -a "$LOG_FILE"
    else
        echo "  Failed: 0" | tee -a "$LOG_FILE"
    fi
    echo "" | tee -a "$LOG_FILE"

    echo "Negative Tests:" | tee -a "$LOG_FILE"
    echo -e "  ${GREEN}Passed: $E2E_NEGATIVE_PASSED${NC}" | tee -a "$LOG_FILE"
    if [ $E2E_NEGATIVE_FAILED -gt 0 ]; then
        echo -e "  ${RED}Failed: $E2E_NEGATIVE_FAILED${NC}" | tee -a "$LOG_FILE"
    else
        echo "  Failed: 0" | tee -a "$LOG_FILE"
    fi
    echo "" | tee -a "$LOG_FILE"
fi

echo "========================================" | tee -a "$LOG_FILE"
echo -e "TOTAL: ${GREEN}$TOTAL_PASSED passed${NC}, ${RED}$TOTAL_FAILED failed${NC}" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Completed: $(date)" | tee -a "$LOG_FILE"

if [ $TOTAL_FAILED -gt 0 ]; then
    echo "" | tee -a "$LOG_FILE"
    echo -e "${RED}SOME TESTS FAILED${NC}" | tee -a "$LOG_FILE"
    exit 1
else
    # Write a "full test pass" stamp that publishing can trust to skip re-running tests.
    #
    # Airplane-grade rule:
    # - Only stamp unfiltered, full runs (no --quick, no --no-unit, no --filter).
    # - Never overwrite the stamp on filtered/partial runs.
    if [ "$QUICK_MODE" = false ] && [ "$SKIP_UNIT" = false ] && [ ${#FILTER_PATTERNS[@]} -eq 0 ]; then
        STAMP_FILE="$ROOT_DIR/.tests/run-all-last-success.json"
        GIT_HEAD="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
        GIT_DIRTY="$(git -C "$ROOT_DIR" status --porcelain 2>/dev/null || true)"
        if [ -z "$GIT_DIRTY" ] && [ -n "$GIT_HEAD" ]; then
            STAMP_TMP="${STAMP_FILE}.tmp"
            STAMP_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
            cat >"$STAMP_TMP" <<EOF
{
  "gitHead": "$GIT_HEAD",
  "gitDirty": false,
  "timestamp": "$STAMP_TS",
  "logFile": "$LOG_FILE",
  "args": {
    "quick": false,
    "skipUnit": false,
    "filters": [],
    "resume": $([ "$RESUME_MODE" = true ] && echo true || echo false)
  }
}
EOF
            mv "$STAMP_TMP" "$STAMP_FILE"
            echo "Full test stamp written to: $STAMP_FILE" | tee -a "$LOG_FILE"
        elif [ -n "$GIT_HEAD" ]; then
            echo -e "${YELLOW}NOTE: Full test stamp not written because repo has uncommitted changes.${NC}" | tee -a "$LOG_FILE"
        fi
    fi

    echo "" | tee -a "$LOG_FILE"
    echo -e "${GREEN}ALL TESTS PASSED${NC}" | tee -a "$LOG_FILE"
    exit 0
fi
