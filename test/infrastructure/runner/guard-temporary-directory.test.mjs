import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

mkdirSync(".temp/guard-temporary-directory-tests", { recursive: true });

test("each guarded job owns its three temp variables and only clean drained success removes them", () => {
  const root = mkdtempSync(resolve(".temp/guard-temporary-directory-tests/case-"));
  for (const exit of [0, 23]) {
    const path = resolve(root, `guard-${exit}.json`);
    const command = `import{writeFileSync}from"node:fs";import{join}from"node:path";
      const t=process.env.TMPDIR;
      if(t!==process.env.TMP||t!==process.env.TEMP||!t.startsWith("/tmp/tsonic-tests/tsonic-"))throw Error("foreign temp root");
      writeFileSync(join(t,"actual-child-proof"),"owned");process.exitCode=${exit};`;
    const run = spawnSync("bash", ["test/scripts/bounded-run.sh", "host", process.execPath, "--input-type=module", "-e", command], {
      encoding: "utf8", timeout: 60_000, maxBuffer: 65_536,
      env: { ...process.env, TSONIC_TEST_GUARD_REPORT: path, TSONIC_TEST_MEMORY_MIB: "1024",
        TSONIC_TEST_WORKER_MEMORY_MIB: "1024", TSONIC_TEST_HEAP_MIB: "128", TSONIC_TEST_WORKERS: "1",
        TSONIC_TEST_CHILD_JOBS: "1", NODE_OPTIONS: "", TSONIC_TEST_TIMEOUT_SECONDS: "15" },
    });
    assert.equal(run.error === undefined, true, "the actual bounded job returned");
    assert.equal(run.status, exit, run.stderr.slice(-2048));
    const guard = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(guard.scopeDrained, true);
    assert.equal(guard.oomScope, "owned-cgroup");
    assert.equal(guard.oomBefore, guard.measurement.oomBefore);
    assert.equal(guard.oomAfter, guard.measurement.oomAfter);
    assert.equal(guard.temporaryDirectory, `/tmp/tsonic-tests/${guard.admission.unit}`);
    assert.equal(guard.temporaryDirectoryRemoved, exit === 0);
    assert.equal(existsSync(guard.temporaryDirectory), exit !== 0,
      "failure data stays in only that job's own directory");
  }
});
