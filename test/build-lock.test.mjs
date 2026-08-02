import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("build lock is released when the direct command exits even if it starts a daemon", async () => {
  await mkdir(resolve(repoRoot, ".tests"), { recursive: true });
  const testRoot = await mkdtemp(resolve(repoRoot, ".tests/build-lock-"));
  const wrapper = resolve(testRoot, "scripts/build/with-lock.sh");
  await mkdir(dirname(wrapper), { recursive: true });
  await copyFile(resolve(repoRoot, "scripts/build/with-lock.sh"), wrapper);
  await chmod(wrapper, 0o755);

  const first = spawnSync(wrapper, [
    "bash",
    "-c",
    "sleep 10 >/dev/null 2>&1 & echo $!",
  ], { encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const daemonPid = Number.parseInt(first.stdout.trim(), 10);
  assert.equal(Number.isSafeInteger(daemonPid), true);

  try {
    const second = spawnSync(wrapper, ["true"], {
      encoding: "utf8",
      timeout: 2_000,
    });
    assert.equal(second.error, undefined, second.error?.message);
    assert.equal(second.status, 0, second.stderr);
  } finally {
    try {
      process.kill(daemonPid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
});
