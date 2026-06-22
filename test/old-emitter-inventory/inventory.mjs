export const oldEmitterInventoryStatuses = Object.freeze([
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
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

export const oldEmitterPortInventory = Object.freeze([
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
  ...deferredEmitterCases([
    "attributes/comprehensive/Attributes",
  ], "attributes", "C# source semantics + C# native provider + C# backend planner", "Class/method/property/field/parameter attribute facts are covered by current C# target tests; this old fixture remains deferred for constructor attribute placement, which still needs an approved source-semantics surface and declaration planner support."),
  ...deferredEmitterCases([
    "attributes/targets/Attributes",
  ], "attributes", "C# source semantics + C# native provider + C# backend planner", "Field placement through finalized attribute facts is covered by current C# target tests; this old fixture remains deferred for explicit C# attribute target specifiers such as return-target attributes, which are not yet part of the approved current source surface."),
  ...deferredEmitterCases([
    "classes/field-marker/FieldMarker",
  ], "classes", "source field marker semantics + C# declaration planner", "Field marker fixtures require finalized neutral field-marker source facts before property/field storage can be emitted without target-specific source syntax."),
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
  ...deferredEmitterCases([
    "edge-cases/clickmeter-nullability-regressions/ClickmeterNullabilityRegressions",
    "edge-cases/generic-null-default/GenericNullDefault",
    "edge-cases/inline-object-param/InlineObjectParam",
    "types/expected-type-threading/ArraySpread",
  ], "operators", "TSTS flow/contextual facts + C# expression planner", "Operator and expected-type fixtures require TSTS flow/contextual types plus finalized nullable/nullish/optional-chain/ternary facts. They must not be implemented by old expected-type threading inside the backend."),
  ...deferredEmitterCases([
    "extensions/linq/ExtensionMethods",
    "extensions/system/Overlaps",
  ], "target-interop", "C# native provider + C# backend planner", "Extension-method fixtures require provider-owned extension member declarations, receiver mapping, selected overload facts, byref/out parameter facts, and target operation AST emission."),
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
    "edge-cases/object-literal-unknown/ObjectLiteralUnknown",
    "edge-cases/record-nested-object/RecordNestedObject",
  ], "object-shapes", "TSTS structural facts + C# object-shape planner", "Object-shape fixtures require target object-shape carriers for inline object parameters, type parameters, broad unknown rejection, nested records, and generated carrier declarations."),
  ...deferredEmitterCases([
    "lang/stackalloc/StackAlloc",
    "structs/basic/Point",
    "types/pointers/PointerTypes",
    "types/type-assertions/TypeAssertions",
  ], "source-semantics", "source semantics + C# backend planner", "Source-semantics fixtures require neutral/csharp marker facts for stackalloc, pointer types, struct/value-type shape, and assertion/cast emission against finalized target type facts."),
  ...deferredEmitterCases([
    "operators/in-operator/InOperator",
  ], "operators", "TSTS operation facts + C# backend planner", "The orphan old golden for in-operator has no source fixture in the old tree; reconstruct the source behavior before porting it as a current-architecture operation test."),
]);

const oldEmitterStatusSet = new Set(oldEmitterInventoryStatuses);
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

function isRelativeOldEmitterPath(value) {
  return value.startsWith(`${oldEmitterCaseRoot}/`);
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

  if (!oldEmitterStatusSet.has(entry.status)) {
    errors.push(`status must be one of ${oldEmitterInventoryStatuses.join(", ")}`);
  }

  if (!oldEmitterFeatureAreaSet.has(entry.featureArea)) {
    errors.push(`featureArea must be one of ${oldEmitterFeatureAreas.join(", ")}`);
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

export function formatOldEmitterInventoryCounts(counts) {
  return oldEmitterReportCountKeys.map((key) => `${key}: ${counts[key]}`).join("\n");
}
