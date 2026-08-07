import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  capabilityCompatRuntimeCarriers,
  capabilitySurfaceEvidenceGateNames,
  coreIntrinsicCoverage,
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
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("capability ledger proof paths resolve to current executable evidence", () => {
  const missing = [];
  for (const entry of capabilityLedger) {
    for (const field of ["positiveTests", "negativeTests"]) {
      for (const proof of entry[field]) {
        if (!existsSync(resolve(repositoryRoot, proof))) {
          missing.push(`${entry.capabilityId}:${field}:${proof}`);
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("capability ledger does not describe the retired target-operation fact lifecycle", () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "capabilities/ledger.mjs"),
    "utf8",
  );
  const retiredTerms = [
    "checkedOperatorObservation",
    "csharpTargetOperationFact",
    "runtimeCarrierFact",
    "selectedTargetSignatureFact",
    "surfaceTargetOperationFact",
    "targetOperationFact",
    "unsupportedTargetOperationFact",
  ];
  assert.deepEqual(
    retiredTerms.filter((term) => source.includes(term)),
    [],
  );
});
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
test("complete capability notes do not carry partial-status wording", () => {
  const partialStatusPattern = /remains partial|partial until|still partial/iu;

  for (const entry of capabilityLedger) {
    if (entry.status !== "complete") {
      continue;
    }

    assert.doesNotMatch(entry.notes, partialStatusPattern, `${entry.capabilityId} complete notes describe partial status`);
    for (const blocker of entry.blockers) {
      assert.doesNotMatch(blocker, partialStatusPattern, `${entry.capabilityId} complete blocker describes partial status`);
    }
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
    assert.equal(
      capabilityCompatRuntimeCarrierSet.has(classification.compat.runtimeCarrier),
      true,
      `${entry.capabilityId} names non-canonical compat carrier ${classification.compat.runtimeCarrier}`,
    );
  }
});
test("Map and Set ledger row distinguishes native and compat runtime lanes", () => {
  const entry = capabilityLedger.find((candidate) => candidate.capabilityId === "surface.js.map-set");
  assert.notEqual(entry, undefined);

  const classification = entry.laneClassification;
  assert.deepEqual(classification.possibleLanes, ["static-native", "compat-runtime", "hard-reject"]);
  assert.equal(classification.compat.runtimeCarrier, "SelectedSurfaceRuntime");
  assert.ok(classification.staticNative.requiredFacts.includes("selected static-native Map/Set lane"));
  assert.ok(classification.staticNative.requiredFacts.includes("provider equality semantics evidence"));
  assert.ok(classification.compat.requiredFacts.includes("closed JS Map/Set runtime carrier"));
  assert.ok(classification.compat.requiredFacts.includes("JS SameValueZero equality metadata"));
  assert.ok(classification.hardReject.reasons.includes("clr-equality-not-full-js-compat"));
  assert.ok(classification.hardReject.reasons.includes("unsupported-selected-map-set-operation"));
  assert.equal(entry.status, "complete");
  assert.deepEqual(entry.blockers, []);
  assert.match(entry.notes, /Dictionary\/HashSet carrier is selected by the normal JS surface/u);
  assert.match(entry.notes, /Dictionary\/HashSet substitution/u);
});
test("capability ledger validator rejects incomplete Map and Set lane evidence", () => {
  const entry = capabilityLedger.find((candidate) => candidate.capabilityId === "surface.js.map-set");
  assert.notEqual(entry, undefined);

  const errors = validateCapabilityLedgerEntry({
    ...entry,
    laneClassification: {
      ...entry.laneClassification,
      staticNative: {
        ...entry.laneClassification.staticNative,
        requiredFacts: entry.laneClassification.staticNative.requiredFacts
          .filter((fact) => fact !== "provider equality semantics evidence"),
      },
      compat: {
        ...entry.laneClassification.compat,
        runtimeCarrier: "TsObject",
        requiredFacts: entry.laneClassification.compat.requiredFacts
          .filter((fact) => fact !== "JS SameValueZero equality metadata"),
      },
      hardReject: {
        ...entry.laneClassification.hardReject,
        reasons: entry.laneClassification.hardReject.reasons
          .filter((reason) => reason !== "clr-equality-not-full-js-compat"),
      },
    },
  });

  assert.ok(errors.includes("surface.js.map-set laneClassification.staticNative.requiredFacts must include provider equality semantics evidence"));
  assert.ok(errors.includes("surface.js.map-set laneClassification.compat.requiredFacts must include JS SameValueZero equality metadata"));
  assert.ok(errors.includes("surface.js.map-set laneClassification.compat.runtimeCarrier must be SelectedSurfaceRuntime"));
  assert.ok(errors.includes("surface.js.map-set laneClassification.hardReject.reasons must include clr-equality-not-full-js-compat"));
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

  assert.deepEqual(
    validateCapabilityLedgerEntry({
      ...sample,
      laneClassification: {
        ...sample.laneClassification,
        compat: {
          ...sample.laneClassification.compat,
          runtimeCarrier: "OpenRuntimeObject",
        },
      },
    }),
    [
      `laneClassification.compat.runtimeCarrier must be one of ${capabilityCompatRuntimeCarriers.join(", ")}`,
    ],
  );
});
test("capability ledger validator rejects incomplete and blocked entries without lane metadata", () => {
  for (const status of ["partial", "not-started", "blocked"]) {
    const entry = sampleCapabilityWithStatus(status);
    assert.ok(
      validateCapabilityLedgerEntry({ ...entry, laneClassification: undefined })
        .includes("laneClassification must be an object"),
      `${entry.capabilityId} must fail without laneClassification`,
    );
  }
});
test("capability ledger includes active plan minimum and rereview expansion ids", () => {
  const requiredIds = [
    "host.config.project-load",
    "host.config.target-selection",
    "host.config.surface-selection",
    "host.config.no-legacy-config",
    "host.graph.source-files",
    "host.package.composition",
    "host.project.package-discovery",
    "host.project.target-selection",
    "host.project.surface-selection",
    "host.project.surface-dependency-validation",
    "host.project.provider-composition",
    "host.project.module-graph",
    "host.project.package-path-resolution",
    "host.project.deterministic-output-paths",
    "host.project.clean-rebuild",
    "host.project.top-level-initialization-order",
    "tsts.program.create-with-extensions",
    "tsts.package.public-root-artifact",
    "tsts.type-query.flow-narrowed-type",
    "tsts.diagnostic.provider-sourced",
    "provider.module.virtual-import",
    "provider.module.no-file-backed-fallback",
    "provider.module.missing-provider-diagnostic",
    "source.primitive.configured-type",
    "source-core.write-only-reference.storage-binding",
    "source-core.reference.parameter-mode",
    "source-core.struct.field-facts",
    "source-core.lang.portable-intrinsics",
    ...coreIntrinsicCoverage.map((entry) => entry.capabilityId),
    "operation.call.provider-selected-method",
    "operation.call.provider-argument-conversion",
    "operation.call.provider-parameter-mode",
    "operation.property.provider-selected-member",
    "operation.member.provider-property",
    "operation.member.provider-indexer",
    "operation.member.no-name-guess",
    "operation.element.provider-indexer",
    "operation.conversion.checked-target-conversion",
    "operation.constructor.provider-selected-target",
    "type.generic.provider-target-arguments",
    "type.generic.provider-target-constraints",
    "operation.array.literal",
    "operation.iteration.provider-target",
    "operation.spread.provider-target-copy",
    "surface.js.console-log",
    "surface.js.array.length-index",
    "surface.js.array.sparse-delete-holes",
    "surface.js.math",
    "surface.js.date",
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
    "native.dotnet.array.explicit",
    "diagnostic.missing-provider-fact",
    "diagnostic.missing-target-fact",
    "diagnostic.unsupported-target-operation",
    "diagnostic.unsupported-selected-surface-operation",
    "diagnostic.strict-mode-slow-op",
    "target.shared.operation-contract",
    "architecture.native-compilable.esm-only",
    "architecture.native-compilable.no-unapproved-deps",
    "architecture.target-pack.boundaries",
    "architecture.target-pack.no-catch-all-semantics",
    "architecture.target-pack.no-procedural-policy",
    "target.csharp.core-lang-intrinsics",
    "target.shared.ownership-placeholder",
    "target.rust.future-borrow-checker-boundary",
    "module.import.named",
    "module.import.default",
    "module.import.namespace",
    "module.import.type-only",
    "module.import.side-effect",
    "module.export.named",
    "module.export.default",
    "module.export.reexport",
    "module.graph.source-files",
    "module.package.exports-subpath",
    "module.path-mapping",
    "module.emit.multi-file",
    "module.emit.top-level-order",
    "type.utility",
    "type.conditional",
    "type.mapped",
    "type.indexed-access",
    "type.keyof",
    "type.infer",
    "type.template-literal",
    "type.variadic-tuple",
    "type.satisfies",
    "type.as-const",
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
test("core intrinsic child capabilities define portable source contracts", () => {
  const expectedExports = [
    "writeOnlyRef",
    "readWriteRef",
    "readOnlyRef",
    "sharedBorrow",
    "mutableBorrow",
    "move",
    "struct",
    "field",
    "attribute",
    "defaultValue",
    "addressOf",
    "allocatePointer",
    "loadPointer",
    "storePointer",
    "equalPointer",
    "Pointer",
    "FunctionPointer",
  ];
  assert.deepEqual(coreIntrinsicCoverage.map((entry) => entry.exportName), expectedExports);

  const entriesByCapabilityId = new Map(capabilityLedger.map((entry) => [entry.capabilityId, entry]));
  for (const intrinsic of coreIntrinsicCoverage) {
    const entry = entriesByCapabilityId.get(intrinsic.capabilityId);
    assert.notEqual(entry, undefined, `missing core intrinsic capability ${intrinsic.capabilityId}`);
    assert.ok(
      entry.status === "partial" || entry.status === "complete",
      `${intrinsic.capabilityId} must be partial or complete`,
    );
    assert.equal(entry.owner, "source-core-provider", intrinsic.capabilityId);
    assert.equal(entry.coreIntrinsic.moduleSpecifier, intrinsic.moduleSpecifier, intrinsic.capabilityId);
    assert.equal(entry.coreIntrinsic.exportName, intrinsic.exportName, intrinsic.capabilityId);
    assert.equal(entry.coreIntrinsic.factSlug, intrinsic.factSlug, intrinsic.capabilityId);
    assert.equal(entry.coreIntrinsic.sourceKind, intrinsic.sourceKind, intrinsic.capabilityId);
    assert.equal(entry.coreIntrinsic.unsupportedTargetBehavior, "deterministic-diagnostic", intrinsic.capabilityId);
    assert.ok(entry.coreIntrinsic.requiredFacts.length > 0, `${intrinsic.capabilityId} must require facts`);
    assert.ok(entry.coreIntrinsic.sourceContract.includes("Core owns"), `${intrinsic.capabilityId} must state core source ownership`);
    assert.match(entry.coreIntrinsic.targetContract, /Targets .*diagnostic/u, intrinsic.capabilityId);
    assert.ok(entry.providerFacts.includes("sourceCoreModuleIdentityFact"), intrinsic.capabilityId);
    assert.ok(entry.providerFacts.includes("selectedTargetIntrinsicContractFact"), intrinsic.capabilityId);
    assert.equal(entry.laneClassification.possibleLanes.includes("hard-reject"), true, intrinsic.capabilityId);
    assert.equal(entry.laneClassification.possibleLanes.includes("compat-runtime"), false, intrinsic.capabilityId);
    assert.equal(entry.laneClassification.hardReject.reasons.includes("unsupported-target-intrinsic"), true, intrinsic.capabilityId);
    assert.ok(entry.sourceExamples.join("\n").includes(intrinsic.exportName), `${intrinsic.capabilityId} examples must name the export`);
    if (entry.status === "complete") {
      assert.equal(entry.blockers.length, 0, `${intrinsic.capabilityId} is complete and must not carry blockers`);
      assert.ok(entry.positiveTests.length > 0, `${intrinsic.capabilityId} is complete without positive tests`);
      assert.ok(entry.negativeTests.length > 0, `${intrinsic.capabilityId} is complete without negative tests`);
      assert.ok(entry.oldEvidence.length > 0, `${intrinsic.capabilityId} is complete without old inventory evidence`);
    } else {
      assert.ok(entry.blockers.length > 0, `${intrinsic.capabilityId} must keep explicit partial blockers`);
    }
  }
});
test("capability ledger validator rejects incomplete core intrinsic metadata", () => {
  const entry = capabilityLedger.find((candidate) =>
    candidate.capabilityId === "source-core.lang.portable-intrinsics.write-only-ref"
  );
  assert.notEqual(entry, undefined);

  assert.deepEqual(
    validateCapabilityLedgerEntry({ ...entry, coreIntrinsic: undefined }),
    ["coreIntrinsic must be an object"],
  );
  assert.ok(
    validateCapabilityLedgerEntry({
      ...entry,
      coreIntrinsic: {
        ...entry.coreIntrinsic,
        moduleSpecifier: "@tsonic/csharp/lang.js",
      },
    }).includes(`coreIntrinsic.moduleSpecifier must be ${entry.coreIntrinsic.moduleSpecifier}`),
  );
  assert.ok(
    validateCapabilityLedgerEntry({
      ...entry,
      coreIntrinsic: {
        ...entry.coreIntrinsic,
        requiredFacts: [],
      },
    }).includes("coreIntrinsic.requiredFacts must be a non-empty array"),
  );
});
test("complete capabilities require positive and negative proof", () => {
  for (const entry of capabilityLedger) {
    if (entry.status !== "complete") {
      continue;
    }

    assert.ok(entry.positiveTests.length > 0, `${entry.capabilityId} is complete without positive tests`);
    assert.ok(entry.negativeTests.length > 0, `${entry.capabilityId} is complete without negative tests`);
    assert.equal(entry.evidenceReview, "reviewed", `${entry.capabilityId} is complete without reviewed evidence`);
    assert.ok(
      entry.oldEvidence.length > 0 || entry.oldEvidenceAbsence?.status === "reviewed-none-found",
      `${entry.capabilityId} is complete without old inventory evidence or reviewed absence`,
    );
  }
});
test("incomplete capabilities require explicit blocker evidence", () => {
  for (const entry of capabilityLedger) {
    if (entry.status === "partial" || entry.status === "not-started" || entry.status === "blocked") {
      assert.ok(entry.blockers.length > 0, `${entry.capabilityId} is ${entry.status} without blockers`);
      continue;
    }
    assert.deepEqual(entry.blockers, [], `${entry.capabilityId} is ${entry.status} and must not carry blockers`);
  }
});
test("capability ledger validator rejects missing blocker evidence", () => {
  const completeEntry = capabilityLedger.find((entry) => entry.status === "complete");
  assert.notEqual(completeEntry, undefined);
  const partialEntry = capabilityLedger.find((entry) => entry.status === "partial") ??
    { ...completeEntry, status: "partial", blockers: ["synthetic incomplete capability blocker"] };

  assert.ok(
    validateCapabilityLedgerEntry({ ...partialEntry, blockers: [] }).includes("partial capabilities must have blockers"),
  );
  assert.ok(
    validateCapabilityLedgerEntry({ ...completeEntry, blockers: ["not allowed"] }).includes("complete capabilities must not have blockers"),
  );
});
