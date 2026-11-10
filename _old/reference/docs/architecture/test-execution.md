# Test execution

Run the complete host/C# bank from the host repository:

```sh
bash test/scripts/run-all.sh
```

Run the complete Rust target bank from `tsonic-rust`:

```sh
npm test
```

Both use the host's shared resource-budget and bounded-process runner. CPU
affinity, CPU quotas and available memory determine the worker count. The budget
leaves room for the desktop and coordinator, bounds native child builds, disables
swap for the test scope, and retains complete logs under the running repository's
`.temp/test-runs/`. A worker count is not a limit on all native threads.

## Configuration

| Variable | Meaning |
| --- | --- |
| `TSONIC_TEST_CPUS` | Effective CPU budget; default 85% of available CPUs, at least one |
| `TSONIC_TEST_MEMORY_MIB` | Total test memory ceiling in MiB |
| `TSONIC_TEST_WORKERS` | Concurrent test files/tasks; must fit CPU and memory budgets |
| `TSONIC_TEST_WORKER_MEMORY_MIB` | Memory reservation per worker |
| `TSONIC_TEST_CHILD_JOBS` | Cargo jobs and .NET processor budget per native child |
| `TSONIC_TEST_HEAP_MIB` | Node heap limit per worker, below its memory reservation |
| `TSONIC_TEST_TIMEOUT_SECONDS` | Complete-run deadline; default 7,200 seconds |
| `TSONIC_TEST_HEARTBEAT_SECONDS` | Progress interval; default 60 seconds |
| `TSONIC_TEST_TASKS_MAX` | Scope process/thread ceiling; default 2,048 |
| `TSONIC_TEST_LOG_SIZE_MAX_BYTES` | Complete-log ceiling; default 64 MiB |

For example, use twelve host workers within a 32 GiB ceiling:

```sh
TSONIC_TEST_CPUS=16 TSONIC_TEST_MEMORY_MIB=32768 TSONIC_TEST_WORKERS=12 \
  bash test/scripts/run-all.sh
```

Native integrations need more resources than lightweight policy tests. Rust's
default reservation is 4 GiB per worker with two Cargo jobs; the host default is
2 GiB with one native child job. Increase reservations when observed peaks
require them. Invalid or unbudgetable selections fail before tests begin.

The host schedules independent groups together, but retains explicit exclusive
tasks and per-group limits. Package unit modules run separately; discovery and
reporting must account for each authored test file exactly once. A full suite
collects all failures. Do not start a subsequent suite while known failures
remain; an aborted or filtered run is never full certification.

## Short utilization calibration

Calibration is an explicitly partial run, not a way to certify a subset:

```sh
TSONIC_TEST_CALIBRATION_SECONDS=120 \
TSONIC_TEST_CALIBRATION_WARMUP_SECONDS=60 \
TSONIC_TEST_MIN_CPU_PERCENT=60 \
  bash test/scripts/run-all.sh
```

After warmup, the runner measures the entire test cgroup's CPU consumption over
the selected window, writes a `.calibration.json` report, and stops the scope.
The percentage is relative to the assigned CPU budget: 60% of twenty CPUs means
twelve CPU-seconds per wall-clock second. Exit 125 means a completed calibration
or an insufficient window; inspect the report to distinguish them. Exit 126 means
the utilization target was missed. Neither is a certification pass. Test failures
observed during calibration still need investigation.

Use the same variables with Rust's `npm test`. Remove calibration variables for
the full run. Keep network, shared-state and performance-sensitive test isolation;
do not weaken assertions or remove checks to raise CPU utilization.
