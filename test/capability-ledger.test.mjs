import assert from "node:assert/strict";
import test from "node:test";
import {
  capabilityIdSet,
  capabilityLedger,
  capabilityOwners,
  capabilityStatuses,
  requiredCapabilityIds,
} from "./capabilities/ledger.mjs";
import { oldEmitterHistoricalCasePaths, oldEmitterPortInventory } from "./old-emitter-inventory/inventory.mjs";
import { oldProductUnitHistoricalTestFiles, oldProductUnitPortInventory } from "./old-product-unit-inventory/inventory.mjs";
import { oldSuitePortInventory } from "./old-suite-inventory/inventory.mjs";

const capabilityStatusSet = new Set(capabilityStatuses);
const capabilityOwnerSet = new Set(capabilityOwners);

test("capability ledger has valid machine-readable entries", () => {
  assert.equal(capabilityLedger.length, requiredCapabilityIds.length);
  assert.equal(new Set(requiredCapabilityIds).size, requiredCapabilityIds.length);

  for (const entry of capabilityLedger) {
    assert.equal(typeof entry.capabilityId, "string", "capabilityId must be a string");
    assert.match(entry.capabilityId, /^[a-z][a-z0-9.-]+$/u, entry.capabilityId);
    assert.equal(typeof entry.title, "string", entry.capabilityId);
    assert.notEqual(entry.title.length, 0, entry.capabilityId);
    assert.equal(capabilityStatusSet.has(entry.status), true, entry.capabilityId);
    assert.equal(capabilityOwnerSet.has(entry.owner), true, entry.capabilityId);
    assert.equal(Array.isArray(entry.sourceExamples), true, entry.capabilityId);
    assert.ok(entry.sourceExamples.length > 0, entry.capabilityId);
    assert.equal(typeof entry.tstsDecision, "string", entry.capabilityId);
    assert.notEqual(entry.tstsDecision.length, 0, entry.capabilityId);
    assert.equal(Array.isArray(entry.providerFacts), true, entry.capabilityId);
    assert.equal(typeof entry.backendContract, "string", entry.capabilityId);
    assert.notEqual(entry.backendContract.length, 0, entry.capabilityId);
    assert.equal(Array.isArray(entry.positiveTests), true, entry.capabilityId);
    assert.equal(Array.isArray(entry.negativeTests), true, entry.capabilityId);
    assert.equal(Array.isArray(entry.oldEvidence), true, entry.capabilityId);
    assert.equal(Array.isArray(entry.blockers), true, entry.capabilityId);
    assert.equal(typeof entry.notes, "string", entry.capabilityId);
  }
});

test("capability ledger includes active plan minimum and rereview expansion ids", () => {
  const requiredIds = [
    "host.project.package-discovery",
    "host.project.target-selection",
    "host.project.surface-selection",
    "host.project.provider-composition",
    "tsts.program.create-with-extensions",
    "tsts.type-query.flow-narrowed-type",
    "tsts.diagnostic.provider-sourced",
    "provider.module.virtual-import",
    "provider.module.no-file-backed-fallback",
    "provider.module.missing-provider-diagnostic",
    "source.primitive.configured-type",
    "source-core.out.storage-binding",
    "source-core.ref.parameter-mode",
    "source-core.struct.field-facts",
    "operation.call.provider-selected-method",
    "operation.call.provider-argument-conversion",
    "operation.call.provider-parameter-mode",
    "operation.member.provider-property",
    "operation.member.provider-indexer",
    "operation.member.no-name-guess",
    "operation.constructor.provider-selected-target",
    "type.generic.provider-target-arguments",
    "type.generic.provider-target-constraints",
    "operation.array.literal",
    "operation.iteration.provider-target",
    "operation.spread.provider-target-copy",
    "surface.js.console-log",
    "surface.js.math",
    "surface.node.process",
    "surface.node.fs",
    "compat.any.dynamic-get",
    "compat.any.dynamic-set",
    "compat.any.dynamic-call",
    "compat.unknown.no-dynamic-access",
    "compat.object.no-dynamic-access",
    "runtime.union.carrier",
    "runtime.undefined.carrier",
    "runtime.dynamic.carrier",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.csharp.printer",
    "backend.csharp.no-direct-semantic-string-output",
    "backend.csharp.project-sdk-emit",
    "backend.csharp.runtime-artifacts",
    "diagnostic.missing-provider-fact",
    "diagnostic.unsupported-target-operation",
    "diagnostic.strict-mode-slow-op",
    "target.shared.operation-contract",
    "target.shared.ownership-placeholder",
    "target.rust.future-borrow-checker-boundary",
    "module.import.named",
    "module.export.reexport",
    "type.conditional",
    "type.mapped",
    "binding.object.rename-rest-default",
    "function.closure",
    "declaration.class.private-fields",
    "native.dotnet.parameter-modes",
    "diagnostic.source-spans",
  ];

  for (const capabilityId of requiredIds) {
    assert.equal(capabilityIdSet.has(capabilityId), true, `missing required capability ${capabilityId}`);
  }
});

test("complete capabilities require positive and negative proof", () => {
  for (const entry of capabilityLedger) {
    if (entry.status !== "complete") {
      continue;
    }

    assert.ok(entry.positiveTests.length > 0, `${entry.capabilityId} is complete without positive tests`);
    assert.ok(entry.negativeTests.length > 0, `${entry.capabilityId} is complete without negative tests`);
  }
});

test("old inventories map only to known capability ids", () => {
  const oldInventoryEntries = [
    ...oldEmitterPortInventory,
    ...oldSuitePortInventory,
    ...oldProductUnitPortInventory,
  ];

  for (const entry of oldInventoryEntries) {
    assert.ok(entry.capabilityIds.length > 0, `${entry.oldPath} has no capabilityIds`);

    for (const capabilityId of entry.capabilityIds) {
      assert.equal(
        capabilityIdSet.has(capabilityId),
        true,
        `${entry.oldPath} references unknown capability ${capabilityId}`,
      );
    }
  }
});

test("capability oldEvidence references classified old inventory paths", () => {
  const classifiedOldPathSet = new Set([
    ...oldEmitterPortInventory.map((entry) => entry.oldPath),
    ...oldEmitterHistoricalCasePaths,
    ...oldSuitePortInventory.map((entry) => entry.oldPath),
    ...oldProductUnitHistoricalTestFiles,
  ]);

  for (const entry of capabilityLedger) {
    for (const oldEvidencePath of entry.oldEvidence) {
      assert.equal(classifiedOldPathSet.has(oldEvidencePath), true, `${entry.capabilityId} references unknown old evidence ${oldEvidencePath}`);
    }
  }
});
