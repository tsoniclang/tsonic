export const oldSuiteStatuses = Object.freeze([
  "reused",
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
]);

export const oldSuiteFeatureAreas = Object.freeze([
  "config",
  "native-provider",
  "js-surface",
  "nodejs-surface",
  "csharp-backend",
  "runtime",
  "toolchain",
  "diagnostic",
  "downstream",
]);

export const oldSuiteReportCountKeys = Object.freeze([
  "total",
  "reused",
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
  "unclassified",
]);

export const oldSuiteRequiredSeedFixturePaths = Object.freeze([
  "test/fixtures/hello-world/",
  "test/fixtures/namespace-imports/",
  "test/fixtures/file-io/",
  "test/fixtures/nullable-narrowing/",
  "test/fixtures/array-spread/",
  "test/fixtures/generic-method-standalone/",
  "test/fixtures/extension-methods-system/",
  "test/fixtures/struct-basic/",
  "test/fixtures/js-surface-runtime-builtins/",
  "test/fixtures/nodejs-surface-alias-coverage/",
]);

export const oldSuitePortInventory = Object.freeze([
  Object.freeze({
    oldPath: "test/fixtures/hello-world/",
    status: "deferred",
    featureArea: "native-provider",
    owner: "C# native provider",
    reason:
      "Old source imports Console.WriteLine from @tsonic/dotnet/System.js; port after final Console facts and target config E2E wiring exist.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/namespace-imports/",
    status: "deferred",
    featureArea: "native-provider",
    owner: "C# native provider + C# backend planner",
    reason:
      "Valid behavior covers namespace imports, local module constants/functions, Console.WriteLine, and E2E output; port after native provider console facts and namespace import fixture wiring exist.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/file-io/",
    status: "deferred",
    featureArea: "native-provider",
    owner: "C# native provider",
    reason:
      "System.IO File and Path calls need provider-owned target member facts plus deterministic toolchain/runtime file-system E2E coverage.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/nullable-narrowing/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "C# backend planner",
    reason:
      "Valid TypeScript narrowing must port as TSTS flow facts plus finalized nullable carrier facts, not old nullable .Value rewrite assertions.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-spread/",
    status: "deferred",
    featureArea: "js-surface",
    owner: "C# JS surface",
    reason:
      "Array spread, Length, and index access need selected array/runtime carrier facts instead of backend spread-lowering fallback.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/generic-method-standalone/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "C# backend planner",
    reason:
      "Source generic method calls are valid; port after the planner consumes TSTS generic call and return-shape facts for method type arguments.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/extension-methods-system/",
    status: "deferred",
    featureArea: "native-provider",
    owner: "C# native provider",
    reason:
      "System extension-method dispatch through asinterface<ExtensionMethods<T>> needs native provider member and parameter-mode facts.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/struct-basic/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "source semantics + C# native provider + C# backend planner",
    reason:
      "Valid behavior covers value-type modeling, object literal storage, System.Math.Sqrt, Console.WriteLine, and E2E output; port to the final neutral struct()/field() source shape instead of preserving old interface extends struct.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/js-surface-runtime-builtins/",
    status: "deferred",
    featureArea: "js-surface",
    owner: "C# JS surface",
    reason:
      "Requires selected js surface facts and runtime artifacts for String, JSON, Date, Math, RegExp, Map, Set, Array, and console behavior.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/nodejs-surface-alias-coverage/",
    status: "deferred",
    featureArea: "nodejs-surface",
    owner: "C# NodeJS surface",
    reason:
      "Requires selected nodejs surface with js dependency and module alias facts for node:* imports before the fixture can be ported.",
  }),
]);

const oldSuiteStatusSet = new Set(oldSuiteStatuses);
const oldSuiteFeatureAreaSet = new Set(oldSuiteFeatureAreas);

function createOldSuiteCounts(total) {
  return {
    total,
    reused: 0,
    ported: 0,
    "replaced-by-stronger-test": 0,
    "invalid-stale-architecture": 0,
    deferred: 0,
    unclassified: 0,
  };
}

function isRelativeOldSuitePath(value) {
  return value.startsWith("test/") || value.startsWith("packages/");
}

export function oldFixturePath(name) {
  return `test/fixtures/${name}/`;
}

export function validateOldSuitePortEntry(entry) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return ["entry must be an object"];
  }

  const errors = [];

  if (typeof entry.oldPath !== "string" || entry.oldPath.length === 0) {
    errors.push("oldPath must be a non-empty string");
  } else if (!isRelativeOldSuitePath(entry.oldPath)) {
    errors.push("oldPath must be a relative old-suite path under test/ or packages/");
  }

  if (entry.newPath !== undefined) {
    if (typeof entry.newPath !== "string" || entry.newPath.length === 0) {
      errors.push("newPath must be a non-empty string when present");
    } else if (entry.newPath.startsWith("/")) {
      errors.push("newPath must be relative when present");
    }
  }

  if (!oldSuiteStatusSet.has(entry.status)) {
    errors.push(`status must be one of ${oldSuiteStatuses.join(", ")}`);
  }

  if (!oldSuiteFeatureAreaSet.has(entry.featureArea)) {
    errors.push(`featureArea must be one of ${oldSuiteFeatureAreas.join(", ")}`);
  }

  if (typeof entry.owner !== "string" || entry.owner.length === 0) {
    errors.push("owner must be a non-empty string");
  }

  if (typeof entry.reason !== "string" || entry.reason.length === 0) {
    errors.push("reason must be a non-empty string");
  }

  return errors;
}

export function buildOldSuiteInventoryReport(historicalOldPaths, inventoryEntries = oldSuitePortInventory) {
  const historicalPaths = [...new Set(historicalOldPaths)].sort();
  const historicalPathSet = new Set(historicalPaths);
  const classifiedOldPathSet = new Set();
  const classifiedUnknownOldPathSet = new Set();
  const counts = createOldSuiteCounts(historicalPaths.length);

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

export function formatOldSuiteInventoryCounts(counts) {
  return oldSuiteReportCountKeys.map((key) => `${key}: ${counts[key]}`).join("\n");
}
