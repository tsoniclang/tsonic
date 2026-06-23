export const oldEmitterInventoryStatuses = Object.freeze([
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
]);

export const oldEmitterCapabilityMappingStatuses = Object.freeze([
  "reviewed",
  "deferred-derived",
]);

export const oldEmitterFeatureAreas = Object.freeze([
  "arrays",
  "async",
  "attributes",
  "classes",
  "collections",
  "control-flow",
  "functions",
  "generics",
  "object-shapes",
  "operators",
  "source-semantics",
  "target-interop",
  "types",
]);

export const oldEmitterReportCountKeys = Object.freeze([
  "total",
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
  "unclassified",
]);

const oldEmitterCaseRoot = "packages/targets/csharp/emitter/testcases/common";

export const oldEmitterHistoricalCasePaths = Object.freeze([
  ...sourceCases([
    "arrays/basic/ArrayLiteral",
    "arrays/destructuring/ArrayDestructure",
    "arrays/double-array/DoubleArray",
    "arrays/multidimensional/MultiDimensional",
    "arrays/spread/ArraySpread",
    "async/basic/AsyncFunction",
    "attributes/basic/Attributes",
    "attributes/comprehensive/Attributes",
    "attributes/targets/Attributes",
    "classes/basic/Person",
    "classes/constructor/User",
    "classes/field-inference/Counter",
    "classes/field-marker/FieldMarker",
    "classes/generic-inheritance/ConcreteExtends",
    "classes/generic-inheritance/GenericExtends",
    "classes/generic-inheritance/InheritanceChain",
    "classes/generic-methods/MethodInGenericClass",
    "classes/generic-methods/MethodInNonGenericClass",
    "classes/inheritance/Inheritance",
    "classes/static-members/MathHelper",
    "collections/list-initializer/ListInitializer",
    "control-flow/switch/SwitchStatement",
    "edge-cases/clickmeter-nullability-regressions/ClickmeterNullabilityRegressions",
    "edge-cases/generic-null-default/GenericNullDefault",
    "edge-cases/inline-object-param/InlineObjectParam",
    "edge-cases/nested-scopes/NestedScopes",
    "edge-cases/object-literal-type-parameter/ObjectLiteralTypeParameter",
    "edge-cases/shadowing/Shadowing",
    "edge-cases/void-expression/VoidExpression",
    "extensions/linq/ExtensionMethods",
    "extensions/system/Overlaps",
    "functions/arrow-inference/ArrowInference",
    "functions/arrow/ArrowFunction",
    "functions/async-hof/AsyncReturningFunctions",
    "functions/basic/Greet",
    "functions/closures/Closures",
    "functions/default-params/DefaultParams",
    "functions/delegates/ActionFunc",
    "functions/higher-order/ReturningFunctions",
    "functions/optional-callbacks/OptionalParams",
    "lang/stackalloc/StackAlloc",
    "operators/nullish-coalescing/NullishCoalescing",
    "operators/optional-chaining/OptionalChaining",
    "structs/basic/Point",
    "types/anonymous-objects/AnonymousObjects",
    "types/conditional/ConditionalTypes",
    "types/constants/ModuleConstants",
    "types/dictionaries/Dictionaries",
    "types/expected-type-threading/ArraySpread",
    "types/expected-type-threading/NullishCoalescing",
    "types/expected-type-threading/NullishFull",
    "types/expected-type-threading/ReturnInControlFlow",
    "types/expected-type-threading/TernaryTyping",
    "types/expected-type-threading/VariableInit",
    "types/function-collections/FunctionArrays",
    "types/function-type-aliases/GenericAliases",
    "types/functor-patterns/MaybeMonad",
    "types/generic-constraints/MultipleConstraints",
    "types/generic-constraints/ObjectConstraint",
    "types/generic-constraints/SingleConstraint",
    "types/generic-interface-inheritance/InterfaceInheritance",
    "types/generic-substitution/NestedSubstitution",
    "types/generics/Generics",
    "types/interfaces/Interfaces",
    "types/mapped/MappedTypes",
    "types/pointers/PointerTypes",
    "types/tuples-arity/TuplesArity",
    "types/type-assertions/TypeAssertions",
    "types/utility-types/UtilityTypes",
    "types/variable-decls/VariableDecls",
  ]),
  ...expectedOnlyCases([
    "edge-cases/object-literal-unknown/ObjectLiteralUnknown",
    "edge-cases/record-nested-object/RecordNestedObject",
    "operators/in-operator/InOperator",
  ]),
].sort());

export const oldEmitterSeedCapabilities = Object.freeze([
  "arrays/basic/ArrayLiteral",
  "attributes/comprehensive/Attributes",
  "classes/generic-inheritance/InheritanceChain",
  "extensions/system/Overlaps",
  "functions/delegates/ActionFunc",
  "types/expected-type-threading/ReturnInControlFlow",
  "types/generic-substitution/NestedSubstitution",
  "types/utility-types/UtilityTypes",
]);

const oldEmitterPortInventoryEntries = Object.freeze([
  portedEmitterCase(
    "control-flow/switch/SwitchStatement",
    "control-flow",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering switch cases, grouped cases, default branches, provider-owned Console output, generated C# AST, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "edge-cases/nested-scopes/NestedScopes",
    "control-flow",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering nested lexical blocks, local storage, generated C# block AST, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "edge-cases/shadowing/Shadowing",
    "control-flow",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering TSTS binding identity for shadowed block locals and function locals, generated C# local names, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "functions/basic/Greet",
    "functions",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering function declarations, string parameters, template output, generated C# AST, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "functions/default-params/DefaultParams",
    "functions",
    "test/cli-build/expressions-control-flow.test.mjs",
    "Ported as current-architecture C# AST coverage for literal default parameters rendered as C# optional parameters and validated by dotnet build.",
  ),
  portedEmitterCase(
    "functions/arrow/ArrowFunction",
    "functions",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for module-scope arrow function values rendered as static Func fields and validated by dotnet build.",
  ),
  portedEmitterCase(
    "functions/arrow-inference/ArrowInference",
    "functions",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for contextual arrow parameter inference through TSTS callable aliases and generated Func field rendering, validated by dotnet build.",
  ),
  portedEmitterCase(
    "functions/delegates/ActionFunc",
    "functions",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for Action, Action<T>, Func<T,R>, multi-argument Func<T1,T2,R>, generic callable parameters, and function-returning-function delegate signatures, validated by dotnet build.",
  ),
  portedEmitterCase(
    "functions/closures/Closures",
    "functions",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for closure-capturing returned lambdas, mutable captured locals, block-bodied lambdas, and captured-parameter lambdas, validated by dotnet build.",
  ),
  portedEmitterCase(
    "functions/higher-order/ReturningFunctions",
    "functions",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for functions returning delegates, nested delegates, explicit lambda parameter target types, and higher-order C# Func return carriers, validated by dotnet build.",
  ),
  portedEmitterCase(
    "types/constants/ModuleConstants",
    "types",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering module constants, primitive type facts, provider-owned Console output, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "types/variable-decls/VariableDecls",
    "types",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering inferred and explicit primitive local declarations, numeric literal rendering, mutable locals, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "types/function-type-aliases/GenericAliases",
    "functions",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for generic callable aliases resolved through TSTS callable signatures before target carrier rendering, validated by dotnet build.",
  ),
  portedEmitterCase(
    "types/function-collections/FunctionArrays",
    "functions",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for arrays of callable aliases and interface members with callable target types, validated by dotnet build.",
  ),
  portedEmitterCase(
    "functions/optional-callbacks/OptionalParams",
    "functions",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for optional callback parameters, nullish callback guards, nullable callable unions, source-primitive delegate signatures, and generated nullable Action/Func carriers, validated by dotnet build.",
  ),
  portedEmitterCase(
    "types/generic-constraints/SingleConstraint",
    "generics",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for named generic constraints rendered only from finalized C# target constraint facts and validated by dotnet build.",
  ),
  portedEmitterCase(
    "types/generic-constraints/MultipleConstraints",
    "generics",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for intersection generic constraints rendered only from finalized C# target constraint facts and validated by dotnet build.",
  ),
  portedEmitterCase(
    "types/generic-constraints/ObjectConstraint",
    "generics",
    "test/cli-build/modules-declarations.test.mjs",
    "Ported as current-architecture C# AST coverage for TypeScript object constraints mapped by C# source semantics to a Roslyn keyword constraint and validated by dotnet build.",
  ),
  portedEmitterCase(
    "arrays/basic/ArrayLiteral",
    "arrays",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering typed array literals, index reads, JS .length access, provider-owned Console output, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "arrays/destructuring/ArrayDestructure",
    "arrays",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering array binding destructuring in function and top-level module scopes using finalized array carrier facts, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "arrays/double-array/DoubleArray",
    "arrays",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering number[] literal and return carriers as C# double arrays, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "arrays/multidimensional/MultiDimensional",
    "arrays",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering nested array carriers, nested indexing, primitive nested arrays, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "arrays/spread/ArraySpread",
    "arrays",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering array spread composition from finalized source carrier facts, JS .length access, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "types/expected-type-threading/ArraySpread",
    "operators",
    "test/cli-build/arrays.test.mjs",
    "Ported through current-architecture CLI coverage for module-scope int32 array spread constants, with every spread element rendered from finalized expected array facts and emitted as Roslyn array-helper call AST against explicit runtime references.",
  ),
  portedEmitterCase(
    "edge-cases/void-expression/VoidExpression",
    "operators",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering void expression evaluation, discarded result emission as C# expression statement AST, preserved side effects, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "operators/nullish-coalescing/NullishCoalescing",
    "operators",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering ?? over nullable string, int32, number, optional property, optional call, and optional element results using finalized TSTS/provider carrier facts.",
  ),
  portedEmitterCase(
    "operators/optional-chaining/OptionalChaining",
    "operators",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering optional property access, nested optional property access, optional method calls, optional element access, JS String.length provider facts on optional receivers, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "types/expected-type-threading/NullishCoalescing",
    "operators",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering expected target carrier propagation through nullish coalescing for int32, number, and string results without backend type guessing.",
  ),
  portedEmitterCase(
    "types/expected-type-threading/TernaryTyping",
    "operators",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering ternary result typing for int32 and number returns using TSTS accepted source expressions plus provider target carrier facts.",
  ),
  portedEmitterCase(
    "types/expected-type-threading/NullishFull",
    "operators",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering int32 nullish expected-carrier threading through basic fallback, nested chains, fallback parameters, typed variable initializers, and if-branch returns.",
  ),
  portedEmitterCase(
    "types/expected-type-threading/ReturnInControlFlow",
    "operators",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering expected int32 carriers through returns in if/else, while, for, switch, nested if, and nullish return expressions.",
  ),
  portedEmitterCase(
    "types/expected-type-threading/VariableInit",
    "operators",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering declared int32 variable initializers, ternary initializers, arithmetic branch initializers, and assignment RHS expected-carrier propagation.",
  ),
  portedEmitterCase(
    "async/basic/AsyncFunction",
    "async",
    "test/async-cli-build.test.mjs",
    "Ported through a current-architecture executable E2E covering TSTS Promise<string> to Task<string> facts, awaited source-owned async calls, Roslyn async method/await AST emission, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "functions/async-hof/AsyncReturningFunctions",
    "async",
    "test/async-cli-build.test.mjs",
    "Ported through a current-architecture executable E2E covering async functions returning sync delegates, async functions returning async delegates, async callback parameters, explicit Task result metadata, Func/Task C# AST output, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "attributes/basic/Attributes",
    "attributes",
    "../tsonic-csharp/test/attributes.test.mjs",
    "Ported as current-architecture attribute coverage for provider-backed attribute declarations, finalized TSTS attribute facts, multiple class attributes, positional constructor arguments, Roslyn attribute-list AST emission, and C# printer output with no raw-string emitter path.",
  ),
  portedEmitterCase(
    "attributes/targets/Attributes",
    "attributes",
    "test/cli-build/provider-dotnet.test.mjs",
    "Ported through finalized AttributeFact applicationTargetSpecifier coverage for field/property/param/return target specifiers, C# target validation, Roslyn attribute AST target specifiers, generated C# assertions, and dotnet build.",
  ),
  ...deferredEmitterCases([
    "attributes/comprehensive/Attributes",
  ], "attributes", "C# source semantics + C# native provider + C# backend planner", "Class/method/property/field/parameter/constructor attribute facts are covered by current C# target tests; this old fixture remains deferred for broader legacy fixture breadth that still requires finalized current source-surface facts instead of old emitter assumptions."),
  portedEmitterCase(
    "classes/field-marker/FieldMarker",
    "classes",
    "test/cli-build/classes-value-types.test.mjs",
    "Ported through finalized neutral FieldFact coverage for class field markers, source primitive field type evidence, C# field declaration AST emission, fail-closed marker diagnostics, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "classes/basic/Person",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering class fields, instance methods, field mutation, generated C# class/member AST, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "classes/constructor/User",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering constructor parameters, instance field assignment, private identifier storage, instance method calls, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "classes/field-inference/Counter",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering initializer-based field carrier inference for number, string, and boolean fields plus method mutation.",
  ),
  portedEmitterCase(
    "classes/generic-inheritance/ConcreteExtends",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering a concrete class extending a generic base with int32 substitution and inherited field access.",
  ),
  portedEmitterCase(
    "classes/generic-inheritance/GenericExtends",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering a generic class extending a generic base while preserving type parameters through source declarations and generated C# type arguments.",
  ),
  portedEmitterCase(
    "classes/generic-inheritance/InheritanceChain",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering a multi-level generic inheritance chain with source class type-argument substitution.",
  ),
  portedEmitterCase(
    "classes/generic-methods/MethodInGenericClass",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering a generic method inside a generic class, source-call return substitution, nested construction, and exact runtime output.",
  ),
  portedEmitterCase(
    "classes/generic-methods/MethodInNonGenericClass",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering generic methods on a non-generic class with delegate parameters, explicit type arguments, and generic return construction.",
  ),
  portedEmitterCase(
    "classes/inheritance/Inheritance",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering class extends, super constructor calls, source-method virtual dispatch facts, generated C# virtual/override modifiers, base-typed calls, and exact stdout.",
  ),
  portedEmitterCase(
    "classes/static-members/MathHelper",
    "classes",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering static class fields, static methods, numeric operation facts, generated C# static members, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "types/generic-interface-inheritance/InterfaceInheritance",
    "generics",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering generic interface inheritance, concrete and generic class implementations, generated C# auto-properties satisfying interface property contracts, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "types/generic-substitution/NestedSubstitution",
    "generics",
    "test/cli-build/e2e-runtime-language.test.mjs",
    "Ported through a current-architecture executable E2E covering nested generic class substitution through Wrapper<T> inside a generic base, concrete int32 specialization, generated C# type arguments, dotnet build/run, and exact stdout.",
  ),
  portedEmitterCase(
    "collections/list-initializer/ListInitializer",
    "collections",
    "test/cli-build/provider-dotnet.test.mjs",
    "Ported through a current-architecture CLI build test covering provider-owned List<T> constructors from array literals for int32, string, and source class elements, generated Roslyn collection-constructor AST, and exact dotnet build.",
  ),
  portedEmitterCase(
    "types/dictionaries/Dictionaries",
    "collections",
    "test/cli-build/provider-dotnet.test.mjs",
    "Ported through a current-architecture executable CLI test covering TSTS Record<K,V> declarations mapped by the selected JS surface to provider-owned Dictionary<K,V>, empty object literals emitted as Dictionary construction, provider indexer reads/writes, generated C# build, run, and exact stdout.",
  ),
  portedEmitterCase(
    "extensions/linq/ExtensionMethods",
    "target-interop",
    "../tsonic-csharp/test/provider-selection.test.mjs",
    "Ported as current-architecture provider/planner coverage for LINQ ExtensionMethods receiver calls: the selected TSTS provider signature identity maps to System.Linq.Enumerable.Average, the target binding proves first-argument receiver passing, the selected overload is refined from finalized receiver facts, and C# operation facts carry the closed Roslyn-call member.",
  ),
  portedEmitterCase(
    "extensions/system/Overlaps",
    "target-interop",
    "../tsonic-csharp/test/call-operation-facts.test.mjs",
    "Ported as current-architecture provider/planner coverage for overlap-style extension overloads with byref out parameters: provider target facts prove receiver passing and parameter passing, selected-signature mapping records the closed target member, and backend call emission now fails closed if finalized C# operation facts drop receiver or parameter-passing metadata.",
  ),
  portedEmitterCase(
    "types/pointers/PointerTypes",
    "source-semantics",
    "test/cli-build/source-semantics.test.mjs",
    "Ported through current-architecture CLI coverage for source `ptr<int32>` and `ptr<ptr<int32>>` signatures: neutral pointer marker facts are finalized before backend planning, the C# planner emits Roslyn pointer type nodes as `int*` and `int**`, the project enables unsafe blocks, and dotnet build validates the generated source.",
  ),
  Object.freeze({
    oldPath: sourceCase("structs/basic/Point"),
    oldExpectedPath: expectedCase("structs/basic/Point"),
    newPath: "test/cli-build/source-semantics.test.mjs",
    status: "replaced-by-stronger-test",
    featureArea: "source-semantics",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Closed by replacing the stale old `interface Point extends struct { x: number; y: number }` marker with final source `export const Point = struct({ x: field<int32>(), y: field<int32>() })`; current CLI coverage proves neutral struct/field facts and Roslyn struct output without using TypeScript-only inheritance as a compiler signal.",
  }),
  Object.freeze({
    oldPath: sourceCase("types/type-assertions/TypeAssertions"),
    oldExpectedPath: expectedCase("types/type-assertions/TypeAssertions"),
    newPath: "test/cli-build/source-semantics.test.mjs",
    status: "replaced-by-stronger-test",
    featureArea: "source-semantics",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Closed by stronger current-semantics coverage that separates accepted and rejected assertion flows: source primitives such as `255 as uint8`, `1000000 as int64`, and `value as decimal` emit finalized target-conversion facts and Roslyn/System.Convert output; source-owned `animal as Dog` emits a C# cast AST; stale broad `object` assertions such as `value: object; value as Animal` fail closed because TypeScript `object` has no finalized carrier.",
  }),
  Object.freeze({
    oldPath: `${oldEmitterCaseRoot}/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs`,
    oldExpectedPath: `${oldEmitterCaseRoot}/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs`,
    newPath: "test/cli-build/object-shapes.test.mjs",
    status: "invalid-stale-architecture",
    featureArea: "object-shapes",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Closed by current-architecture fail-closed coverage: an object literal contextualized as unknown now reports a deterministic diagnostic before C# carrier emission, because unknown/any object shapes must not lower to object, dynamic, dictionary, or anonymous fallback carriers.",
  }),
  Object.freeze({
    oldPath: `${oldEmitterCaseRoot}/expected/edge-cases/record-nested-object/RecordNestedObject.cs`,
    oldExpectedPath: `${oldEmitterCaseRoot}/expected/edge-cases/record-nested-object/RecordNestedObject.cs`,
    newPath: "test/cli-build/object-shapes.test.mjs",
    status: "ported",
    featureArea: "object-shapes",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Ported through current-architecture CLI coverage for Record<string, Record<string, boolean>> returning { authentication_methods: { password, dev, \"openid connect\" } }, where the backend consumes finalized nested Record carrier facts and emits Dictionary<string, Dictionary<string, bool>> indexer initializers without object/dynamic fallback.",
  }),
  Object.freeze({
    oldPath: `${oldEmitterCaseRoot}/expected/operators/in-operator/InOperator.cs`,
    oldExpectedPath: `${oldEmitterCaseRoot}/expected/operators/in-operator/InOperator.cs`,
    newPath: "test/cli-build/object-shapes.test.mjs",
    status: "invalid-stale-architecture",
    featureArea: "operators",
    owner: "current TSTS/provider/C# AST pipeline",
    reason:
      "Closed as stale architecture instead of ported: the old orphan golden has no source fixture and emits legacy runtime-union carrier calls such as Is1()/As1(), which are explicitly banned by the current architecture. Current non-nullish union emission fails closed unless finalized runtime-carrier facts exist.",
  }),
  ...deferredEmitterCases([
    "edge-cases/clickmeter-nullability-regressions/ClickmeterNullabilityRegressions",
    "edge-cases/generic-null-default/GenericNullDefault",
    "edge-cases/inline-object-param/InlineObjectParam",
  ], "operators", "TSTS flow/contextual facts + C# expression planner", "Operator and expected-type fixtures require TSTS flow/contextual types plus finalized nullable/nullish/optional-chain/ternary facts. They must not be implemented by old expected-type threading inside the backend."),
  ...deferredEmitterCases([
    "types/anonymous-objects/AnonymousObjects",
    "types/conditional/ConditionalTypes",
    "types/functor-patterns/MaybeMonad",
    "types/generics/Generics",
    "types/interfaces/Interfaces",
    "types/mapped/MappedTypes",
    "types/tuples-arity/TuplesArity",
    "types/utility-types/UtilityTypes",
  ], "generics", "TSTS structural/generic facts + C# declaration planner", "Generic and type-system fixtures require complete generic declarations, constraints, inheritance substitution, structural object shapes, mapped/utility type projection facts, tuple arity rendering, and generic class/interface emission."),
  ...deferredEmitterCases([
    "edge-cases/object-literal-type-parameter/ObjectLiteralTypeParameter",
  ], "object-shapes", "TSTS generic inference facts + C# object-shape planner", "Deferred because id<T>({ ok: true, nested: { x: 1 } }) currently reaches the backend without a finalized concrete object-shape carrier for inferred T; the backend must continue to diagnose instead of inferring a carrier from source spelling."),
  ...deferredEmitterCases([
    "lang/stackalloc/StackAlloc",
  ], "source-semantics", "source semantics + C# backend planner", "Stackalloc still requires a source-visible C# provider declaration, Span<T> target/source facts, stackalloc Roslyn AST support, and closed element/member facts before it can be emitted without a backend raw-code or heuristic path."),
]);

const oldEmitterReviewedCapabilityIdsByOldPath = new Map([
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("control-flow/switch/SwitchStatement"),
    sourceCase("edge-cases/nested-scopes/NestedScopes"),
    sourceCase("edge-cases/shadowing/Shadowing"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "statement.block-scope",
    "statement.control-transfer",
    "statement.if-else",
    "statement.switch",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("functions/arrow-inference/ArrowInference"),
    sourceCase("functions/arrow/ArrowFunction"),
    sourceCase("functions/basic/Greet"),
    sourceCase("functions/closures/Closures"),
    sourceCase("functions/default-params/DefaultParams"),
    sourceCase("functions/delegates/ActionFunc"),
    sourceCase("functions/higher-order/ReturningFunctions"),
    sourceCase("types/function-collections/FunctionArrays"),
    sourceCase("types/function-type-aliases/GenericAliases"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "carrier.function-delegate",
    "function.arrow",
    "function.closure",
    "function.declaration",
    "function.higher-order",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("types/constants/ModuleConstants"),
    sourceCase("types/variable-decls/VariableDecls"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "carrier.primitive",
    "type.assertion",
    "type.utility",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("functions/optional-callbacks/OptionalParams"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "carrier.function-delegate",
    "carrier.null-undefined",
    "function.arrow",
    "function.closure",
    "function.declaration",
    "function.higher-order",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("types/generic-constraints/MultipleConstraints"),
    sourceCase("types/generic-constraints/ObjectConstraint"),
    sourceCase("types/generic-constraints/SingleConstraint"),
    sourceCase("types/generic-interface-inheritance/InterfaceInheritance"),
    sourceCase("types/generic-substitution/NestedSubstitution"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "declaration.generic-parameters",
    "tsts.generic-inference",
    "type.generic.provider-target-arguments",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("arrays/basic/ArrayLiteral"),
    sourceCase("arrays/double-array/DoubleArray"),
    sourceCase("arrays/multidimensional/MultiDimensional"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "carrier.array",
    "operation.array.literal",
    "operation.element.provider-indexer",
    "operation.iteration.provider-target",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("arrays/destructuring/ArrayDestructure"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "binding.array.fixed-rest-default",
    "carrier.array",
    "operation.array.literal",
    "operation.destructure.array-object",
    "operation.element.provider-indexer",
    "operation.iteration.provider-target",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("arrays/spread/ArraySpread"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "carrier.array",
    "operation.array.literal",
    "operation.element.provider-indexer",
    "operation.iteration.provider-target",
    "operation.spread.array",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("types/expected-type-threading/ArraySpread"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "expression.nullish-optional",
    "operation.conversion.checked-target-conversion",
    "operation.operator.checked-target-operation",
    "operation.spread.array",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("edge-cases/void-expression/VoidExpression"),
    sourceCase("types/expected-type-threading/ReturnInControlFlow"),
    sourceCase("types/expected-type-threading/TernaryTyping"),
    sourceCase("types/expected-type-threading/VariableInit"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "expression.nullish-optional",
    "operation.conversion.checked-target-conversion",
    "operation.operator.checked-target-operation",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("operators/nullish-coalescing/NullishCoalescing"),
    sourceCase("operators/optional-chaining/OptionalChaining"),
    sourceCase("types/expected-type-threading/NullishCoalescing"),
    sourceCase("types/expected-type-threading/NullishFull"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "carrier.null-undefined",
    "expression.nullish-optional",
    "operation.conversion.checked-target-conversion",
    "operation.operator.checked-target-operation",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("async/basic/AsyncFunction"),
    sourceCase("functions/async-hof/AsyncReturningFunctions"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "carrier.function-delegate",
    "function.async",
    "operation.await.promise-task",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("attributes/basic/Attributes"),
    sourceCase("attributes/targets/Attributes"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "declaration.attributes",
    "source.marker.attribute",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("classes/basic/Person"),
    sourceCase("classes/constructor/User"),
    sourceCase("classes/field-inference/Counter"),
    sourceCase("classes/field-marker/FieldMarker"),
    sourceCase("classes/generic-inheritance/ConcreteExtends"),
    sourceCase("classes/generic-inheritance/GenericExtends"),
    sourceCase("classes/generic-inheritance/InheritanceChain"),
    sourceCase("classes/generic-methods/MethodInGenericClass"),
    sourceCase("classes/generic-methods/MethodInNonGenericClass"),
    sourceCase("classes/inheritance/Inheritance"),
    sourceCase("classes/static-members/MathHelper"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "declaration.class",
    "declaration.class.fields",
    "declaration.class.inheritance",
    "declaration.class.methods",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("collections/list-initializer/ListInitializer"),
    sourceCase("types/dictionaries/Dictionaries"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "carrier.dictionary-record",
    "operation.construct.provider-selected-constructor",
    "operation.element.provider-indexer",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("extensions/linq/ExtensionMethods"),
    sourceCase("extensions/system/Overlaps"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "operation.call.provider-selected-method",
    "operation.member.no-name-guess",
    "provider.virtual-module.target-identity",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("types/pointers/PointerTypes"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "source.marker.field",
    "source.marker.ptr-fnptr",
    "source.marker.struct",
    "source.primitive.numeric",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    sourceCase("structs/basic/Point"),
    sourceCase("types/type-assertions/TypeAssertions"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "source.marker.field",
    "source.marker.struct",
    "source.primitive.numeric",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    expectedCase("edge-cases/object-literal-unknown/ObjectLiteralUnknown"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "backend.no-semantic-strings",
    "carrier.object-shape",
    "compat.unknown.no-dynamic-access",
    "declaration.generated-structural",
    "diagnostic.missing-target-fact",
    "expression.object-literal",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    expectedCase("edge-cases/record-nested-object/RecordNestedObject"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "carrier.object-shape",
    "declaration.generated-structural",
    "expression.object-literal",
  ]),
  ...reviewedOldEmitterCapabilityMapping([
    expectedCase("operators/in-operator/InOperator"),
  ], [
    "backend.ast.only",
    "backend.fail-closed-facts",
    "backend.csharp.no-direct-semantic-string-output",
    "backend.no-semantic-strings",
    "diagnostic.missing-target-fact",
    "expression.nullish-optional",
    "operation.conversion.checked-target-conversion",
    "operation.operator.checked-target-operation",
    "runtime.union.carrier",
  ]),
]);

const oldEmitterReplacementProofByOldPath = new Map([
  [expectedCase("edge-cases/object-literal-unknown/ObjectLiteralUnknown"), Object.freeze({
    replacementCapabilityIds: freezeSortedStrings([
      "backend.fail-closed-facts",
      "compat.unknown.no-dynamic-access",
      "diagnostic.missing-target-fact",
    ]),
    replacementCapabilityPath:
      "Current object-shape diagnostics replace the old unknown-to-object-literal golden: unknown has no dynamic/object-shape carrier, so backend.fail-closed-facts plus compat.unknown.no-dynamic-access produce diagnostic.missing-target-fact instead of C# emission.",
  })],
  [expectedCase("operators/in-operator/InOperator"), Object.freeze({
    replacementCapabilityIds: freezeSortedStrings([
      "backend.fail-closed-facts",
      "diagnostic.missing-target-fact",
      "runtime.union.carrier",
    ]),
    replacementCapabilityPath:
      "Current union/operator diagnostics replace the orphan in-operator golden: runtime union lowering requires explicit runtime.union.carrier facts, and missing finalized facts fail closed through backend.fail-closed-facts and diagnostic.missing-target-fact.",
  })],
]);

const oldEmitterOldEvidenceRole = "regression-evidence-only";

export const oldEmitterPortInventory = Object.freeze(
  oldEmitterPortInventoryEntries.map(withOldEmitterCapabilityProof),
);

const oldEmitterStatusSet = new Set(oldEmitterInventoryStatuses);
const oldEmitterCapabilityMappingStatusSet = new Set(oldEmitterCapabilityMappingStatuses);
const oldEmitterFeatureAreaSet = new Set(oldEmitterFeatureAreas);

function sourceCase(relativePath) {
  return `${oldEmitterCaseRoot}/${relativePath}.ts`;
}

function sourceCases(relativePaths) {
  return relativePaths.map(sourceCase);
}

function expectedCase(relativePath) {
  return `${oldEmitterCaseRoot}/expected/${relativePath}.cs`;
}

function expectedOnlyCases(relativePaths) {
  return relativePaths.map(expectedCase);
}

function withOldEmitterCapabilityProof(entry) {
  const capabilityMappingStatus = entry.status === "deferred" ? "deferred-derived" : "reviewed";
  const capabilityIds = entry.status === "deferred"
    ? defaultOldEmitterCapabilityIds(entry)
    : oldEmitterReviewedCapabilityIdsFor(entry);
  const replacementProof = entry.status === "invalid-stale-architecture"
    ? oldEmitterReplacementProofFor(entry)
    : undefined;

  return Object.freeze({
    ...entry,
    oldEvidenceRole: oldEmitterOldEvidenceRole,
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

function reviewedOldEmitterCapabilityMapping(oldPaths, capabilityIds) {
  const frozenCapabilityIds = freezeSortedStrings(capabilityIds);
  return oldPaths.map((oldPath) => [oldPath, frozenCapabilityIds]);
}

function oldEmitterReviewedCapabilityIdsFor(entry) {
  const capabilityIds = oldEmitterReviewedCapabilityIdsByOldPath.get(entry.oldPath);
  if (capabilityIds === undefined) {
    throw new Error(`missing reviewed old C# emitter capability mapping for ${entry.oldPath}`);
  }

  return capabilityIds;
}

function oldEmitterReplacementProofFor(entry) {
  const replacementProof = oldEmitterReplacementProofByOldPath.get(entry.oldPath);
  if (replacementProof === undefined) {
    throw new Error(`missing replacement capability path for stale old C# emitter entry ${entry.oldPath}`);
  }

  return replacementProof;
}

function defaultOldEmitterCapabilityIds(entry) {
  const ids = new Set(["backend.ast.only", "backend.fail-closed-facts"]);
  const oldPath = entry.oldPath;

  switch (entry.featureArea) {
    case "arrays":
      ids.add("carrier.array");
      ids.add("operation.array.literal");
      ids.add("operation.element.provider-indexer");
      ids.add("operation.iteration.provider-target");
      break;
    case "async":
      ids.add("operation.await.promise-task");
      ids.add("function.async");
      ids.add("carrier.function-delegate");
      break;
    case "attributes":
      ids.add("source.marker.attribute");
      ids.add("declaration.attributes");
      break;
    case "classes":
      ids.add("declaration.class");
      ids.add("declaration.class.fields");
      ids.add("declaration.class.methods");
      ids.add("declaration.class.inheritance");
      break;
    case "collections":
      ids.add("carrier.dictionary-record");
      ids.add("operation.construct.provider-selected-constructor");
      ids.add("operation.element.provider-indexer");
      break;
    case "control-flow":
      ids.add("statement.block-scope");
      ids.add("statement.if-else");
      ids.add("statement.switch");
      ids.add("statement.control-transfer");
      break;
    case "functions":
      ids.add("function.declaration");
      ids.add("function.arrow");
      ids.add("function.closure");
      ids.add("function.higher-order");
      ids.add("carrier.function-delegate");
      break;
    case "generics":
      ids.add("declaration.generic-parameters");
      ids.add("type.generic.provider-target-arguments");
      ids.add("tsts.generic-inference");
      break;
    case "object-shapes":
      ids.add("carrier.object-shape");
      ids.add("declaration.generated-structural");
      ids.add("expression.object-literal");
      break;
    case "operators":
      ids.add("operation.operator.checked-target-operation");
      ids.add("operation.conversion.checked-target-conversion");
      ids.add("expression.nullish-optional");
      break;
    case "source-semantics":
      ids.add("source.primitive.numeric");
      ids.add("source.marker.struct");
      ids.add("source.marker.field");
      break;
    case "target-interop":
      ids.add("provider.virtual-module.target-identity");
      ids.add("operation.call.provider-selected-method");
      ids.add("operation.member.no-name-guess");
      break;
    case "types":
      ids.add("carrier.primitive");
      ids.add("type.utility");
      ids.add("type.assertion");
      break;
    default:
      ids.add("diagnostic.missing-target-fact");
  }

  if (oldPath.includes("/destructuring/") || oldPath.includes("Destructure")) {
    ids.add("operation.destructure.array-object");
    ids.add("binding.array.fixed-rest-default");
  }
  if (oldPath.includes("/spread/") || oldPath.includes("ArraySpread")) {
    ids.add("operation.spread.array");
  }
  if (oldPath.includes("Nullish") || oldPath.includes("Optional")) {
    ids.add("carrier.null-undefined");
  }
  if (oldPath.includes("MappedTypes")) {
    ids.add("type.mapped");
  }
  if (oldPath.includes("ConditionalTypes")) {
    ids.add("type.conditional");
  }
  if (oldPath.includes("UtilityTypes")) {
    ids.add("type.utility");
  }
  if (oldPath.includes("TuplesArity")) {
    ids.add("carrier.tuple");
    ids.add("type.variadic-tuple");
  }
  if (oldPath.includes("PointerTypes")) {
    ids.add("source.marker.ptr-fnptr");
  }
  if (oldPath.includes("StackAlloc")) {
    ids.add("native.dotnet.parameter-modes");
  }
  if (entry.status === "invalid-stale-architecture") {
    ids.add("backend.no-semantic-strings");
    ids.add("diagnostic.missing-target-fact");
  }

  return [...ids].sort();
}

function portedEmitterCase(relativePath, featureArea, newPath, reason) {
  return Object.freeze({
    oldPath: sourceCase(relativePath),
    oldExpectedPath: expectedCase(relativePath),
    newPath,
    status: "ported",
    featureArea,
    owner: "current TSTS/provider/C# AST pipeline",
    reason,
  });
}

function deferredEmitterCases(relativePaths, featureArea, owner, reason) {
  return relativePaths.map((relativePath) => Object.freeze({
    oldPath: oldEmitterHistoricalCasePaths.includes(sourceCase(relativePath))
      ? sourceCase(relativePath)
      : expectedCase(relativePath),
    oldExpectedPath: expectedCase(relativePath),
    status: "deferred",
    featureArea,
    owner,
    reason,
  }));
}

function createOldEmitterCounts(total) {
  return {
    total,
    ported: 0,
    "replaced-by-stronger-test": 0,
    "invalid-stale-architecture": 0,
    deferred: 0,
    unclassified: 0,
  };
}

function createOldEmitterCapabilityMappingCounts() {
  return {
    reviewed: 0,
    "deferred-derived": 0,
  };
}

function isRelativeOldEmitterPath(value) {
  return value.startsWith(`${oldEmitterCaseRoot}/`);
}

function validateOldEmitterStringArrayField(errors, entry, fieldName) {
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

export function validateOldEmitterPortEntry(entry) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return ["entry must be an object"];
  }

  const errors = [];

  if (typeof entry.oldPath !== "string" || entry.oldPath.length === 0) {
    errors.push("oldPath must be a non-empty string");
  } else if (!isRelativeOldEmitterPath(entry.oldPath)) {
    errors.push(`oldPath must be a relative old emitter path under ${oldEmitterCaseRoot}/`);
  }

  if (entry.oldExpectedPath !== undefined) {
    if (typeof entry.oldExpectedPath !== "string" || entry.oldExpectedPath.length === 0) {
      errors.push("oldExpectedPath must be a non-empty string when present");
    } else if (!isRelativeOldEmitterPath(entry.oldExpectedPath) || !entry.oldExpectedPath.includes("/expected/")) {
      errors.push("oldExpectedPath must be a relative expected C# path when present");
    }
  }

  if (entry.newPath !== undefined) {
    if (typeof entry.newPath !== "string" || entry.newPath.length === 0) {
      errors.push("newPath must be a non-empty string when present");
    } else if (entry.newPath.startsWith("/")) {
      errors.push("newPath must be relative when present");
    }
  }

  if (
    (entry.status === "ported" || entry.status === "replaced-by-stronger-test") &&
    (typeof entry.newPath !== "string" || entry.newPath.length === 0)
  ) {
    errors.push("ported and replaced entries must name a current-architecture newPath");
  }

  if (!oldEmitterStatusSet.has(entry.status)) {
    errors.push(`status must be one of ${oldEmitterInventoryStatuses.join(", ")}`);
  }

  if (!oldEmitterFeatureAreaSet.has(entry.featureArea)) {
    errors.push(`featureArea must be one of ${oldEmitterFeatureAreas.join(", ")}`);
  }

  if (entry.oldEvidenceRole !== oldEmitterOldEvidenceRole) {
    errors.push(`oldEvidenceRole must be ${oldEmitterOldEvidenceRole}`);
  }

  if (!oldEmitterCapabilityMappingStatusSet.has(entry.capabilityMappingStatus)) {
    errors.push(`capabilityMappingStatus must be one of ${oldEmitterCapabilityMappingStatuses.join(", ")}`);
  }

  if (entry.status === "deferred" && entry.capabilityMappingStatus !== "deferred-derived") {
    errors.push("deferred entries must use deferred-derived capability mappings");
  }

  if (entry.status !== "deferred" && entry.capabilityMappingStatus !== "reviewed") {
    errors.push("ported, replaced, and stale entries must use reviewed capability mappings");
  }

  const capabilityIdsAreValid = validateOldEmitterStringArrayField(errors, entry, "capabilityIds");

  if (entry.status === "invalid-stale-architecture") {
    const replacementCapabilityIdsAreValid = validateOldEmitterStringArrayField(errors, entry, "replacementCapabilityIds");
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

export function buildOldEmitterInventoryReport(historicalOldPaths, inventoryEntries = oldEmitterPortInventory) {
  const historicalPaths = [...new Set(historicalOldPaths)].sort();
  const historicalPathSet = new Set(historicalPaths);
  const classifiedOldPathSet = new Set();
  const classifiedUnknownOldPathSet = new Set();
  const counts = createOldEmitterCounts(historicalPaths.length);
  const capabilityMappingCounts = createOldEmitterCapabilityMappingCounts();

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

export function formatOldEmitterInventoryCounts(counts) {
  return oldEmitterReportCountKeys.map((key) => `${key}: ${counts[key]}`).join("\n");
}
