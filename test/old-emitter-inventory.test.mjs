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

test("old C# emitter inventory requires explicit capability ids", () => {
  const entry = oldEmitterPortInventory[0];

  assert.ok(
    validateOldEmitterPortEntry({ ...entry, capabilityIds: [] })
      .includes("capabilityIds must be a non-empty array"),
  );

  const report = buildOldEmitterInventoryReport([entry.oldPath], [
    { ...entry, capabilityIds: [] },
  ]);
  assert.equal(report.rules.entriesMustPassValidation, true);
  assert.equal(report.rules.entriesRequireExplicitCapabilityIds, true);
  assert.equal(report.validationErrorCount, 1);
  assert.equal(report.classificationStatus, "hole");
  assert.deepEqual(report.proofHoles, [
    {
      oldPath: entry.oldPath,
      proofHole: "old-inventory-validation",
      error: "capabilityIds must be a non-empty array",
    },
  ]);
});

test("old C# emitter stale entries require replacement capability evidence", () => {
  const staleEntry = oldEmitterPortInventory.find((entry) => entry.status === "invalid-stale-architecture");
  assert.notEqual(staleEntry, undefined);

  assert.ok(
    validateOldEmitterPortEntry({ ...staleEntry, replacementCapabilityIds: [] })
      .includes("replacementCapabilityIds must be a non-empty array"),
  );
  assert.ok(
    validateOldEmitterPortEntry({ ...staleEntry, replacementCapabilityPath: "" })
      .includes("replacementCapabilityPath must be a non-empty string for stale entries"),
  );
  assert.ok(
    validateOldEmitterPortEntry({ ...staleEntry, replacementCapabilityIds: ["unknown.capability"] })
      .includes("replacementCapabilityIds must be included in capabilityIds"),
  );
});

test("old C# emitter inventory report counts are deterministic", () => {
  const report = buildOldEmitterInventoryReport(oldEmitterHistoricalCasePaths);

  assert.deepEqual(report.counts, {
    total: 73,
    ported: 55,
    "replaced-by-stronger-test": 2,
    "invalid-stale-architecture": 2,
    deferred: 14,
    unclassified: 0,
  });

  assert.equal(formatOldEmitterInventoryCounts(report.counts), [
    "total: 73",
    "ported: 55",
    "replaced-by-stronger-test: 2",
    "invalid-stale-architecture: 2",
    "deferred: 14",
    "unclassified: 0",
  ].join("\n"));
  assert.equal(report.rules.unclassifiedOldInventoryIsImpossible, true);
  assert.equal(report.rules.entriesMustPassValidation, true);
  assert.equal(report.rules.entriesRequireExplicitCapabilityIds, true);
  assert.equal(report.rules.staleEntriesRequireReplacementCapabilities, true);
  assert.equal(report.classificationStatus, "complete");
  assert.equal(report.validationErrorCount, 0);
  assert.deepEqual(report.classifiedUnknownOldPaths, []);
  assert.deepEqual(report.unclassifiedOldPaths, []);
  assert.deepEqual(report.proofHoles, []);
});

test("old C# emitter inventory report exposes unclassified proof holes", () => {
  const report = buildOldEmitterInventoryReport([oldEmitterHistoricalCasePaths[0]], []);

  assert.equal(report.classificationStatus, "hole");
  assert.deepEqual(report.unclassifiedOldPaths, [oldEmitterHistoricalCasePaths[0]]);
  assert.deepEqual(report.proofHoles, [
    {
      oldPath: oldEmitterHistoricalCasePaths[0],
      proofHole: "unclassified-old-inventory",
    },
  ]);
});
