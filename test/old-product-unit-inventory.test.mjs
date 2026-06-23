import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOldProductUnitInventoryReport,
  countOldProductUnitDeclarations,
  formatOldProductUnitInventoryCounts,
  oldProductUnitHistoricalTestFiles,
  oldProductUnitPortInventory,
  validateOldProductUnitPortEntry,
} from "./old-product-unit-inventory/inventory.mjs";

test("old product unit inventory captures every non-TSTS historical unit test file", () => {
  assert.equal(oldProductUnitHistoricalTestFiles.length, 109);
  assert.equal(new Set(oldProductUnitHistoricalTestFiles).size, oldProductUnitHistoricalTestFiles.length);
  assert.deepEqual([...oldProductUnitHistoricalTestFiles].sort(), oldProductUnitHistoricalTestFiles);
  assert.equal(countOldProductUnitDeclarations(), 598);
});

test("old product unit inventory entries have required classification fields", () => {
  for (const entry of oldProductUnitPortInventory) {
    assert.deepEqual(validateOldProductUnitPortEntry(entry), [], entry.oldPath);
  }

  const oldPaths = oldProductUnitPortInventory.map((entry) => entry.oldPath);
  assert.equal(new Set(oldPaths).size, oldPaths.length);
});

test("old product unit inventory report counts are deterministic", () => {
  const report = buildOldProductUnitInventoryReport(oldProductUnitHistoricalTestFiles);

  assert.deepEqual(report.counts, {
    total: 109,
    ported: 0,
    "replaced-by-stronger-test": 0,
    "invalid-stale-architecture": 26,
    deferred: 83,
    unclassified: 0,
  });

  assert.equal(formatOldProductUnitInventoryCounts(report.counts), [
    "total: 109",
    "ported: 0",
    "replaced-by-stronger-test: 0",
    "invalid-stale-architecture: 26",
    "deferred: 83",
    "unclassified: 0",
  ].join("\n"));
  assert.deepEqual(report.classifiedUnknownOldPaths, []);
  assert.deepEqual(report.unclassifiedOldPaths, []);
});
