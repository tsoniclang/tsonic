import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import {
  capabilityClosedRuntimeCarriers,
  capabilitySurfaceEvidenceGateNames,
  capabilityLaneNames,
  capabilityIdSet,
  capabilityLedger,
  capabilityOwners,
  capabilityStatuses,
  requiredCapabilityIds,
  validateCapabilityLedger,
  validateCapabilityLedgerEntry,
} from "./fixtures/ledger.mjs";
import {
  buildOldEmitterInventoryReport,
  oldEmitterHistoricalCasePaths,
  oldEmitterPortInventory,
  validateOldEmitterPortEntry,
} from "../../infrastructure/historical-inventory/fixtures/emitter.mjs";
import {
  buildOldProductUnitInventoryReport,
  oldProductUnitHistoricalTestFiles,
  oldProductUnitPortInventory,
  validateOldProductUnitPortEntry,
} from "../../infrastructure/historical-inventory/fixtures/product-unit.mjs";
import {
  buildOldSuiteInventoryReport,
  oldSuitePortInventory,
  oldSuiteRequiredSeedFixturePaths,
  validateOldSuitePortEntry,
} from "../../infrastructure/historical-inventory/fixtures/suite.mjs";

const capabilityStatusSet = new Set(capabilityStatuses);
const capabilityOwnerSet = new Set(capabilityOwners);
const capabilityLaneSet = new Set(capabilityLaneNames);
const capabilityClosedRuntimeCarrierSet = new Set(capabilityClosedRuntimeCarriers);
































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
  assertValidLaneBehavior(entry, "canonical", classification.canonical);
  if (classification.possibleLanes.includes("static-native")) {
    assertValidLaneBehavior(entry, "staticNative", classification.staticNative);
    assert.ok(
      Array.isArray(classification.staticNative.requiredFacts) && classification.staticNative.requiredFacts.length > 0,
      `${entry.capabilityId} static-native lane must require facts`,
    );
  }
  if (classification.possibleLanes.includes("closed-runtime")) {
    assertValidLaneBehavior(entry, "closedRuntime", classification.closedRuntime);
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
    blockers,
    notes: "Synthetic validation entry.",
  };
}

test("stale old inventory replacement capabilities reference known ledger ids", () => {
  const staleOldInventoryEntries = [
    ...oldEmitterPortInventory,
    ...oldSuitePortInventory,
    ...oldProductUnitPortInventory,
  ].filter((entry) => entry.status === "invalid-stale-architecture");

  assert.ok(staleOldInventoryEntries.length > 0);

  for (const entry of staleOldInventoryEntries) {
    assert.ok(
      entry.replacementCapabilityIds.length > 0,
      `${entry.oldPath} must name replacement capabilities`,
    );

    for (const capabilityId of entry.replacementCapabilityIds) {
      assert.equal(
        capabilityIdSet.has(capabilityId),
        true,
        `${entry.oldPath} references unknown replacement capability ${capabilityId}`,
      );
      assert.equal(
        entry.capabilityIds.includes(capabilityId),
        true,
        `${entry.oldPath} replacement capability ${capabilityId} must also be mapped as old evidence`,
      );
    }
  }
});
