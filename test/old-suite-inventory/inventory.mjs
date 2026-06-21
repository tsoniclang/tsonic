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
  Object.freeze({
    oldPath: "test/fixtures/top-level-code/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "C# backend planner + C# native provider",
    reason:
      "Source behavior is a module const read by an exported function plus top-level Console.WriteLine statements; port after current target config, entrypoint Main wrapping, module field storage, and Console E2E facts are finalized.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/dotnet-test-command/",
    status: "invalid-stale-architecture",
    featureArea: "config",
    owner: "host/CLI config",
    reason:
      "Rejected behavior is the old library test-command config using output.type, nativeAot, and tests.entryPoint; current config is entryPoint/rootDir/outDir/targets, so the old dotnet test command shape is not preserved.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/module-constants/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "C# backend planner + C# native provider",
    reason:
      "Source behavior is inferred module constants for number, string, integer, and boolean values printed through template strings; port after module const storage, interpolation formatting, and Console E2E coverage exist under current config.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/variable-decls/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "C# backend planner",
    reason:
      "Source behavior is primitive inference, explicit int/byte/short/long/float/number/string/boolean annotations, and mutable local assignment; port after neutral primitive aliases and assignment storage are covered under current config.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/function-basic/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "C# backend planner + C# native provider",
    reason:
      "Source behavior is local function declarations for greeting, arithmetic, and boolean modulo checks with Console output; port after function lowering and Console E2E output are covered in the clean suite.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/switch-statement/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "C# backend planner",
    reason:
      "Source behavior is switch grouping for weekend/weekday/default return values; port after the clean control-flow suite asserts source switch semantics and runtime output under current target config.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/return-in-control-flow/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "TSTS semantic facts + C# backend planner",
    reason:
      "Source behavior is expected int typing threaded through returns in if/else, while, for, switch, nested if, and nullish return expressions so integer division truncates; port after TSTS expected-type facts drive every return site.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/nested-scopes/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "C# backend planner",
    reason:
      "Source behavior is block-scoped locals a, b, and c added with a parameter across nested lexical scopes; port after local scope emission is asserted with runtime output instead of old generated C# text.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/shadowing/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "TSTS binding facts + C# backend planner",
    reason:
      "Source behavior is block-local shadowing and arrow-function-local shadowing producing distinct values; port after clean tests prove binder identity and C# local naming preserve shadowed source bindings.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/nullish-coalescing/",
    status: "deferred",
    featureArea: "js-surface",
    owner: "C# JS surface + C# backend planner",
    reason:
      "Source behavior is ?? over string null/undefined, number null, and boolean constructor input; port after nullish carrier facts and undefined handling are finalized without preserving stale runtime fallbacks.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/optional-chaining/",
    status: "deferred",
    featureArea: "js-surface",
    owner: "C# JS surface + C# backend planner",
    reason:
      "Source behavior is optional property chaining over object-literal User/Address shapes and name.length with ?? fallback; port after structural object storage, undefined carrier choice, and optional-chain lowering are covered together.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/ternary-int-branch/",
    status: "deferred",
    featureArea: "diagnostic",
    owner: "TSTS semantic facts + C# backend diagnostics",
    reason:
      "Source behavior is the old TSN5110 rejection for a ternary assigned to number with one integer and one double branch; defer until the numeric widening contract is reviewed against current source-primitive tests.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/ternary-int-threading/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "TSTS semantic facts + C# backend planner",
    reason:
      "Source behavior is int expected-type threading through ternary literals, int division in ternary branches, nested ternaries, return statements, arithmetic branches, and assignments; port after those facts are emitted from TSTS.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-literal/",
    status: "deferred",
    featureArea: "js-surface",
    owner: "C# JS surface + C# backend planner",
    reason:
      "Source behavior is int[] literal creation, index reads, and length output; port with modern JS .length semantics under selected array carrier facts, not as a compatibility requirement for the old .Length spelling.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-constructor/",
    status: "deferred",
    featureArea: "js-surface",
    owner: "C# JS surface + C# backend planner",
    reason:
      "Source behavior is new Array<T>(size) for int and string arrays plus fixed-size array length output; port after array construction facts are finalized and length is expressed with canonical JS source syntax.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-destructuring/",
    status: "deferred",
    featureArea: "js-surface",
    owner: "C# JS surface + C# backend planner",
    reason:
      "Source behavior is array binding destructuring from a parameter and from a literal, then summing or printing first, second, and third values; port after array destructuring uses finalized carrier facts with runtime output coverage.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-double/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "TSTS semantic facts + C# backend planner",
    reason:
      "Source behavior is number[] literals with integer-valued elements emitted as double storage and read by index; port after numeric literal-to-number array inference is locked against the current primitive contract.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-type-emission/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "C# backend planner",
    reason:
      "Source behavior is typed arrays for int, long, byte, short, float, number, decimal, uint, ulong, and nested numeric arrays; port after neutral primitive array element carriers and literal suffix facts are covered.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/tuple-int-elements/",
    status: "deferred",
    featureArea: "diagnostic",
    owner: "TSTS semantic facts + C# backend diagnostics",
    reason:
      "Source behavior is the old TSN5110 rejection for passing [1, 2] to a [number, number] parameter; defer until tuple literal numeric widening is reviewed against current tuple source semantics.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/tuple-cast-exemption/",
    status: "deferred",
    featureArea: "csharp-backend",
    owner: "TSTS semantic facts + C# backend planner",
    reason:
      "Source behavior is tuple literals accepted when elements use explicit number assertions or double literals; port after tuple value emission and assertion-erasure facts cover explicit user intent.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/implicit-int-to-double/",
    status: "invalid-stale-architecture",
    featureArea: "diagnostic",
    owner: "TSTS semantic facts + C# backend diagnostics",
    reason:
      "Rejected behavior is the old TSN5110 expectation that integer literals cannot flow to number parameters; current CLI coverage accepts number rest parameters called as sum(1, 2, 3), so this old negative expectation is not canonical.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/default-param-int-to-double/",
    status: "invalid-stale-architecture",
    featureArea: "diagnostic",
    owner: "TSTS semantic facts + C# backend diagnostics",
    reason:
      "Rejected behavior is the old TSN5110 expectation for value: number = 42; current CLI coverage accepts value: number = 3 and emits a C# optional double parameter, so the old negative expectation is stale.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/type-alias-int-to-double/",
    status: "deferred",
    featureArea: "diagnostic",
    owner: "TSTS semantic facts + C# backend diagnostics",
    reason:
      "Source behavior is the old TSN5110 rejection for an object literal property x: 42 assigned through type Config = { x: number }; defer until structural type-alias object literal widening is reviewed directly.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/char-primitive/",
    status: "deferred",
    featureArea: "native-provider",
    owner: "C# native provider + C# backend planner",
    reason:
      "Source behavior is char literals in variables, ternaries, arrays, comparisons, assertions, Char.IsLetter/IsWhiteSpace calls, and Rune construction; port after closed native Char/Rune facts and char literal E2E coverage exist.",
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
