import { pathToFileURL } from "node:url";
import {
  capabilityLedger,
  capabilityOwners,
  capabilityStatuses,
} from "./ledger.mjs";
import {
  oldEmitterHistoricalCasePaths,
  oldEmitterPortInventory,
} from "../old-emitter-inventory/inventory.mjs";
import {
  oldProductUnitHistoricalTestFiles,
  oldProductUnitPortInventory,
} from "../old-product-unit-inventory/inventory.mjs";
import { oldSuitePortInventory } from "../old-suite-inventory/inventory.mjs";

const incompleteBlockerStatuses = Object.freeze(["partial", "not-started"]);

export function buildCapabilityCoverageReport({
  ledgerEntries = capabilityLedger,
  statuses = capabilityStatuses,
  owners = capabilityOwners,
  oldEvidenceSourceGroups = defaultOldEvidenceSourceGroups(),
  oldInventoryEntries = defaultOldInventoryEntries(),
} = {}) {
  const classifiedOldEvidencePathSet = pathSetFromGroups(oldEvidenceSourceGroups);
  const oldInventoryEvidenceByCapability = groupOldInventoryEvidenceByCapability(oldInventoryEntries);
  const completeCapabilities = ledgerEntries
    .filter((entry) => entry.status === "complete")
    .map((entry) => completeCapabilityEvidence(entry, classifiedOldEvidencePathSet));
  const partialNotStartedBlockers = ledgerEntries
    .filter((entry) => incompleteBlockerStatuses.includes(entry.status))
    .map(partialNotStartedBlocker);
  const completeCapabilityProofHoles = completeCapabilities
    .filter((entry) => entry.proofHoles.length > 0)
    .map((entry) => ({
      capabilityId: entry.capabilityId,
      title: entry.title,
      owner: entry.owner,
      proofHoles: entry.proofHoles,
      evidenceScope: entry.evidenceScope,
      currentPositiveTests: entry.currentPositiveTests,
      currentNegativeTests: entry.currentNegativeTests,
      oldPositiveEvidence: entry.oldPositiveEvidence,
      oldNegativeEvidence: entry.oldNegativeEvidence,
      parentScopedCurrentTests: entry.parentScopedCurrentTests,
    }));

  return {
    schemaVersion: 1,
    reportKind: "tsonic-capability-coverage",
    rules: {
      ledgerIsSourceOfTruth: true,
      oldTestsAreEvidenceOnly: true,
      completeRequiresCurrentPositiveAndNegativeProof: true,
      completeParentOnlyProofIsHole: true,
    },
    counts: {
      total: ledgerEntries.length,
      byStatus: countByStatus(ledgerEntries, statuses),
      byOwner: countByOwner(ledgerEntries, owners),
      byOwnerAndStatus: countByOwnerAndStatus(ledgerEntries, owners, statuses),
    },
    completeCapabilities,
    partialNotStartedBlockers,
    partialNotStartedBlockerSummary: summarizePartialNotStartedBlockers(partialNotStartedBlockers),
    oldEvidenceCoverage: oldEvidenceCoverage(
      ledgerEntries,
      oldEvidenceSourceGroups,
      classifiedOldEvidencePathSet,
      oldInventoryEvidenceByCapability,
    ),
    completeCapabilityProofHoles,
  };
}

function defaultOldEvidenceSourceGroups() {
  return [
    {
      source: "old-emitter-inventory",
      paths: oldEmitterPortInventory.map((entry) => entry.oldPath),
    },
    {
      source: "old-emitter-historical-cases",
      paths: oldEmitterHistoricalCasePaths,
    },
    {
      source: "old-suite-inventory",
      paths: oldSuitePortInventory.map((entry) => entry.oldPath),
    },
    {
      source: "old-product-unit-historical-tests",
      paths: oldProductUnitHistoricalTestFiles,
    },
  ];
}

function defaultOldInventoryEntries() {
  return [
    ...oldEmitterPortInventory.map((entry) => oldInventoryEvidence("old-emitter", entry)),
    ...oldSuitePortInventory.map((entry) => oldInventoryEvidence("old-suite", entry)),
    ...oldProductUnitPortInventory.map((entry) => oldInventoryEvidence("old-product-unit", entry)),
  ];
}

function oldInventoryEvidence(inventory, entry) {
  return {
    inventory,
    oldPath: entry.oldPath,
    status: entry.status,
    capabilityIds: [...entry.capabilityIds],
  };
}

function countByStatus(entries, statuses) {
  const counts = zeroCountRecord(statuses);
  for (const entry of entries) {
    increment(counts, entry.status);
  }
  return counts;
}

function countByOwner(entries, owners) {
  const counts = zeroCountRecord(owners);
  for (const entry of entries) {
    increment(counts, entry.owner);
  }
  return counts;
}

function countByOwnerAndStatus(entries, owners, statuses) {
  const counts = Object.fromEntries(owners.map((owner) => [owner, zeroCountRecord(statuses)]));
  for (const entry of entries) {
    if (counts[entry.owner] === undefined) {
      counts[entry.owner] = zeroCountRecord(statuses);
    }
    increment(counts[entry.owner], entry.status);
  }
  return counts;
}

function zeroCountRecord(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function increment(counts, key) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function completeCapabilityEvidence(entry, classifiedOldEvidencePathSet) {
  const positiveTests = [...entry.positiveTests];
  const negativeTests = [...entry.negativeTests];
  const oldEvidence = [...entry.oldEvidence];
  const currentPositiveTests = positiveTests.filter((testPath) => !classifiedOldEvidencePathSet.has(testPath));
  const currentNegativeTests = negativeTests.filter((testPath) => !classifiedOldEvidencePathSet.has(testPath));
  const oldPositiveEvidence = positiveTests.filter((testPath) => classifiedOldEvidencePathSet.has(testPath));
  const oldNegativeEvidence = negativeTests.filter((testPath) => classifiedOldEvidencePathSet.has(testPath));
  const currentProofTests = uniqueSorted([...currentPositiveTests, ...currentNegativeTests]);
  const externalCurrentTests = currentProofTests.filter(externalCurrentPath);
  const repoScopedCurrentTests = currentProofTests.filter((testPath) => !externalCurrentPath(testPath));
  const proofHoles = completeProofHoles({
    currentPositiveTests,
    currentNegativeTests,
    oldPositiveEvidence,
    oldNegativeEvidence,
  });

  return {
    capabilityId: entry.capabilityId,
    title: entry.title,
    owner: entry.owner,
    evidenceReview: entry.evidenceReview,
    proofStatus: proofHoles.length === 0 ? "proven" : "hole",
    proofHoles,
    evidenceScope: evidenceScope(currentProofTests, repoScopedCurrentTests, externalCurrentTests),
    positiveTests,
    negativeTests,
    currentPositiveTests,
    currentNegativeTests,
    oldPositiveEvidence,
    oldNegativeEvidence,
    oldEvidence,
    repoScopedCurrentTests,
    externalCurrentTests,
    notes: entry.notes,
  };
}

function completeProofHoles({
  currentPositiveTests,
  currentNegativeTests,
  oldPositiveEvidence,
  oldNegativeEvidence,
}) {
  const holes = [];
  if (currentPositiveTests.length === 0) {
    holes.push("missing-current-positive-proof");
  }
  if (currentNegativeTests.length === 0) {
    holes.push("missing-current-negative-proof");
  }
  if (oldPositiveEvidence.length > 0) {
    holes.push("positive-proof-uses-old-evidence");
  }
  if (oldNegativeEvidence.length > 0) {
    holes.push("negative-proof-uses-old-evidence");
  }
  return holes;
}

function evidenceScope(currentProofTests, repoScopedCurrentTests, externalCurrentTests) {
  if (currentProofTests.length === 0) {
    return "none";
  }
  if (repoScopedCurrentTests.length === 0) {
    return "external-current";
  }
  if (externalCurrentTests.length > 0) {
    return "repo-and-external-current";
  }
  return "repo";
}

function externalCurrentPath(testPath) {
  return testPath.startsWith("../");
}

function partialNotStartedBlocker(entry) {
  return {
    capabilityId: entry.capabilityId,
    title: entry.title,
    status: entry.status,
    owner: entry.owner,
    blockers: [...entry.blockers],
    blockerStatus: entry.blockers.length === 0 ? "missing" : "present",
  };
}

function summarizePartialNotStartedBlockers(entries) {
  const byStatus = Object.fromEntries(incompleteBlockerStatuses.map((status) => [status, {
    total: 0,
    withBlockers: 0,
    missingBlockers: 0,
  }]));
  for (const entry of entries) {
    byStatus[entry.status].total += 1;
    if (entry.blockerStatus === "present") {
      byStatus[entry.status].withBlockers += 1;
    } else {
      byStatus[entry.status].missingBlockers += 1;
    }
  }
  return {
    total: entries.length,
    withBlockers: entries.filter((entry) => entry.blockerStatus === "present").length,
    missingBlockers: entries.filter((entry) => entry.blockerStatus === "missing").length,
    byStatus,
  };
}

function oldEvidenceCoverage(
  ledgerEntries,
  oldEvidenceSourceGroups,
  classifiedOldEvidencePathSet,
  oldInventoryEvidenceByCapability,
) {
  const ledgerOldEvidencePaths = ledgerEntries.flatMap((entry) => entry.oldEvidence);
  const ledgerOldEvidencePathSet = new Set(ledgerOldEvidencePaths);
  const uniqueLedgerOldEvidencePaths = uniqueSorted(ledgerOldEvidencePaths);
  const unknownOldEvidencePaths = uniqueLedgerOldEvidencePaths
    .filter((oldEvidencePath) => !classifiedOldEvidencePathSet.has(oldEvidencePath));
  const unreferencedClassifiedOldEvidencePaths = uniqueSorted([...classifiedOldEvidencePathSet])
    .filter((oldEvidencePath) => !ledgerOldEvidencePathSet.has(oldEvidencePath));

  return {
    classifiedOldPathCount: classifiedOldEvidencePathSet.size,
    ledgerOldEvidenceReferenceCount: ledgerOldEvidencePaths.length,
    ledgerOldEvidencePathCount: uniqueLedgerOldEvidencePaths.length,
    capabilityCountWithLedgerOldEvidence: ledgerEntries
      .filter((entry) => entry.oldEvidence.length > 0)
      .length,
    capabilityCountWithInventoryOldEvidence: [...oldInventoryEvidenceByCapability.keys()].length,
    unknownOldEvidencePaths,
    unreferencedClassifiedOldEvidencePaths,
    bySource: oldEvidenceSourceGroups.map((group) => oldEvidenceSourceCoverage(group, ledgerOldEvidencePathSet)),
    byCapability: oldEvidenceCoverageByCapability(ledgerEntries, oldInventoryEvidenceByCapability),
  };
}

function oldEvidenceSourceCoverage(group, ledgerOldEvidencePathSet) {
  const sourcePathSet = new Set(group.paths);
  const referencedPaths = uniqueSorted([...sourcePathSet].filter((oldEvidencePath) => ledgerOldEvidencePathSet.has(oldEvidencePath)));
  const unreferencedPaths = uniqueSorted([...sourcePathSet].filter((oldEvidencePath) => !ledgerOldEvidencePathSet.has(oldEvidencePath)));
  return {
    source: group.source,
    classifiedOldPathCount: sourcePathSet.size,
    referencedOldPathCount: referencedPaths.length,
    unreferencedOldPathCount: unreferencedPaths.length,
    referencedPaths,
    unreferencedPaths,
  };
}

function oldEvidenceCoverageByCapability(ledgerEntries, oldInventoryEvidenceByCapability) {
  return ledgerEntries
    .map((entry) => {
      const inventoryEvidence = oldInventoryEvidenceByCapability.get(entry.capabilityId) ?? [];
      const inventoryEvidencePaths = uniqueSorted(inventoryEvidence.map((evidence) => evidence.oldPath));
      const ledgerOldEvidence = [...entry.oldEvidence];
      const ledgerOldEvidencePathSet = new Set(ledgerOldEvidence);
      const inventoryEvidencePathSet = new Set(inventoryEvidencePaths);

      return {
        capabilityId: entry.capabilityId,
        title: entry.title,
        status: entry.status,
        owner: entry.owner,
        ledgerOldEvidence,
        inventoryEvidencePaths,
        missingLedgerOldEvidencePaths: inventoryEvidencePaths
          .filter((oldEvidencePath) => !ledgerOldEvidencePathSet.has(oldEvidencePath)),
        ledgerOldEvidenceNotInInventoryPaths: ledgerOldEvidence
          .filter((oldEvidencePath) => !inventoryEvidencePathSet.has(oldEvidencePath)),
      };
    })
    .filter((entry) => entry.ledgerOldEvidence.length > 0 || entry.inventoryEvidencePaths.length > 0);
}

function groupOldInventoryEvidenceByCapability(oldInventoryEntries) {
  const byCapability = new Map();
  for (const entry of oldInventoryEntries) {
    for (const capabilityId of entry.capabilityIds) {
      const evidence = byCapability.get(capabilityId) ?? [];
      evidence.push({
        inventory: entry.inventory,
        oldPath: entry.oldPath,
        status: entry.status,
      });
      byCapability.set(capabilityId, evidence);
    }
  }
  return byCapability;
}

function pathSetFromGroups(groups) {
  return new Set(groups.flatMap((group) => group.paths));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify(buildCapabilityCoverageReport(), null, 2)}\n`);
}
