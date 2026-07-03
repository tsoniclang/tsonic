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
    oldPath: "test/fixtures/async-basic/",
    newPath: "test/async-cli-build.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS Promise carrier facts + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering async Promise<string> return facts, awaited source-owned async calls, Roslyn async method/await AST emission, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/async-higher-order/",
    newPath: "test/async-cli-build.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS Promise/delegate carrier facts + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering async functions returning sync delegates, async functions returning async delegates, async callback parameters, Task result facts, Func/Task C# AST output, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/async-ops-uses-map/",
    newPath: "test/async-cli-build.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS Promise carrier facts + C# JS surface Map carrier facts + C# backend planner",
    reason:
      "Ported as a current-architecture executable E2E covering async Promise<Task> lowering composed with selected JS Map carrier facts, Roslyn async method output, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/promise-chain-reject-stable/",
    newPath: "test/async-cli-build.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS Promise facts + C# backend diagnostics",
    reason:
      "Ported as current-architecture negative proof that Promise.resolve(...).then(...) is rejected before target artifacts unless provider/runtime facts explicitly own the Promise chain.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/promise-constructor-task/",
    newPath: "test/async-cli-build.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS Promise facts + C# backend diagnostics",
    reason:
      "Ported as current-architecture negative proof that Promise construction is rejected before target artifacts without finalized Task carrier facts.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/promise-void-resolve/",
    newPath: "test/async-cli-build.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS Promise facts + C# backend diagnostics",
    reason:
      "Ported as current-architecture negative proof that Promise.resolve() is rejected before target artifacts without provider-owned Promise/Task operation facts.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/task-then-disallowed/",
    newPath: "test/async-cli-build.test.mjs",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS Promise facts + C# backend diagnostics",
    reason:
      "Ported as current-architecture negative proof that .then-style Task/Promise chaining is rejected before target artifacts rather than lowered through source-name fallback.",
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
    oldPath: "test/fixtures/aspnetcore-dotnet/",
    newPath: "test/cli-build/downstream-smoke.test.mjs",
    status: "ported",
    featureArea: "downstream",
    owner: "C# native provider + downstream target package providers",
    reason:
      "Ported as a current-architecture downstream proof: generated library uses real .NET provider facts for attributes, Guid, DateTime, DateTimeOffset, nullable fields, async Task<T>, List<T>, and interface implementation; an external Microsoft.NET.Sdk.Web project consumes it through ProjectReference, builds, runs, and exercises Microsoft.AspNetCore.Http.Results without runtime reflection or dynamic dispatch.",
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
    status: "ported",
    featureArea: "nodejs-surface",
    owner: "C# NodeJS provider package",
    newPath: "test/cli-build/nodejs-surface.test.mjs",
    reason:
      "Ported as current-architecture evidence for selected NodeJS provider-package aliases: supported node:* modules participate through existing provider declarations, while unsupported historical modules child_process, dgram, dns, events, http, net, querystring, readline, stream, timers, tls, zlib, and type-only node:http declarations produce deterministic provider diagnostics with no target artifacts.",
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
  Object.freeze({
    oldPath: "test/fixtures/nested-object-rest-destructuring/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS object-shape facts + C# backend planner",
    newPath: "test/cli-build/object-shapes.test.mjs",
    reason:
      "Ported as a current-architecture executable CLI test covering nested object rest destructuring from finalized TSTS rest-binding and object-shape facts, generated closed rest carriers, dotnet build/run, exact stdout, and no dynamic/reflection fallback.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/object-literal-method-this/",
    status: "replaced-by-stronger-test",
    featureArea: "csharp-backend",
    owner: "TSTS this-binding facts + C# backend planner",
    newPath: "test/cli-build/expressions-control-flow.test.mjs",
    reason:
      "Replaced by current-architecture positive and negative CLI proof for this-binding: instance and lexical class this emit only with finalized receiver facts, while object-literal method this is now a deterministic fail-closed diagnostic before C# artifacts instead of a JavaScript this fallback.",
  }),
  ...deferredFixtures([
    "object-literal-accessors",
    "object-literal-computed-const-keys",
    "object-literal-method-accessor-js",
    "object-literal-method-arguments-destructured-reject",
    "object-literal-method-arguments-index",
    "object-literal-method-arguments-index-reject",
    "object-literal-method-arguments-length",
    "object-literal-method-super-reject",
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
  Object.freeze({
    oldPath: "test/fixtures/property-override-virtual/",
    status: "ported",
    featureArea: "csharp-backend",
    owner: "TSTS declaration dispatch facts + C# declaration planner",
    newPath: "test/cli-build/classes-value-types.test.mjs",
    reason:
      "Ported as a current-architecture executable proof that project-source member dispatch facts make overriding class field declarations emit C# virtual/override properties, preserving JavaScript this.value dispatch through dotnet build/run and exact stdout.",
  }),
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
  ], "csharp-backend", "TSTS declaration AST + C# declaration planner", "Valid behavior covers source declarations, class members, constructors, inheritance, attributes, modifiers, overrides, and virtual/protected shapes; port after declaration planner coverage is fixture-backed with C# AST output only."),
  ...deferredFixtures([
    "async-bidirectional-generator",
    "async-union-object-literal-return",
    "bidirectional-generator",
    "generator-different-treturn",
    "generator-return-value",
    "multi-module-generators",
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
  Object.freeze({
    oldPath: "test/fixtures/defaultof-intrinsic/",
    status: "ported",
    featureArea: "native-provider",
    owner: "source semantics + C# backend planner",
    newPath: "test/cli-build/source-semantics.test.mjs",
    reason:
      "Ported as current-architecture coverage for neutral defaultof<T>() source facts, C# alias defaultof, fail-closed missing-type diagnostics, Roslyn default-expression emission, and dotnet build under the final source-core/provider pipeline.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/pointer-types/",
    status: "ported",
    featureArea: "native-provider",
    owner: "source semantics + C# backend planner",
    newPath: "test/cli-build/source-semantics.test.mjs",
    reason:
      "Ported as current-architecture coverage for neutral ptr<T> and fnptr<[...], R> marker facts, unsafe C# pointer/function-pointer type emission from finalized facts, project unsafe-block wiring, and dotnet build without backend type guessing.",
  }),
  ...deferredFixtures([
    "core-intrinsics-provenance",
    "integer-casting",
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
  Object.freeze({
    oldPath: "test/fixtures/date-not-global/",
    status: "ported",
    featureArea: "js-surface",
    owner: "C# JS surface provider + C# JS runtime",
    newPath: "test/cli-build/js-surface.test.mjs",
    reason:
      "Ported as final surface-selection coverage: Date constructor/calls compile only when the JS surface supplies provider-backed Date facts, while no-surface Date usage fails closed instead of becoming a native/global fallback.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/dotnet-disallowed-js-builtins/",
    status: "ported",
    featureArea: "js-surface",
    owner: "C# JS surface provider + C# backend diagnostics",
    newPath: "test/cli-build/js-surface.test.mjs",
    reason:
      "Ported as final no-surface rejection coverage for standard JS built-ins: array mutators, string methods, and Date constructors require selected JS surface facts and otherwise produce deterministic diagnostics with no output project.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/js-string-array-returns/",
    status: "ported",
    featureArea: "js-surface",
    owner: "C# JS surface provider + C# JS runtime",
    newPath: "test/cli-build/js-surface.test.mjs",
    reason:
      "Ported as current JS-surface C# AST coverage for string and array-returning operations, including array push/at/length, string trim/toUpperCase/slice/split/join, runtime carrier selection, and dotnet build.",
  }),
  ...deferredFixtures([
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
  Object.freeze({
    oldPath: "test/fixtures/nodejs-path-posix-join/",
    status: "ported",
    featureArea: "nodejs-surface",
    owner: "C# NodeJS provider package + C# NodeJS runtime",
    newPath: "test/cli-build/nodejs-surface.test.mjs",
    reason:
      "Ported as current-architecture executable proof for node:path posix joins through selected NodeJS provider-package declarations, generated C# AST, dotnet build/run, and exact stdout.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/nodejs-surface-imports-negative/",
    status: "ported",
    featureArea: "nodejs-surface",
    owner: "C# NodeJS provider package + C# NodeJS runtime",
    newPath: "test/cli-build/nodejs-surface.test.mjs",
    reason:
      "Ported as current-architecture executable proof for provider-backed default node:fs imports when the NodeJS provider package is selected, plus adjacent no-package diagnostics in the same current test file.",
  }),
  Object.freeze({
    oldPath: "test/fixtures/nodejs-surface-module-graph/",
    status: "ported",
    featureArea: "nodejs-surface",
    owner: "C# NodeJS provider package + C# NodeJS runtime",
    newPath: "test/cli-build/nodejs-surface.test.mjs",
    reason:
      "Ported as current-architecture executable proof for a multi-file NodeJS provider-package module graph using node:path, node:fs, node:crypto, node:os, and node:process through selected provider facts, generated C# AST, dotnet build/run, and exact stdout.",
  }),
]);

const oldSuiteReviewedCapabilityIdsByOldPath = new Map([
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("aspnetcore-dotnet"),
  ], [
    "backend.ast.only",
    "downstream.dotnet.aspnet",
    "downstream.no-old-runtime-reflection",
    "native.dotnet.attributes",
    "native.dotnet.member-methods",
    "native.dotnet.member-fields-properties-events",
    "operation.await.promise-task",
    "provider.virtual-module.target-identity",
    "source.marker.attribute",
    "toolchain.csharp.build-run",
    "toolchain.csharp.library",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("file-io"),
    oldFixturePath("hello-world"),
    oldFixturePath("namespace-imports"),
  ], [
    "backend.ast.only",
    "downstream.no-old-runtime-reflection",
    "downstream.smoke.simple-apps",
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
    "tsts.type-query.flow-narrowed-type",
    "type.non-null-assertion",
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
    oldFixturePath("generic-function-value-default-export"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "declaration.generic-parameters",
    "host.package.composition",
    "module.export.default",
    "toolchain.csharp.build-run",
    "tsts.generic-inference",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("async-basic"),
    oldFixturePath("async-higher-order"),
    oldFixturePath("async-ops-uses-map"),
    oldFixturePath("promise-chain-reject-stable"),
    oldFixturePath("promise-constructor-task"),
    oldFixturePath("promise-void-resolve"),
    oldFixturePath("task-then-disallowed"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "carrier.function-delegate",
    "function.async",
    "host.package.composition",
    "operation.await.promise-task",
    "surface.js.map-set",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("import-type-erase"),
  ], [
    "backend.ast.only",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.package.composition",
    "module.import.type-only",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("module-const-array-mutation"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.package.composition",
    "host.project.top-level-initialization-order",
    "operation.array.literal",
    "toolchain.csharp.build-run",
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
    oldFixturePath("nested-object-rest-destructuring"),
    oldFixturePath("object-literal-method-shorthand"),
    oldFixturePath("object-literal-object"),
    oldFixturePath("object-prop-int-to-int"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.generated-declarations",
    "backend.project-source-declarations",
    "binding.object-shape",
    "binding.object.rename-rest-default",
    "carrier.object-shape",
    "expression.object-literal",
    "host.package.composition",
    "operation.destructure.array-object",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("object-literal-method-this"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "diagnostic.unsupported-target-operation",
    "function.this-binding",
    "host.package.composition",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("property-override-virtual"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "declaration.class",
    "declaration.class.fields",
    "declaration.class.inheritance",
    "declaration.class.methods",
    "declaration.class.properties",
    "expression.property-access",
    "host.package.composition",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("extension-methods-system"),
  ], [
    "backend.ast.only",
    "host.package.composition",
    "native.dotnet.member-methods",
    "operation.call.provider-selected-method",
    "operation.member.no-name-guess",
    "provider.virtual-module.target-identity",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("struct-basic"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "host.package.composition",
    "source-core.lang.portable-intrinsics.field",
    "source-core.lang.portable-intrinsics.struct",
    "source-core.struct.field-facts",
    "source.marker.field",
    "source.marker.struct",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("js-surface-runtime-builtins"),
  ], [
    "backend.ast.only",
    "backend.csharp.runtime-artifacts",
    "carrier.array.public-abi-policy",
    "expression.element-access",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "operation.element.provider-indexer",
    "operation.member.provider-indexer",
    "runtime.csharp.js",
    "surface.js.boolean-methods",
    "surface.js.array-methods",
    "surface.js.array.length-index",
    "surface.js.console",
    "surface.js.console-log",
    "surface.js.date",
    "surface.js.map-set",
    "surface.js.math",
    "surface.js.math-json-regexp",
    "surface.js.number-methods",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("nodejs-surface-alias-coverage"),
  ], [
    "backend.ast.only",
    "backend.csharp.runtime-artifacts",
    "downstream.nodejs-source",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.nodejs",
    "surface.node.fs-path-process",
    "surface.node.url",
    "surface.node.util",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("array-constructor"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "diagnostic.ts-invalid-not-rescued",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "operation.array.literal",
    "runtime.csharp.js",
    "surface.js.array-constructor",
    "surface.js.array-methods",
    "surface.js.array.length-index",
    "surface.js.array.sparse-delete-holes",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("char-primitive"),
  ], [
    "backend.ast.only",
    "host.package.composition",
    "operation.call.provider-selected-method",
    "provider.virtual-module.target-identity",
    "source.primitive.char-bool",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("array-index-dotnet"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "carrier.array.public-abi-policy",
    "host.package.composition",
    "native.dotnet.array.explicit",
    "operation.array.literal",
    "operation.call.provider-selected-method",
    "provider.virtual-module.target-identity",
    "surface.js.array.length-index",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("clr-string-indexer-dotnet"),
  ], [
    "backend.ast.only",
    "host.package.composition",
    "operation.call.provider-selected-method",
    "provider.virtual-module.target-identity",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("native-array-push-mutation"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "host.package.composition",
    "native.dotnet.array.explicit",
    "operation.array.literal",
    "operation.call.provider-selected-method",
    "provider.virtual-module.target-identity",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("readonly-array-property-mutation"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "host.package.composition",
    "native.dotnet.array.explicit",
    "operation.array.literal",
    "operation.call.provider-selected-method",
    "provider.virtual-module.target-identity",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("param-modifiers"),
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.project-source-declarations",
    "function.default-rest-optional-params.provider-defaults",
    "function.default-rest-optional-params.provider-params-array",
    "function.default-rest-optional-params.provider-unsupported-defaults",
    "host.package.composition",
    "native.dotnet.parameter-modes",
    "operation.call.provider.parameter-mode.byref-marker-consumption",
    "operation.call.provider.parameter-mode.mutated-fact-rejection",
    "operation.call.provider.parameter-mode.optional-default-arity",
    "operation.call.provider.parameter-mode.params-array-arity",
    "operation.call.provider.parameter-mode.unsupported-default-rejection",
    "operation.call.provider-parameter-mode",
    "source-core.lang.portable-intrinsics.inref",
    "source-core.lang.portable-intrinsics.out",
    "source-core.lang.portable-intrinsics.ref",
    "source-core.out.storage-binding",
    "source-core.ref.parameter-mode",
    "source.marker.out-ref-inref",
    "target.csharp.core-lang-intrinsics",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("barrel-reexports"),
  ], [
    "backend.ast.only",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.package.composition",
    "module.export.reexport",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("multi-file"),
  ], [
    "backend.ast.only",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.graph.source-files",
    "host.package.composition",
    "module.emit.multi-file",
    "module.graph.source-files",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("multi-file-imports"),
  ], [
    "backend.ast.only",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.graph.source-files",
    "host.package.composition",
    "module.emit.multi-file",
    "module.graph.source-files",
    "module.import.named",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("multi-file-types"),
  ], [
    "backend.ast.only",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.graph.source-files",
    "host.package.composition",
    "module.graph.source-files",
    "module.import.type-only",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("source-package-basic"),
  ], [
    "backend.ast.only",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.package.composition",
    "module.package.exports-subpath",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("source-package-subpath"),
  ], [
    "backend.ast.only",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.package.composition",
    "module.package.exports-subpath",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("source-package-surface-mismatch"),
  ], [
    "backend.ast.only",
    "diagnostic.unsupported-surface",
    "host.config.no-legacy-config",
    "host.config.project-load",
    "host.package.composition",
    "module.package.exports-subpath",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("core-intrinsics-provenance"),
  ], [
    "backend.ast.only",
    "host.package.composition",
    "operation.call.provider-selected-method",
    "provider.virtual-module.target-identity",
    "source-core.lang.portable-intrinsics",
    "target.csharp.core-lang-intrinsics",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("defaultof-intrinsic"),
  ], [
    "backend.ast.only",
    "host.package.composition",
    "operation.call.provider-selected-method",
    "provider.virtual-module.target-identity",
    "source-core.lang.portable-intrinsics",
    "source-core.lang.portable-intrinsics.defaultof",
    "source.marker.defaultof",
    "target.csharp.core-lang-intrinsics",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("pointer-types"),
  ], [
    "backend.ast.only",
    "host.package.composition",
    "operation.call.provider-selected-method",
    "provider.virtual-module.target-identity",
    "source-core.lang.portable-intrinsics.fnptr",
    "source-core.lang.portable-intrinsics.ptr",
    "source.marker.ptr-fnptr",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("date-not-global"),
  ], [
    "backend.ast.only",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.date",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("dotnet-disallowed-js-builtins"),
  ], [
    "backend.ast.only",
    "diagnostic.unsupported-selected-surface-operation",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("js-string-array-returns"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "operation.array.literal",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("js-surface-array-from-map-keys"),
  ], [
    "backend.ast.only",
    "carrier.array",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "operation.array.literal",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.map-set",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("js-surface-boolean-tostring"),
  ], [
    "backend.ast.only",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.js",
    "surface.js.boolean-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("js-surface-json-typed-parse"),
  ], [
    "backend.ast.only",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.math-json-regexp",
    "surface.js.object-runtime",
    "surface.js.string-methods",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("map-set-not-in-globals"),
  ], [
    "backend.ast.only",
    "diagnostic.ts-invalid-not-rescued",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.js",
    "surface.js.map-set",
    "tsts.no-target-overrides",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("js-surface-node-boolean-tostring"),
  ], [
    "backend.ast.only",
    "backend.csharp.runtime-artifacts",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.js",
    "runtime.csharp.nodejs",
    "surface.js.boolean-methods",
    "surface.node.fs",
    "surface.node.fs-path-process",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("js-surface-node-date-union"),
  ], [
    "backend.ast.only",
    "backend.csharp.runtime-artifacts",
    "carrier.null-undefined",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.js",
    "runtime.csharp.nodejs",
    "surface.js.date",
    "surface.node.fs",
    "surface.node.fs-stats-date",
    "toolchain.csharp.build-run",
    "tsts.flow-narrowing",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("json-native-inline-stringify"),
  ], [
    "backend.ast.only",
    "downstream.no-old-runtime-reflection",
    "host.package.composition",
    "runtime.csharp.js",
    "runtime.no-reflection-semantics",
    "surface.js.math-json-regexp",
    "surface.js.object-runtime",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("json-native-typed-stringify"),
  ], [
    "backend.ast.only",
    "downstream.no-old-runtime-reflection",
    "host.package.composition",
    "runtime.csharp.js",
    "runtime.no-reflection-semantics",
    "surface.js.math-json-regexp",
    "surface.js.object-runtime",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("nodejs-path-posix-join"),
  ], [
    "backend.ast.only",
    "downstream.nodejs-source",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.nodejs",
    "surface.node.fs-path-process",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("nodejs-surface-imports-negative"),
  ], [
    "backend.ast.only",
    "diagnostic.unsupported-surface",
    "downstream.nodejs-source",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.nodejs",
    "surface.node.fs-path-process",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldSuiteCapabilityMapping([
    oldFixturePath("nodejs-surface-module-graph"),
  ], [
    "backend.ast.only",
    "downstream.nodejs-source",
    "host.package.composition",
    "host.project.surface-extension-composition",
    "runtime.csharp.nodejs",
    "surface.node.buffer-crypto-os",
    "surface.node.fs",
    "surface.node.fs-path-process",
    "surface.node.process",
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

const oldSuiteLedgerEvidenceCapabilityIdsByOldPath = new Map([
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("generic-interface-inheritance"),
  ], [
    "declaration.heritage",
    "declaration.interface",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("interface-with-functions"),
  ], [
    "declaration.interface",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("dotnet-test-command"),
  ], [
    "backend.csharp.project-sdk-emit",
    "toolchain.csharp.library",
    "toolchain.csharp.nativeaot",
    "toolchain.csharp.project",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("nodejs-surface-alias-coverage"),
  ], [
    "backend.csharp.runtime-artifacts",
    "downstream.nodejs-source",
    "surface.node.url",
    "surface.node.util",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("js-surface-runtime-builtins"),
  ], [
    "backend.csharp.runtime-artifacts",
    "carrier.array.public-abi-policy",
    "expression.element-access",
    "surface.js.array.length-index",
    "surface.js.console",
    "surface.js.console-log",
    "surface.js.map-set",
    "surface.js.math",
    "surface.js.math-json-regexp",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("array-destructuring"),
  ], [
    "binding.array.fixed-rest-default",
    "binding.assignment",
    "binding.parameter",
    "expression.assignment",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("array-spread"),
  ], [
    "carrier.array.public-abi-policy",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("array-literal"),
  ], [
    "carrier.array.public-abi-policy",
    "expression.array-literal",
    "surface.js.array.length-index",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("array-index-dotnet"),
  ], [
    "carrier.array.public-abi-policy",
    "native.dotnet.array.explicit",
    "surface.js.array.length-index",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("dotnet-disallowed-js-builtins"),
  ], [
    "diagnostic.unsupported-selected-surface-operation",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("nodejs-surface-imports-negative"),
  ], [
    "diagnostic.unsupported-surface",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("source-package-surface-mismatch"),
  ], [
    "diagnostic.unsupported-surface",
    "module.package.exports-subpath",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("array-double"),
    oldFixturePath("array-multidimensional"),
    oldFixturePath("array-type-emission"),
  ], [
    "expression.array-literal",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("nullish-coalescing"),
    oldFixturePath("nullish-coalescing-threading"),
  ], [
    "expression.conditional",
    "expression.literal.null-undefined",
    "expression.nullish-optional",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("optional-function-params"),
  ], [
    "function.default-rest-optional-params",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("multi-file"),
  ], [
    "host.project.module-graph",
    "host.graph.source-files",
    "module.emit.multi-file",
    "module.graph.source-files",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("multi-file-imports"),
  ], [
    "host.project.module-graph",
    "host.graph.source-files",
    "module.emit.multi-file",
    "module.graph.source-files",
    "module.import.named",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("multi-file-types"),
  ], [
    "host.project.module-graph",
    "host.graph.source-files",
    "module.graph.source-files",
    "module.import.type-only",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("namespace-imports"),
  ], [
    "host.project.module-graph",
    "module.emit.multi-file",
    "module.import.namespace",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("top-level-code"),
  ], [
    "host.project.module-graph",
    "host.project.top-level-initialization-order",
    "module.emit.top-level-order",
    "module.import.side-effect",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("module-const-array-mutation"),
  ], [
    "host.project.top-level-initialization-order",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("module-constants"),
  ], [
    "module.export.named",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("barrel-reexports"),
  ], [
    "host.project.module-graph",
    "host.project.top-level-initialization-order",
    "module.export.reexport",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("generic-function-value-default-export"),
  ], [
    "module.export.default",
    "type.generic.provider-target-arguments",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("import-type-erase"),
  ], [
    "module.import.type-only",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("source-package-basic"),
    oldFixturePath("source-package-subpath"),
  ], [
    "host.project.module-graph",
    "host.project.package-path-resolution",
    "module.package.exports-subpath",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("source-package-surface-mismatch"),
  ], [
    "host.project.module-graph",
    "host.project.package-path-resolution",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("native-array-push-mutation"),
    oldFixturePath("readonly-array-property-mutation"),
  ], [
    "native.dotnet.array.explicit",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("generic-nested-substitution"),
  ], [
    "expression.new",
    "native.dotnet.constructors",
    "native.dotnet.type-model",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("default-param-int-to-double"),
    oldFixturePath("implicit-int-to-double"),
  ], [
    "native.dotnet.conversions",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("extension-methods-system"),
    oldFixturePath("generic-method-standalone"),
    oldFixturePath("generic-nested-substitution"),
  ], [
    "expression.new",
    "native.dotnet.constructors",
    "native.dotnet.member-methods",
    "native.dotnet.type-model",
    "type.generic.provider-target-arguments",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("param-modifiers"),
  ], [
    "function.default-rest-optional-params.provider-defaults",
    "function.default-rest-optional-params.provider-params-array",
    "function.default-rest-optional-params.provider-unsupported-defaults",
    "native.dotnet.parameter-modes",
    "operation.call.provider.parameter-mode.byref-marker-consumption",
    "operation.call.provider.parameter-mode.mutated-fact-rejection",
    "operation.call.provider.parameter-mode.optional-default-arity",
    "operation.call.provider.parameter-mode.params-array-arity",
    "operation.call.provider.parameter-mode.unsupported-default-rejection",
    "operation.call.provider-parameter-mode",
    "source-core.lang.portable-intrinsics.inref",
    "source-core.lang.portable-intrinsics.out",
    "source-core.lang.portable-intrinsics.ref",
    "source-core.out.storage-binding",
    "source-core.ref.parameter-mode",
    "source.marker.out-ref-inref",
    "target.csharp.core-lang-intrinsics",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("defaultof-intrinsic"),
  ], [
    "source-core.lang.portable-intrinsics",
    "source-core.lang.portable-intrinsics.defaultof",
    "source.marker.defaultof",
    "target.csharp.core-lang-intrinsics",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("core-intrinsics-provenance"),
  ], [
    "source-core.flow.borrow-move-facts",
    "source-core.lang.portable-intrinsics",
    "source-core.lang.portable-intrinsics.borrow",
    "source-core.lang.portable-intrinsics.borrow-mut",
    "source-core.lang.portable-intrinsics.move",
    "source.marker.borrow-move",
    "target.csharp.core-lang-intrinsics",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("struct-basic"),
  ], [
    "source-core.lang.portable-intrinsics.field",
    "source-core.lang.portable-intrinsics.struct",
    "source-core.struct.field-facts",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("pointer-types"),
  ], [
    "source-core.lang.portable-intrinsics.fnptr",
    "source-core.lang.portable-intrinsics.ptr",
    "source.marker.ptr-fnptr",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("char-primitive"),
  ], [
    "source.primitive.char-bool",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("array-constructor"),
  ], [
    "surface.js.array-constructor",
    "surface.js.array.sparse-delete-holes",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("js-surface-array-from-map-keys"),
    oldFixturePath("map-set-not-in-globals"),
  ], [
    "surface.js.map-set",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("js-surface-boolean-tostring"),
    oldFixturePath("js-surface-node-boolean-tostring"),
  ], [
    "surface.js.boolean-methods",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("js-surface-json-typed-parse"),
    oldFixturePath("json-native-inline-stringify"),
    oldFixturePath("json-native-typed-stringify"),
  ], [
    "surface.js.math-json-regexp",
    "surface.js.object-runtime",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("js-surface-node-date-union"),
  ], [
    "surface.node.fs-stats-date",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("clr-string-indexer-dotnet"),
  ], [
    "surface.js.string-methods",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("nodejs-surface-module-graph"),
  ], [
    "surface.node.buffer-crypto-os",
    "surface.node.fs",
    "surface.node.process",
  ]),
  ...oldSuiteLedgerEvidenceCapabilityMapping([
    oldFixturePath("generic-constraints-object-struct"),
    oldFixturePath("generic-constraints-single"),
    oldFixturePath("generic-multiple-constraints"),
  ], [
    "diagnostic.target-constraint",
    "native.dotnet.constraints",
    "provider.virtual-module.constraints",
    "type.generic.provider-target-constraints",
  ]),
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
  const reviewedCapabilityIds = oldSuiteReviewedCapabilityIdsByOldPath.get(entry.oldPath);
  const capabilityMappingStatus = reviewedCapabilityIds === undefined ? "deferred-derived" : "reviewed";
  const baseCapabilityIds = reviewedCapabilityIds ?? oldSuiteDerivedCapabilityIdsFor(entry);
  const capabilityIds = oldSuiteCapabilityIdsWithLedgerEvidence(entry, baseCapabilityIds);
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
  return Object.freeze([...new Set(values)].sort());
}

function reviewedOldSuiteCapabilityMapping(oldPaths, capabilityIds) {
  const frozenCapabilityIds = freezeSortedStrings(capabilityIds);
  return oldPaths.map((oldPath) => [oldPath, frozenCapabilityIds]);
}

function oldSuiteLedgerEvidenceCapabilityMapping(oldPaths, capabilityIds) {
  const frozenCapabilityIds = freezeSortedStrings(capabilityIds);
  return oldPaths.map((oldPath) => [oldPath, frozenCapabilityIds]);
}

function oldSuiteCapabilityIdsWithLedgerEvidence(entry, capabilityIds) {
  const ledgerEvidenceCapabilityIds = oldSuiteLedgerEvidenceCapabilityIdsByOldPath.get(entry.oldPath);
  if (ledgerEvidenceCapabilityIds === undefined) {
    return capabilityIds;
  }

  return freezeSortedStrings([...capabilityIds, ...ledgerEvidenceCapabilityIds]);
}

function oldSuiteReviewedCapabilityIdsFor(entry) {
  const capabilityIds = oldSuiteReviewedCapabilityIdsByOldPath.get(entry.oldPath);
  if (capabilityIds === undefined) {
    throw new Error(`missing reviewed old suite capability mapping for ${entry.oldPath}`);
  }

  return capabilityIds;
}

function oldSuiteDerivedCapabilityIdsFor(entry) {
  if (entry.status !== "deferred") {
    return oldSuiteReviewedCapabilityIdsFor(entry);
  }

  return defaultOldSuiteCapabilityIds(entry);
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
  if (oldPath.includes("date") || oldPath.includes("js-surface-runtime-builtins")) {
    ids.add("surface.js.date");
  }
  if (oldPath.includes("js-surface-runtime-builtins")) {
    ids.add("operation.element.provider-indexer");
    ids.add("operation.member.provider-indexer");
    ids.add("surface.js.number-methods");
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
  const validationProofHoles = [];

  for (const entry of inventoryEntries) {
    validationProofHoles.push(...oldSuiteInventoryValidationProofHoles(entry));

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
  const proofHoles = oldSuiteInventoryProofHoles(
    unclassifiedOldPaths,
    classifiedUnknownOldPathSet,
    validationProofHoles,
  );

  return Object.freeze({
    rules: Object.freeze({
      unclassifiedOldInventoryIsImpossible: true,
      classifiedInventoryPathsMustBeHistorical: true,
      entriesMustPassValidation: true,
      entriesRequireExplicitCapabilityIds: true,
      staleEntriesRequireReplacementCapabilities: true,
    }),
    classificationStatus: proofHoles.length === 0 ? "complete" : "hole",
    counts: Object.freeze(counts),
    capabilityMappingCounts: Object.freeze(capabilityMappingCounts),
    validationErrorCount: validationProofHoles.length,
    classifiedOldPaths: Object.freeze([...classifiedOldPathSet].sort()),
    classifiedUnknownOldPaths: Object.freeze([...classifiedUnknownOldPathSet].sort()),
    unclassifiedOldPaths: Object.freeze(unclassifiedOldPaths),
    proofHoles: Object.freeze(proofHoles),
  });
}

function oldSuiteInventoryValidationProofHoles(entry) {
  const oldPath = typeof entry?.oldPath === "string" && entry.oldPath.length > 0
    ? entry.oldPath
    : "<unknown>";
  return validateOldSuitePortEntry(entry).map((error) => Object.freeze({
    oldPath,
    proofHole: "old-inventory-validation",
    error,
  }));
}

function oldSuiteInventoryProofHoles(unclassifiedOldPaths, classifiedUnknownOldPathSet, validationProofHoles) {
  return [
    ...validationProofHoles,
    ...unclassifiedOldPaths.map((oldPath) => Object.freeze({
      oldPath,
      proofHole: "unclassified-old-inventory",
    })),
    ...[...classifiedUnknownOldPathSet].sort().map((oldPath) => Object.freeze({
      oldPath,
      proofHole: "classified-unknown-old-inventory",
    })),
  ];
}

export function formatOldSuiteInventoryCounts(counts) {
  return oldSuiteReportCountKeys.map((key) => `${key}: ${counts[key]}`).join("\n");
}
