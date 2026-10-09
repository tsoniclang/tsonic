import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("the bounded process launcher preserves literal child arguments", () => {
  const script = readFileSync(new URL("../scripts/bounded-run.sh", import.meta.url), "utf8");
  const invocation = script.slice(script.indexOf("  systemd-run \\\n"), script.indexOf("test_runner_pid=$!"));
  assert.match(invocation, /^\s*--expand-environment=no \\/mu);
  assert.match(invocation, /^\s*env -u TSONIC_TEST_GUARD_REPORT "\$@" \\/mu);
  assert.doesNotMatch(invocation, /\beval\b/u);
});

test("the bounded process launcher drains detached native children after success, failure and resource rejection", { timeout: 60_000 }, () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const scratch = mkdtempSync(resolve(root, ".temp/test-guard-drain-"));
  try {
    for (const status of [0, 1, 124, 153]) {
      const pidFile = resolve(scratch, `child-${status}.pid`);
      const worker = `
        import { spawn } from "node:child_process";
        import { writeFileSync } from "node:fs";
        const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
        writeFileSync(process.argv[1], String(child.pid));
        child.unref();
        process.exitCode = ${status === 1 ? 1 : 0};
        ${status === 124 || status === 153 ? "setInterval(() => {}, 1000);" : ""}
        ${status === 153 ? 'console.log("x".repeat(256));' : ""}
      `;
      const result = spawnSync("bash", [resolve(root, "test/scripts/bounded-run.sh"), "host",
        process.execPath, "--input-type=module", "-e", worker, pidFile], {
        cwd: root,
        encoding: "utf8",
        timeout: 20_000,
        maxBuffer: 65_536,
        env: { ...process.env, NODE_OPTIONS: "", TSONIC_TEST_GUARD_REPORT: "",
          TSONIC_TEST_RESOURCE_BUDGET: "", TSONIC_TEST_CALIBRATION_SECONDS: "",
          TSONIC_TEST_CPUS: "1", TSONIC_TEST_WORKERS: "1", TSONIC_TEST_CHILD_JOBS: "1",
          TSONIC_TEST_MEMORY_MIB: "1024", TSONIC_TEST_WORKER_MEMORY_MIB: "1024",
          TSONIC_TEST_HEAP_MIB: "128", TSONIC_TEST_TIMEOUT_SECONDS: status === 124 ? "1" : "15",
          TSONIC_TEST_LOG_SIZE_MAX_BYTES: status === 153 ? "64" : "67108864" },
      });
      assert.equal(result.error === undefined, true, `bounded launcher must actually finish: ${result.error?.code}`);
      assert.equal(result.status, status, `original child exit ${status}: ${result.stderr.slice(-2048)}`);
      assert.match(result.stdout, /scope drained: true/u);
      assert.equal(existsSync(pidFile), true, "the detached native child was actually spawned");
      const child = Number(readFileSync(pidFile, "utf8"));
      const processStatus = `/proc/${child}/status`;
      assert.equal(!existsSync(processStatus) || /^State:\s+Z\b/mu.test(readFileSync(processStatus, "utf8")), true,
        "no live detached child remains after the guard returns");
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
