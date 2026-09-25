import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { releaseLaneBudget, runReleaseLanes } from "../../scripts/release/parallel-lanes.mjs";
import { startPackedRegistry } from "../../scripts/release/packed-install/registry.mjs";
import { hostRoot } from "../../scripts/release/npm-wave.mjs";
import { createTestWorkspace } from "../scripts/test-workspaces.mjs";

test("release lanes partition native CPU and memory instead of multiplying them", () => {
  assert.deepEqual(releaseLaneBudget({ cpuBudget: 20, memoryMiB: 40960 }, 2),
    { workers: 2, memoryMiB: 40960, workerMemoryMiB: 20480, childJobs: 10 });
  assert.equal(releaseLaneBudget({ cpuBudget: 20, memoryMiB: 4096 }, 2).workers, 1);
  assert.equal(releaseLaneBudget({ cpuBudget: 1, memoryMiB: 8192 }, 2).childJobs, 1);
  assert.throws(() => releaseLaneBudget({ cpuBudget: 20, memoryMiB: 1024 }, 2), /4096/u);
  assert.throws(() => releaseLaneBudget({ cpuBudget: 20, memoryMiB: 8192 }, 0), /positive/u);
});

test("independent acceptance lanes overlap and drain after a failure", async () => {
  const active = new Set();
  let peak = 0;
  const completed = [];
  await assert.rejects(runReleaseLanes([{ id: "csharp" }, { id: "rust" }], ".", async (lane, options) => {
    active.add(lane.id);
    peak = Math.max(peak, active.size);
    assert.equal(options.environment.CARGO_BUILD_JOBS, "10");
    assert.equal(options.environment.DOTNET_PROCESSOR_COUNT, "10");
    await new Promise(resolveNext => setImmediate(resolveNext));
    active.delete(lane.id);
    completed.push(lane.id);
    if (lane.id === "csharp") throw new Error("native failure");
  }, { cpuBudget: 20, memoryMiB: 8192 }), /drained/u);
  assert.equal(peak, 2);
  assert.deepEqual(completed.sort(), ["csharp", "rust"]);
  assert.equal(active.size, 0);
});

test("packed registry serves exact artifacts to concurrent isolated consumers", async () => {
  const root = createTestWorkspace(resolve(hostRoot, ".temp"), "release-registry-");
  const tarballPath = resolve(root, "example.tgz");
  writeFileSync(tarballPath, "exact package bytes");
  const registry = await startPackedRegistry([{ name: "@tsonic/example", filename: "example.tgz", version: "1.2.3",
    tarballPath, manifest: { name: "@tsonic/example" }, integrity: "sha512-proof", shasum: "proof" }]);
  try {
    const responses = await Promise.all([fetch(`${registry.origin}/@tsonic%2fexample`), fetch(`${registry.origin}/tarballs/example.tgz`)]);
    const manifest = await responses[0].json();
    assert.equal(manifest.versions["1.2.3"].dist.integrity, "sha512-proof");
    assert.equal(await responses[1].text(), "exact package bytes");
    assert.equal((await fetch(`${registry.origin}/missing`)).status, 404);
  } finally {
    await new Promise(resolveClose => registry.server.close(resolveClose));
  }
});
