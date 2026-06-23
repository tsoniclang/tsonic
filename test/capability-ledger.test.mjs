import assert from "node:assert/strict";
import test from "node:test";
import {
  capabilityLaneNames,
  capabilityIdSet,
  capabilityLedger,
  capabilityOwners,
  capabilityStatuses,
  requiredCapabilityIds,
  validateCapabilityLedgerEntry,
} from "./capabilities/ledger.mjs";
import { oldEmitterHistoricalCasePaths, oldEmitterPortInventory } from "./old-emitter-inventory/inventory.mjs";
import { oldProductUnitHistoricalTestFiles, oldProductUnitPortInventory } from "./old-product-unit-inventory/inventory.mjs";
import { oldSuitePortInventory } from "./old-suite-inventory/inventory.mjs";

const capabilityStatusSet = new Set(capabilityStatuses);
const capabilityOwnerSet = new Set(capabilityOwners);
const capabilityLaneSet = new Set(capabilityLaneNames);

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
    assert.equal(typeof entry.evidenceReview, "string", entry.capabilityId);
    assert.match(entry.evidenceReview, /^(reviewed|seeded)$/u, entry.capabilityId);
    assert.equal(Array.isArray(entry.positiveTests), true, entry.capabilityId);
    assert.equal(Array.isArray(entry.negativeTests), true, entry.capabilityId);
    assert.equal(Array.isArray(entry.oldEvidence), true, entry.capabilityId);
    assertValidLaneClassification(entry);
    assert.equal(Array.isArray(entry.blockers), true, entry.capabilityId);
    assert.equal(typeof entry.notes, "string", entry.capabilityId);
  }
});

test("incomplete and blocked capabilities have ledger-enforced lane classification", () => {
  for (const entry of capabilityLedger) {
    if (entry.status === "complete" || entry.status === "invalid") {
      continue;
    }

    assertValidLaneClassification(entry);
    assert.ok(
      entry.laneClassification.possibleLanes.includes("hard-reject"),
      `${entry.capabilityId} must define a fail-closed lane`,
    );
    assert.equal(
      typeof entry.laneClassification.strictNative,
      "object",
      `${entry.capabilityId} must define strict-native behavior`,
    );
  }
});

test("compat-runtime lane classifications name closed carriers and required facts", () => {
  for (const entry of capabilityLedger) {
    const classification = entry.laneClassification;
    if (!classification.possibleLanes.includes("compat-runtime")) {
      continue;
    }

    assert.equal(typeof classification.compat, "object", `${entry.capabilityId} has compat-runtime without compat behavior`);
    assert.equal(classification.compat.lane, "compat-runtime", `${entry.capabilityId} compat behavior must use compat-runtime lane`);
    assert.equal(typeof classification.compat.runtimeCarrier, "string", `${entry.capabilityId} compat behavior must name a runtime carrier`);
    assert.notEqual(classification.compat.runtimeCarrier.length, 0, `${entry.capabilityId} compat runtime carrier must be non-empty`);
    assert.ok(Array.isArray(classification.compat.requiredFacts), `${entry.capabilityId} compat behavior must name required facts`);
    assert.ok(classification.compat.requiredFacts.length > 0, `${entry.capabilityId} compat behavior must require facts`);
    assert.doesNotMatch(classification.compat.runtimeCarrier, /QuickJS|Reflection|dynamic/u, `${entry.capabilityId} names a banned compat mechanism`);
  }
});

test("capability ledger validator rejects missing or malformed lane classification", () => {
  const sample = capabilityLedger.find((entry) => entry.laneClassification.possibleLanes.includes("compat-runtime"));
  assert.notEqual(sample, undefined);

  assert.deepEqual(
    validateCapabilityLedgerEntry({ ...sample, laneClassification: undefined }),
    ["laneClassification must be an object"],
  );

  assert.deepEqual(
    validateCapabilityLedgerEntry({
      ...sample,
      laneClassification: {
        ...sample.laneClassification,
        possibleLanes: [],
      },
    }),
    ["laneClassification.possibleLanes must be a non-empty array"],
  );

  assert.deepEqual(
    validateCapabilityLedgerEntry({
      ...sample,
      laneClassification: {
        ...sample.laneClassification,
        hardReject: {
          ...sample.laneClassification.hardReject,
          lane: "static-native",
        },
      },
    }),
    ["laneClassification.hardReject.lane must be hard-reject"],
  );

  assert.deepEqual(
    validateCapabilityLedgerEntry({
      ...sample,
      laneClassification: {
        ...sample.laneClassification,
        compat: {
          ...sample.laneClassification.compat,
          lane: "static-native",
        },
      },
    }),
    ["laneClassification.compat.lane must be compat-runtime"],
  );

  assert.deepEqual(
    validateCapabilityLedgerEntry({
      ...sample,
      laneClassification: {
        ...sample.laneClassification,
        compat: {
          ...sample.laneClassification.compat,
          runtimeCarrier: "",
          requiredFacts: [],
        },
      },
    }),
    [
      "laneClassification.compat.requiredFacts must be a non-empty array",
      "laneClassification.compat.runtimeCarrier must be a non-empty string when lane is compat-runtime",
    ],
  );
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
    assert.equal(entry.evidenceReview, "reviewed", `${entry.capabilityId} is complete without reviewed evidence`);
    assert.ok(entry.oldEvidence.length > 0, `${entry.capabilityId} is complete without old inventory evidence`);
  }
});

test("complete parent capabilities require complete child capabilities", () => {
  for (const entry of capabilityLedger) {
    if (entry.status !== "complete") {
      continue;
    }

    const childCapabilities = capabilityLedger.filter((candidate) =>
      candidate.capabilityId.startsWith(`${entry.capabilityId}.`),
    );
    for (const child of childCapabilities) {
      assert.equal(
        child.status,
        "complete",
        `${entry.capabilityId} is complete but child ${child.capabilityId} is ${child.status}`,
      );
    }
  }
});

test("complete capability proof references current positive and negative tests", () => {
  const oldPathSet = new Set([
    ...oldEmitterPortInventory.map((entry) => entry.oldPath),
    ...oldEmitterHistoricalCasePaths,
    ...oldSuitePortInventory.map((entry) => entry.oldPath),
    ...oldProductUnitHistoricalTestFiles,
  ]);

  for (const entry of capabilityLedger) {
    if (entry.status !== "complete") {
      continue;
    }

    for (const positiveTest of entry.positiveTests) {
      assert.equal(typeof positiveTest, "string", `${entry.capabilityId} has a non-string positive test`);
      assert.notEqual(positiveTest.length, 0, `${entry.capabilityId} has an empty positive test`);
      assert.equal(oldPathSet.has(positiveTest), false, `${entry.capabilityId} uses old evidence as positive proof: ${positiveTest}`);
    }

    for (const negativeTest of entry.negativeTests) {
      assert.equal(typeof negativeTest, "string", `${entry.capabilityId} has a non-string negative test`);
      assert.notEqual(negativeTest.length, 0, `${entry.capabilityId} has an empty negative test`);
      assert.equal(oldPathSet.has(negativeTest), false, `${entry.capabilityId} uses old evidence as negative proof: ${negativeTest}`);
    }
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

test("complete capability oldEvidence is bidirectionally mapped by old inventories", () => {
  const oldEntriesByPath = new Map([
    ...oldEmitterPortInventory.map((entry) => [entry.oldPath, entry]),
    ...oldSuitePortInventory.map((entry) => [entry.oldPath, entry]),
    ...oldProductUnitPortInventory.map((entry) => [entry.oldPath, entry]),
  ]);

  for (const entry of capabilityLedger) {
    if (entry.status !== "complete") {
      continue;
    }

    for (const oldEvidencePath of entry.oldEvidence) {
      const oldEntry = oldEntriesByPath.get(oldEvidencePath);
      assert.notEqual(oldEntry, undefined, `${entry.capabilityId} references old evidence without an inventory entry: ${oldEvidencePath}`);
      assert.equal(
        oldEntry.capabilityIds.includes(entry.capabilityId),
        true,
        `${entry.capabilityId} old evidence is not bidirectionally mapped by ${oldEvidencePath}`,
      );
    }
  }
});

function assertValidLaneClassification(entry) {
  const classification = entry.laneClassification;
  assert.equal(typeof classification, "object", `${entry.capabilityId} missing laneClassification`);
  assert.equal(typeof classification.patternKind, "string", `${entry.capabilityId} missing patternKind`);
  assert.notEqual(classification.patternKind.length, 0, `${entry.capabilityId} has empty patternKind`);
  assert.ok(Array.isArray(classification.possibleLanes), `${entry.capabilityId} possibleLanes must be an array`);
  assert.ok(classification.possibleLanes.length > 0, `${entry.capabilityId} possibleLanes must be non-empty`);
  for (const lane of classification.possibleLanes) {
    assert.equal(capabilityLaneSet.has(lane), true, `${entry.capabilityId} has unknown lane ${lane}`);
  }
  assertValidLaneBehavior(entry, "strictNative", classification.strictNative);
  if (classification.possibleLanes.includes("static-native")) {
    assertValidLaneBehavior(entry, "staticNative", classification.staticNative);
    assert.ok(
      Array.isArray(classification.staticNative.requiredFacts) && classification.staticNative.requiredFacts.length > 0,
      `${entry.capabilityId} static-native lane must require facts`,
    );
  }
  if (classification.possibleLanes.includes("compat-runtime")) {
    assertValidLaneBehavior(entry, "compat", classification.compat);
  }
  assertValidLaneBehavior(entry, "hardReject", classification.hardReject);
  assert.equal(classification.hardReject.lane, "hard-reject", `${entry.capabilityId} hardReject.lane must be hard-reject`);
  assert.ok(
    Array.isArray(classification.hardReject.reasons) && classification.hardReject.reasons.length > 0,
    `${entry.capabilityId} hard-reject lane must name reasons`,
  );
}

function assertValidLaneBehavior(entry, fieldName, behavior) {
  assert.equal(typeof behavior, "object", `${entry.capabilityId} missing ${fieldName} lane behavior`);
  assert.equal(typeof behavior.lane, "string", `${entry.capabilityId} ${fieldName}.lane must be a string`);
  assert.equal(capabilityLaneSet.has(behavior.lane), true, `${entry.capabilityId} ${fieldName}.lane is invalid: ${behavior.lane}`);
}
