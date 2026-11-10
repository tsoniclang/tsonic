import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  capabilityLedger,
  capabilityOwners,
  capabilityStatuses,
  capabilitySurfaceEvidenceGateNames,
  isReviewedOldEvidenceAbsence,
} from "./fixtures/ledger.mjs";
import { buildCapabilityCoverageReport } from "./fixtures/coverage-report.mjs";
import { oldEmitterPortInventory } from "../../infrastructure/historical-inventory/fixtures/emitter.mjs";
import { oldProductUnitPortInventory } from "../../infrastructure/historical-inventory/fixtures/product-unit.mjs";
import { oldSuitePortInventory } from "../../infrastructure/historical-inventory/fixtures/suite.mjs";



















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
  if (completeEntry.oldEvidence.length === 0 && !isReviewedOldEvidenceAbsence(completeEntry.oldEvidenceAbsence)) {
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
  oldEvidenceAbsence,
  includeLaneClassification = true,
  surfaceEvidence,
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
    ...(oldEvidenceAbsence === undefined ? {} : { oldEvidenceAbsence }),
    ...(surfaceEvidence === undefined ? {} : { surfaceEvidence }),
    blockers,
    notes: "Test entry",
    ...(includeLaneClassification
      ? {
        laneClassification: laneClassification ?? {
          patternKind: "validation-test-pattern",
          possibleLanes: ["static-native", "hard-reject"],
          canonical: {
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

test("capability coverage report summarizes surface evidence gates", () => {
  const report = buildCapabilityCoverageReport();
  const trackedLedgerEntries = capabilityLedger.filter((entry) =>
    entry.capabilityId.startsWith("surface.js") ||
    entry.capabilityId.startsWith("surface.node") ||
    entry.surfaceEvidence !== undefined
  );
  const surfaceCoverageById = new Map(
    report.surfaceEvidenceCoverage.byCapability.map((entry) => [entry.capabilityId, entry]),
  );

  assert.equal(report.rules.surfaceEvidenceIsLedgerEnforced, true);
  assert.equal(report.surfaceEvidenceCoverage.rules.failClosedGatesRequireNegativeTests, true);
  assert.equal(report.surfaceEvidenceCoverage.rules.implementationGatesRequirePositiveTests, true);
  assert.equal(report.surfaceEvidenceCoverage.summary.total, trackedLedgerEntries.length);
  assert.equal(report.surfaceEvidenceCoverage.proofHoles.length, 0);

  for (const ledgerEntry of trackedLedgerEntries) {
    const coverageEntry = surfaceCoverageById.get(ledgerEntry.capabilityId);
    assert.notEqual(coverageEntry, undefined, ledgerEntry.capabilityId);
    assert.equal(coverageEntry.status, ledgerEntry.status, ledgerEntry.capabilityId);
    assert.equal(coverageEntry.owner, ledgerEntry.owner, ledgerEntry.capabilityId);
    assert.deepEqual(coverageEntry.surfaceEvidence, ledgerEntry.surfaceEvidence ?? null, ledgerEntry.capabilityId);
  }
});
test("capability coverage report flags missing and malformed surface evidence gates", () => {
  const report = buildCapabilityCoverageReport({
    ledgerEntries: [
      capabilityEntry({
        capabilityId: "surface.js.complete-missing",
        status: "complete",
        owner: "surface-provider",
        evidenceReview: "reviewed",
        positiveTests: ["test/current-positive.test.mjs"],
        negativeTests: ["test/current-negative.test.mjs"],
        oldEvidence: ["old/example.test.ts"],
      }),
      capabilityEntry({
        capabilityId: "surface.node.invalid-gates",
        status: "complete",
        owner: "surface-provider",
        evidenceReview: "reviewed",
        positiveTests: ["test/current-positive.test.mjs"],
        negativeTests: ["test/current-negative.test.mjs"],
        oldEvidence: ["old/example.test.ts"],
        surfaceEvidence: {
          selectedOperationFacts: ["test/current-negative.test.mjs"],
          providerFacts: ["test/current-positive.test.mjs"],
          backendEmission: ["test/current-positive.test.mjs"],
          runtimeBehavior: ["test/current-positive.test.mjs"],
          failClosedDiagnostics: ["test/current-positive.test.mjs"],
          backendNoFallback: ["test/current-negative.test.mjs"],
        },
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

  assert.equal(report.surfaceEvidenceCoverage.summary.proofStatus, "hole");
  assert.equal(report.surfaceEvidenceCoverage.summary.missingSurfaceEvidence, 1);
  assert.equal(report.surfaceEvidenceCoverage.summary.invalidSurfaceEvidence, 1);
  assert.deepEqual(report.surfaceEvidenceCoverage.proofHoles, [
    {
      capabilityId: "surface.js.complete-missing",
      title: "Capability surface.js.complete-missing",
      status: "complete",
      owner: "surface-provider",
      evidenceStatus: "missing",
      proofHoles: ["complete surface capabilities must have surfaceEvidence"],
    },
    {
      capabilityId: "surface.node.invalid-gates",
      title: "Capability surface.node.invalid-gates",
      status: "complete",
      owner: "surface-provider",
      evidenceStatus: "invalid",
      proofHoles: [
        "surfaceEvidence.selectedOperationFacts must reference positiveTests",
        "surfaceEvidence.failClosedDiagnostics must reference negativeTests",
      ],
    },
  ]);
});
test("capability coverage report CLI emits machine-readable JSON", () => {
  const result = spawnSync(process.execPath, ["test/host/capabilities/fixtures/coverage-report.mjs"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.reportKind, "tsonic-capability-coverage");
  assert.equal(parsed.counts.total, capabilityLedger.length);
});
