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
    "source-core.out.storage-binding",
    "source-core.ref.parameter-mode",
    "source-core.struct.field-facts",
    "source-core.lang.portable-intrinsics",
    ...coreLangIntrinsicCoverage.map((entry) => entry.capabilityId),
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

test("core lang intrinsic child capabilities define portable source contracts", () => {
  const expectedExports = [
    "out",
    "ref",
    "inref",
    "borrow",
    "borrowMut",
    "move",
    "struct",
    "field",
    "attribute",
    "defaultof",
    "ptr",
    "fnptr",
  ];
  assert.deepEqual(coreLangIntrinsicCoverage.map((entry) => entry.exportName), expectedExports);

  const entriesByCapabilityId = new Map(capabilityLedger.map((entry) => [entry.capabilityId, entry]));
  for (const intrinsic of coreLangIntrinsicCoverage) {
    const entry = entriesByCapabilityId.get(intrinsic.capabilityId);
    assert.notEqual(entry, undefined, `missing core intrinsic capability ${intrinsic.capabilityId}`);
    assert.ok(
      entry.status === "partial" || entry.status === "complete",
      `${intrinsic.capabilityId} must be partial or complete`,
    );
    assert.equal(entry.owner, "source-core-provider", intrinsic.capabilityId);
    assert.equal(entry.coreIntrinsic.moduleSpecifier, coreLangIntrinsicModuleSpecifier, intrinsic.capabilityId);
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
    candidate.capabilityId === "source-core.lang.portable-intrinsics.out"
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
    }).includes(`coreIntrinsic.moduleSpecifier must be ${coreLangIntrinsicModuleSpecifier}`),
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
