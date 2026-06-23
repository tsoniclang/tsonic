export const oldProductUnitStatuses = Object.freeze([
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
]);

export const oldProductUnitFeatureAreas = Object.freeze([
  "cli",
  "host-config",
  "package-model",
  "frontend",
  "source-semantics",
  "surface-provider",
  "target-provider",
  "csharp-backend",
  "toolchain",
  "diagnostic",
]);

export const oldProductUnitReportCountKeys = Object.freeze([
  "total",
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
  "unclassified",
]);

const oldProductUnitHistoricalTestFileTuples = Object.freeze([
  ["packages/cli/src/cli/parser.test.ts", 52],
  ["packages/cli/src/commands/add-common.test.ts", 9],
  ["packages/cli/src/commands/add-common/generated-bindings.test.ts", 1],
  ["packages/cli/src/commands/add-deps.test.ts", 5],
  ["packages/cli/src/commands/add-npm-cases/package-manifest-transitive.test.ts", 2],
  ["packages/cli/src/commands/add-npm-cases/package-manifest.test.ts", 6],
  ["packages/cli/src/commands/add-npm.test.ts", 0],
  ["packages/cli/src/commands/build-cases/local-package-ownership.test.ts", 5],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-1-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-1-cases/part-2.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-1-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-1.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-2-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-2-cases/part-2.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-2-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-2.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3-cases/part-2.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4-cases/part-2.test.ts", 3],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5-cases/part-2.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6-cases/part-1.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6-cases/part-2.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6-cases/part-3.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7-cases/part-1.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7-cases/part-2.test.ts", 4],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-1.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-2.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-3.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-5.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8.test.ts", 0],
  ["packages/cli/src/commands/build-cases/ref-dirs.test.ts", 5],
  ["packages/cli/src/commands/build-native-lib.test.ts", 1],
  ["packages/cli/src/commands/build-no-generate.test.ts", 1],
  ["packages/cli/src/commands/build-source-package.test.ts", 3],
  ["packages/cli/src/commands/build.test.ts", 0],
  ["packages/cli/src/commands/init.test.ts", 12],
  ["packages/cli/src/commands/restore-cases/external-types.test.ts", 2],
  ["packages/cli/src/commands/restore-cases/nuget-bindings.test.ts", 3],
  ["packages/cli/src/commands/restore-cases/runtime-dlls.test.ts", 4],
  ["packages/cli/src/commands/restore.test.ts", 0],
  ["packages/cli/src/commands/run-build-regressions.test.ts", 3],
  ["packages/cli/src/commands/test-command.test.ts", 1],
  ["packages/cli/src/config-cases/resolve-basics.test.ts", 13],
  ["packages/cli/src/config-cases/resolve-output-options.test.ts", 18],
  ["packages/cli/src/config-cases/resolve-surfaces.test.ts", 6],
  ["packages/cli/src/config.test.ts", 0],
  ["packages/cli/src/dotnet/nuget-config.test.ts", 3],
  ["packages/cli/src/package-manifests/bindings-cases/discovery-and-overlay.test.ts", 7],
  ["packages/cli/src/package-manifests/bindings-cases/manifest-resolution.test.ts", 8],
  ["packages/cli/src/package-manifests/bindings-cases/runtime-overrides-and-validation.test.ts", 5],
  ["packages/cli/src/package-manifests/bindings.test.ts", 0],
  ["packages/cli/src/surface/profiles.test.ts", 15],
  ["packages/cli/src/test-cli-bin.test.ts", 1],
  ["packages/frontend/src/lowering/plan-builders.test.ts", 19],
  ["packages/frontend/src/program/creation-cases/authoritative-type-roots.test.ts", 3],
  ["packages/frontend/src/program/creation-cases/core-type-checking.test.ts", 3],
  ["packages/frontend/src/program/creation-cases/module-bindings.test.ts", 8],
  ["packages/frontend/src/program/creation-cases/package-resolution.test.ts", 5],
  ["packages/frontend/src/program/creation-cases/tsts-source-program.test.ts", 3],
  ["packages/frontend/src/program/creation.test.ts", 0],
  ["packages/frontend/src/program/entrypoint-scope.test.ts", 2],
  ["packages/frontend/src/program/package-roots.test.ts", 8],
  ["packages/frontend/src/program/program-input-discovery.test.ts", 13],
  ["packages/frontend/src/resolver/namespace.test.ts", 9],
  ["packages/frontend/src/source-frontend/source-semantic-boundary.test.ts", 25],
  ["packages/frontend/src/source-frontend/tsts-source-program.test.ts", 4],
  ["packages/frontend/src/surface/profiles.test.ts", 14],
  ["packages/frontend/src/tsonic-extension/numeric-primitives.test.ts", 2],
  ["packages/frontend/src/tsonic-extension/source-semantics.test.ts", 27],
  ["packages/frontend/src/types/diagnostic.test.ts", 10],
  ["packages/frontend/src/types/result.test.ts", 15],
  ["packages/frontend/src/validator-cases/any-and-object-literals.test.ts", 28],
  ["packages/frontend/src/validator-cases/generic-validation.test.ts", 20],
  ["packages/frontend/src/validator-cases/parameters-and-dict-keys.test.ts", 24],
  ["packages/frontend/src/validator-cases/utility-types.test.ts", 29],
  ["packages/frontend/src/validator-maximus-cases/array-and-literal-inference.test.ts", 6],
  ["packages/frontend/src/validator-maximus-cases/deterministic-typing.test.ts", 1],
  ["packages/frontend/src/validator-maximus-cases/dictionary-and-object-literal.test.ts", 4],
  ["packages/frontend/src/validator-maximus-cases/feature-gating.test.ts", 2],
  ["packages/frontend/src/validator-maximus-cases/generic-function-values.test.ts", 2],
  ["packages/frontend/src/validator-maximus-cases/json-static-safety.test.ts", 5],
  ["packages/frontend/src/validator-maximus-cases/type-syntax.test.ts", 3],
  ["packages/frontend/src/validator.maximus.test.ts", 0],
  ["packages/frontend/src/validator.test.ts", 0],
  ["packages/targets/csharp/backend/src/dotnet.test.ts", 2],
  ["packages/targets/csharp/backend/src/program-generator.test.ts", 3],
  ["packages/targets/csharp/backend/src/project-generator.test.ts", 9],
  ["packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts", 3],
  ["packages/targets/csharp/emitter/src/rendering/expressions.test.ts", 23],
  ["packages/targets/csharp/emitter/src/rendering/external-bindings.test.ts", 2],
  ["packages/targets/csharp/emitter/src/rendering/module.test.ts", 17],
  ["packages/targets/csharp/emitter/src/rendering/statements.test.ts", 3],
]);

export const oldProductUnitHistoricalTestFiles = Object.freeze(
  oldProductUnitHistoricalTestFileTuples.map(([oldPath]) => oldPath),
);

export const oldProductUnitPortInventory = Object.freeze(
  oldProductUnitHistoricalTestFileTuples.map(([oldPath, testDeclarations]) => Object.freeze({
    oldPath,
    testDeclarations,
    status: oldProductUnitStatusFor(oldPath),
    featureArea: oldProductUnitFeatureAreaFor(oldPath),
    owner: oldProductUnitOwnerFor(oldPath),
    capabilityIds: Object.freeze(oldProductUnitCapabilityIdsFor(oldPath)),
    reason: oldProductUnitReasonFor(oldPath),
  })),
);

const oldProductUnitStatusSet = new Set(oldProductUnitStatuses);
const oldProductUnitFeatureAreaSet = new Set(oldProductUnitFeatureAreas);

function oldProductUnitStatusFor(oldPath) {
  if (
    oldPath.includes("/package-manifests/bindings") ||
    oldPath.includes("/add-npm") ||
    oldPath.includes("/add-deps") ||
    oldPath.includes("/restore") ||
    oldPath.includes("/lowering/") ||
    oldPath.includes("/validator")
  ) {
    return "invalid-stale-architecture";
  }

  return "deferred";
}

function oldProductUnitFeatureAreaFor(oldPath) {
  if (oldPath.includes("/config")) {
    return "host-config";
  }
  if (oldPath.includes("/package-manifests/") || oldPath.includes("/add-") || oldPath.includes("/restore")) {
    return "package-model";
  }
  if (oldPath.includes("/surface/")) {
    return "surface-provider";
  }
  if (oldPath.includes("/tsonic-extension/") || oldPath.includes("/source-frontend/")) {
    return "source-semantics";
  }
  if (oldPath.includes("/program/") || oldPath.includes("/resolver/") || oldPath.includes("/validator") || oldPath.includes("/lowering/")) {
    return "frontend";
  }
  if (oldPath.includes("/targets/csharp/backend/")) {
    return "toolchain";
  }
  if (oldPath.includes("/targets/csharp/emitter/")) {
    return "csharp-backend";
  }
  if (oldPath.includes("/dotnet/")) {
    return "target-provider";
  }
  if (oldPath.includes("/types/")) {
    return "diagnostic";
  }

  return "cli";
}

function oldProductUnitOwnerFor(oldPath) {
  switch (oldProductUnitFeatureAreaFor(oldPath)) {
    case "host-config":
      return "Tsonic host config";
    case "package-model":
      return "provider/package composition";
    case "frontend":
      return "TSTS public API integration";
    case "source-semantics":
      return "source/core provider";
    case "surface-provider":
      return "surface providers";
    case "target-provider":
      return "target provider";
    case "csharp-backend":
      return "C# backend AST";
    case "toolchain":
      return "C# toolchain";
    case "diagnostic":
      return "diagnostics and result model";
    default:
      return "Tsonic CLI";
  }
}

function oldProductUnitCapabilityIdsFor(oldPath) {
  const ids = new Set();
  const featureArea = oldProductUnitFeatureAreaFor(oldPath);

  switch (featureArea) {
    case "host-config":
      ids.add("host.config.project-load");
      ids.add("host.config.target-selection");
      ids.add("host.config.surface-selection");
      break;
    case "package-model":
      ids.add("host.package.composition");
      ids.add("provider.virtual-module.ownership");
      ids.add("provider.virtual-module.no-fallback");
      break;
    case "frontend":
      ids.add("tsts.parse-bind-check");
      ids.add("tsts.consumer-queries");
      ids.add("backend.fail-closed-facts");
      break;
    case "source-semantics":
      ids.add("source.primitive.numeric");
      ids.add("source.marker.out-ref-inref");
      ids.add("source.marker.attribute");
      break;
    case "surface-provider":
      ids.add("host.config.surface-selection");
      ids.add("surface.js.console");
      ids.add("surface.node.fs-path-process");
      break;
    case "target-provider":
      ids.add("native.dotnet.assembly-model");
      ids.add("provider.virtual-module.target-identity");
      break;
    case "csharp-backend":
      ids.add("backend.ast.only");
      ids.add("backend.no-semantic-strings");
      ids.add("backend.csharp.ast-expression");
      break;
    case "toolchain":
      ids.add("toolchain.csharp.project");
      ids.add("toolchain.csharp.build-run");
      break;
    case "diagnostic":
      ids.add("diagnostic.source-spans");
      ids.add("diagnostic.evidence");
      break;
    default:
      ids.add("host.config.project-load");
      ids.add("host.package.composition");
  }

  if (oldPath.includes("build")) {
    ids.add("toolchain.csharp.build-run");
    ids.add("backend.csharp.project-sdk-emit");
  }
  if (oldPath.includes("native-library") || oldPath.includes("dotnet")) {
    ids.add("native.dotnet.type-model");
    ids.add("operation.call.provider-selected-method");
  }
  if (oldPath.includes("bindings")) {
    ids.add("provider.module.no-file-backed-fallback");
  }
  if (oldPath.includes("surface")) {
    ids.add("surface.js.array-methods");
    ids.add("runtime.csharp.js");
  }
  if (oldPath.includes("any") || oldPath.includes("object-literal")) {
    ids.add("compat.any.dynamic-get");
    ids.add("carrier.object-shape");
  }
  if (oldPath.includes("generic")) {
    ids.add("tsts.generic-inference");
    ids.add("type.generic.provider-target-arguments");
  }
  if (oldPath.includes("utility")) {
    ids.add("type.utility");
  }
  if (oldPath.includes("array")) {
    ids.add("carrier.array");
    ids.add("operation.array.literal");
  }

  return [...ids].sort();
}

function oldProductUnitReasonFor(oldPath) {
  if (oldProductUnitStatusFor(oldPath) === "invalid-stale-architecture") {
    return "Old unit test targets legacy frontend, package manifest, or binding-file architecture; replacement must be capability-ledger coverage against TSTS/provider/fact boundaries.";
  }

  return "Old product unit test is mandatory regression evidence and remains deferred until the matching capability batch ports it to the current TSTS/provider/backend architecture.";
}

function createOldProductUnitCounts(total) {
  return {
    total,
    ported: 0,
    "replaced-by-stronger-test": 0,
    "invalid-stale-architecture": 0,
    deferred: 0,
    unclassified: 0,
  };
}

export function validateOldProductUnitPortEntry(entry) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return ["entry must be an object"];
  }

  const errors = [];

  if (typeof entry.oldPath !== "string" || entry.oldPath.length === 0) {
    errors.push("oldPath must be a non-empty string");
  } else if (!entry.oldPath.startsWith("packages/") || entry.oldPath.startsWith("/")) {
    errors.push("oldPath must be a relative packages/ path");
  }

  if (!Number.isInteger(entry.testDeclarations) || entry.testDeclarations < 0) {
    errors.push("testDeclarations must be a non-negative integer");
  }

  if (entry.newPath !== undefined) {
    if (typeof entry.newPath !== "string" || entry.newPath.length === 0) {
      errors.push("newPath must be a non-empty string when present");
    } else if (entry.newPath.startsWith("/")) {
      errors.push("newPath must be relative when present");
    }
  }

  if (!oldProductUnitStatusSet.has(entry.status)) {
    errors.push(`status must be one of ${oldProductUnitStatuses.join(", ")}`);
  }

  if (!oldProductUnitFeatureAreaSet.has(entry.featureArea)) {
    errors.push(`featureArea must be one of ${oldProductUnitFeatureAreas.join(", ")}`);
  }

  if (!Array.isArray(entry.capabilityIds) || entry.capabilityIds.length === 0) {
    errors.push("capabilityIds must be a non-empty array");
  } else {
    for (const capabilityId of entry.capabilityIds) {
      if (typeof capabilityId !== "string" || capabilityId.length === 0) {
        errors.push("capabilityIds must contain non-empty strings");
      }
    }
  }

  if (typeof entry.owner !== "string" || entry.owner.length === 0) {
    errors.push("owner must be a non-empty string");
  }

  if (typeof entry.reason !== "string" || entry.reason.length === 0) {
    errors.push("reason must be a non-empty string");
  }

  return errors;
}

export function buildOldProductUnitInventoryReport(historicalOldPaths, inventoryEntries = oldProductUnitPortInventory) {
  const historicalPaths = [...new Set(historicalOldPaths)].sort();
  const historicalPathSet = new Set(historicalPaths);
  const classifiedOldPathSet = new Set();
  const classifiedUnknownOldPathSet = new Set();
  const counts = createOldProductUnitCounts(historicalPaths.length);

  for (const entry of inventoryEntries) {
    if (!historicalPathSet.has(entry.oldPath)) {
      classifiedUnknownOldPathSet.add(entry.oldPath);
      continue;
    }

    if (classifiedOldPathSet.has(entry.oldPath)) {
      continue;
    }

    counts[entry.status] += 1;
    classifiedOldPathSet.add(entry.oldPath);
  }

  const unclassifiedOldPaths = historicalPaths.filter((oldPath) => !classifiedOldPathSet.has(oldPath));
  counts.unclassified = unclassifiedOldPaths.length;

  return Object.freeze({
    counts: Object.freeze(counts),
    classifiedOldPaths: Object.freeze([...classifiedOldPathSet].sort()),
    classifiedUnknownOldPaths: Object.freeze([...classifiedUnknownOldPathSet].sort()),
    unclassifiedOldPaths: Object.freeze(unclassifiedOldPaths),
  });
}

export function countOldProductUnitDeclarations(inventoryEntries = oldProductUnitPortInventory) {
  return inventoryEntries.reduce((total, entry) => total + entry.testDeclarations, 0);
}

export function formatOldProductUnitInventoryCounts(counts) {
  return oldProductUnitReportCountKeys.map((key) => `${key}: ${counts[key]}`).join("\n");
}
