print_summary_and_exit() {
    print_count_block() {
        local label="$1"
        local status="$2"
        local passed="$3"
        local failed="$4"
        local skipped="$5"
        local wall_ms="$6"
        local count="$7"
        local executed_count="$8"
        local avg_wall_ms
        avg_wall_ms="$(average_ms "$wall_ms" "$executed_count")"

        echo "$label:" | tee -a "$LOG_FILE"
        if [ "$status" = "skipped" ]; then
            echo -e "  ${YELLOW}Skipped${NC}" | tee -a "$LOG_FILE"
        else
            echo -e "  ${GREEN}Passed: $passed${NC}" | tee -a "$LOG_FILE"
            if [ "$failed" -gt 0 ]; then
                echo -e "  ${RED}Failed: $failed${NC}" | tee -a "$LOG_FILE"
            else
                echo "  Failed: 0" | tee -a "$LOG_FILE"
            fi
            echo "  Skipped: $skipped" | tee -a "$LOG_FILE"
            echo "  Count: $count" | tee -a "$LOG_FILE"
            echo "  Executed: $executed_count" | tee -a "$LOG_FILE"
        fi
        echo "  Wall Duration: $(format_duration_ms "$wall_ms")" | tee -a "$LOG_FILE"
        if [ "$executed_count" -gt 0 ]; then
            echo "  Avg Wall / Executed Test: $(format_duration_ms "$avg_wall_ms")" | tee -a "$LOG_FILE"
        fi
        echo "" | tee -a "$LOG_FILE"
    }

    print_duration_breakdown() {
        local label="$1"
        local passed="$2"
        local failed="$3"
        local skipped="$4"
        local count="$5"
        local duration_sum_ms="$6"
        local avg_ms="$7"

        echo "$label:" | tee -a "$LOG_FILE"
        echo -e "  ${GREEN}Passed: $passed${NC}" | tee -a "$LOG_FILE"
        if [ "$failed" -gt 0 ]; then
            echo -e "  ${RED}Failed: $failed${NC}" | tee -a "$LOG_FILE"
        else
            echo "  Failed: 0" | tee -a "$LOG_FILE"
        fi
        echo "  Skipped: $skipped" | tee -a "$LOG_FILE"
        echo "  Count: $count" | tee -a "$LOG_FILE"
        echo "  Test Duration Sum: $(format_duration_ms "$duration_sum_ms")" | tee -a "$LOG_FILE"
        if [ "$count" -gt 0 ]; then
            echo "  Avg Test Duration: $(format_duration_ms "$avg_ms")" | tee -a "$LOG_FILE"
        fi
        echo "" | tee -a "$LOG_FILE"
    }

    print_phase_status_block() {
        local label="$1"
        local status="$2"
        local duration_ms="$3"
        local skipped_note="${4:-}"

        echo "$label:" | tee -a "$LOG_FILE"
        case "$status" in
            skipped)
                if [ -n "$skipped_note" ]; then
                    echo -e "  ${YELLOW}Skipped${NC} ($skipped_note)" | tee -a "$LOG_FILE"
                else
                    echo -e "  ${YELLOW}Skipped${NC}" | tee -a "$LOG_FILE"
                fi
                ;;
            passed)
                echo -e "  ${GREEN}Passed${NC}" | tee -a "$LOG_FILE"
                ;;
            failed)
                echo -e "  ${RED}Failed${NC}" | tee -a "$LOG_FILE"
                ;;
            *)
                echo "  Status: $status" | tee -a "$LOG_FILE"
                ;;
        esac
        echo "  Duration: $(format_duration_ms "$duration_ms")" | tee -a "$LOG_FILE"
        echo "" | tee -a "$LOG_FILE"
    }

    print_fixture_block() {
        local label="$1"
        local status="$2"
        local passed="$3"
        local failed="$4"
        local duration_ms="$5"
        local skipped_note="${6:-}"

        echo "$label:" | tee -a "$LOG_FILE"
        if [ "$status" = "skipped" ]; then
            if [ -n "$skipped_note" ]; then
                echo -e "  ${YELLOW}Skipped${NC} ($skipped_note)" | tee -a "$LOG_FILE"
            else
                echo -e "  ${YELLOW}Skipped${NC}" | tee -a "$LOG_FILE"
            fi
        else
            echo -e "  ${GREEN}Passed: $passed${NC}" | tee -a "$LOG_FILE"
            if [ "$failed" -gt 0 ]; then
                echo -e "  ${RED}Failed: $failed${NC}" | tee -a "$LOG_FILE"
            else
                echo "  Failed: 0" | tee -a "$LOG_FILE"
            fi
        fi
        echo "  Duration: $(format_duration_ms "$duration_ms")" | tee -a "$LOG_FILE"
        if [ "$status" != "skipped" ] && [ $((passed + failed)) -gt 0 ]; then
            echo "  Avg Wall / Fixture: $(format_duration_ms "$(average_ms "$duration_ms" "$((passed + failed))")")" | tee -a "$LOG_FILE"
        fi
        echo "" | tee -a "$LOG_FILE"
    }

    echo "" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "           TEST SUMMARY REPORT          " | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    TOTAL_PASSED=$((FRESH_BUILD_PASSED + RELEASE_SMOKE_PASSED + UNIT_PASSED + TSC_PASSED + E2E_DOTNET_PASSED + E2E_NEGATIVE_PASSED))
    TOTAL_FAILED=$((FRESH_BUILD_FAILED + RELEASE_SMOKE_FAILED + UNIT_FAILED + TSC_FAILED + E2E_DOTNET_FAILED + E2E_NEGATIVE_FAILED))

    echo "Fresh Workspace Build:" | tee -a "$LOG_FILE"
    if [ "$FRESH_BUILD_STATUS" = "skipped" ]; then
        echo -e "  ${YELLOW}Skipped (--no-unit)${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "  ${GREEN}Passed: $FRESH_BUILD_PASSED${NC}" | tee -a "$LOG_FILE"
        if [ $FRESH_BUILD_FAILED -gt 0 ]; then
            echo -e "  ${RED}Failed: $FRESH_BUILD_FAILED${NC}" | tee -a "$LOG_FILE"
        else
            echo "  Failed: 0" | tee -a "$LOG_FILE"
        fi
    fi
    echo "  Duration: $(format_duration_ms "$FRESH_BUILD_DURATION_MS")" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    print_phase_status_block "Release Package Smoke" "$RELEASE_SMOKE_STATUS" "$RELEASE_SMOKE_DURATION_MS"

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
    echo "  Wall Duration: $(format_duration_ms "$UNIT_DURATION_MS")" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    if [ "$UNIT_STATUS" != "skipped" ]; then
        print_count_block "Frontend Tests" "$FRONTEND_STATUS" "$FRONTEND_ALL_PASSED" "$FRONTEND_ALL_FAILED" "$FRONTEND_ALL_SKIPPED" "$FRONTEND_DURATION_MS" "$FRONTEND_ALL_COUNT" "$FRONTEND_ALL_EXECUTED_COUNT"
        print_duration_breakdown "Frontend Test Durations" "$FRONTEND_ALL_PASSED" "$FRONTEND_ALL_FAILED" "$FRONTEND_ALL_SKIPPED" "$FRONTEND_ALL_COUNT" "$FRONTEND_ALL_TEST_DURATION_SUM_MS" "$FRONTEND_ALL_TEST_AVG_MS"
        print_count_block "Backend Tests" "$BACKEND_STATUS" "$BACKEND_ALL_PASSED" "$BACKEND_ALL_FAILED" "$BACKEND_ALL_SKIPPED" "$BACKEND_DURATION_MS" "$BACKEND_ALL_COUNT" "$BACKEND_ALL_EXECUTED_COUNT"
        print_duration_breakdown "Backend Test Durations" "$BACKEND_ALL_PASSED" "$BACKEND_ALL_FAILED" "$BACKEND_ALL_SKIPPED" "$BACKEND_ALL_COUNT" "$BACKEND_ALL_TEST_DURATION_SUM_MS" "$BACKEND_ALL_TEST_AVG_MS"
        print_count_block "Emitter Tests" "$EMITTER_STATUS" "$EMITTER_ALL_PASSED" "$EMITTER_ALL_FAILED" "$EMITTER_ALL_SKIPPED" "$EMITTER_DURATION_MS" "$EMITTER_ALL_COUNT" "$EMITTER_ALL_EXECUTED_COUNT"
        print_duration_breakdown "Emitter All Test Durations" "$EMITTER_ALL_PASSED" "$EMITTER_ALL_FAILED" "$EMITTER_ALL_SKIPPED" "$EMITTER_ALL_COUNT" "$EMITTER_ALL_TEST_DURATION_SUM_MS" "$EMITTER_ALL_TEST_AVG_MS"
        print_duration_breakdown "Emitter Regular Subgroup" "$EMITTER_REGULAR_PASSED" "$EMITTER_REGULAR_FAILED" "$EMITTER_REGULAR_SKIPPED" "$EMITTER_REGULAR_COUNT" "$EMITTER_REGULAR_TEST_DURATION_SUM_MS" "$EMITTER_REGULAR_TEST_AVG_MS"
        print_duration_breakdown "Emitter Golden Subgroup" "$EMITTER_GOLDEN_PASSED" "$EMITTER_GOLDEN_FAILED" "$EMITTER_GOLDEN_SKIPPED" "$EMITTER_GOLDEN_COUNT" "$EMITTER_GOLDEN_TEST_DURATION_SUM_MS" "$EMITTER_GOLDEN_TEST_AVG_MS"
        print_count_block "CLI Tests" "$CLI_STATUS" "$CLI_ALL_PASSED" "$CLI_ALL_FAILED" "$CLI_ALL_SKIPPED" "$CLI_DURATION_MS" "$CLI_ALL_COUNT" "$CLI_ALL_EXECUTED_COUNT"
        print_duration_breakdown "CLI Test Durations" "$CLI_ALL_PASSED" "$CLI_ALL_FAILED" "$CLI_ALL_SKIPPED" "$CLI_ALL_COUNT" "$CLI_ALL_TEST_DURATION_SUM_MS" "$CLI_ALL_TEST_AVG_MS"
    fi

    if [ "$TSC_STATUS" = "skipped" ]; then
        print_fixture_block "TypeScript Typecheck" "skipped" "$TSC_PASSED" "$TSC_FAILED" "$TSC_DURATION_MS" "--no-fixtures/--fast"
    else
        print_fixture_block "TypeScript Typecheck" "$TSC_STATUS" "$TSC_PASSED" "$TSC_FAILED" "$TSC_DURATION_MS"
    fi

    runtime_skip_note=""
    if [ "$SKIP_FIXTURES" = true ]; then
        runtime_skip_note="--no-fixtures/--fast"
    elif [ "$QUICK_MODE" = true ]; then
        runtime_skip_note="--quick"
    fi

    e2e_dotnet_status="passed"
    if [ "$SKIP_FIXTURES" = true ] || [ "$QUICK_MODE" = true ]; then
        e2e_dotnet_status="skipped"
    elif [ "$E2E_DOTNET_FAILED" -gt 0 ]; then
        e2e_dotnet_status="failed"
    elif [ $((E2E_DOTNET_PASSED + E2E_DOTNET_FAILED)) -eq 0 ]; then
        e2e_dotnet_status="skipped"
    fi

    e2e_negative_status="passed"
    if [ "$SKIP_FIXTURES" = true ] || [ "$QUICK_MODE" = true ]; then
        e2e_negative_status="skipped"
    elif [ "$E2E_NEGATIVE_FAILED" -gt 0 ]; then
        e2e_negative_status="failed"
    elif [ $((E2E_NEGATIVE_PASSED + E2E_NEGATIVE_FAILED)) -eq 0 ]; then
        e2e_negative_status="skipped"
    fi

    print_phase_status_block "Core Runtime DLL Sync" "$RUNTIME_SYNC_STATUS" "$RUNTIME_SYNC_DURATION_MS" "$runtime_skip_note"
    print_phase_status_block "NativeAOT Preflight" "$AOT_PREFLIGHT_STATUS" "$AOT_PREFLIGHT_DURATION_MS" "$runtime_skip_note"
    print_fixture_block "E2E Dotnet Tests" "$e2e_dotnet_status" "$E2E_DOTNET_PASSED" "$E2E_DOTNET_FAILED" "$E2E_DOTNET_DURATION_MS" "$runtime_skip_note"
    print_fixture_block "Negative Tests" "$e2e_negative_status" "$E2E_NEGATIVE_PASSED" "$E2E_NEGATIVE_FAILED" "$E2E_NEGATIVE_DURATION_MS" "$runtime_skip_note"

    echo "========================================" | tee -a "$LOG_FILE"
    echo -e "TOTAL: ${GREEN}$TOTAL_PASSED passed${NC}, ${RED}$TOTAL_FAILED failed${NC}" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
    echo "Trace saved to: $TRACE_FILE" | tee -a "$LOG_FILE"
    echo "Completed: $(date)" | tee -a "$LOG_FILE"

    if [ $TOTAL_FAILED -gt 0 ]; then
        trace_event run-done scope run status failed totalPassed "$TOTAL_PASSED" totalFailed "$TOTAL_FAILED" logFile "$LOG_FILE" traceFile "$TRACE_FILE"
        echo "" | tee -a "$LOG_FILE"
        echo -e "${RED}SOME TESTS FAILED${NC}" | tee -a "$LOG_FILE"
        exit 1
    fi

    if [ "$QUICK_MODE" = false ] && [ "$SKIP_UNIT" = false ] && [ "$SKIP_CLI" = false ] && [ "$SKIP_FIXTURES" = false ] && [ ${#FILTER_PATTERNS[@]} -eq 0 ]; then
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
    "skipCli": false,
    "skipFixtures": false,
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

    trace_event run-done scope run status passed totalPassed "$TOTAL_PASSED" totalFailed "$TOTAL_FAILED" logFile "$LOG_FILE" traceFile "$TRACE_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo -e "${GREEN}ALL TESTS PASSED${NC}" | tee -a "$LOG_FILE"
    exit 0
}
