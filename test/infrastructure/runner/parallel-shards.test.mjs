import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createParallelShardPlan } from "../../scripts/parallel-shards.mjs";
import { requiredParallelPreRuns } from "../../scripts/parallel-preruns.mjs";
import { createParallelSuiteDefinition, createRustParallelSuiteDefinition, selectParallelSuiteDefinition } from "../../scripts/suite-definition.mjs";
import { testRepositoryRoots, tsonicRoot } from "../../scripts/workspace-layout.mjs";

const paths = { tsonicRoot, statusRoot: resolve(tsonicRoot, ".temp/shard-contract-results") };

test("every Host and Rust Node shard has an explicit single-file memory-scoped concurrency", () => {
  for (const definition of [createParallelSuiteDefinition(testRepositoryRoots), createRustParallelSuiteDefinition(testRepositoryRoots)]) {
    const { shards } = createParallelShardPlan(definition, testRepositoryRoots, paths);
    const nodes = shards.filter(shard => shard.resultFormat === "node");
    assert.equal(nodes.length > 0, true, definition.bank);
    for (const shard of nodes) {
      assert.equal(shard.args.filter(argument => argument.startsWith("--test-concurrency")).length, 1, shard.id);
      assert.equal(shard.args.includes("--test-concurrency=1"), true, shard.id);
      assert.equal(shard.files.length, 1, shard.id);
    }
  }
});

test("prerequisites come from suite and file data rather than names of groups", () => {
  const definition = createParallelSuiteDefinition(testRepositoryRoots);
  definition.nodeSuites[0] = { ...definition.nodeSuites[0], group: "renamed-ordinary-group" };
  const { shards } = createParallelShardPlan(definition, testRepositoryRoots, paths);
  const registry = shards.find(shard => shard.file?.endsWith("/keel-node-registry.test.mjs"));
  const ordinary = shards.find(shard => shard.file?.endsWith("/keel-check-contract.test.mjs"));
  assert.equal(registry.group, "renamed-ordinary-group");
  assert.equal(ordinary.group, "renamed-ordinary-group");
  assert.equal(requiredParallelPreRuns(definition, [registry]).some(run => run.id === "rust-nodejs.build"), true);
  assert.equal(requiredParallelPreRuns(definition, [ordinary]).some(run => run.id === "rust-nodejs.build"), false);
  const main = readFileSync(resolve(tsonicRoot, "test/scripts/run-parallel.mjs"), "utf8");
  const shardsSource = readFileSync(resolve(tsonicRoot, "test/scripts/parallel-shards.mjs"), "utf8");
  assert.doesNotMatch(main + shardsSource, /host-keel-inventory|host-carrier-registry|preRunsForTask|resourcesForFile/u);
});

test("bank selection uses declared inventories and rejects cross-bank mixtures", () => {
  assert.equal(selectParallelSuiteDefinition(testRepositoryRoots, new Set()).bank, "host");
  assert.equal(selectParallelSuiteDefinition(testRepositoryRoots, new Set(["tsonic-rust"])).bank, "node");
  assert.throws(() => selectParallelSuiteDefinition(testRepositoryRoots, new Set(["tsonic-rust", "tsonic"])), /separate banks/u);
  assert.throws(() => selectParallelSuiteDefinition(testRepositoryRoots, new Set(["unknown"])), /canonical bank/u);
});
