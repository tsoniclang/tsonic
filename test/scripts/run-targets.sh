#!/bin/bash

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

print_help() {
    cat <<EOF
Usage: ./test/scripts/run-targets.sh [target flags] [-- <extra mocha args>]

Target flags:
  --frontend            Run \`npm run test:frontend\`
  --backend             Run \`npm run test:backend\`
  --emitter             Run \`npm run test:emitter\`
  --cli                 Run \`npm run test:cli\`
  --all                 Run all unit/golden targets above

Other options:
  -h, --help            Show this help

Examples:
  ./test/scripts/run-targets.sh --frontend
  ./test/scripts/run-targets.sh --frontend -- --grep "surface isolation"
  ./test/scripts/run-targets.sh --frontend --emitter -- --grep "Uint8Array"

Notes:
  - Output is always mirrored into \`.tests/run-targets-<targets>-<timestamp>.log\`
  - Extra args after \`--\` are forwarded to every selected target.
EOF
}

TARGETS=()
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
    case "${1:-}" in
        --frontend)
            TARGETS+=("frontend")
            shift
            ;;
        --backend)
            TARGETS+=("backend")
            shift
            ;;
        --emitter)
            TARGETS+=("emitter")
            shift
            ;;
        --cli)
            TARGETS+=("cli")
            shift
            ;;
        --all)
            TARGETS=("frontend" "backend" "emitter" "cli")
            shift
            ;;
        --)
            shift
            EXTRA_ARGS=("$@")
            break
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            echo "FAIL: unknown argument: $1" >&2
            print_help >&2
            exit 2
            ;;
    esac
done

if [ ${#TARGETS[@]} -eq 0 ]; then
    echo "FAIL: select at least one target flag (or use --all)" >&2
    print_help >&2
    exit 2
fi

declare -A seen_targets=()
DEDUPED_TARGETS=()
for target in "${TARGETS[@]}"; do
    if [ -n "${seen_targets[$target]:-}" ]; then
        continue
    fi
    seen_targets[$target]=1
    DEDUPED_TARGETS+=("$target")
done
TARGETS=("${DEDUPED_TARGETS[@]}")

mkdir -p "$ROOT_DIR/.tests"

target_slug="$(IFS=-; echo "${TARGETS[*]}")"
LOG_FILE="$ROOT_DIR/.tests/run-targets-$target_slug-$(date +%Y%m%d-%H%M%S).log"

declare -A script_names=(
    [frontend]="test:frontend"
    [backend]="test:backend"
    [emitter]="test:emitter"
    [cli]="test:cli"
)

declare -A pretty_names=(
    [frontend]="Frontend"
    [backend]="Backend"
    [emitter]="Emitter"
    [cli]="CLI"
)

declare -A statuses=()
FAILED_TARGETS=()

{
    echo "=== Tsonic Target Test Run ==="
    echo "Branch:  $(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || echo 'unknown')"
    echo "Commit:  $(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    echo "Started: $(date)"
    echo "Targets: ${TARGETS[*]}"
    if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
        printf 'Extra args:'
        for arg in "${EXTRA_ARGS[@]}"; do
            printf ' %q' "$arg"
        done
        printf '\n'
    fi
    echo "Log: $LOG_FILE"
    echo
} | tee "$LOG_FILE"

cd "$ROOT_DIR"

for target in "${TARGETS[@]}"; do
    script_name="${script_names[$target]}"
    pretty_name="${pretty_names[$target]}"

    {
        echo "--- Running $pretty_name Tests ---"
        printf 'Command: npm run %s' "$script_name"
        if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
            printf ' --'
            for arg in "${EXTRA_ARGS[@]}"; do
                printf ' %q' "$arg"
            done
        fi
        printf '\n'
    } | tee -a "$LOG_FILE"

    if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
        if npm run "$script_name" -- "${EXTRA_ARGS[@]}" 2>&1 | tee -a "$LOG_FILE"; then
            statuses[$target]="passed"
        else
            statuses[$target]="failed"
            FAILED_TARGETS+=("$target")
        fi
    else
        if npm run "$script_name" 2>&1 | tee -a "$LOG_FILE"; then
            statuses[$target]="passed"
        else
            statuses[$target]="failed"
            FAILED_TARGETS+=("$target")
        fi
    fi

    echo | tee -a "$LOG_FILE"
done

{
    echo "=== Summary ==="
    for target in "${TARGETS[@]}"; do
        printf '%s: %s\n' "${pretty_names[$target]}" "${statuses[$target]}"
    done
    echo "Finished: $(date)"
    echo "Log: $LOG_FILE"
} | tee -a "$LOG_FILE"

if [ ${#FAILED_TARGETS[@]} -gt 0 ]; then
    exit 1
fi

exit 0
