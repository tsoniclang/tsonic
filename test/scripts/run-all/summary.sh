print_summary_and_exit() {
    echo "" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "           TEST SUMMARY REPORT          " | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    TOTAL_PASSED=$((FRESH_BUILD_PASSED + UNIT_PASSED + TSC_PASSED + E2E_DOTNET_PASSED + E2E_NEGATIVE_PASSED))
    TOTAL_FAILED=$((FRESH_BUILD_FAILED + UNIT_FAILED + TSC_FAILED + E2E_DOTNET_FAILED + E2E_NEGATIVE_FAILED))

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
    echo "" | tee -a "$LOG_FILE"

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
    fi

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
}
