import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import {
  capabilityCompatRuntimeCarriers,
  capabilitySurfaceEvidenceGateNames,
  coreLangIntrinsicCoverage,
  coreLangIntrinsicModuleSpecifier,
  capabilityLaneNames,
  capabilityIdSet,
  capabilityLedger,
  capabilityOwners,
  capabilityStatuses,
  requiredCapabilityIds,
  validateCapabilityLedger,
  validateCapabilityLedgerEntry,
} from "./capabilities/ledger.mjs";
import {
  buildOldEmitterInventoryReport,
  oldEmitterHistoricalCasePaths,
  oldEmitterPortInventory,
  validateOldEmitterPortEntry,
} from "./old-emitter-inventory/inventory.mjs";
import {
  buildOldProductUnitInventoryReport,
  oldProductUnitHistoricalTestFiles,
  oldProductUnitPortInventory,
  validateOldProductUnitPortEntry,
} from "./old-product-unit-inventory/inventory.mjs";
import {
  buildOldSuiteInventoryReport,
  oldSuitePortInventory,
  oldSuiteRequiredSeedFixturePaths,
  validateOldSuitePortEntry,
} from "./old-suite-inventory/inventory.mjs";

const capabilityStatusSet = new Set(capabilityStatuses);
const capabilityOwnerSet = new Set(capabilityOwners);
const capabilityLaneSet = new Set(capabilityLaneNames);
const capabilityCompatRuntimeCarrierSet = new Set(capabilityCompatRuntimeCarriers);
































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

function sampleCapabilityWithStatus(status) {
  const existing = capabilityLedger.find((entry) => entry.status === status);
  if (existing !== undefined) {
    return existing;
  }
  const completeEntry = capabilityLedger.find((entry) => entry.status === "complete");
  assert.notEqual(completeEntry, undefined, `missing complete capability sample for synthetic ${status} validator coverage`);
  return {
    ...completeEntry,
    status,
    blockers: [`synthetic ${status} capability blocker`],
  };
}

function sourceFilesUnder(root) {
  const absoluteRoot = join(process.cwd(), root);
  const entries = readdirSync(absoluteRoot).sort();
  const files = [];
  for (const entry of entries) {
    const absolutePath = join(absoluteRoot, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      files.push(...sourceFilesUnder(relative(process.cwd(), absolutePath)));
    } else if (/\.[cm]?tsx?$/u.test(entry)) {
      files.push(absolutePath);
    }
  }
  return files;
}

function capabilityEntry({
  capabilityId,
  status,
  owner = "target-provider",
  blockers = [],
  evidenceReview = "seeded",
  positiveTests = [],
  negativeTests = [],
  oldEvidence = [],
  surfaceEvidence,
}) {
  return {
    capabilityId,
    title: `Capability ${capabilityId}`,
    status,
    owner,
    sourceExamples: [`${capabilityId} source example`],
    tstsDecision: "TSTS owns the source-language decision.",
    providerFacts: [`${capabilityId}.fact`],
    backendContract: "Backend consumes finalized facts and fails closed when missing.",
    evidenceReview,
    positiveTests,
    negativeTests,
    oldEvidence,
    ...(surfaceEvidence === undefined ? {} : { surfaceEvidence }),
    laneClassification: {
      patternKind: "validation-test-pattern",
      possibleLanes: ["static-native", "hard-reject"],
      strictNative: {
        lane: "static-native",
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: [`${capabilityId}.fact`],
      },
      hardReject: {
        lane: "hard-reject",
        reasons: ["missing-required-facts"],
      },
    },
    blockers,
    notes: "Synthetic validation entry.",
  };
}

test("capability ledger validator rejects complete capabilities without proof", () => {
  const completeEntry = capabilityLedger.find((entry) => entry.status === "complete");
  assert.notEqual(completeEntry, undefined);

  assert.ok(
    validateCapabilityLedgerEntry({ ...completeEntry, positiveTests: [] })
      .includes("complete capabilities must have positiveTests"),
  );
  assert.ok(
    validateCapabilityLedgerEntry({ ...completeEntry, negativeTests: [] })
      .includes("complete capabilities must have negativeTests"),
  );
  assert.ok(
    validateCapabilityLedgerEntry({ ...completeEntry, evidenceReview: "seeded" })
      .includes("complete capabilities must have reviewed evidence"),
  );
  assert.ok(
    validateCapabilityLedgerEntry({ ...completeEntry, evidenceReview: "rubber-stamped" })
      .includes("evidenceReview must be one of seeded, reviewed"),
  );
  assert.ok(
    validateCapabilityLedgerEntry({ ...completeEntry, oldEvidence: [] })
      .includes("complete capabilities must have oldEvidence or reviewed oldEvidenceAbsence"),
  );
  assert.deepEqual(
    validateCapabilityLedgerEntry({
      ...completeEntry,
      oldEvidence: [],
      oldEvidenceAbsence: {
        status: "reviewed-none-found",
        reviewedInventories: ["old fixture inventory"],
        searchEvidence: ["reviewed inventories contain no matching old behavior entry"],
        reviewerNotes: "Current tests are the source of proof because no historical behavior entry exists.",
      },
    }).filter((error) => error.includes("oldEvidence")),
    [],
  );
  assert.ok(
    validateCapabilityLedgerEntry({
      ...completeEntry,
      oldEvidence: [],
      oldEvidenceAbsence: {
        status: "reviewed-none-found",
        reviewedInventories: [],
        searchEvidence: ["reviewed inventories contain no matching old behavior entry"],
        reviewerNotes: "Current tests are the source of proof because no historical behavior entry exists.",
      },
    }).includes("oldEvidenceAbsence.reviewedInventories must be a non-empty array"),
  );
});
test("capability ledger validator rejects duplicated and stale evidence reuse", () => {
  const completeEntry = capabilityLedger.find((entry) => entry.status === "complete");
  assert.notEqual(completeEntry, undefined);

  assert.ok(
    validateCapabilityLedgerEntry({
      ...completeEntry,
      positiveTests: [...completeEntry.positiveTests, completeEntry.positiveTests[0]],
    }).includes("positiveTests must not contain duplicate entries"),
  );
  assert.ok(
    validateCapabilityLedgerEntry({
      ...completeEntry,
      negativeTests: [...completeEntry.negativeTests, completeEntry.negativeTests[0]],
    }).includes("negativeTests must not contain duplicate entries"),
  );
  assert.ok(
    validateCapabilityLedgerEntry({
      ...completeEntry,
      oldEvidence: [...completeEntry.oldEvidence, completeEntry.oldEvidence[0]],
    }).includes("oldEvidence must not contain duplicate entries"),
  );
  assert.ok(
    validateCapabilityLedgerEntry({
      ...completeEntry,
      positiveTests: [completeEntry.oldEvidence[0]],
    }).includes("positiveTests must not reuse oldEvidence paths"),
  );
  assert.ok(
    validateCapabilityLedgerEntry({
      ...completeEntry,
      negativeTests: [completeEntry.oldEvidence[0]],
    }).includes("negativeTests must not reuse oldEvidence paths"),
  );
});
test("capability ledger validator rejects incomplete sub-capability evidence for complete broad capabilities", () => {
  const parentEntry = capabilityEntry({
    capabilityId: "example.broad",
    status: "complete",
    evidenceReview: "reviewed",
    positiveTests: ["test/current-positive.test.mjs"],
    negativeTests: ["test/current-negative.test.mjs"],
    oldEvidence: ["test/fixtures/old-example/"],
  });
  const partialChildEntry = capabilityEntry({
    capabilityId: "example.broad.child",
    status: "partial",
    blockers: ["Child capability is intentionally incomplete for validation coverage."],
  });

  assert.deepEqual(
    validateCapabilityLedger([parentEntry, partialChildEntry], { requiredIds: [] }),
    [
      "example.broad: complete broad capabilities require complete sub-capability evidence; example.broad.child is partial",
    ],
  );
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
test("current TSTS evidence does not point at retired source-tree tests", () => {
  const staleCurrentEvidence = [];

  for (const entry of capabilityLedger) {
    for (const fieldName of ["positiveTests", "negativeTests"]) {
      for (const testPath of entry[fieldName]) {
        if (testPath.startsWith("packages/tsts/src/")) {
          staleCurrentEvidence.push(`${entry.capabilityId}.${fieldName}: ${testPath}`);
        }
      }
    }
  }

  assert.deepEqual(staleCurrentEvidence, []);

  const publicRootArtifact = capabilityLedger.find((entry) =>
    entry.capabilityId === "tsts.package.public-root-artifact"
  );
  assert.notEqual(publicRootArtifact, undefined);
  assert.equal(publicRootArtifact.status, "complete");
  assert.ok(publicRootArtifact.positiveTests.includes("test/tsts-package-artifact.test.mjs"));
  assert.ok(publicRootArtifact.positiveTests.includes("test/cli/surface-composition.test.mjs"));
  assert.ok(publicRootArtifact.negativeTests.includes("test/tsts-package-artifact.test.mjs"));
  assert.ok(publicRootArtifact.negativeTests.includes("test/capability-ledger.test.mjs"));
  assert.match(publicRootArtifact.notes, /root-package smoke imports @tsonic\/tsts/);
});
test("product code imports TSTS through the public package root only", () => {
  const violations = [];
  const scannedRoots = [
    "packages/host/src",
    "packages/source-core/src",
    "packages/target-api/src",
  ];

  for (const sourceFile of scannedRoots.flatMap(sourceFilesUnder)) {
    const text = readFileSync(sourceFile, "utf8");
    for (const match of text.matchAll(/["'](@tsonic\/tsts\/[^"']+)["']/gu)) {
      violations.push(`${relative(process.cwd(), sourceFile)}: ${match[1]}`);
    }
  }

  assert.deepEqual(violations, []);
});
test("complete surface capabilities require fact/backend/runtime evidence gates", () => {
  const completeSurfaceEntries = capabilityLedger.filter((entry) =>
    entry.status === "complete" &&
    (entry.capabilityId.startsWith("surface.js") || entry.capabilityId.startsWith("surface.node"))
  );
  assert.ok(completeSurfaceEntries.length > 0);

  for (const entry of completeSurfaceEntries) {
    assert.equal(typeof entry.surfaceEvidence, "object", entry.capabilityId);
    for (const gateName of capabilitySurfaceEvidenceGateNames) {
      assert.ok(Array.isArray(entry.surfaceEvidence[gateName]), `${entry.capabilityId} missing ${gateName}`);
      assert.ok(entry.surfaceEvidence[gateName].length > 0, `${entry.capabilityId} has empty ${gateName}`);
    }
  }

  const missingGateEntry = capabilityEntry({
    capabilityId: "surface.js.example",
    status: "complete",
    owner: "surface-provider",
    evidenceReview: "reviewed",
    positiveTests: ["test/current-positive.test.mjs"],
    negativeTests: ["test/current-negative.test.mjs"],
    oldEvidence: ["test/fixtures/old-example/"],
  });
  assert.ok(
    validateCapabilityLedgerEntry(missingGateEntry)
      .includes("complete surface capabilities must have surfaceEvidence"),
  );

  const malformedGateEntry = capabilityEntry({
    capabilityId: "surface.node.example",
    status: "complete",
    owner: "surface-provider",
    evidenceReview: "reviewed",
    positiveTests: ["test/current-positive.test.mjs"],
    negativeTests: ["test/current-negative.test.mjs"],
    oldEvidence: ["test/fixtures/old-example/"],
    surfaceEvidence: {
      selectedOperationFacts: ["test/current-negative.test.mjs"],
      providerFacts: ["test/current-positive.test.mjs"],
      backendEmission: ["test/current-positive.test.mjs"],
      runtimeBehavior: ["test/current-positive.test.mjs"],
      failClosedDiagnostics: ["test/current-positive.test.mjs"],
      backendNoFallback: ["test/current-negative.test.mjs"],
    },
  });
  assert.deepEqual(
    validateCapabilityLedgerEntry(malformedGateEntry).filter((error) => error.startsWith("surfaceEvidence.")),
    [
      "surfaceEvidence.selectedOperationFacts must reference positiveTests",
      "surfaceEvidence.failClosedDiagnostics must reference negativeTests",
    ],
  );
});
test("capability ledger validator rejects old paths as complete current proof", () => {
  const completeEntry = capabilityEntry({
    capabilityId: "example.current-proof",
    status: "complete",
    evidenceReview: "reviewed",
    positiveTests: ["old/positive.test.ts"],
    negativeTests: ["old/negative.test.ts"],
    oldEvidence: ["old/evidence.test.ts"],
  });

  assert.deepEqual(
    validateCapabilityLedger([completeEntry], {
      requiredIds: [],
      oldEvidencePaths: [
        "old/positive.test.ts",
        "old/negative.test.ts",
        "old/evidence.test.ts",
      ],
    }),
    [
      "example.current-proof: complete capabilities must have current positiveTests",
      "example.current-proof: complete capabilities must have current negativeTests",
      "example.current-proof: positiveTests must not reference old evidence paths",
      "example.current-proof: negativeTests must not reference old evidence paths",
    ],
  );
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
test("focused capability gate validates old inventory classification completeness", () => {
  for (const entry of oldEmitterPortInventory) {
    assert.deepEqual(validateOldEmitterPortEntry(entry), [], entry.oldPath);
  }
  for (const entry of oldSuitePortInventory) {
    assert.deepEqual(validateOldSuitePortEntry(entry), [], entry.oldPath);
  }
  for (const entry of oldProductUnitPortInventory) {
    assert.deepEqual(validateOldProductUnitPortEntry(entry), [], entry.oldPath);
  }

  const oldEmitterReport = buildOldEmitterInventoryReport(oldEmitterHistoricalCasePaths);
  const oldSuiteReport = buildOldSuiteInventoryReport(oldSuitePortInventory.map((entry) => entry.oldPath));
  const oldProductUnitReport = buildOldProductUnitInventoryReport(oldProductUnitHistoricalTestFiles);

  for (const report of [oldEmitterReport, oldSuiteReport, oldProductUnitReport]) {
    assert.equal(report.rules.unclassifiedOldInventoryIsImpossible, true);
    assert.equal(report.rules.classifiedInventoryPathsMustBeHistorical, true);
    assert.equal(report.classificationStatus, "complete");
    assert.deepEqual(report.unclassifiedOldPaths, []);
    assert.deepEqual(report.classifiedUnknownOldPaths, []);
    assert.deepEqual(report.proofHoles, []);
  }

  const oldSuitePathSet = new Set(oldSuitePortInventory.map((entry) => entry.oldPath));
  for (const requiredSeedPath of oldSuiteRequiredSeedFixturePaths) {
    assert.equal(oldSuitePathSet.has(requiredSeedPath), true, `old suite seed path is unclassified: ${requiredSeedPath}`);
  }
});
test("reviewed old inventory entries are represented by ledger oldEvidence", () => {
  const oldEvidenceByCapability = new Map(
    capabilityLedger.map((entry) => [entry.capabilityId, new Set(entry.oldEvidence)]),
  );
  const reviewedOldInventoryEntries = [
    ...oldEmitterPortInventory,
    ...oldSuitePortInventory,
    ...oldProductUnitPortInventory,
  ].filter((entry) => entry.capabilityMappingStatus === "reviewed");

  assert.ok(reviewedOldInventoryEntries.length > 0);

  for (const entry of reviewedOldInventoryEntries) {
    const representedByLedger = entry.capabilityIds.some((capabilityId) =>
      oldEvidenceByCapability.get(capabilityId)?.has(entry.oldPath) === true,
    );
    assert.equal(
      representedByLedger,
      true,
      `${entry.oldPath} has reviewed old inventory mapping but no matching ledger oldEvidence`,
    );
  }
});
test("host and module capabilities carry reviewed old inventory proof", () => {
  const requiredOldEvidenceByCapability = new Map([
    [
      "host.project.module-graph",
      [
        "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
        "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
        "packages/frontend/src/program/entrypoint-scope.test.ts",
        "packages/frontend/src/program/program-input-discovery.test.ts",
        "packages/frontend/src/resolver/namespace.test.ts",
        "test/fixtures/barrel-reexports/",
        "test/fixtures/multi-file/",
        "test/fixtures/multi-file-imports/",
        "test/fixtures/multi-file-types/",
        "test/fixtures/namespace-imports/",
        "test/fixtures/source-package-basic/",
        "test/fixtures/source-package-subpath/",
        "test/fixtures/source-package-surface-mismatch/",
        "test/fixtures/top-level-code/",
      ],
    ],
    [
      "host.project.package-path-resolution",
      [
        "packages/cli/src/commands/build-cases/local-package-ownership.test.ts",
        "packages/cli/src/commands/build-source-package.test.ts",
        "packages/frontend/src/program/creation-cases/package-resolution.test.ts",
        "packages/frontend/src/program/package-roots.test.ts",
        "test/fixtures/source-package-basic/",
        "test/fixtures/source-package-subpath/",
        "test/fixtures/source-package-surface-mismatch/",
      ],
    ],
    [
      "host.project.top-level-initialization-order",
      [
        "packages/frontend/src/program/entrypoint-scope.test.ts",
        "test/fixtures/barrel-reexports/",
        "test/fixtures/module-const-array-mutation/",
        "test/fixtures/top-level-code/",
      ],
    ],
    [
      "module.import.type-only",
      [
        "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
        "test/fixtures/import-type-erase/",
        "test/fixtures/multi-file-types/",
      ],
    ],
    [
      "module.package.exports-subpath",
      [
        "packages/cli/src/commands/build-cases/local-package-ownership.test.ts",
        "packages/cli/src/commands/build-source-package.test.ts",
        "packages/frontend/src/program/creation-cases/package-resolution.test.ts",
        "packages/frontend/src/program/package-roots.test.ts",
        "test/fixtures/source-package-basic/",
        "test/fixtures/source-package-subpath/",
        "test/fixtures/source-package-surface-mismatch/",
      ],
    ],
  ]);
  const capabilityById = new Map(capabilityLedger.map((entry) => [entry.capabilityId, entry]));
  const oldEntriesByPath = new Map([
    ...oldEmitterPortInventory.map((entry) => [entry.oldPath, entry]),
    ...oldSuitePortInventory.map((entry) => [entry.oldPath, entry]),
    ...oldProductUnitPortInventory.map((entry) => [entry.oldPath, entry]),
  ]);

  for (const [capabilityId, requiredOldPaths] of requiredOldEvidenceByCapability) {
    const capability = capabilityById.get(capabilityId);
    assert.notEqual(capability, undefined, capabilityId);
    const oldEvidenceSet = new Set(capability.oldEvidence);

    for (const oldPath of requiredOldPaths) {
      assert.equal(oldEvidenceSet.has(oldPath), true, `${capabilityId} missing oldEvidence ${oldPath}`);
      const oldEntry = oldEntriesByPath.get(oldPath);
      assert.notEqual(oldEntry, undefined, `${capabilityId} references unknown old inventory path ${oldPath}`);
      assert.equal(oldEntry.capabilityMappingStatus, "reviewed", `${oldPath} must be a reviewed mapping for ${capabilityId}`);
      assert.equal(oldEntry.capabilityIds.includes(capabilityId), true, `${oldPath} is not bidirectionally mapped to ${capabilityId}`);
    }
  }
});
test("ledger oldEvidence paths are reviewed old inventory mappings", () => {
  const oldEntriesByPath = new Map([
    ...oldEmitterPortInventory.map((entry) => [entry.oldPath, entry]),
    ...oldSuitePortInventory.map((entry) => [entry.oldPath, entry]),
    ...oldProductUnitPortInventory.map((entry) => [entry.oldPath, entry]),
  ]);

  for (const entry of capabilityLedger) {
    for (const oldEvidencePath of entry.oldEvidence) {
      const oldEntry = oldEntriesByPath.get(oldEvidencePath);
      assert.notEqual(oldEntry, undefined, `${entry.capabilityId} references old evidence without an inventory entry: ${oldEvidencePath}`);
      assert.equal(
        oldEntry.capabilityMappingStatus,
        "reviewed",
        `${entry.capabilityId} old evidence is not reviewed by ${oldEvidencePath}`,
      );
      assert.equal(
        oldEntry.capabilityIds.includes(entry.capabilityId),
        true,
        `${entry.capabilityId} old evidence is not bidirectionally mapped by ${oldEvidencePath}`,
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