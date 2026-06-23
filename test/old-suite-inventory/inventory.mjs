export const oldSuiteStatuses = Object.freeze([
  "reused",
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
]);

export const oldSuiteCapabilityMappingStatuses = Object.freeze([
  "reviewed",
  "deferred-derived",
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

const oldSuitePortInventoryEntries = Object.freeze([
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
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS flow facts + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering typeof-based narrowing of string | null, nullable class/value carriers, optional access after narrowing, generated C# AST, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-spread/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "js-surface",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Ported as a current-architecture executable E2E covering array spread, index reads, JS .length access, finalized array carrier facts, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/generic-method-standalone/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS generic call facts + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering top-level generic method calls with explicit and inferred type arguments, source-call return carriers, generated C# generic methods, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/generic-constraints-single/",
    newPath: "test/cli-build/modules-declarations.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS generic constraint facts + C# backend planner",
    reason:
      "Ported as current-architecture C# AST coverage for named generic constraints rendered only from finalized target constraint facts and validated by dotnet build.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/generic-constraints-object-struct/",
    newPath: "test/cli-build/modules-declarations.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS generic constraint facts + C# backend planner",
    reason:
      "Ported as current-architecture C# AST coverage for TypeScript object constraints mapped by source semantics to a C# class keyword constraint and validated by dotnet build.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/generic-multiple-constraints/",
    newPath: "test/cli-build/modules-declarations.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS generic constraint facts + C# backend planner",
    reason:
      "Ported as current-architecture C# AST coverage for intersection generic constraints rendered only from finalized target constraint facts and validated by dotnet build.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/generic-interface-inheritance/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS generic/interface facts + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering generic interface inheritance, concrete and generic implementations, C# auto-property interface satisfaction, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/generic-nested-substitution/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS generic substitution facts + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering nested generic class substitution through Wrapper<T>, int32 specialization, generated C# type arguments, dotnet build/run, and exact stdout.",
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
    status: "ported",
    featureArea: "csharp-backend",
    owner: "C# backend planner + C# native provider",
    newPath: "test/cli-build/e2e-runtime.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering a module const read by an exported function plus top-level provider-owned Console.writeLine statements, current target config, entrypoint Main wrapping, dotnet build/run, and exact stdout.",
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
    status: "ported",
    featureArea: "csharp-backend",
    owner: "C# backend planner + C# native provider",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering inferred module constants for number, string, integer, and boolean values, provider-owned Console.writeLine, template interpolation, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/variable-decls/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering primitive inference, explicit int32/uint8/int16/int64/float32/number/string/boolean annotations, mutable local assignment, typed numeric literal emission, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/function-basic/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "C# backend planner + C# native provider",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering source function declarations, string returns, numeric arithmetic, boolean modulo checks through provider-recorded operator facts, Console output, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/switch-statement/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering switch grouping for weekend/weekday/default return values, runtime output under current target config, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/return-in-control-flow/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS semantic facts + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering expected int32 carriers through returns in if/else, while, for, switch, nested if, and nullish return expressions so integer division truncates under finalized provider facts.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/nested-scopes/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering block-scoped locals added with a parameter across nested lexical scopes, C# AST block emission, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/shadowing/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS binding facts + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering block-local shadowing and arrow-function-local shadowing; C# local names are symbol-keyed from TSTS bindings, dotnet build/run succeeds, and stdout proves distinct source bindings.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/nullish-coalescing/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "js-surface",
    owner: "C# JS surface + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering ?? over nullable string, int32, number, optional property, optional call, and optional element results using finalized TSTS/provider carrier facts.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/nullish-coalescing-threading/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS semantic facts + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering int32 nullish expected-carrier threading through basic fallback, nested chains, fallback parameters, typed variable initializers, and if-branch returns.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/optional-chaining/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "js-surface",
    owner: "C# JS surface + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering optional property access, nested optional property access, optional method calls, optional element access, JS String.length provider facts on optional receivers, dotnet build/run, and exact stdout.",
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
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS semantic facts + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering int32 expected-carrier threading through ternary literals, int division in ternary branches, nested ternaries, return statements, arithmetic branches, and assignments.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-literal/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "js-surface",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Ported as a current-architecture executable E2E covering int32[] literal creation, index reads, JS .length access, provider-owned Console output, dotnet build/run, and exact stdout.",
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
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "js-surface",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Ported as a current-architecture executable E2E covering array binding destructuring from parameters and top-level module values using finalized carrier facts, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-double/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Ported as a current-architecture executable E2E covering number[] literals and returns as C# double arrays with index reads, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-type-emission/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Ported as a current-architecture executable E2E covering typed arrays for int32, int64, uint8, int16, float32, number, decimal, uint32, uint64, and nested numeric arrays with exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/array-multidimensional/",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    status: "ported",
    featureArea: "js-surface",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Ported as a current-architecture executable E2E covering nested array carriers, nested indexing, primitive nested arrays, dotnet build/run, and exact stdout.",
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
  Object.freeze({
    oldPath: "test/fixtures/arrow-function/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS contextual signatures + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering arrow-function values with explicit number parameter and return annotations, finalized callable carrier facts, C# Func emission, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/arrow-inference/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS contextual signatures + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering contextual arrow parameters passed to a typed callable argument so TSTS supplies the source signature and C# emission consumes finalized delegate facts.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/closures/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS contextual signatures + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering returned lambdas that capture and mutate lexical locals, returned adder closures, C# Func emission, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/optional-function-params/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS contextual signatures + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering optional and nullable callback parameters with int32 source primitive aliases, finalized nullable delegate carriers, C# optional/default parameter emission, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/function-types-in-collections/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS contextual signatures + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering an array of function-typed values, element-access callable invocation, finalized delegate carrier facts on the callee expression, C# Func array emission, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/functions-returning-functions/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS contextual signatures + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering returned function values, nested callable invocation, closure capture through nested lambdas, finalized delegate carrier facts for call-expression callees, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/interface-with-functions/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS object-shape facts + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering an interface property whose type is callable, object-literal delegate assignment, structural shape implementation as a C# property rather than a method, property-access callable invocation, dotnet build/run, and exact stdout.",
  }),
  ...deferredFixtures([
    "action-func-callbacks",
    "arrow-contextual-advanced",
    "arrow-return-object-literal",
    "delegate-types-comprehensive",
  ], "csharp-backend", "TSTS contextual signatures + C# backend planner", "Valid source behavior exercises callable values, contextual lambda typing, delegate/function carriers, closures, and optional parameters; port after every callable fixture uses TSTS signatures and finalized target delegate facts with no backend inference."),
  ...deferredFixtures([
    "advanced-generics-tsn7414",
    "generic-chains",
    "generic-complex-chain",
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
    "generic-method-in-class",
    "generic-null-default",
    "nested-generic-brands",
  ], "csharp-backend", "TSTS generic inference/substitution facts + C# declaration planner", "Valid behavior covers generic declarations, imported/exported generic function values, contextual generic calls, inheritance substitution, constraints, aliases, and nested substitutions; port after C# planning consumes TSTS generic symbols/type arguments and provider constraint facts end to end."),
  Object.freeze({
    oldPath: "test/fixtures/object-literal-method-shorthand/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS object-shape facts + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering object-literal method shorthand assigned to an interface method signature, contextual method parameters from TSTS, generated object-shape method wrappers, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/anonymous-object-type-literal/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS object-shape facts + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering an inline structural type-literal parameter, TSTS-resolved call parameter declaration facts, generated object-shape carriers, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/object-literal-object/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS object-shape facts + C# backend planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering object literal assignment to a structural type alias, source-visible member annotations, generated object-shape carrier identity, property reads, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/object-prop-int-to-int/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS source primitive facts + C# object-shape planner",
    newPath: "test/cli-build/e2e-runtime-language.test.mjs",
    reason:
      "Ported as a current-architecture executable E2E covering an int32 object-shape property preserved from explicit source annotation through finalized object-shape facts into an int field and int return, dotnet build/run, and exact stdout.",
  }),
  ...deferredFixtures([
    "nested-object-rest-destructuring",
    "object-literal-accessors",
    "object-literal-computed-const-keys",
    "object-literal-method-accessor-js",
    "object-literal-method-arguments-destructured-reject",
    "object-literal-method-arguments-index",
    "object-literal-method-arguments-index-reject",
    "object-literal-method-arguments-length",
    "object-literal-method-super-reject",
    "object-literal-method-this",
    "object-prop-int-to-double",
    "recursive-tree",
    "recursive-type-no-hang",
    "utility-types",
  ], "csharp-backend", "TSTS structural type facts + C# object-shape planner", "Valid behavior covers structural type literals, object literals, methods/accessors, rest/spread-style shape materialization, recursive source shapes, and utility-type projections; port only through finalized object-shape facts and generated target carriers."),
  ...deferredFixtures([
    "array-index-dotnet",
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

const oldSuiteReviewedCapabilityIdsByOldPath = new Map([
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("file-io"),
    oldFixturePath("hello-world"),
    oldFixturePath("namespace-imports"),
  ], [
    "backend.ast.only",
    "host.project.provider-composition",
    "host.package.composition",
    "operation.call.provider-selected-method",
    "provider.virtual-module.target-identity",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("nullable-narrowing"),
    oldFixturePath("nullish-coalescing-threading"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "carrier.null-undefined",
    "host.package.composition",
    "toolchain.csharp.build-run",
    "tsts.flow-narrowing",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("array-spread"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "host.package.composition",
    "operation.array.literal",
    "operation.spread.array",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("generic-constraints-single"),
    oldFixturePath("generic-interface-inheritance"),
    oldFixturePath("generic-method-standalone"),
    oldFixturePath("generic-multiple-constraints"),
    oldFixturePath("generic-nested-substitution"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "declaration.generic-parameters",
    "host.package.composition",
    "toolchain.csharp.build-run",
    "tsts.generic-inference",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("generic-constraints-object-struct"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "declaration.generic-parameters",
    "host.package.composition",
    "source.marker.field",
    "source.marker.struct",
    "toolchain.csharp.build-run",
    "tsts.generic-inference",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("arrow-function"),
    oldFixturePath("arrow-inference"),
    oldFixturePath("closures"),
    oldFixturePath("function-basic"),
    oldFixturePath("function-types-in-collections"),
    oldFixturePath("functions-returning-functions"),
    oldFixturePath("interface-with-functions"),
    oldFixturePath("module-constants"),
    oldFixturePath("nested-scopes"),
    oldFixturePath("optional-function-params"),
    oldFixturePath("return-in-control-flow"),
    oldFixturePath("shadowing"),
    oldFixturePath("switch-statement"),
    oldFixturePath("ternary-int-threading"),
    oldFixturePath("top-level-code"),
    oldFixturePath("variable-decls"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "host.package.composition",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("dotnet-test-command"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.config.target-selection",
    "host.project.target-selection",
    "host.package.composition",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("nullish-coalescing"),
  ], [
    "backend.ast.only",
    "carrier.null-undefined",
    "host.package.composition",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
    "tsts.flow-narrowing",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("optional-chaining"),
  ], [
    "backend.ast.only",
    "carrier.null-undefined",
    "expression.nullish-optional",
    "host.package.composition",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("array-literal"),
    oldFixturePath("array-multidimensional"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "host.package.composition",
    "operation.array.literal",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("array-destructuring"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "host.package.composition",
    "operation.array.literal",
    "operation.destructure.array-object",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("array-double"),
    oldFixturePath("array-type-emission"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "carrier.array",
    "host.package.composition",
    "operation.array.literal",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("default-param-int-to-double"),
    oldFixturePath("implicit-int-to-double"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "expression.literal.string-number-boolean",
    "host.package.composition",
    "operation.conversion.checked-target-conversion",
    "source.primitive.numeric",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("anonymous-object-type-literal"),
    oldFixturePath("object-literal-method-shorthand"),
    oldFixturePath("object-literal-object"),
    oldFixturePath("object-prop-int-to-int"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "carrier.object-shape",
    "expression.object-literal",
    "host.package.composition",
    "toolchain.csharp.build-run",
  ]),
]);

const oldSuiteReplacementProofByOldPath = new Map([
  [oldFixturePath("dotnet-test-command"), Object.freeze({
    replacementCapabilityIds: freezeSortedStrings([
      "backend.fail-closed-facts",
      "host.config.no-legacy-config",
      "host.config.project-load",
      "host.config.target-selection",
    ]),
    replacementCapabilityPath:
      "Current host config replaces the old dotnet test command fixture: project-load and target-selection accept only entryPoint/rootDir/outDir/targets, while host.config.no-legacy-config and backend.fail-closed-facts reject output.type/nativeAot/tests.entryPoint rather than preserving a legacy test-command path.",
  })],
  [oldFixturePath("implicit-int-to-double"), Object.freeze({
    replacementCapabilityIds: freezeSortedStrings([
      "expression.literal.string-number-boolean",
      "operation.conversion.checked-target-conversion",
      "source.primitive.numeric",
    ]),
    replacementCapabilityPath:
      "Current numeric source semantics replace the old negative fixture: TSTS accepts integer literals flowing to number, source.primitive.numeric records the source numeric fact, and operation.conversion.checked-target-conversion emits the finalized target conversion instead of treating the call as a diagnostic.",
  })],
  [oldFixturePath("default-param-int-to-double"), Object.freeze({
    replacementCapabilityIds: freezeSortedStrings([
      "expression.literal.string-number-boolean",
      "operation.conversion.checked-target-conversion",
      "source.primitive.numeric",
    ]),
    replacementCapabilityPath:
      "Current default-parameter numeric semantics replace the old negative fixture: TSTS accepts the numeric default, source.primitive.numeric and literal facts preserve the value, and operation.conversion.checked-target-conversion supplies the finalized double optional-parameter carrier.",
  })],
]);

const oldSuiteOldEvidenceRole = "regression-evidence-only";

export const oldSuitePortInventory = Object.freeze(
  oldSuitePortInventoryEntries.map(withOldSuiteCapabilityProof),
);

const oldSuiteStatusSet = new Set(oldSuiteStatuses);
const oldSuiteCapabilityMappingStatusSet = new Set(oldSuiteCapabilityMappingStatuses);
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

function createOldSuiteCapabilityMappingCounts() {
  return {
    reviewed: 0,
    "deferred-derived": 0,
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

function withOldSuiteCapabilityProof(entry) {
  const capabilityMappingStatus = entry.status === "deferred" ? "deferred-derived" : "reviewed";
  const capabilityIds = entry.status === "deferred"
    ? defaultOldSuiteCapabilityIds(entry)
    : oldSuiteReviewedCapabilityIdsFor(entry);
  const replacementProof = entry.status === "invalid-stale-architecture"
    ? oldSuiteReplacementProofFor(entry)
    : undefined;

  return Object.freeze({
    ...entry,
    oldEvidenceRole: oldSuiteOldEvidenceRole,
    capabilityMappingStatus,
    capabilityIds: freezeSortedStrings(capabilityIds),
    ...(replacementProof === undefined ? {} : {
      replacementCapabilityIds: replacementProof.replacementCapabilityIds,
      replacementCapabilityPath: replacementProof.replacementCapabilityPath,
    }),
  });
}

function freezeSortedStrings(values) {
  return Object.freeze([...values].sort());
}

function reviewedOldSuiteCapabilityMapping(oldPaths, capabilityIds) {
  const frozenCapabilityIds = freezeSortedStrings(capabilityIds);
  return oldPaths.map((oldPath) => [oldPath, frozenCapabilityIds]);
}

function oldSuiteReviewedCapabilityIdsFor(entry) {
  const capabilityIds = oldSuiteReviewedCapabilityIdsByOldPath.get(entry.oldPath);
  if (capabilityIds === undefined) {
    throw new Error(`missing reviewed old suite capability mapping for ${entry.oldPath}`);
  }

  return capabilityIds;
}

function oldSuiteReplacementProofFor(entry) {
  const replacementProof = oldSuiteReplacementProofByOldPath.get(entry.oldPath);
  if (replacementProof === undefined) {
    throw new Error(`missing replacement capability path for stale old suite entry ${entry.oldPath}`);
  }

  return replacementProof;
}

function defaultOldSuiteCapabilityIds(entry) {
  const ids = new Set(["host.package.composition", "backend.ast.only", "toolchain.csharp.build-run"]);
  const oldPath = entry.oldPath;

  switch (entry.featureArea) {
    case "config":
      ids.add("host.config.project-load");
      ids.add("host.config.no-legacy-config");
      break;
    case "native-provider":
      ids.add("provider.virtual-module.target-identity");
      ids.add("operation.call.provider-selected-method");
      break;
    case "js-surface":
      ids.add("host.project.surface-extension-composition");
      ids.add("surface.js.array-methods");
      ids.add("surface.js.string-methods");
      ids.add("runtime.csharp.js");
      break;
    case "nodejs-surface":
      ids.add("host.project.surface-extension-composition");
      ids.add("surface.node.fs-path-process");
      ids.add("runtime.csharp.nodejs");
      break;
    case "csharp-backend":
      ids.add("backend.project-source-declarations");
      ids.add("backend.csharp.ast-expression");
      ids.add("backend.csharp.ast-statement");
      break;
    case "runtime":
      ids.add("runtime.csharp.js");
      ids.add("runtime.no-reflection-semantics");
      break;
    case "toolchain":
      ids.add("toolchain.csharp.project");
      ids.add("toolchain.csharp.library");
      break;
    case "diagnostic":
      ids.add("diagnostic.missing-target-fact");
      ids.add("diagnostic.ts-invalid-not-rescued");
      break;
    case "downstream":
      ids.add("downstream.smoke.simple-apps");
      break;
    default:
      ids.add("diagnostic.missing-target-fact");
  }

  if (oldPath.includes("nullable") || oldPath.includes("nullish") || oldPath.includes("instanceof") || oldPath.includes("discriminant")) {
    ids.add("tsts.flow-narrowing");
    ids.add("carrier.null-undefined");
  }
  if (oldPath.includes("array") || oldPath.includes("tuple")) {
    ids.add("carrier.array");
    ids.add("operation.array.literal");
  }
  if (oldPath.includes("spread")) {
    ids.add("operation.spread.array");
  }
  if (oldPath.includes("destructuring")) {
    ids.add("operation.destructure.array-object");
  }
  if (oldPath.includes("generic")) {
    ids.add("tsts.generic-inference");
    ids.add("declaration.generic-parameters");
  }
  if (oldPath.includes("attribute")) {
    ids.add("source.marker.attribute");
    ids.add("declaration.attributes");
  }
  if (oldPath.includes("struct") || oldPath.includes("field")) {
    ids.add("source.marker.struct");
    ids.add("source.marker.field");
  }
  if (oldPath.includes("async") || oldPath.includes("promise") || oldPath.includes("task")) {
    ids.add("operation.await.promise-task");
    ids.add("function.async");
  }
  if (oldPath.includes("generator") || oldPath.includes("yield")) {
    ids.add("statement.loop");
    ids.add("carrier.function-delegate");
  }
  if (oldPath.includes("object-literal") || oldPath.includes("anonymous-object") || oldPath.includes("object-prop")) {
    ids.add("carrier.object-shape");
    ids.add("expression.object-literal");
  }
  if (oldPath.includes("dictionary") || oldPath.includes("record")) {
    ids.add("carrier.dictionary-record");
  }
  if (oldPath.includes("method-overload") || oldPath.includes("extension-methods") || oldPath.includes("linq")) {
    ids.add("operation.call.provider-selected-method");
    ids.add("operation.member.no-name-guess");
  }
  if (entry.status === "invalid-stale-architecture") {
    ids.add("host.config.no-legacy-config");
    ids.add("backend.fail-closed-facts");
  }

  return [...ids].sort();
}

function validateOldSuiteStringArrayField(errors, entry, fieldName) {
  const values = entry[fieldName];
  if (!Array.isArray(values) || values.length === 0) {
    errors.push(`${fieldName} must be a non-empty array`);
    return false;
  }

  let valuesAreValid = true;
  let previousValue = undefined;
  const seenValues = new Set();
  let isSorted = true;

  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`${fieldName} must contain non-empty strings`);
      valuesAreValid = false;
      continue;
    }

    if (previousValue !== undefined && previousValue > value) {
      isSorted = false;
    }
    previousValue = value;
    seenValues.add(value);
  }

  if (seenValues.size !== values.length) {
    errors.push(`${fieldName} must not contain duplicate strings`);
    valuesAreValid = false;
  }

  if (!isSorted) {
    errors.push(`${fieldName} must be sorted`);
    valuesAreValid = false;
  }

  return valuesAreValid;
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

  if (
    (entry.status === "ported" || entry.status === "replaced-by-stronger-test" || entry.status === "reused") &&
    (typeof entry.newPath !== "string" || entry.newPath.length === 0)
  ) {
    errors.push("reused, ported, and replaced entries must name a current-architecture newPath");
  }

  if (!oldSuiteStatusSet.has(entry.status)) {
    errors.push(`status must be one of ${oldSuiteStatuses.join(", ")}`);
  }

  if (!oldSuiteFeatureAreaSet.has(entry.featureArea)) {
    errors.push(`featureArea must be one of ${oldSuiteFeatureAreas.join(", ")}`);
  }

  if (entry.oldEvidenceRole !== oldSuiteOldEvidenceRole) {
    errors.push(`oldEvidenceRole must be ${oldSuiteOldEvidenceRole}`);
  }

  if (!oldSuiteCapabilityMappingStatusSet.has(entry.capabilityMappingStatus)) {
    errors.push(`capabilityMappingStatus must be one of ${oldSuiteCapabilityMappingStatuses.join(", ")}`);
  }

  if (entry.status === "deferred" && entry.capabilityMappingStatus !== "deferred-derived") {
    errors.push("deferred entries must use deferred-derived capability mappings");
  }

  if (entry.status !== "deferred" && entry.capabilityMappingStatus !== "reviewed") {
    errors.push("reused, ported, replaced, and stale entries must use reviewed capability mappings");
  }

  const capabilityIdsAreValid = validateOldSuiteStringArrayField(errors, entry, "capabilityIds");

  if (entry.status === "invalid-stale-architecture") {
    const replacementCapabilityIdsAreValid = validateOldSuiteStringArrayField(errors, entry, "replacementCapabilityIds");
    if (typeof entry.replacementCapabilityPath !== "string" || entry.replacementCapabilityPath.length === 0) {
      errors.push("replacementCapabilityPath must be a non-empty string for stale entries");
    }

    if (capabilityIdsAreValid && replacementCapabilityIdsAreValid) {
      for (const capabilityId of entry.replacementCapabilityIds) {
        if (!entry.capabilityIds.includes(capabilityId)) {
          errors.push("replacementCapabilityIds must be included in capabilityIds");
          break;
        }
      }
    }
  } else {
    if (entry.replacementCapabilityIds !== undefined) {
      errors.push("replacementCapabilityIds is only valid for stale entries");
    }
    if (entry.replacementCapabilityPath !== undefined) {
      errors.push("replacementCapabilityPath is only valid for stale entries");
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

export function buildOldSuiteInventoryReport(historicalOldPaths, inventoryEntries = oldSuitePortInventory) {
  const historicalPaths = [...new Set(historicalOldPaths)].sort();
  const historicalPathSet = new Set(historicalPaths);
  const classifiedOldPathSet = new Set();
  const classifiedUnknownOldPathSet = new Set();
  const counts = createOldSuiteCounts(historicalPaths.length);
  const capabilityMappingCounts = createOldSuiteCapabilityMappingCounts();

  for (const entry of inventoryEntries) {
    if (!historicalPathSet.has(entry.oldPath)) {
      classifiedUnknownOldPathSet.add(entry.oldPath);
      continue;
    }

    if (classifiedOldPathSet.has(entry.oldPath)) {
      continue;
    }

    counts[entry.status] += 1;
    if (Object.hasOwn(capabilityMappingCounts, entry.capabilityMappingStatus)) {
      capabilityMappingCounts[entry.capabilityMappingStatus] += 1;
    }
    classifiedOldPathSet.add(entry.oldPath);
  }

  const unclassifiedOldPaths = historicalPaths.filter((oldPath) => !classifiedOldPathSet.has(oldPath));
  counts.unclassified = unclassifiedOldPaths.length;

  return Object.freeze({
    counts: Object.freeze(counts),
    capabilityMappingCounts: Object.freeze(capabilityMappingCounts),
    classifiedOldPaths: Object.freeze([...classifiedOldPathSet].sort()),
    classifiedUnknownOldPaths: Object.freeze([...classifiedUnknownOldPathSet].sort()),
    unclassifiedOldPaths: Object.freeze(unclassifiedOldPaths),
  });
}

export function formatOldSuiteInventoryCounts(counts) {
  return oldSuiteReportCountKeys.map((key) => `${key}: ${counts[key]}`).join("\n");
}
