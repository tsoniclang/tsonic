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
    newPath: "test/cli-build/e2e-runtime.test.mjs",
    status: "ported",
    featureArea: "native-provider",
    owner: "C# native provider",
    reason:
      "Ported as a current-architecture executable E2E: provider-owned Console.writeLine is compiled through TSTS/provider facts, emitted as C# AST, built by dotnet, and run with exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/namespace-imports/",
    newPath: "test/cli-build/e2e-runtime.test.mjs",
    status: "ported",
    featureArea: "native-provider",
    owner: "C# native provider + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering namespace import access, source module constants/functions, provider-owned Console.writeLine, C# AST output, dotnet build, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/file-io/",
    newPath: "test/cli-build/e2e-runtime.test.mjs",
    status: "ported",
    featureArea: "native-provider",
    owner: "C# native provider",
    reason:
      "Ported as a current-architecture executable E2E covering reflection-provider File/Path operations, ordered top-level execution, dotnet build/run, file-system behavior, and exact stdout.",
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
      "Array spread, Length, and index access need selected array/runtime carrier facts instead of backend spread-lowering inference.",
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
      "Source behavior is ?? over string null/undefined, number null, and boolean constructor input; port after nullish carrier facts and undefined handling are finalized without preserving stale runtime recovery paths.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/optional-chaining/",
    status: "deferred",
    featureArea: "js-surface",
    owner: "C# JS surface + C# backend planner",
    reason:
      "Source behavior is optional property chaining over object-literal User/Address shapes and name.length with ?? alternate value; port after structural object storage, undefined carrier choice, and optional-chain lowering are covered together.",
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
      "Source behavior is int[] literal creation, index reads, and length output; port with modern JS .length semantics under selected array carrier facts, not as support for the old .Length spelling.",
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
  ...deferredFixtures([
    "action-func-callbacks",
    "arrow-contextual-advanced",
    "arrow-function",
    "arrow-inference",
    "arrow-return-object-literal",
    "closures",
    "delegate-types-comprehensive",
    "function-types-in-collections",
    "functions-returning-functions",
    "interface-with-functions",
    "optional-function-params",
  ], "csharp-backend", "TSTS contextual signatures + C# backend planner", "Valid source behavior exercises callable values, contextual lambda typing, delegate/function carriers, closures, and optional parameters; port after every callable fixture uses TSTS signatures and finalized target delegate facts with no backend inference."),
  ...deferredFixtures([
    "advanced-generics-tsn7414",
    "generic-chains",
    "generic-complex-chain",
    "generic-constraints-object-struct",
    "generic-constraints-single",
    "generic-contextual",
    "generic-function-declaration-alias",
    "generic-function-declaration-tsn7432",
    "generic-function-import-alias",
    "generic-function-import-tsn7432",
    "generic-function-type-aliases",
    "generic-function-value",
    "generic-function-value-alias",
    "generic-function-value-contextual",
    "generic-function-value-default-export",
    "generic-function-value-let-reassign-tsn7432",
    "generic-function-value-multi-declarator",
    "generic-function-value-nested",
    "generic-function-value-tsn7432",
    "generic-inference",
    "generic-inheritance-chain",
    "generic-inheritance-concrete",
    "generic-inheritance-generic",
    "generic-int-substitution",
    "generic-interface-inheritance",
    "generic-method-in-class",
    "generic-multiple-constraints",
    "generic-nested-substitution",
    "generic-null-default",
    "nested-generic-brands",
  ], "csharp-backend", "TSTS generic inference/substitution facts + C# declaration planner", "Valid behavior covers generic declarations, imported/exported generic function values, contextual generic calls, inheritance substitution, constraints, aliases, and nested substitutions; port after C# planning consumes TSTS generic symbols/type arguments and provider constraint facts end to end."),
  ...deferredFixtures([
    "anonymous-object-type-literal",
    "nested-object-rest-destructuring",
    "object-literal-accessors",
    "object-literal-computed-const-keys",
    "object-literal-method-accessor-js",
    "object-literal-method-arguments-destructured-reject",
    "object-literal-method-arguments-index",
    "object-literal-method-arguments-index-reject",
    "object-literal-method-arguments-length",
    "object-literal-method-shorthand",
    "object-literal-method-super-reject",
    "object-literal-method-this",
    "object-literal-object",
    "object-prop-int-to-double",
    "object-prop-int-to-int",
    "recursive-tree",
    "recursive-type-no-hang",
    "utility-types",
  ], "csharp-backend", "TSTS structural type facts + C# object-shape planner", "Valid behavior covers structural type literals, object literals, methods/accessors, rest/spread-style shape materialization, recursive source shapes, and utility-type projections; port only through finalized object-shape facts and generated target carriers."),
  ...deferredFixtures([
    "array-index-dotnet",
    "array-multidimensional",
    "clr-string-indexer-dotnet",
    "collections",
    "dictionaries",
    "method-overload-specialization",
    "method-overload-specialization-dotnet-string",
    "method-overload-specialization-multiparam",
    "native-array-push-mutation",
    "readonly-array-property-mutation",
  ], "native-provider", "C# native provider + C# backend planner", "Valid behavior covers native arrays, collection/dictionary carriers, overload specialization, and mutation constraints; port after .NET provider facts supply closed member/indexer/overload data and C# planner consumes selected target facts only."),
  ...deferredFixtures([
    "asinterface-dotnet",
    "aspnetcore-dotnet",
    "await-task-dotnet",
    "boolean-context-locals-dotnet",
    "continuewith-return-task-dotnet",
    "efcore-linq-async-dotnet",
    "efcore-precompile-queries-dotnet",
    "efcore-sqlite-dotnet",
    "extension-methods-dotnet",
    "implements-clr-interface",
    "linq-dotnet",
    "linq-queryable-dotnet",
  ], "downstream", "C# native provider + downstream target package providers", "Valid behavior depends on broad .NET/ASP.NET/EF/LINQ API data, extension methods, task carriers, and interface implementation facts; port after provider data is supplied by target packages and downstream fixture wiring is restored under current target config."),
  ...deferredFixtures([
    "attributes-basic",
    "attributes-comprehensive",
    "class-basic",
    "class-constructor",
    "class-field-inference",
    "class-inheritance",
    "class-static-members",
    "override-protected-internal",
    "param-modifiers",
    "property-override-virtual",
  ], "csharp-backend", "TSTS declaration AST + C# declaration planner", "Valid behavior covers source declarations, class members, constructors, inheritance, attributes, modifiers, overrides, and virtual/protected shapes; port after declaration planner coverage is fixture-backed with C# AST output only."),
  ...deferredFixtures([
    "async-basic",
    "async-bidirectional-generator",
    "async-higher-order",
    "async-ops-uses-map",
    "async-union-object-literal-return",
    "bidirectional-generator",
    "generator-different-treturn",
    "generator-return-value",
    "multi-module-generators",
    "promise-chain-reject-stable",
    "promise-constructor-task",
    "promise-void-resolve",
    "task-then-disallowed",
    "yield-compound-assignment",
    "yield-conditional-expression",
    "yield-control-conditions",
    "yield-for-condition-update",
    "yield-for-declaration-initializer",
    "yield-for-initializer-assignment",
    "yield-forof-forin-expression",
    "yield-nested-expression-lowering",
    "yield-return-expression",
    "yield-switch-case-test-tsn6101",
  ], "csharp-backend", "TSTS async/generator facts + C# backend planner", "Valid behavior covers async, Promise/Task mapping, generator/yield control flow, return channels, and reject cases; port after TSTS/provider facts identify awaited/yielded carriers and the backend emits deterministic C# async/iterator AST."),
  ...deferredFixtures([
    "barrel-reexports",
    "import-type-erase",
    "module-const-array-mutation",
    "multi-file",
    "multi-file-imports",
    "multi-file-types",
    "source-package-basic",
    "source-package-subpath",
    "source-package-surface-mismatch",
  ], "config", "Tsonic host module graph + source package loader", "Valid behavior covers ESM import/export graphs, type-only erasure, source package subpaths, multi-file source ownership, and target/surface mismatch diagnostics; port after current host config and TSTS module graph queries cover the fixture shape."),
  ...deferredFixtures([
    "core-intrinsics-provenance",
    "defaultof-intrinsic",
    "integer-casting",
    "pointer-types",
    "stackalloc-span",
    "type-assertions",
  ], "native-provider", "source semantics + C# native provider + C# backend planner", "Valid behavior covers source intrinsics, primitive casts, pointers, stack allocation, and assertion erasure; port after source marker facts and provider target facts fully determine the C# AST without backend inference."),
  ...deferredFixtures([
    "char-invalid-tsn7418",
    "conditional-types",
    "deterministic-typing-ergonomics",
    "finite-number-int-narrowing-reject",
    "mapped-types",
    "never-generic-arg-tsn7419",
    "parseint-int-narrowing-reject",
    "unprovable-numeric-narrowing",
    "with-reject-stable",
  ], "diagnostic", "TSTS diagnostics + C# backend diagnostic gates", "Valid negative coverage protects rejected source patterns, type-level TS features that erase before target emission, and unprovable numeric narrowing; port after each diagnostic is tied to the owning TSTS or provider fact boundary."),
  ...deferredFixtures([
    "cast-exemption-as-number",
    "cast-precedence",
    "discriminant-equality",
    "first-next-ignored",
    "instanceof-narrowing",
    "nullish-coalescing-threading",
    "optional-value-type-properties",
  ], "csharp-backend", "TSTS flow/contextual facts + C# expression planner", "Valid behavior covers narrowing, discriminants, cast erasure, nullish/optional threading, and precedence preservation; port after C# expression planning consumes TSTS flow and contextual target facts instead of recalculating them."),
  ...deferredFixtures([
    "date-not-global",
    "dotnet-disallowed-js-builtins",
    "js-string-array-returns",
    "js-surface-array-from-map-keys",
    "js-surface-boolean-tostring",
    "js-surface-hello",
    "js-surface-json-typed-parse",
    "js-surface-node-aliases",
    "js-surface-node-boolean-tostring",
    "js-surface-node-date-union",
    "map-set-not-in-globals",
    "nonpromise-then-allowed",
  ], "js-surface", "C# JS surface provider + C# JS runtime", "Valid behavior covers explicit JavaScript surface selection, globals/builtins, Date/Map/Set/JSON/Boolean/String/Array behavior, and JS-vs-native rejection; port after JS surface facts and runtime artifacts are selected by target config."),
  ...deferredFixtures([
    "json-bcl-roundtrip",
    "json-native-inline-stringify",
    "json-native-roundtrip",
    "json-native-typed-stringify",
  ], "runtime", "C# runtime/project artifacts + provider JSON facts", "Valid behavior covers JSON source generation, typed stringify/parse, BCL roundtrips, and project artifact generation; port after JSON metadata is proven statically and emitted through target-owned project/runtime artifacts."),
  ...deferredFixtures([
    "nodejs-path-posix-join",
    "nodejs-surface-imports-negative",
    "nodejs-surface-module-graph",
  ], "nodejs-surface", "C# NodeJS surface provider + C# NodeJS runtime", "Valid behavior covers NodeJS module ownership, negative imports without selected surface, path variants, and module graph aliases; port after nodejs surface virtual declarations and runtime artifacts cover the fixture APIs."),
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

function deferredFixtures(names, featureArea, owner, reason) {
  return names.map((name) => Object.freeze({
    oldPath: oldFixturePath(name),
    status: "deferred",
    featureArea,
    owner,
    reason,
  }));
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
