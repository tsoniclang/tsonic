import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOldEmitterInventoryReport,
  formatOldEmitterInventoryCounts,
  oldEmitterHistoricalCasePaths,
  oldEmitterPortInventory,
  oldEmitterSeedCapabilities,
  validateOldEmitterPortEntry,
} from "./old-emitter-inventory/inventory.mjs";

test("old C# emitter golden inventory is fully tracked for clean backend recovery", () => {
  assert.equal(oldEmitterHistoricalCasePaths.length, 73);
  assert.equal(new Set(oldEmitterHistoricalCasePaths).size, oldEmitterHistoricalCasePaths.length);
  assert.deepEqual([...oldEmitterHistoricalCasePaths].sort(), oldEmitterHistoricalCasePaths);

  const historicalPathSet = new Set(oldEmitterHistoricalCasePaths);
  for (const relativeSeedPath of oldEmitterSeedCapabilities) {
    assert.equal(
      historicalPathSet.has(`packages/targets/csharp/emitter/testcases/common/${relativeSeedPath}.ts`),
      true,
      `missing old C# emitter seed capability ${relativeSeedPath}`,
    );
  }
});

test("old C# emitter inventory entries have required classification fields", () => {
  for (const entry of oldEmitterPortInventory) {
    assert.deepEqual(validateOldEmitterPortEntry(entry), [], entry.oldPath);
  }

  const oldPaths = oldEmitterPortInventory.map((entry) => entry.oldPath);
  assert.equal(new Set(oldPaths).size, oldPaths.length);
});

test("old C# emitter inventory report counts are deterministic", () => {
  const report = buildOldEmitterInventoryReport(oldEmitterHistoricalCasePaths);

  assert.deepEqual(report.counts, {
    total: 73,
    ported: 11,
    "replaced-by-stronger-test": 0,
    "invalid-stale-architecture": 0,
    deferred: 62,
    unclassified: 0,
  });

  assert.equal(formatOldEmitterInventoryCounts(report.counts), [
    "total: 73",
    "ported: 11",
    "replaced-by-stronger-test: 0",
    "invalid-stale-architecture: 0",
    "deferred: 62",
    "unclassified: 0",
  ].join("\n"));
  assert.deepEqual(report.classifiedUnknownOldPaths, []);
  assert.deepEqual(report.unclassifiedOldPaths, []);
});
