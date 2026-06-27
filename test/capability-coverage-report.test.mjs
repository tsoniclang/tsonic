import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  capabilityCompatRuntimeCarriers,
  capabilityLedger,
  capabilityOwners,
  capabilityStatuses,
} from "./capabilities/ledger.mjs";
import { buildCapabilityCoverageReport } from "./capabilities/coverage-report.mjs";
import { oldEmitterPortInventory } from "./old-emitter-inventory/inventory.mjs";
import { oldProductUnitPortInventory } from "./old-product-unit-inventory/inventory.mjs";
import { oldSuitePortInventory } from "./old-suite-inventory/inventory.mjs";

test("capability coverage report exposes counts by status and owner", () => {
  const report = buildCapabilityCoverageReport();

  assert.equal(report.reportKind, "tsonic-capability-coverage");
  assert.equal(report.counts.total, capabilityLedger.length);

  for (const status of capabilityStatuses) {
    assert.equal(
      report.counts.byStatus[status],
      capabilityLedger.filter((entry) => entry.status === status).length,
      status,
    );
  }

  for (const owner of capabilityOwners) {
    assert.equal(
      report.counts.byOwner[owner],
      capabilityLedger.filter((entry) => entry.owner === owner).length,
      owner,
    );

    for (const status of capabilityStatuses) {
      assert.equal(
        report.counts.byOwnerAndStatus[owner][status],
        capabilityLedger.filter((entry) => entry.owner === owner && entry.status === status).length,
        `${owner}/${status}`,
      );
    }
  }
});

test("capability coverage report exposes ledger validation as a gate", () => {
  const report = buildCapabilityCoverageReport();

  assert.equal(report.rules.capabilityLedgerValidationIsEnforced, true);
  assert.equal(report.ledgerValidation.rules.entriesMustPassSingleEntryValidation, true);
  assert.equal(report.ledgerValidation.rules.completeCapabilitiesRequirePositiveAndNegativeProof, true);
  assert.equal(report.ledgerValidation.rules.completeCapabilitiesRequireCurrentPositiveAndNegativeProof, true);
  assert.equal(report.ledgerValidation.rules.positiveNegativeProofMustNotUseOldEvidence, true);
  assert.equal(report.ledgerValidation.rules.completeBroadCapabilitiesRequireCompleteSubCapabilityEvidence, true);
  assert.equal(report.ledgerValidation.summary.entryCount, capabilityLedger.length);
  assert.equal(report.ledgerValidation.summary.validationErrorCount, 0);
  assert.equal(report.ledgerValidation.summary.proofStatus, "proven");
  assert.deepEqual(report.ledgerValidation.proofHoles, []);
});

test("capability coverage report flags complete broad capabilities with incomplete children", () => {
  const report = buildCapabilityCoverageReport({
    ledgerEntries: [
      capabilityEntry({
        capabilityId: "example.broad",
        status: "complete",
        evidenceReview: "reviewed",
        positiveTests: ["test/current-positive.test.mjs"],
        negativeTests: ["test/current-negative.test.mjs"],
        oldEvidence: ["old/example.test.ts"],
      }),
      capabilityEntry({
        capabilityId: "example.broad.child",
        status: "blocked",
        blockers: ["Synthetic blocked child capability."],
      }),
    ],
    oldEvidenceSourceGroups: [
      {
        source: "test-old-source",
        paths: ["old/example.test.ts"],
      },
    ],
    oldInventoryEntries: [],
  });

  assert.equal(report.ledgerValidation.summary.validationErrorCount, 1);
  assert.equal(report.ledgerValidation.summary.proofStatus, "hole");
  assert.deepEqual(report.ledgerValidation.proofHoles, [
    {
      proofHole: "capability-ledger-validation",
      error:
        "example.broad: complete broad capabilities require complete sub-capability evidence; example.broad.child is blocked",
    },
  ]);
});

test("capability coverage report lists complete capabilities with proof holes", () => {
  const report = buildCapabilityCoverageReport();
  const completeLedgerEntries = capabilityLedger.filter((entry) => entry.status === "complete");
  const completeLedgerById = new Map(completeLedgerEntries.map((entry) => [entry.capabilityId, entry]));

  assert.deepEqual(
    report.completeCapabilities.map((entry) => entry.capabilityId),
    completeLedgerEntries.map((entry) => entry.capabilityId),
  );

  for (const completeEntry of report.completeCapabilities) {
    const ledgerEntry = completeLedgerById.get(completeEntry.capabilityId);
    assert.deepEqual(completeEntry.positiveTests, [...ledgerEntry.positiveTests], completeEntry.capabilityId);
    assert.deepEqual(completeEntry.negativeTests, [...ledgerEntry.negativeTests], completeEntry.capabilityId);
    assert.deepEqual(completeEntry.oldEvidence, [...ledgerEntry.oldEvidence], completeEntry.capabilityId);
    assert.deepEqual(completeEntry.proofHoles, expectedProofHoles(completeEntry), completeEntry.capabilityId);
    assert.equal(completeEntry.proofStatus, completeEntry.proofHoles.length === 0 ? "proven" : "hole");
  }

  assert.deepEqual(
    report.completeCapabilityProofHoles.map((entry) => entry.capabilityId),
    report.completeCapabilities
      .filter((entry) => entry.proofHoles.length > 0)
      .map((entry) => entry.capabilityId),
  );
});

test("capability coverage report flags complete proof holes for missing reviewed and old evidence", () => {
  const report = buildCapabilityCoverageReport({
    ledgerEntries: [
      capabilityEntry({
        capabilityId: "host.project.target-selection",
        status: "complete",
        evidenceReview: "seeded",
        positiveTests: ["test/current-positive.test.mjs"],
        negativeTests: ["test/current-negative.test.mjs"],
        oldEvidence: [],
      }),
    ],
    oldEvidenceSourceGroups: [],
    oldInventoryEntries: [],
  });

  assert.deepEqual(report.completeCapabilities[0].proofHoles, [
    "missing-reviewed-evidence",
    "missing-old-evidence",
  ]);
  assert.deepEqual(report.completeCapabilityProofHoles[0].proofHoles, [
    "missing-reviewed-evidence",
    "missing-old-evidence",
  ]);
});

test("capability coverage report validates complete proof is current", () => {
  const report = buildCapabilityCoverageReport({
    ledgerEntries: [
      capabilityEntry({
        capabilityId: "host.project.target-selection",
        status: "complete",
        evidenceReview: "reviewed",
        positiveTests: ["old/positive.test.ts"],
        negativeTests: ["old/negative.test.ts"],
        oldEvidence: ["old/evidence.test.ts"],
      }),
    ],
    oldEvidenceSourceGroups: [
      {
        source: "test-old-source",
        paths: ["old/positive.test.ts", "old/negative.test.ts", "old/evidence.test.ts"],
      },
    ],
    oldInventoryEntries: [],
  });

  assert.equal(report.ledgerValidation.summary.validationErrorCount, 4);
  assert.deepEqual(report.ledgerValidation.proofHoles, [
    {
      proofHole: "capability-ledger-validation",
      error: "host.project.target-selection: complete capabilities must have current positiveTests",
    },
    {
      proofHole: "capability-ledger-validation",
      error: "host.project.target-selection: complete capabilities must have current negativeTests",
    },
    {
      proofHole: "capability-ledger-validation",
      error: "host.project.target-selection: positiveTests must not reference old evidence paths",
    },
    {
      proofHole: "capability-ledger-validation",
      error: "host.project.target-selection: negativeTests must not reference old evidence paths",
    },
  ]);
  assert.deepEqual(report.completeCapabilityProofHoles[0].proofHoles, [
    "missing-current-positive-proof",
    "missing-current-negative-proof",
    "positive-proof-uses-old-evidence",
    "negative-proof-uses-old-evidence",
  ]);
});

test("capability coverage report exposes partial and not-started blockers", () => {
  const report = buildCapabilityCoverageReport();
  const blockerLedgerEntries = capabilityLedger
    .filter((entry) => entry.status === "partial" || entry.status === "not-started");
  const reportBlockersById = new Map(report.partialNotStartedBlockers.map((entry) => [entry.capabilityId, entry]));

  assert.equal(report.partialNotStartedBlockers.length, blockerLedgerEntries.length);
  assert.equal(report.partialNotStartedBlockerSummary.total, blockerLedgerEntries.length);

  for (const ledgerEntry of blockerLedgerEntries) {
    const reportEntry = reportBlockersById.get(ledgerEntry.capabilityId);
    assert.equal(reportEntry.status, ledgerEntry.status, ledgerEntry.capabilityId);
    assert.equal(reportEntry.owner, ledgerEntry.owner, ledgerEntry.capabilityId);
    assert.deepEqual(reportEntry.blockers, [...ledgerEntry.blockers], ledgerEntry.capabilityId);
    assert.equal(
      reportEntry.blockerStatus,
      ledgerEntry.blockers.length === 0 ? "missing" : "present",
      ledgerEntry.capabilityId,
    );
  }
});

test("capability coverage report exposes blocker coverage for all incomplete work", () => {
  const report = buildCapabilityCoverageReport();
  const trackedLedgerEntries = capabilityLedger
    .filter((entry) => report.blockerCoverage.rules.trackedStatuses.includes(entry.status));
  const blockerCoverageById = new Map(
    report.blockerCoverage.byCapability.map((entry) => [entry.capabilityId, entry]),
  );

  assert.equal(report.blockerCoverage.rules.incompleteCapabilitiesRequireBlockers, true);
  assert.equal(report.blockerCoverage.summary.total, trackedLedgerEntries.length);
  assert.equal(report.blockerCoverage.summary.withBlockers, trackedLedgerEntries.length);
  assert.equal(report.blockerCoverage.summary.missingBlockers, 0);
  assert.deepEqual(report.blockerCoverage.proofHoles, []);

  for (const ledgerEntry of trackedLedgerEntries) {
    const coverageEntry = blockerCoverageById.get(ledgerEntry.capabilityId);
    assert.equal(coverageEntry.status, ledgerEntry.status, ledgerEntry.capabilityId);
    assert.equal(coverageEntry.owner, ledgerEntry.owner, ledgerEntry.capabilityId);
    assert.deepEqual(coverageEntry.blockers, [...ledgerEntry.blockers], ledgerEntry.capabilityId);
    assert.equal(coverageEntry.blockerStatus, "present", ledgerEntry.capabilityId);
  }
});

test("capability coverage report exposes oldEvidence coverage", () => {
  const report = buildCapabilityCoverageReport();
  const ledgerOldEvidencePaths = capabilityLedger.flatMap((entry) => entry.oldEvidence);
  const ledgerOldEvidencePathSet = new Set(ledgerOldEvidencePaths);
  const oldEvidenceByCapability = new Map(
    report.oldEvidenceCoverage.byCapability.map((entry) => [entry.capabilityId, entry]),
  );

  assert.equal(report.oldEvidenceCoverage.unknownOldEvidencePaths.length, 0);
  assert.equal(report.oldEvidenceCoverage.rules.oldEvidencePathsMustBeClassified, true);
  assert.equal(report.oldEvidenceCoverage.rules.completeOldEvidenceMustBeBidirectionallyMapped, true);
  assert.equal(report.oldEvidenceCoverage.ledgerOldEvidenceReferenceCount, ledgerOldEvidencePaths.length);
  assert.equal(report.oldEvidenceCoverage.ledgerOldEvidencePathCount, ledgerOldEvidencePathSet.size);
  assert.equal(report.oldEvidenceCoverage.summary.unknownOldEvidencePaths, 0);
  assert.equal(report.oldEvidenceCoverage.summary.completeCapabilitiesWithBidirectionalHoles, 0);
  assert.deepEqual(report.oldEvidenceCoverage.proofHoles, []);

  for (const ledgerEntry of capabilityLedger.filter((entry) => entry.oldEvidence.length > 0)) {
    assert.deepEqual(
      oldEvidenceByCapability.get(ledgerEntry.capabilityId).ledgerOldEvidence,
      [...ledgerEntry.oldEvidence],
      ledgerEntry.capabilityId,
    );
  }
});

test("capability coverage report proves old inventory coverage by inventory", () => {
  const report = buildCapabilityCoverageReport();
  const inventoryCoverageByName = new Map(
    report.oldInventoryCoverage.byInventory.map((entry) => [entry.inventory, entry]),
  );

  assert.equal(report.rules.oldInventoryCoverageIsSeparatedByInventory, true);
  assert.equal(report.oldInventoryCoverage.rules.inventoriesAreReportedSeparately, true);
  assert.equal(report.oldInventoryCoverage.rules.entriesRequireCapabilityIds, true);
  assert.equal(report.oldInventoryCoverage.rules.capabilityIdsMustExistInLedger, true);
  assert.equal(report.oldInventoryCoverage.rules.staleInvalidArchitectureRequiresReplacementCapabilities, true);
  assert.equal(report.oldInventoryCoverage.rules.staleReplacementCapabilitiesMustExistInLedger, true);
  assert.equal(report.oldInventoryCoverage.rules.staleReplacementCapabilitiesMustBeMappedAsEvidence, true);
  assert.equal(report.oldInventoryCoverage.summary.inventoryCount, 3);
  assert.equal(
    report.oldInventoryCoverage.summary.entryCount,
    oldSuitePortInventory.length + oldEmitterPortInventory.length + oldProductUnitPortInventory.length,
  );
  assert.equal(report.oldInventoryCoverage.summary.invalidEntryCount, 0);
  assert.equal(report.oldInventoryCoverage.summary.proofHoleCount, 0);
  assert.equal(report.oldInventoryCoverage.summary.proofStatus, "proven");
  assert.deepEqual(report.oldInventoryCoverage.proofHoles, []);

  assertOldInventoryCoverage(inventoryCoverageByName.get("old-fixture"), oldSuitePortInventory, {
    total: 198,
    ported: 44,
    deferred: 151,
    "invalid-stale-architecture": 3,
  });
  assertOldInventoryCoverage(inventoryCoverageByName.get("old-csharp-emitter"), oldEmitterPortInventory, {
    total: 73,
    ported: 55,
    deferred: 14,
    "replaced-by-stronger-test": 2,
    "invalid-stale-architecture": 2,
  });
  assertOldInventoryCoverage(inventoryCoverageByName.get("old-product-unit"), oldProductUnitPortInventory, {
    total: 109,
    ported: 4,
    deferred: 79,
    "invalid-stale-architecture": 26,
  });
});

test("capability coverage report exposes old inventory proof holes", () => {
  const report = buildCapabilityCoverageReport({
    oldInventoryCoverageSources: [
      {
        inventory: "old-fixture",
        statuses: ["ported", "invalid-stale-architecture"],
        entries: [
          {
            oldPath: "test/fixtures/stale/",
            status: "invalid-stale-architecture",
            capabilityIds: ["unknown.capability"],
            replacementCapabilityIds: [],
            replacementCapabilityPath: "",
            capabilityMappingStatus: "reviewed",
          },
        ],
        validate: () => ["replacementCapabilityIds must be a non-empty array"],
      },
    ],
  });

  assert.equal(report.oldInventoryCoverage.summary.inventoryCount, 1);
  assert.equal(report.oldInventoryCoverage.summary.entryCount, 1);
  assert.equal(report.oldInventoryCoverage.summary.invalidEntryCount, 1);
  assert.equal(report.oldInventoryCoverage.summary.proofHoleCount, 1);
  assert.equal(report.oldInventoryCoverage.summary.proofStatus, "hole");
  assert.deepEqual(report.oldInventoryCoverage.proofHoles, [
    {
      inventory: "old-fixture",
      oldPath: "test/fixtures/stale/",
      status: "invalid-stale-architecture",
      proofHoles: [
        "inventory-validation: replacementCapabilityIds must be a non-empty array",
        "unknown-capabilityId: unknown.capability",
        "missing-replacementCapabilityIds",
        "missing-replacementCapabilityPath",
      ],
    },
  ]);
});

test("capability coverage report exposes complete oldEvidence bidirectional mapping holes", () => {
  const report = buildCapabilityCoverageReport({
    ledgerEntries: [
      capabilityEntry({
        capabilityId: "host.project.target-selection",
        status: "complete",
        evidenceReview: "reviewed",
        positiveTests: ["test/current-positive.test.mjs"],
        negativeTests: ["test/current-negative.test.mjs"],
        oldEvidence: ["old/a.test.ts"],
      }),
    ],
    oldEvidenceSourceGroups: [
      {
        source: "test-old-source",
        paths: ["old/a.test.ts", "old/b.test.ts"],
      },
    ],
    oldInventoryEntries: [
      {
        inventory: "test-old-inventory",
        oldPath: "old/b.test.ts",
        status: "ported",
        capabilityIds: ["host.project.target-selection"],
      },
    ],
  });

  assert.equal(report.oldEvidenceCoverage.summary.completeCapabilitiesWithBidirectionalHoles, 1);
  assert.deepEqual(report.oldEvidenceCoverage.byCapability[0].missingLedgerOldEvidencePaths, ["old/b.test.ts"]);
  assert.deepEqual(report.oldEvidenceCoverage.byCapability[0].ledgerOldEvidenceNotInInventoryPaths, ["old/a.test.ts"]);
  assert.deepEqual(report.oldEvidenceCoverage.proofHoles, [
    {
      capabilityId: "host.project.target-selection",
      title: "Capability host.project.target-selection",
      status: "complete",
      owner: "target-provider",
      proofHoles: [
        "ledger-old-evidence-not-in-inventory",
      ],
      missingLedgerOldEvidencePaths: ["old/b.test.ts"],
      ledgerOldEvidenceNotInInventoryPaths: ["old/a.test.ts"],
    },
  ]);
});

test("capability coverage report summarizes lane classification coverage", () => {
  const report = buildCapabilityCoverageReport();
  const trackedLedgerEntries = capabilityLedger.filter((entry) =>
    report.laneClassificationCoverage.rules.trackedStatuses.includes(entry.status) ||
    entry.laneClassification !== undefined
  );
  const laneCoverageById = new Map(
    report.laneClassificationCoverage.byCapability.map((entry) => [entry.capabilityId, entry]),
  );

  assert.equal(report.rules.laneClassificationIsLedgerEnforced, true);
  assert.equal(report.laneClassificationCoverage.rules.allLedgerEntriesWithLaneClassificationAreTracked, true);
  assert.equal(report.laneClassificationCoverage.rules.compatRuntimeCarriersMustBeClosed, true);
  assert.deepEqual(report.laneClassificationCoverage.rules.allowedCompatRuntimeCarriers, [...capabilityCompatRuntimeCarriers]);
  assert.equal(report.laneClassificationCoverage.summary.total, trackedLedgerEntries.length);
  assert.equal(report.laneClassificationCoverage.proofHoles.length, report.laneClassificationCoverage.summary.withProofHoles);

  for (const ledgerEntry of trackedLedgerEntries) {
    const coverageEntry = laneCoverageById.get(ledgerEntry.capabilityId);
    assert.equal(coverageEntry.status, ledgerEntry.status, ledgerEntry.capabilityId);
    assert.equal(coverageEntry.owner, ledgerEntry.owner, ledgerEntry.capabilityId);
    assert.deepEqual(coverageEntry.laneClassification, ledgerEntry.laneClassification ?? null, ledgerEntry.capabilityId);
  }
});

test("capability coverage report mirrors lane classifications and reports proof holes", () => {
  const validLaneClassification = {
    patternKind: "dynamic-get",
    possibleLanes: ["static-native", "compat-runtime", "hard-reject"],
    strictNative: {
      lane: "hard-reject",
      reason: "Dynamic get requires compatibility mode.",
    },
    compat: {
      lane: "compat-runtime",
      requiredFacts: ["runtime.dynamic.carrier", "compat.any.dynamic-get"],
      runtimeCarrier: "TsValue",
      operation: "GetProperty",
    },
    staticNative: {
      lane: "static-native",
      requiredFacts: ["selected-source-or-provider-shape", "selected-target-member"],
    },
    hardReject: {
      lane: "hard-reject",
      reasons: ["strict-native-selected", "missing-runtime-carrier-fact"],
    },
  };
  const invalidLaneClassification = {
    patternKind: "",
    possibleLanes: ["compat-runtime", "runtime-reflection"],
    compat: {
      lane: "compat-runtime",
      operation: "CallProperty",
    },
    hardReject: {
      reasons: [],
    },
  };
  const report = buildCapabilityCoverageReport({
    ledgerEntries: [
      capabilityEntry({
        capabilityId: "compat.any.dynamic-get",
        status: "not-started",
        laneClassification: validLaneClassification,
      }),
      capabilityEntry({
        capabilityId: "operation.iteration.for-in.keys",
        status: "partial",
        includeLaneClassification: false,
      }),
      capabilityEntry({
        capabilityId: "compat.any.dynamic-call",
        status: "blocked",
        laneClassification: invalidLaneClassification,
        blockers: ["Requires dynamic carrier operation metadata."],
      }),
    ],
    oldEvidenceSourceGroups: [],
    oldInventoryEntries: [],
  });
  const laneCoverageById = new Map(
    report.laneClassificationCoverage.byCapability.map((entry) => [entry.capabilityId, entry]),
  );

  assert.equal(report.laneClassificationCoverage.summary.total, 3);
  assert.equal(report.laneClassificationCoverage.summary.coveredLaneClassification, 1);
  assert.equal(report.laneClassificationCoverage.summary.missingLaneClassification, 1);
  assert.equal(report.laneClassificationCoverage.summary.invalidLaneClassification, 1);

  const validCoverage = laneCoverageById.get("compat.any.dynamic-get");
  assert.equal(validCoverage.classificationStatus, "covered");
  assert.deepEqual(validCoverage.laneClassification, validLaneClassification);
  assert.deepEqual(validCoverage.possibleLanes, validLaneClassification.possibleLanes);
  assert.deepEqual(validCoverage.proofHoles, []);

  const missingCoverage = laneCoverageById.get("operation.iteration.for-in.keys");
  assert.equal(missingCoverage.classificationStatus, "missing");
  assert.deepEqual(missingCoverage.proofHoles, ["laneClassification must be an object"]);

  const invalidCoverage = laneCoverageById.get("compat.any.dynamic-call");
  assert.equal(invalidCoverage.classificationStatus, "invalid");
  assert.deepEqual(invalidCoverage.invalidPossibleLanes, ["runtime-reflection"]);
  assert.ok(invalidCoverage.proofHoles.includes("laneClassification.patternKind must be a non-empty string"));
  assert.ok(invalidCoverage.proofHoles.includes("laneClassification.possibleLanes must contain only static-native, compat-runtime, hard-reject"));
  assert.ok(invalidCoverage.proofHoles.includes("laneClassification.strictNative must be an object"));
  assert.ok(invalidCoverage.proofHoles.includes("laneClassification.compat.requiredFacts must be a non-empty array"));
  assert.ok(invalidCoverage.proofHoles.includes("laneClassification.compat.runtimeCarrier must be a non-empty string when lane is compat-runtime"));
  assert.ok(invalidCoverage.proofHoles.includes("laneClassification.hardReject.reasons must be a non-empty array"));

  assert.deepEqual(
    report.laneClassificationCoverage.proofHoles.map((entry) => entry.capabilityId),
    ["operation.iteration.for-in.keys", "compat.any.dynamic-call"],
  );
});

test("capability coverage report CLI emits machine-readable JSON", () => {
  const result = spawnSync(process.execPath, ["test/capabilities/coverage-report.mjs"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.reportKind, "tsonic-capability-coverage");
  assert.equal(parsed.counts.total, capabilityLedger.length);
});

function expectedProofHoles(completeEntry) {
  const holes = [];
  if (completeEntry.currentPositiveTests.length === 0) {
    holes.push("missing-current-positive-proof");
  }
  if (completeEntry.currentNegativeTests.length === 0) {
    holes.push("missing-current-negative-proof");
  }
  if (completeEntry.evidenceReview !== "reviewed") {
    holes.push("missing-reviewed-evidence");
  }
  if (completeEntry.oldEvidence.length === 0) {
    holes.push("missing-old-evidence");
  }
  if (completeEntry.oldPositiveEvidence.length > 0) {
    holes.push("positive-proof-uses-old-evidence");
  }
  if (completeEntry.oldNegativeEvidence.length > 0) {
    holes.push("negative-proof-uses-old-evidence");
  }
  return holes;
}

function assertOldInventoryCoverage(reportEntry, inventoryEntries, expectedStatusCounts) {
  assert.notEqual(reportEntry, undefined);
  assert.equal(reportEntry.entryCount, expectedStatusCounts.total);
  assert.equal(reportEntry.entryCount, inventoryEntries.length);
  assert.equal(reportEntry.validationErrorCount, 0);
  assert.equal(reportEntry.invalidEntryCount, 0);
  assert.deepEqual(reportEntry.invalidEntries, []);
  assert.deepEqual(reportEntry.proofHoles, []);

  for (const [status, expectedCount] of Object.entries(expectedStatusCounts)) {
    if (status === "total") {
      continue;
    }
    assert.equal(reportEntry.statusCounts[status], expectedCount, `${reportEntry.inventory}/${status}`);
  }

  for (const staleEntry of reportEntry.staleEntries) {
    assert.equal(staleEntry.replacementStatus, "mapped", `${reportEntry.inventory}/${staleEntry.oldPath}`);
    assert.ok(staleEntry.replacementCapabilityIds.length > 0, `${reportEntry.inventory}/${staleEntry.oldPath}`);
    assert.notEqual(staleEntry.replacementCapabilityPath, null, `${reportEntry.inventory}/${staleEntry.oldPath}`);
  }
}

function capabilityEntry({
  capabilityId,
  status,
  owner = "target-provider",
  laneClassification,
  blockers = [],
  evidenceReview = "seeded",
  positiveTests = [],
  negativeTests = [],
  oldEvidence = [],
  includeLaneClassification = true,
}) {
  return {
    capabilityId,
    title: `Capability ${capabilityId}`,
    status,
    owner,
    sourceExamples: [`${capabilityId} source example`],
    tstsDecision: "TSTS decision",
    providerFacts: [],
    backendContract: "Backend contract",
    evidenceReview,
    positiveTests,
    negativeTests,
    oldEvidence,
    blockers,
    notes: "Test entry",
    ...(includeLaneClassification
      ? {
        laneClassification: laneClassification ?? {
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
      }
      : {}),
  };
}
