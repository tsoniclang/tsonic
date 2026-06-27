import { pathToFileURL } from "node:url";
import {
  capabilityCompatRuntimeCarriers,
  capabilityLaneNames,
  capabilityLedger,
  capabilityOwners,
  capabilityStatuses,
  requiredCapabilityIds,
  validateCapabilityLedger,
  validateCapabilityLaneClassification,
} from "./ledger.mjs";
import {
  oldEmitterHistoricalCasePaths,
  oldEmitterInventoryStatuses,
  oldEmitterPortInventory,
  validateOldEmitterPortEntry,
} from "../old-emitter-inventory/inventory.mjs";
import {
  oldProductUnitHistoricalTestFiles,
  oldProductUnitStatuses,
  oldProductUnitPortInventory,
  validateOldProductUnitPortEntry,
} from "../old-product-unit-inventory/inventory.mjs";
import {
  oldSuitePortInventory,
  oldSuiteStatuses,
  validateOldSuitePortEntry,
} from "../old-suite-inventory/inventory.mjs";

const incompleteBlockerStatuses = Object.freeze(["partial", "not-started"]);
const laneClassificationTrackedStatuses = Object.freeze(["partial", "not-started", "blocked"]);

export function buildCapabilityCoverageReport({
  ledgerEntries = capabilityLedger,
  statuses = capabilityStatuses,
  owners = capabilityOwners,
  oldEvidenceSourceGroups = defaultOldEvidenceSourceGroups(),
  oldInventoryEntries = defaultOldInventoryEntries(),
  oldInventoryCoverageSources = defaultOldInventoryCoverageSources(),
  ledgerRequiredCapabilityIds = ledgerEntries === capabilityLedger ? requiredCapabilityIds : [],
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
      laneClassificationIsLedgerEnforced: true,
      oldInventoryCoverageIsSeparatedByInventory: true,
      capabilityLedgerValidationIsEnforced: true,
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
    blockerCoverage: blockerCoverage(ledgerEntries, statuses, owners),
    oldEvidenceCoverage: oldEvidenceCoverage(
      ledgerEntries,
      oldEvidenceSourceGroups,
      classifiedOldEvidencePathSet,
      oldInventoryEvidenceByCapability,
    ),
    oldInventoryCoverage: oldInventoryCoverage(ledgerEntries, oldInventoryCoverageSources),
    ledgerValidation: ledgerValidationCoverage(ledgerEntries, ledgerRequiredCapabilityIds, classifiedOldEvidencePathSet),
    laneClassificationCoverage: laneClassificationCoverage(ledgerEntries, statuses, owners),
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

function defaultOldInventoryCoverageSources() {
  return [
    {
      inventory: "old-fixture",
      entries: oldSuitePortInventory,
      statuses: oldSuiteStatuses,
      validate: validateOldSuitePortEntry,
    },
    {
      inventory: "old-csharp-emitter",
      entries: oldEmitterPortInventory,
      statuses: oldEmitterInventoryStatuses,
      validate: validateOldEmitterPortEntry,
    },
    {
      inventory: "old-product-unit",
      entries: oldProductUnitPortInventory,
      statuses: oldProductUnitStatuses,
      validate: validateOldProductUnitPortEntry,
    },
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
    evidenceReview: entry.evidenceReview,
    currentPositiveTests,
    currentNegativeTests,
    oldEvidence,
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
  evidenceReview,
  currentPositiveTests,
  currentNegativeTests,
  oldEvidence,
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
  if (evidenceReview !== "reviewed") {
    holes.push("missing-reviewed-evidence");
  }
  if (oldEvidence.length === 0) {
    holes.push("missing-old-evidence");
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

function blockerCoverage(ledgerEntries, statuses, owners) {
  const trackedStatuses = ["partial", "not-started", "blocked"];
  const entries = ledgerEntries
    .filter((entry) => trackedStatuses.includes(entry.status))
    .map((entry) => ({
      capabilityId: entry.capabilityId,
      title: entry.title,
      status: entry.status,
      owner: entry.owner,
      blockers: [...entry.blockers],
      blockerStatus: entry.blockers.length === 0 ? "missing" : "present",
    }));

  return {
    rules: {
      trackedStatuses,
      incompleteCapabilitiesRequireBlockers: true,
    },
    summary: summarizeBlockerCoverage(entries, statuses, owners),
    byCapability: entries,
    proofHoles: entries
      .filter((entry) => entry.blockerStatus === "missing")
      .map((entry) => ({
        capabilityId: entry.capabilityId,
        title: entry.title,
        status: entry.status,
        owner: entry.owner,
        proofHoles: ["missing-blockers"],
      })),
  };
}

function summarizeBlockerCoverage(entries, statuses, owners) {
  const byBlockerStatus = zeroCountRecord(["present", "missing"]);
  const byStatus = Object.fromEntries(statuses.map((status) => [status, blockerSummaryBucket()]));
  const byOwner = Object.fromEntries(owners.map((owner) => [owner, blockerSummaryBucket()]));

  for (const entry of entries) {
    increment(byBlockerStatus, entry.blockerStatus);
    if (byStatus[entry.status] === undefined) {
      byStatus[entry.status] = blockerSummaryBucket();
    }
    if (byOwner[entry.owner] === undefined) {
      byOwner[entry.owner] = blockerSummaryBucket();
    }
    incrementBlockerSummaryBucket(byStatus[entry.status], entry);
    incrementBlockerSummaryBucket(byOwner[entry.owner], entry);
  }

  return {
    total: entries.length,
    withBlockers: byBlockerStatus.present,
    missingBlockers: byBlockerStatus.missing,
    byBlockerStatus,
    byStatus,
    byOwner,
  };
}

function blockerSummaryBucket() {
  return {
    total: 0,
    withBlockers: 0,
    missingBlockers: 0,
  };
}

function incrementBlockerSummaryBucket(bucket, entry) {
  bucket.total += 1;
  if (entry.blockerStatus === "present") {
    bucket.withBlockers += 1;
  } else {
    bucket.missingBlockers += 1;
  }
}

function laneClassificationCoverage(ledgerEntries, statuses, owners) {
  const byCapability = ledgerEntries
    .filter(laneClassificationTrackedEntry)
    .map(laneClassificationCapabilityCoverage);

  return {
    rules: {
      trackedStatuses: [...laneClassificationTrackedStatuses],
      allLedgerEntriesWithLaneClassificationAreTracked: true,
      allowedLanes: [...capabilityLaneNames],
      failClosedLaneRequired: true,
      compatRuntimeCarriersMustBeClosed: true,
      allowedCompatRuntimeCarriers: [...capabilityCompatRuntimeCarriers],
    },
    summary: summarizeLaneClassificationCoverage(byCapability, statuses, owners),
    byCapability,
    proofHoles: byCapability
      .filter((entry) => entry.proofHoles.length > 0)
      .map((entry) => ({
        capabilityId: entry.capabilityId,
        title: entry.title,
        status: entry.status,
        owner: entry.owner,
        classificationStatus: entry.classificationStatus,
        proofHoles: entry.proofHoles,
      })),
  };
}

function laneClassificationTrackedEntry(entry) {
  return laneClassificationTrackedStatuses.includes(entry.status) ||
    entry.laneClassification !== undefined;
}

function laneClassificationCapabilityCoverage(entry) {
  const laneClassification = entry.laneClassification;
  const proofHoles = laneClassificationProofHoles(entry);

  return {
    capabilityId: entry.capabilityId,
    title: entry.title,
    status: entry.status,
    owner: entry.owner,
    classificationStatus: laneClassificationStatus(laneClassification, proofHoles),
    laneClassification: laneClassification ?? null,
    patternKind: laneClassificationPatternKind(laneClassification),
    possibleLanes: laneClassificationPossibleLanes(laneClassification),
    invalidPossibleLanes: laneClassificationInvalidPossibleLanes(laneClassification),
    proofHoles,
  };
}

function laneClassificationStatus(laneClassification, proofHoles) {
  if (laneClassification === undefined) {
    return "missing";
  }
  if (proofHoles.length > 0) {
    return "invalid";
  }
  return "covered";
}

function laneClassificationPatternKind(laneClassification) {
  if (!isObjectRecord(laneClassification) || !nonEmptyString(laneClassification.patternKind)) {
    return null;
  }
  return laneClassification.patternKind;
}

function laneClassificationPossibleLanes(laneClassification) {
  if (!isObjectRecord(laneClassification) || !Array.isArray(laneClassification.possibleLanes)) {
    return [];
  }
  return [...laneClassification.possibleLanes];
}

function laneClassificationInvalidPossibleLanes(laneClassification) {
  return laneClassificationPossibleLanes(laneClassification)
    .filter((lane) => !capabilityLaneNames.includes(lane));
}

function laneClassificationProofHoles(entry) {
  return validateCapabilityLaneClassification(entry);
}

function summarizeLaneClassificationCoverage(entries, statuses, owners) {
  const byClassificationStatus = zeroCountRecord(["covered", "missing", "invalid"]);
  const byStatus = Object.fromEntries(statuses.map((status) => [status, laneClassificationSummaryBucket()]));
  const byOwner = Object.fromEntries(owners.map((owner) => [owner, laneClassificationSummaryBucket()]));
  const byPossibleLane = zeroCountRecord(capabilityLaneNames);

  for (const entry of entries) {
    increment(byClassificationStatus, entry.classificationStatus);
    if (byStatus[entry.status] === undefined) {
      byStatus[entry.status] = laneClassificationSummaryBucket();
    }
    if (byOwner[entry.owner] === undefined) {
      byOwner[entry.owner] = laneClassificationSummaryBucket();
    }
    incrementLaneClassificationSummaryBucket(byStatus[entry.status], entry);
    incrementLaneClassificationSummaryBucket(byOwner[entry.owner], entry);

    for (const lane of uniqueSorted(entry.possibleLanes.filter((possibleLane) => capabilityLaneNames.includes(possibleLane)))) {
      byPossibleLane[lane] += 1;
    }
  }

  return {
    total: entries.length,
    withLaneClassification: entries.filter((entry) => entry.classificationStatus !== "missing").length,
    coveredLaneClassification: byClassificationStatus.covered,
    missingLaneClassification: byClassificationStatus.missing,
    invalidLaneClassification: byClassificationStatus.invalid,
    withProofHoles: entries.filter((entry) => entry.proofHoles.length > 0).length,
    byClassificationStatus,
    byStatus,
    byOwner,
    byPossibleLane,
  };
}

function laneClassificationSummaryBucket() {
  return {
    total: 0,
    covered: 0,
    missing: 0,
    invalid: 0,
    withProofHoles: 0,
  };
}

function incrementLaneClassificationSummaryBucket(bucket, entry) {
  bucket.total += 1;
  bucket[entry.classificationStatus] += 1;
  if (entry.proofHoles.length > 0) {
    bucket.withProofHoles += 1;
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isObjectRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  const byCapability = oldEvidenceCoverageByCapability(ledgerEntries, oldInventoryEvidenceByCapability);
  const proofHoles = oldEvidenceCoverageProofHoles(byCapability);

  return {
    rules: {
      oldEvidencePathsMustBeClassified: true,
      completeOldEvidenceMustBeBidirectionallyMapped: true,
    },
    classifiedOldPathCount: classifiedOldEvidencePathSet.size,
    ledgerOldEvidenceReferenceCount: ledgerOldEvidencePaths.length,
    ledgerOldEvidencePathCount: uniqueLedgerOldEvidencePaths.length,
    capabilityCountWithLedgerOldEvidence: ledgerEntries
      .filter((entry) => entry.oldEvidence.length > 0)
      .length,
    capabilityCountWithInventoryOldEvidence: [...oldInventoryEvidenceByCapability.keys()].length,
    unknownOldEvidencePaths,
    unreferencedClassifiedOldEvidencePaths,
    summary: summarizeOldEvidenceCoverage(byCapability, unknownOldEvidencePaths),
    bySource: oldEvidenceSourceGroups.map((group) => oldEvidenceSourceCoverage(group, ledgerOldEvidencePathSet)),
    byCapability,
    proofHoles,
  };
}

function summarizeOldEvidenceCoverage(byCapability, unknownOldEvidencePaths) {
  const completeCapabilities = byCapability.filter((entry) => entry.status === "complete");
  const completeCapabilitiesWithBidirectionalHoles = completeCapabilities
    .filter((entry) => entry.ledgerOldEvidenceNotInInventoryPaths.length > 0);

  return {
    capabilitiesWithLedgerOrInventoryEvidence: byCapability.length,
    completeCapabilitiesWithLedgerOrInventoryEvidence: completeCapabilities.length,
    unknownOldEvidencePaths: unknownOldEvidencePaths.length,
    completeCapabilitiesWithBidirectionalHoles: completeCapabilitiesWithBidirectionalHoles.length,
  };
}

function oldEvidenceCoverageProofHoles(byCapability) {
  return byCapability
    .filter((entry) => entry.status === "complete")
    .map((entry) => {
      const proofHoles = [];
      if (entry.ledgerOldEvidenceNotInInventoryPaths.length > 0) {
        proofHoles.push("ledger-old-evidence-not-in-inventory");
      }

      return {
        capabilityId: entry.capabilityId,
        title: entry.title,
        status: entry.status,
        owner: entry.owner,
        proofHoles,
        missingLedgerOldEvidencePaths: entry.missingLedgerOldEvidencePaths,
        ledgerOldEvidenceNotInInventoryPaths: entry.ledgerOldEvidenceNotInInventoryPaths,
      };
    })
    .filter((entry) => entry.proofHoles.length > 0);
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

function oldInventoryCoverage(ledgerEntries, oldInventoryCoverageSources) {
  const knownCapabilityIds = new Set(ledgerEntries.map((entry) => entry.capabilityId));
  const byInventory = oldInventoryCoverageSources.map((source) =>
    oldInventorySourceCoverage(source, knownCapabilityIds)
  );
  const proofHoles = byInventory.flatMap((inventoryCoverage) => inventoryCoverage.proofHoles);

  return {
    rules: {
      inventoriesAreReportedSeparately: true,
      entriesRequireCapabilityIds: true,
      capabilityIdsMustExistInLedger: true,
      staleInvalidArchitectureRequiresReplacementCapabilities: true,
      staleReplacementCapabilitiesMustExistInLedger: true,
      staleReplacementCapabilitiesMustBeMappedAsEvidence: true,
    },
    summary: summarizeOldInventoryCoverage(byInventory, proofHoles),
    byInventory,
    proofHoles,
  };
}

function oldInventorySourceCoverage(source, knownCapabilityIds) {
  const entries = source.entries;
  const statusCounts = zeroCountRecord(source.statuses);
  const mappingStatusCounts = {};
  const proofHoles = [];
  const invalidEntries = [];
  const staleEntries = [];

  for (const entry of entries) {
    increment(statusCounts, entry.status);
    increment(mappingStatusCounts, entry.capabilityMappingStatus);

    const entryProofHoles = [
      ...oldInventoryEntryValidationHoles(source, entry),
      ...oldInventoryCapabilityHoles(entry, knownCapabilityIds),
      ...oldInventoryStaleReplacementHoles(entry, knownCapabilityIds),
    ];

    if (entryProofHoles.length > 0) {
      proofHoles.push({
        inventory: source.inventory,
        oldPath: entry.oldPath,
        status: entry.status,
        proofHoles: entryProofHoles,
      });
      invalidEntries.push(entry.oldPath);
    }

    if (entry.status === "invalid-stale-architecture") {
      staleEntries.push({
        oldPath: entry.oldPath,
        replacementCapabilityIds: Array.isArray(entry.replacementCapabilityIds)
          ? [...entry.replacementCapabilityIds]
          : [],
        replacementCapabilityPath: typeof entry.replacementCapabilityPath === "string"
          ? entry.replacementCapabilityPath
          : null,
        replacementStatus: oldInventoryReplacementStatus(entry, entryProofHoles),
      });
    }
  }

  return {
    inventory: source.inventory,
    entryCount: entries.length,
    statusCounts,
    mappingStatusCounts,
    validationErrorCount: proofHoles.reduce((count, entry) => count + entry.proofHoles.length, 0),
    invalidEntryCount: invalidEntries.length,
    staleEntryCount: staleEntries.length,
    staleEntries,
    invalidEntries,
    proofHoles,
  };
}

function oldInventoryEntryValidationHoles(source, entry) {
  const validationErrors = source.validate(entry);
  return validationErrors.map((error) => `inventory-validation: ${error}`);
}

function oldInventoryCapabilityHoles(entry, knownCapabilityIds) {
  const holes = [];
  if (!Array.isArray(entry.capabilityIds) || entry.capabilityIds.length === 0) {
    holes.push("missing-capabilityIds");
    return holes;
  }

  for (const capabilityId of entry.capabilityIds) {
    if (!knownCapabilityIds.has(capabilityId)) {
      holes.push(`unknown-capabilityId: ${capabilityId}`);
    }
  }
  return holes;
}

function oldInventoryStaleReplacementHoles(entry, knownCapabilityIds) {
  if (entry.status !== "invalid-stale-architecture") {
    if (entry.replacementCapabilityIds !== undefined || entry.replacementCapabilityPath !== undefined) {
      return ["replacement-capabilities-on-non-stale-entry"];
    }
    return [];
  }

  const holes = [];
  if (!Array.isArray(entry.replacementCapabilityIds) || entry.replacementCapabilityIds.length === 0) {
    holes.push("missing-replacementCapabilityIds");
  } else {
    for (const capabilityId of entry.replacementCapabilityIds) {
      if (!knownCapabilityIds.has(capabilityId)) {
        holes.push(`unknown-replacementCapabilityId: ${capabilityId}`);
      }
      if (!Array.isArray(entry.capabilityIds) || !entry.capabilityIds.includes(capabilityId)) {
        holes.push(`replacement-not-mapped-as-capabilityId: ${capabilityId}`);
      }
    }
  }

  if (typeof entry.replacementCapabilityPath !== "string" || entry.replacementCapabilityPath.length === 0) {
    holes.push("missing-replacementCapabilityPath");
  }
  return holes;
}

function oldInventoryReplacementStatus(entry, proofHoles) {
  if (entry.status !== "invalid-stale-architecture") {
    return "not-stale";
  }
  return proofHoles.some((proofHole) =>
    proofHole.includes("replacement") ||
    proofHole.includes("inventory-validation")
  )
    ? "hole"
    : "mapped";
}

function summarizeOldInventoryCoverage(byInventory, proofHoles) {
  return {
    inventoryCount: byInventory.length,
    entryCount: byInventory.reduce((count, inventory) => count + inventory.entryCount, 0),
    staleEntryCount: byInventory.reduce((count, inventory) => count + inventory.staleEntryCount, 0),
    invalidEntryCount: byInventory.reduce((count, inventory) => count + inventory.invalidEntryCount, 0),
    proofHoleCount: proofHoles.length,
    proofStatus: proofHoles.length === 0 ? "proven" : "hole",
  };
}

function ledgerValidationCoverage(ledgerEntries, requiredIds, oldEvidencePaths) {
  const validationErrors = validateCapabilityLedger(ledgerEntries, { requiredIds, oldEvidencePaths });
  const proofHoles = validationErrors.map((error) => ({
    proofHole: "capability-ledger-validation",
    error,
  }));

  return {
    rules: {
      entriesMustPassSingleEntryValidation: true,
      completeCapabilitiesRequirePositiveAndNegativeProof: true,
      completeCapabilitiesRequireCurrentPositiveAndNegativeProof: true,
      positiveNegativeProofMustNotUseOldEvidence: true,
      completeCapabilitiesRequireReviewedEvidence: true,
      completeCapabilitiesRequireOldInventoryEvidence: true,
      completeBroadCapabilitiesRequireCompleteSubCapabilityEvidence: true,
      requiredCapabilityIdsMustExist: requiredIds.length > 0,
    },
    summary: {
      entryCount: ledgerEntries.length,
      requiredCapabilityIdCount: requiredIds.length,
      validationErrorCount: validationErrors.length,
      proofStatus: validationErrors.length === 0 ? "proven" : "hole",
    },
    proofHoles,
  };
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
