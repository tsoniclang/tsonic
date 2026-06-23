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

test("capability coverage report exposes oldEvidence coverage", () => {
  const report = buildCapabilityCoverageReport();
  const ledgerOldEvidencePaths = capabilityLedger.flatMap((entry) => entry.oldEvidence);
  const ledgerOldEvidencePathSet = new Set(ledgerOldEvidencePaths);
  const oldEvidenceByCapability = new Map(
    report.oldEvidenceCoverage.byCapability.map((entry) => [entry.capabilityId, entry]),
  );

  assert.equal(report.oldEvidenceCoverage.unknownOldEvidencePaths.length, 0);
  assert.equal(report.oldEvidenceCoverage.ledgerOldEvidenceReferenceCount, ledgerOldEvidencePaths.length);
  assert.equal(report.oldEvidenceCoverage.ledgerOldEvidencePathCount, ledgerOldEvidencePathSet.size);

  for (const ledgerEntry of capabilityLedger.filter((entry) => entry.oldEvidence.length > 0)) {
    assert.deepEqual(
      oldEvidenceByCapability.get(ledgerEntry.capabilityId).ledgerOldEvidence,
      [...ledgerEntry.oldEvidence],
      ledgerEntry.capabilityId,
    );
  }
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
  if (completeEntry.oldPositiveEvidence.length > 0) {
    holes.push("positive-proof-uses-old-evidence");
  }
  if (completeEntry.oldNegativeEvidence.length > 0) {
    holes.push("negative-proof-uses-old-evidence");
  }
  return holes;
}
