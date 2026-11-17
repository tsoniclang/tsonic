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

for required_command in node systemd-run systemctl tail timeout flock; do
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
measurement_file="$PWD/.temp/test-runs/${run_id}.measurements.json"
temporary_directory="/tmp/tsonic-tests/$unit"
mkdir -p -m 700 /tmp/tsonic-tests
mkdir -m 700 "$temporary_directory"
export TMPDIR="$temporary_directory" TMP="$temporary_directory" TEMP="$temporary_directory"
export TSONIC_TEST_TEMP_DIRECTORY="$temporary_directory"
export TSONIC_TEST_TEMP_DIRECTORY_REMOVED=false
memory_events="/sys/fs/cgroup/user.slice/user-$(id -u).slice/memory.events"

read_oom_kill_count() {
  if [[ ! -r "${memory_events}" ]]; then
    printf 'unavailable\n'
    return
  fi
  awk '$1 == "oom_kill" { print $2 }' "${memory_events}"
}

oom_kill_before="$(read_oom_kill_count)"
admission_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/tsonic-test-admission"
mkdir -p -m 700 "$admission_root"
exec {admission_fd}>"$admission_root/lock"
admission_state="$admission_root/state.json"
admission_queued_at="$(node -p 'process.hrtime.bigint().toString()')"
while true; do
  flock "$admission_fd"
  admission_status=0
  admission="$(node "$script_root/memory-admission.mjs" acquire "$admission_state" "$unit" "$$" "$memory_mebibytes" "$admission_queued_at")" || admission_status=$?
  flock -u "$admission_fd"
  if (( admission_status == 0 )); then break; fi
  if (( admission_status != 75 )); then exit "$admission_status"; fi
  sleep 1
done
export TSONIC_TEST_ADMISSION="$admission"
export TSONIC_TEST_ADMISSION_LOCK="$admission_root/lock"
export TSONIC_TEST_ADMISSION_STATE="$admission_state"
export TSONIC_TEST_ADMISSION_OWNER="$$"
launch_started=false
scope_drained=false
admission_released=false
release_test_memory() {
  if [[ "$admission_released" == true ]]; then return; fi
  flock "$admission_fd"
  local release_status=0
  node "$script_root/memory-admission.mjs" release "$admission_state" "$unit" "$$" || release_status=$?
  flock -u "$admission_fd"
  if (( release_status == 0 )); then admission_released=true; fi
  return "$release_status"
}
trap 'if [[ "$launch_started" == false ]]; then release_test_memory; fi' EXIT
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
launch_started=true
(
  systemd-run \
    --user \
    --scope \
    --quiet \
    --expand-environment=no \
    --unit="${unit%.scope}" \
    --property="MemoryMax=${memory_max}" \
    --property="Delegate=yes" \
    --property="MemorySwapMax=0" \
    --property="TasksMax=${tasks_max}" \
    env -u TSONIC_TEST_GUARD_REPORT node "$script_root/guard-command.mjs" "$measurement_file" "$timeout_seconds" \
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
  systemctl --user kill "${unit}" --signal=KILL --kill-whom=all 2>/dev/null || true
  systemctl --user stop "${unit}" --no-block 2>/dev/null || true
  if kill -0 "${test_runner_pid}" 2>/dev/null; then
    kill "${test_runner_pid}" 2>/dev/null || true
  fi
}
scope_is_drained() {
  local properties
  properties="$(systemctl --user show "$unit" --property=ControlGroup --property=LoadState --property=ActiveState --no-pager 2>/dev/null)" || return 1
  local group
  group="$(printf '%s\n' "$properties" | sed -n 's/^ControlGroup=//p')"
  if [[ -n "$group" ]]; then
    local group_root="/sys/fs/cgroup${group}"
    if [[ -r "$group_root/cgroup.events" ]]; then
      [[ "$(awk '$1 == "populated" { print $2 }' "$group_root/cgroup.events")" == "0" ]]
      return "$?"
    fi
    return 1
  fi
  [[ "$properties" == *"LoadState=not-found"* && "$properties" == *"ActiveState=inactive"* ]]
}
drain_test_scope() {
  stop_bounded_test_scope
  wait "$test_runner_pid" 2>/dev/null || true
  scope_drained=false
  for ((attempt = 0; attempt < 50; attempt++)); do
    if scope_is_drained; then scope_drained=true; break; fi
    sleep 0.1
  done
}
cleanup_test_scope() {
  if [[ "$scope_drained" != true ]]; then drain_test_scope; fi
  if [[ "$scope_drained" == true ]]; then
    release_test_memory
  else
    printf 'Owned scope is not proven empty; its memory reservation is retained.\n' >&2
  fi
}
trap cleanup_test_scope EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -n "${TSONIC_TEST_CALIBRATION_SECONDS:-}" ]]; then
  node "$script_root/calibrate-utilization.mjs" "$unit" "$test_runner_pid" "$log_file" &
  calibration_pid=$!
fi

guard_watch_sleep_pid=""
stop_guard_watch() {
  if [[ -n "${guard_watch_sleep_pid}" ]]; then
    kill "${guard_watch_sleep_pid}" 2>/dev/null || true
    wait "${guard_watch_sleep_pid}" 2>/dev/null || true
  fi
}
sleep_guard_watch() {
  sleep "$1" &
  guard_watch_sleep_pid=$!
  wait "${guard_watch_sleep_pid}"
  guard_watch_sleep_pid=""
}

(
  trap stop_guard_watch EXIT
  trap 'exit 0' HUP INT TERM
  while kill -0 "${test_runner_pid}" 2>/dev/null; do
    sleep_guard_watch "${heartbeat_seconds}"
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
  trap stop_guard_watch EXIT
  trap 'exit 0' HUP INT TERM
  while kill -0 "${test_runner_pid}" 2>/dev/null; do
    sleep_guard_watch 1
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
scope_result="$(systemctl --user show "${unit}" --property=Result --value --no-pager 2>/dev/null || true)"
drain_test_scope
if [[ "$scope_drained" != true ]]; then
  if (( test_status == 0 )); then test_status=1; fi
  printf 'Bounded test scope did not drain its owned descendants.\n' >&2
fi
trap - HUP INT TERM
set -e

oom_kill_after="$(read_oom_kill_count)"
printf '  exit status: %s\n' "${test_status}"
printf '  scope result: %s\n' "${scope_result:-unavailable}"
printf '  scope drained: %s\n' "${scope_drained}"
printf '  user-slice oom_kill after: %s\n' "${oom_kill_after}"
printf '  complete log: %s (%s bytes)\n' "${log_file}" "$(wc -c <"${log_file}")"

log_size_after="$(wc -c <"${log_file}")"
if (( log_size_after > log_size_max_bytes )); then
  printf 'Bounded test log exceeded its %s-byte ceiling; inspect %s.\n' \
    "${log_size_max_bytes}" \
    "${log_file}" >&2
  test_status=153
fi

if (( test_status != 0 )); then
  printf '\nLast %s bytes of failed run (complete output remains in %s):\n' \
    "${failure_excerpt_bytes}" \
    "${log_file}" >&2
  tail -c "${failure_excerpt_bytes}" "${log_file}" >&2
  printf '\n' >&2
fi

if [[ -f "$measurement_file" ]]; then
  if ! node --input-type=module -e 'import {readFileSync} from "node:fs"; const {guardMeasurementSucceeded}=await import(process.argv[2]); const measured=JSON.parse(readFileSync(process.argv[1], "utf8")); process.exit(guardMeasurementSucceeded(measured) ? 0 : 1)' "$measurement_file" "file://$script_root/guard-cgroup.mjs"; then
    printf 'Bounded command exhausted its memory ceiling or used swap; inspect %s.\n' "$measurement_file" >&2
    test_status=137
  fi
elif (( test_status == 0 )); then
  printf 'Bounded command did not publish its resource measurements.\n' >&2
  test_status=1
fi
if [[ "${scope_result}" == "oom-kill" && ! -f "$measurement_file" ]]; then
  printf 'Bounded test scope exhausted its memory ceiling without recovery evidence; inspect %s.\n' "${log_file}" >&2
  test_status=137
fi

if [[ -n "${TSONIC_TEST_CALIBRATION_SECONDS:-}" && "$test_status" != 137 && "$test_status" != 153 ]]; then
  if [[ -f "$log_file.calibration.json" ]]; then
    cat "$log_file.calibration.json"
    if node --input-type=module -e 'import {readFileSync} from "node:fs"; process.exit(JSON.parse(readFileSync(process.argv[1], "utf8")).targetMet ? 0 : 1)' "$log_file.calibration.json"; then
      test_status=125
    else
      test_status=126
    fi
  else
    printf 'Calibration ended before a complete measurement window; this is not certification.\n'
    test_status=125
  fi
fi
if [[ -n "${TSONIC_TEST_GUARD_REPORT:-}" ]]; then
  if (( test_status == 0 )) && [[ "$scope_drained" == true ]]; then
    if rm -rf -- "$temporary_directory"; then
      export TSONIC_TEST_TEMP_DIRECTORY_REMOVED=true
    else
      printf 'Could not remove the drained successful job temporary directory: %s\n' "$temporary_directory" >&2
      test_status=1
    fi
  fi
  node "$script_root/guard-report.mjs" "$TSONIC_TEST_GUARD_REPORT" "$PWD/$log_file" \
    "$test_status" "$memory_mebibytes" "$tasks_max" "$timeout_seconds" "$log_size_max_bytes" \
    "$oom_kill_before" "$oom_kill_after" "$scope_result" "${TSONIC_TEST_CALIBRATION_SECONDS:-}" \
    "$measurement_file" "$scope_drained"
elif (( test_status == 0 )) && [[ "$scope_drained" == true ]]; then
  rm -rf -- "$temporary_directory"
fi
exit "${test_status}"
