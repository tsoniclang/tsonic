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

test("old product unit stale entries require replacement capability evidence", () => {
  const staleEntry = oldProductUnitPortInventory.find((entry) => entry.status === "invalid-stale-architecture");
  assert.notEqual(staleEntry, undefined);

  assert.ok(
    validateOldProductUnitPortEntry({ ...staleEntry, replacementCapabilityIds: [] })
      .includes("replacementCapabilityIds must be a non-empty array"),
  );
  assert.ok(
    validateOldProductUnitPortEntry({ ...staleEntry, replacementCapabilityPath: "" })
      .includes("replacementCapabilityPath must be a non-empty string for stale entries"),
  );
  assert.ok(
    validateOldProductUnitPortEntry({ ...staleEntry, replacementCapabilityIds: ["unknown.capability"] })
      .includes("replacementCapabilityIds must be included in capabilityIds"),
  );
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
  assert.equal(report.rules.unclassifiedOldInventoryIsImpossible, true);
  assert.equal(report.classificationStatus, "complete");
  assert.deepEqual(report.classifiedUnknownOldPaths, []);
  assert.deepEqual(report.unclassifiedOldPaths, []);
  assert.deepEqual(report.proofHoles, []);
});

test("old product unit inventory report exposes unclassified proof holes", () => {
  const report = buildOldProductUnitInventoryReport([oldProductUnitHistoricalTestFiles[0]], []);

  assert.equal(report.classificationStatus, "hole");
  assert.deepEqual(report.unclassifiedOldPaths, [oldProductUnitHistoricalTestFiles[0]]);
  assert.deepEqual(report.proofHoles, [
    {
      oldPath: oldProductUnitHistoricalTestFiles[0],
      proofHole: "unclassified-old-inventory",
    },
  ]);
});
