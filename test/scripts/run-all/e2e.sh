ensure_result_parent() {
    local target_file="$1"
    mkdir -p "$(dirname "$target_file")"
}

write_result_file() {
    local target_file="$1"
    local value="$2"
    ensure_result_parent "$target_file"
    printf '%s\n' "$value" >"$target_file"
}

append_error_file() {
    local target_file="$1"
    local value="$2"
    ensure_result_parent "$target_file"
    printf '%s\n' "$value" >>"$target_file"
}

run_dotnet_test() {
    local fixture_dir="$1"
    local results_dir="$2"
    local started_ms
    started_ms="$(now_ms)"
    local fixture_name
    fixture_name=$(basename "$fixture_dir")
    local result_file="$results_dir/$fixture_name"
    local error_file="$results_dir/${fixture_name}.error"
    local result=""

    ensure_result_parent "$result_file"
    ensure_result_parent "$error_file"

    if [ "$RESUME_MODE" = true ] && [ -f "$result_file" ]; then
        prev=$(cat "$result_file" 2>/dev/null || true)
        if [[ "$prev" == PASS* ]]; then
            local elapsed_ms
            elapsed_ms=$(( $(now_ms) - started_ms ))
            echo -e "  $fixture_name: \033[1;33mSKIP (cached PASS, $(format_duration_ms "$elapsed_ms"))\033[0m"
            return
        fi
    fi

    echo -e "  $fixture_name: \033[0;36mSTART\033[0m"

    cd "$fixture_dir"

    if [ "${E2E_NPM_INSTALL:-0}" != "1" ]; then
        rm -rf node_modules 2>/dev/null || true
    fi

    if [ -f "package.json" ] && [ "${E2E_NPM_INSTALL:-0}" = "1" ]; then
        npm install --silent --no-package-lock
    elif [ "${E2E_NPM_INSTALL:-0}" != "1" ]; then
        mkdir -p node_modules/@tsonic
        dotnet_major=$(node -e 'const fs=require("fs"); try { const cfg=JSON.parse(fs.readFileSync("tsonic.workspace.json","utf8")); const dv=String(cfg.dotnetVersion ?? "net10.0"); const m=dv.match(/net(\\d+)/); console.log(m ? m[1] : "10"); } catch { console.log("10"); }' 2>/dev/null || echo "10")
        deps="$(collect_fixture_tsonic_packages "$fixture_dir" || true)"

        while IFS= read -r pkg; do
            [ -n "$pkg" ] || continue
            name="${pkg#@tsonic/}"
            dest="node_modules/@tsonic/$name"
            if [ -e "$dest" ]; then
                continue
            fi

            resolved_pkg="$(resolve_local_tsonic_package_dest "$pkg" "$dotnet_major" || true)"
            if [ -n "$resolved_pkg" ]; then
                ln -s "$resolved_pkg" "$dest"
                continue
            fi

            sibling="$ROOT_DIR/../$name"
            append_error_file "$error_file" "FAIL: missing dependency $pkg. Set E2E_NPM_INSTALL=1 to install from npm, or clone the repo at $sibling."
            result="FAIL (missing deps, $(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
            write_result_file "$result_file" "$result"
            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
            return
        done <<<"$deps"
    fi

    build_args=("build" "--project" "$fixture_name" "--config" "tsonic.workspace.json")

    ensure_result_parent "$error_file"
    if node "$TSONIC_BIN" "${build_args[@]}" 2>"$error_file"; then
        run_postbuild_commands "$fixture_dir" "$error_file" || {
            result="FAIL (post-build error, $(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
            write_result_file "$result_file" "$result"
            echo -e "  $fixture_name: \033[0;31m$result\033[0m"
            return
        }

        local exe_path
        exe_path="$(resolve_fixture_executable "$fixture_name")"
        if [ -n "$exe_path" ] && [ -x "$exe_path" ]; then
            if [ -f "expected-output.txt" ]; then
                actual=$("$exe_path" 2>&1 || true)
                expected=$(cat expected-output.txt)
                if [ "$actual" = "$expected" ]; then
                    result="PASS ($(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
                else
                    result="FAIL (output mismatch, $(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
                fi
            elif "$exe_path" >/dev/null 2>&1; then
                result="PASS ($(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
            else
                result="FAIL (runtime error, $(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
            fi
        else
            result="PASS (build only, $(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
        fi
    else
        result="FAIL (build error, $(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
    fi

    write_result_file "$result_file" "$result"
    if [[ "$result" == PASS* ]]; then
        echo -e "  $fixture_name: \033[0;32m$result\033[0m"
    else
        echo -e "  $fixture_name: \033[0;31m$result\033[0m"
    fi
}

run_postbuild_commands() {
    local fixture_dir="$1"
    local error_file="$2"
    local meta_file="$fixture_dir/e2e.meta.json"
    if [ ! -f "$meta_file" ]; then
        return 0
    fi

    postbuild_items=()
    while IFS= read -r -d '' item; do
        postbuild_items+=("$item")
    done < <(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const pb=m.postBuild; if(!pb||!Array.isArray(pb.commands)||pb.commands.length===0){process.exit(0);} const parts=[String(pb.workingDirectory ?? ""), ...pb.commands.map(String)]; process.stdout.write(parts.join("\\0") + "\\0");' "$meta_file" 2>/dev/null || true)

    if [ "${#postbuild_items[@]}" -le 1 ]; then
        return 0
    fi

    local postbuild_cwd="${postbuild_items[0]}"
    local postbuild_cmds=("${postbuild_items[@]:1}")
    if [ -n "$postbuild_cwd" ]; then
        pushd "$fixture_dir/$postbuild_cwd" >/dev/null || {
            append_error_file "$error_file" "FAIL: postBuild workingDirectory not found: $postbuild_cwd"
            return 1
        }
    else
        pushd "$fixture_dir" >/dev/null
    fi

    local cmd
    for cmd in "${postbuild_cmds[@]}"; do
        append_error_file "$error_file" "=== postBuild: $cmd"
        if ! bash -lc "$cmd" >>"$error_file" 2>&1; then
            popd >/dev/null
            return 1
        fi
    done

    popd >/dev/null
    return 0
}

resolve_fixture_executable() {
    local fixture_name="$1"
    local project_root="packages/$fixture_name"
    local out_dir="$project_root/out"
    local output_name="$fixture_name"
    local generated_subdir="generated"

    if [ -f "$project_root/tsonic.json" ]; then
        cfg_vals=$(node -e 'const fs=require("fs"); const cfg=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(String(cfg.outputName ?? "")); console.log(String(cfg.outputDirectory ?? ""));' "$project_root/tsonic.json" 2>/dev/null || true)
        cfg_output_name=$(printf "%s" "$cfg_vals" | sed -n '1p')
        cfg_output_dir=$(printf "%s" "$cfg_vals" | sed -n '2p')
        if [ -n "$cfg_output_name" ]; then output_name="$cfg_output_name"; fi
        if [ -n "$cfg_output_dir" ]; then generated_subdir="$cfg_output_dir"; fi
    fi

    local generated_dir="$project_root/$generated_subdir"
    local exe_path=""
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

    printf '%s' "$exe_path"
}

collect_dotnet_fixtures() {
    DOTNET_FIXTURES=()
    for fixture_dir in "$FIXTURES_DIR"/*/; do
        config_file="$fixture_dir/tsonic.workspace.json"
        if [ ! -f "$config_file" ]; then
            continue
        fi
        meta_file="$fixture_dir/e2e.meta.json"
        if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
            continue
        fi
        if ! matches_filter "$(basename "$fixture_dir")"; then
            continue
        fi
        DOTNET_FIXTURES+=("$fixture_dir")
    done
}

run_dotnet_test_batch() {
    collect_dotnet_fixtures
    local worker_script="$SCRIPT_DIR/run-all/e2e-worker.sh"
    for fixture_dir in "${DOTNET_FIXTURES[@]}"; do
        while [ "$(jobs -r | wc -l)" -ge "$TEST_CONCURRENCY" ]; do
            sleep 0.1
        done
        (
            ROOT_DIR="$ROOT_DIR" \
            TSONIC_BIN="$TSONIC_BIN" \
            RESUME_MODE="$RESUME_MODE" \
            E2E_NPM_INSTALL="${E2E_NPM_INSTALL:-0}" \
            bash "$worker_script" dotnet "$fixture_dir" "$RESULTS_DIR"
        ) &
    done
    wait

    for fixture_dir in "${DOTNET_FIXTURES[@]}"; do
        fixture_name=$(basename "$fixture_dir")
        result_file="$RESULTS_DIR/$fixture_name"
        error_file="$RESULTS_DIR/${fixture_name}.error"
        if [ -f "$result_file" ]; then
            result=$(cat "$result_file")
            echo "  $fixture_name: $result" >> "$LOG_FILE"
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
}

run_negative_test() {
    local fixture_dir="$1"
    local results_dir="$2"
    local started_ms
    started_ms="$(now_ms)"
    local fixture_name
    fixture_name=$(basename "$fixture_dir")
    local result_file="$results_dir/neg_$fixture_name"
    local result=""

    ensure_result_parent "$result_file"

    if [ "$RESUME_MODE" = true ] && [ -f "$result_file" ]; then
        prev=$(cat "$result_file" 2>/dev/null || true)
        if [[ "$prev" == PASS* ]]; then
            local elapsed_ms
            elapsed_ms=$(( $(now_ms) - started_ms ))
            echo -e "  $fixture_name: \033[1;33mSKIP (cached PASS, $(format_duration_ms "$elapsed_ms"))\033[0m"
            return
        fi
    fi

    echo -e "  $fixture_name: \033[0;36mSTART (negative)\033[0m"

    if [ ! -f "$fixture_dir/tsonic.workspace.json" ]; then
        result="FAIL (no config, $(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
        write_result_file "$result_file" "$result"
        echo -e "  $fixture_name: \033[0;31m$result\033[0m"
        return
    fi

    cd "$fixture_dir"
    if [ -f "package.json" ] && [ "${E2E_NPM_INSTALL:-0}" = "1" ]; then
        npm install --silent --no-package-lock
    fi

    build_args=("build" "--project" "$fixture_name" "--config" "tsonic.workspace.json")
    if node "$TSONIC_BIN" "${build_args[@]}" >/dev/null 2>&1; then
        result="FAIL (expected error but succeeded, $(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
    else
        result="PASS (failed as expected, $(format_duration_ms "$(( $(now_ms) - started_ms ))"))"
    fi

    write_result_file "$result_file" "$result"
    if [[ "$result" == PASS* ]]; then
        echo -e "  $fixture_name: \033[0;32m$result\033[0m"
    else
        echo -e "  $fixture_name: \033[0;31m$result\033[0m"
    fi
}

collect_negative_fixtures() {
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
}

run_negative_test_batch() {
    collect_negative_fixtures
    if [ ${#NEGATIVE_FIXTURES[@]} -eq 0 ]; then
        return
    fi

    local worker_script="$SCRIPT_DIR/run-all/e2e-worker.sh"
    for fixture_dir in "${NEGATIVE_FIXTURES[@]}"; do
        while [ "$(jobs -r | wc -l)" -ge "$TEST_CONCURRENCY" ]; do
            sleep 0.1
        done
        (
            ROOT_DIR="$ROOT_DIR" \
            TSONIC_BIN="$TSONIC_BIN" \
            RESUME_MODE="$RESUME_MODE" \
            E2E_NPM_INSTALL="${E2E_NPM_INSTALL:-0}" \
            bash "$worker_script" negative "$fixture_dir" "$RESULTS_DIR"
        ) &
    done
    wait

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
}
