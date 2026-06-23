import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  capabilityLedger,
  capabilityOwners,
  capabilityStatuses,
} from "./capabilities/ledger.mjs";
import { buildCapabilityCoverageReport } from "./capabilities/coverage-report.mjs";

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
}) {
  return {
    capabilityId,
    title: `Capability ${capabilityId}`,
    status,
    owner,
    sourceExamples: [],
    tstsDecision: "TSTS decision",
    providerFacts: [],
    backendContract: "Backend contract",
    evidenceReview,
    positiveTests,
    negativeTests,
    oldEvidence,
    blockers,
    notes: "Test entry",
    ...(laneClassification === undefined ? {} : { laneClassification }),
  };
}
