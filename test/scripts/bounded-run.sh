#!/usr/bin/env bash
set -euo pipefail

profile="$1"
shift
script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for ((index = 1; index <= $#; index++)); do
  if [[ "${!index}" == "--concurrency" ]]; then
    following=$((index + 1))
    export TSONIC_TEST_WORKERS="${!following}"
  fi
done
selected_budget="$(node "$script_root/test-resource-budget.mjs" "$profile")"
export TSONIC_TEST_RESOURCE_BUDGET="$selected_budget"
read -r test_concurrency memory_mebibytes cargo_build_jobs heap_megabytes cpu_budget < <(
  node --input-type=module -e 'const budget=JSON.parse(process.env.TSONIC_TEST_RESOURCE_BUDGET); console.log(budget.workers,budget.memoryMiB,budget.childJobs,budget.heapMiB,budget.cpuBudget);'
)
export TSONIC_TEST_WORKERS="$test_concurrency"
export TSONIC_TEST_CPUS="$cpu_budget"
export DOTNET_PROCESSOR_COUNT="$cargo_build_jobs"
memory_max="${memory_mebibytes}M"
tasks_max="${TSONIC_TEST_TASKS_MAX:-2048}"
timeout_seconds="${TSONIC_TEST_TIMEOUT_SECONDS:-7200}"
heartbeat_seconds="${TSONIC_TEST_HEARTBEAT_SECONDS:-60}"
failure_excerpt_bytes="${TSONIC_TEST_FAILURE_EXCERPT_BYTES:-16384}"
log_size_max_bytes="${TSONIC_TEST_LOG_SIZE_MAX_BYTES:-67108864}"
for value in "$tasks_max" "$timeout_seconds" "$heartbeat_seconds" "$failure_excerpt_bytes" "$log_size_max_bytes"; do
  if ! [[ "$value" =~ ^[1-9][0-9]*$ ]]; then
    printf "Test guard settings must be positive integers.\n" >&2
    exit 2
  fi
done

for required_command in node systemd-run systemctl tail timeout; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    printf 'Required bounded-test command is unavailable: %s\n' "${required_command}" >&2
    exit 2
  fi
done

export NODE_OPTIONS="${NODE_OPTIONS:+${NODE_OPTIONS} }--max-old-space-size=${heap_megabytes}"
export CARGO_BUILD_JOBS="${cargo_build_jobs}"
export RUST_TEST_THREADS="${cargo_build_jobs}"
export MSBUILDDISABLENODEREUSE=1
export DOTNET_CLI_USE_MSBUILD_SERVER=0
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export UseSharedCompilation=false
if [[ -n "${TSONIC_TEST_CALIBRATION_SECONDS:-}" ]]; then
  node "$script_root/calibrate-utilization.mjs" --validate
fi

mkdir -p .temp/test-runs
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
unit="tsonic-${profile}-tests-${run_id}.scope"
log_file=".temp/test-runs/${run_id}.log"
memory_events="/sys/fs/cgroup/user.slice/user-$(id -u).slice/memory.events"

read_oom_kill_count() {
  if [[ ! -r "${memory_events}" ]]; then
    printf 'unavailable\n'
    return
  fi
  awk '$1 == "oom_kill" { print $2 }' "${memory_events}"
}

oom_kill_before="$(read_oom_kill_count)"
start_epoch="$(date +%s)"
printf 'Tsonic %s bounded test run\n' "$profile"
printf '  unit: %s\n' "${unit}"
printf '  log: %s\n' "${log_file}"
printf '  workers: %s\n' "${test_concurrency}"
printf '  nested Cargo jobs: %s per Cargo invocation\n' "${cargo_build_jobs}"
printf '  heap per worker: %s MiB\n' "${heap_megabytes}"
printf '  process-group memory ceiling: %s\n' "${memory_max}"
printf '  process-group swap ceiling: 0\n'
printf '  process-group task ceiling: %s\n' "${tasks_max}"
printf '  hard timeout: %s seconds\n' "${timeout_seconds}"
printf '  heartbeat: %s seconds\n' "${heartbeat_seconds}"
printf '  live test output: log-only; failure excerpt capped at %s bytes\n' "${failure_excerpt_bytes}"
printf '  complete-log size ceiling: %s bytes\n' "${log_size_max_bytes}"
printf '  user-slice oom_kill before: %s\n' "${oom_kill_before}"

set +e
(
  systemd-run \
    --user \
    --scope \
    --quiet \
    --unit="${unit%.scope}" \
    --property="MemoryMax=${memory_max}" \
    --property="MemorySwapMax=0" \
    --property="TasksMax=${tasks_max}" \
    timeout \
      --signal=TERM \
      --kill-after=30s \
      "${timeout_seconds}s" \
      "$@" \
    >"${log_file}" 2>&1
) &
test_runner_pid=$!

heartbeat_pid=""
log_guard_pid=""
calibration_pid=""
stop_bounded_test_scope() {
  if [[ -n "${calibration_pid}" ]]; then
    kill "${calibration_pid}" 2>/dev/null || true
  fi
  if [[ -n "${heartbeat_pid}" ]]; then
    kill "${heartbeat_pid}" 2>/dev/null || true
  fi
  if [[ -n "${log_guard_pid}" ]]; then
    kill "${log_guard_pid}" 2>/dev/null || true
  fi
  if kill -0 "${test_runner_pid}" 2>/dev/null; then
    systemctl --user stop "${unit}" --no-block 2>/dev/null || true
    kill "${test_runner_pid}" 2>/dev/null || true
  fi
}
trap stop_bounded_test_scope EXIT HUP INT TERM

if [[ -n "${TSONIC_TEST_CALIBRATION_SECONDS:-}" ]]; then
  node "$script_root/calibrate-utilization.mjs" "$unit" "$test_runner_pid" "$log_file" &
  calibration_pid=$!
fi

(
  while kill -0 "${test_runner_pid}" 2>/dev/null; do
    sleep "${heartbeat_seconds}"
    if ! kill -0 "${test_runner_pid}" 2>/dev/null; then
      break
    fi
    elapsed_seconds=$(( $(date +%s) - start_epoch ))
    printf '[heartbeat] %s remains active; elapsed=%ss\n' "${unit}" "${elapsed_seconds}"
    systemctl --user show "${unit}" \
      --property=MemoryCurrent \
      --property=MemoryPeak \
      --property=TasksCurrent \
      --property=CPUUsageNSec \
      --no-pager 2>/dev/null || true
  done
) &
heartbeat_pid=$!

(
  while kill -0 "${test_runner_pid}" 2>/dev/null; do
    sleep 1
    log_bytes="$(wc -c <"${log_file}")"
    if (( log_bytes > log_size_max_bytes )); then
      systemctl --user stop "${unit}" --no-block 2>/dev/null || true
      kill "${test_runner_pid}" 2>/dev/null || true
      break
    fi
  done
) &
log_guard_pid=$!

wait "${test_runner_pid}"
test_status=$?
if [[ -n "$calibration_pid" ]]; then
  kill "$calibration_pid" 2>/dev/null || true
  wait "$calibration_pid" 2>/dev/null || true
  calibration_pid=""
fi
kill "${heartbeat_pid}" 2>/dev/null || true
wait "${heartbeat_pid}" 2>/dev/null || true
heartbeat_pid=""
kill "${log_guard_pid}" 2>/dev/null || true
wait "${log_guard_pid}" 2>/dev/null || true
log_guard_pid=""
trap - EXIT HUP INT TERM
set -e

oom_kill_after="$(read_oom_kill_count)"
scope_result="$(systemctl --user show "${unit}" --property=Result --value --no-pager 2>/dev/null || true)"
printf '  exit status: %s\n' "${test_status}"
printf '  scope result: %s\n' "${scope_result:-unavailable}"
printf '  user-slice oom_kill after: %s\n' "${oom_kill_after}"
printf '  complete log: %s (%s bytes)\n' "${log_file}" "$(wc -c <"${log_file}")"

log_size_after="$(wc -c <"${log_file}")"
if (( log_size_after > log_size_max_bytes )); then
  printf 'Bounded test log exceeded its %s-byte ceiling; inspect %s.\n' \
    "${log_size_max_bytes}" \
    "${log_file}" >&2
  exit 153
fi

if (( test_status != 0 )); then
  printf '\nLast %s bytes of failed run (complete output remains in %s):\n' \
    "${failure_excerpt_bytes}" \
    "${log_file}" >&2
  tail -c "${failure_excerpt_bytes}" "${log_file}" >&2
  printf '\n' >&2
fi

if [[ "${scope_result}" == "oom-kill" ]]; then
  printf 'Bounded test scope exhausted its memory ceiling; inspect %s.\n' "${log_file}" >&2
  exit 137
fi

if [[ "${oom_kill_before}" != "unavailable" && "${oom_kill_after}" != "unavailable" &&
  "${oom_kill_after}" -gt "${oom_kill_before}" ]]; then
  printf 'System OOM kill count increased during the test run; inspect %s.\n' "${log_file}" >&2
  exit 137
fi

if [[ -n "${TSONIC_TEST_CALIBRATION_SECONDS:-}" ]]; then
  if [[ -f "$log_file.calibration.json" ]]; then
    cat "$log_file.calibration.json"
    if node --input-type=module -e 'import {readFileSync} from "node:fs"; process.exit(JSON.parse(readFileSync(process.argv[1], "utf8")).targetMet ? 0 : 1)' "$log_file.calibration.json"; then
      exit 125
    fi
    exit 126
  fi
  printf 'Calibration ended before a complete measurement window; this is not certification.\n'
  exit 125
fi
exit "${test_status}"
