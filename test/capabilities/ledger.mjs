export const capabilityStatuses = Object.freeze([
  "not-started",
  "partial",
  "complete",
  "blocked",
  "invalid",
]);

export const capabilityOwners = Object.freeze([
  "tsonic-host",
  "tsts-api",
  "source-core-provider",
  "target-provider",
  "surface-provider",
  "csharp-backend",
  "csharp-runtime",
  "csharp-toolchain",
  "rust-future",
  "tests",
]);

const baseCapabilityDefinitions = Object.freeze([
  ["host.config.project-load", "Load current tsonic project config", "partial", "tsonic-host"],
  ["host.config.target-selection", "Select configured target pack", "partial", "tsonic-host"],
  ["host.config.surface-selection", "Select target-supported compatibility surfaces", "partial", "tsonic-host"],
  ["host.config.no-legacy-config", "Reject legacy config shapes", "partial", "tsonic-host"],
  ["host.graph.source-files", "Use TSTS source graph as project file graph", "partial", "tsonic-host"],
  ["host.package.composition", "Compose target, providers, surfaces, backend, runtime, and toolchain", "partial", "tsonic-host"],
  ["host.project.package-discovery", "Discover project packages without legacy package-root shims", "partial", "tsonic-host"],
  ["host.project.target-selection", "Select target by target id", "complete", "tsonic-host"],
  ["host.project.surface-selection", "Select surfaces by target capability", "complete", "tsonic-host"],
  ["host.project.provider-composition", "Compose provider set for a compile session", "complete", "tsonic-host"],
  ["host.project.surface-extension-composition", "Compose selected surface extensions as first-class compiler contributors", "complete", "tsonic-host"],

  ["module.graph.source-files", "Resolve ordinary TypeScript source file graph", "partial", "tsts-api"],
  ["module.import.named", "Support named ESM imports", "partial", "tsts-api"],
  ["module.import.default", "Support default ESM imports", "partial", "tsts-api"],
  ["module.import.namespace", "Support namespace ESM imports", "partial", "tsts-api"],
  ["module.import.type-only", "Support type-only ESM imports", "partial", "tsts-api"],
  ["module.import.side-effect", "Support side-effect imports and module initialization order", "partial", "tsts-api"],
  ["module.export.named", "Support named ESM exports", "partial", "tsts-api"],
  ["module.export.default", "Support default ESM exports", "partial", "tsts-api"],
  ["module.export.reexport", "Support re-exports and export-star", "partial", "tsts-api"],
  ["module.package.exports-subpath", "Resolve package exports and subpaths", "partial", "tsonic-host"],
  ["module.path-mapping", "Support or diagnose tsconfig path mapping", "not-started", "tsonic-host"],
  ["module.emit.multi-file", "Emit deterministic target files for multi-file source projects", "partial", "csharp-backend"],
  ["module.emit.top-level-order", "Emit deterministic module top-level initialization order", "partial", "csharp-backend"],

  ["tsts.parse-bind-check", "TSTS owns parse, bind, and check", "partial", "tsts-api"],
  ["tsts.flow-narrowing", "TSTS owns source flow narrowing", "partial", "tsts-api"],
  ["tsts.contextual-typing", "TSTS owns source contextual typing", "partial", "tsts-api"],
  ["tsts.generic-inference", "TSTS owns source generic inference", "partial", "tsts-api"],
  ["tsts.overload-resolution", "TSTS owns source overload resolution", "partial", "tsts-api"],
  ["tsts.consumer-queries", "Backends consume stable public TSTS queries", "partial", "tsts-api"],
  ["tsts.no-target-overrides", "Extensions cannot rescue invalid TypeScript", "complete", "tsts-api"],
  ["tsts.program.create-with-extensions", "Create TSTS compiler session with extensions", "partial", "tsts-api"],
  ["tsts.type-query.flow-narrowed-type", "Query flow-narrowed type at a source node", "partial", "tsts-api"],
  ["tsts.diagnostic.provider-sourced", "Surface provider diagnostics through TSTS diagnostics", "partial", "tsts-api"],

  ["provider.virtual-module.ownership", "Provider explicitly owns module specifiers", "partial", "target-provider"],
  ["provider.virtual-module.no-fallback", "Provider-owned module failure has no file fallback", "partial", "target-provider"],
  ["provider.virtual-module.source-shape", "Provider supplies source-visible virtual declarations", "partial", "target-provider"],
  ["provider.virtual-module.target-identity", "Provider attaches target identity to virtual declarations", "partial", "target-provider"],
  ["provider.virtual-module.constraints", "Provider supplies target constraints outside TS source shape", "partial", "target-provider"],
  ["provider.virtual-module.overload-identity", "Provider supplies exact overload/member identity", "partial", "target-provider"],
  ["provider.module.virtual-import", "Provider-backed virtual imports become compiler state", "partial", "target-provider"],
  ["provider.module.no-file-backed-fallback", "Provider module resolution has no declaration-file fallback", "complete", "target-provider"],
  ["provider.module.missing-provider-diagnostic", "Missing provider-owned modules produce diagnostics", "complete", "target-provider"],

  ["source.primitive.numeric", "Neutral source numeric primitives attach facts", "partial", "source-core-provider"],
  ["source.primitive.char-bool", "Neutral char and bool primitives attach facts", "partial", "source-core-provider"],
  ["source.primitive.configured-type", "Configured source primitive aliases map to canonical facts", "partial", "source-core-provider"],
  ["source.marker.out-ref-inref", "out, ref, and inref markers attach storage facts", "partial", "source-core-provider"],
  ["source.marker.field", "field marker attaches storage facts", "partial", "source-core-provider"],
  ["source.marker.struct", "struct marker attaches value-type source facts", "partial", "source-core-provider"],
  ["source.marker.attribute", "attribute marker attaches target attribute facts", "partial", "source-core-provider"],
  ["source.marker.defaultof", "defaultof marker attaches target default facts", "partial", "source-core-provider"],
  ["source.marker.ptr-fnptr", "pointer and function-pointer markers attach target-validated facts", "partial", "source-core-provider"],
  ["source-core.out.storage-binding", "out marker resolves to assignable storage", "partial", "source-core-provider"],
  ["source-core.ref.parameter-mode", "ref and inref markers resolve to parameter passing facts", "partial", "source-core-provider"],
  ["source-core.struct.field-facts", "struct and field markers combine into value-shape facts", "partial", "source-core-provider"],

  ["type.utility", "Utility types are consumed from TSTS results", "partial", "tsts-api"],
  ["type.conditional", "Conditional types are consumed from TSTS results", "partial", "tsts-api"],
  ["type.mapped", "Mapped types are consumed from TSTS results", "partial", "tsts-api"],
  ["type.indexed-access", "Indexed access types are consumed from TSTS results", "partial", "tsts-api"],
  ["type.keyof", "keyof types are consumed from TSTS results", "partial", "tsts-api"],
  ["type.infer", "infer in conditional types is consumed from TSTS results", "partial", "tsts-api"],
  ["type.template-literal", "Template literal types are consumed from TSTS results", "not-started", "tsts-api"],
  ["type.variadic-tuple", "Variadic tuple types are consumed from TSTS results", "not-started", "tsts-api"],
  ["type.satisfies", "satisfies checks source without target emission", "not-started", "tsts-api"],
  ["type.as-const", "as const preserves literal and readonly facts", "not-started", "tsts-api"],
  ["type.assertion", "Type assertions consume TSTS type facts and target casts", "partial", "tsts-api"],
  ["type.non-null-assertion", "Non-null assertions consume TSTS nullable facts", "partial", "tsts-api"],
  ["type.generic.provider-target-arguments", "Map TSTS-inferred type arguments to target type arguments", "partial", "target-provider"],
  ["type.generic.provider-target-constraints", "Validate provider target generic constraints", "partial", "target-provider"],

  ["operation.call.provider-selected-method", "Provider-owned calls emit from selected signature facts", "complete", "target-provider"],
  ["operation.call.provider-argument-conversion", "Provider-owned calls record target argument conversion facts", "partial", "target-provider"],
  ["operation.call.provider-parameter-mode", "Provider-owned calls record parameter mode facts", "partial", "target-provider"],
  ["operation.construct.provider-selected-constructor", "Provider-owned constructors emit from selected constructor facts", "partial", "target-provider"],
  ["operation.constructor.provider-selected-target", "Constructors map to selected target constructor facts", "partial", "target-provider"],
  ["operation.property.provider-selected-member", "Provider-owned property access emits from selected member facts", "partial", "target-provider"],
  ["operation.member.provider-property", "Member properties map through selected provider declarations", "partial", "target-provider"],
  ["operation.member.provider-indexer", "Member indexers map through selected provider declarations", "partial", "target-provider"],
  ["operation.member.no-name-guess", "Target member mapping cannot guess from source spelling", "complete", "target-provider"],
  ["operation.element.provider-indexer", "Element access emits from selected indexer or carrier facts", "partial", "target-provider"],
  ["operation.operator.checked-target-operation", "Operators emit from checked target operation facts", "partial", "target-provider"],
  ["operation.conversion.checked-target-conversion", "Target conversions are explicit facts", "partial", "target-provider"],
  ["operation.iteration.for-of.sync", "for-of emits only with sync iteration facts", "partial", "target-provider"],
  ["operation.iteration.for-in.keys", "for-in emits only with key enumeration facts", "not-started", "target-provider"],
  ["operation.iteration.provider-target", "Iteration maps to provider target iteration facts", "partial", "target-provider"],
  ["operation.array.literal", "Array literals choose target carrier from facts", "partial", "target-provider"],
  ["operation.spread.array", "Array spread emits from iterable/spread facts", "partial", "target-provider"],
  ["operation.spread.object", "Object spread emits from object-shape facts", "partial", "target-provider"],
  ["operation.spread.provider-target-copy", "Spread emits via provider target copy facts", "partial", "target-provider"],
  ["operation.destructure.array-object", "Binding patterns emit from extraction facts", "partial", "target-provider"],
  ["operation.await.promise-task", "await and async functions emit from promise/task facts", "partial", "target-provider"],
  ["operation.throw.catch", "throw/catch/finally use target exception facts", "partial", "target-provider"],

  ["expression.literal.string-number-boolean", "String, number, and boolean literals emit target literals", "partial", "csharp-backend"],
  ["expression.literal.null-undefined", "null and undefined literals emit target carriers", "partial", "csharp-backend"],
  ["expression.literal.bigint-regex-template", "bigint, regex, and template literals use target facts", "not-started", "target-provider"],
  ["expression.object-literal", "Object literal expressions map to target shape facts", "partial", "target-provider"],
  ["expression.array-literal", "Array literal expressions map to target array facts", "partial", "target-provider"],
  ["expression.call", "Call expressions consume TSTS signature and provider facts", "partial", "target-provider"],
  ["expression.new", "new expressions consume TSTS construct signature and provider facts", "partial", "target-provider"],
  ["expression.property-access", "Property access consumes TSTS member and provider facts", "partial", "target-provider"],
  ["expression.element-access", "Element access consumes TSTS element and provider facts", "partial", "target-provider"],
  ["expression.operator", "Operators consume TSTS type facts and provider operation facts", "partial", "target-provider"],
  ["expression.conditional", "Conditional expressions consume TSTS expected types", "partial", "tsts-api"],
  ["expression.nullish-optional", "Nullish and optional operations consume nullable facts", "partial", "target-provider"],
  ["expression.assignment", "Assignments consume TSTS assignment result and target validation facts", "partial", "target-provider"],
  ["expression.lambda", "Lambdas consume TSTS contextual signatures", "partial", "tsts-api"],

  ["statement.block-scope", "Blocks and nested scopes preserve binding identity", "partial", "tsts-api"],
  ["statement.if-else", "if/else emits from source AST and TSTS flow facts", "partial", "tsts-api"],
  ["statement.switch", "switch emits grouped cases and defaults", "partial", "csharp-backend"],
  ["statement.loop", "for, while, do, for-of, and for-in emit target loops", "partial", "target-provider"],
  ["statement.control-transfer", "break, continue, and labels emit target control flow", "partial", "csharp-backend"],
  ["statement.return", "return emits with TSTS return type and target conversion facts", "partial", "target-provider"],
  ["statement.throw-catch-finally", "throw, catch, and finally emit target exception flow", "partial", "target-provider"],
  ["statement.top-level", "Top-level statements emit deterministic entry/module init", "partial", "csharp-backend"],

  ["binding.array.fixed-rest-default", "Array binding supports fixed, rest, defaults, and nested extraction", "partial", "target-provider"],
  ["binding.object.rename-rest-default", "Object binding supports rename, rest, defaults, and nested extraction", "partial", "target-provider"],
  ["binding.parameter", "Parameter destructuring emits from TSTS binding facts", "not-started", "target-provider"],
  ["binding.assignment", "Assignment destructuring emits deterministic storage writes", "not-started", "target-provider"],
  ["binding.object-shape", "Object-shape destructuring consumes generated shape facts", "partial", "target-provider"],

  ["function.declaration", "Function declarations emit target methods/functions", "partial", "csharp-backend"],
  ["function.arrow", "Arrow functions emit target lambdas/delegates", "partial", "csharp-backend"],
  ["function.default-rest-optional-params", "Default, rest, and optional params use target parameter facts", "partial", "target-provider"],
  ["function.closure", "Closures preserve captured variables and mutation", "partial", "csharp-backend"],
  ["function.higher-order", "Higher-order functions use delegate/function carriers", "partial", "csharp-backend"],
  ["function.delegate-carrier", "Delegate carriers are selected by target facts", "partial", "target-provider"],
  ["function.this-binding", "this binding follows TSTS source decisions and target facts", "partial", "tsts-api"],
  ["function.async", "Async functions map Promise to target task facts", "partial", "target-provider"],

  ["declaration.function", "Function declarations render from AST and TSTS facts", "partial", "csharp-backend"],
  ["declaration.class", "Classes render constructors, fields, methods, and static members", "partial", "csharp-backend"],
  ["declaration.class.constructor", "Class constructors emit target constructors", "partial", "csharp-backend"],
  ["declaration.class.fields", "Class fields emit from TSTS/property facts", "partial", "target-provider"],
  ["declaration.class.methods", "Class methods emit target methods", "partial", "csharp-backend"],
  ["declaration.class.properties", "Accessors and property markers emit target properties", "partial", "target-provider"],
  ["declaration.class.visibility", "Visibility emits only from source and target-legal facts", "not-started", "target-provider"],
  ["declaration.class.private-fields", "#private fields get a target representation or diagnostic", "not-started", "target-provider"],
  ["declaration.class.static-blocks", "Static blocks get target support or diagnostic", "not-started", "target-provider"],
  ["declaration.class.inheritance", "Class inheritance emits from TSTS heritage facts", "partial", "tsts-api"],
  ["declaration.class.abstract", "Abstract classes and members emit target abstract declarations", "not-started", "target-provider"],
  ["declaration.interface", "Interfaces render from TSTS and target facts", "partial", "csharp-backend"],
  ["declaration.enum", "Enums and enum constants render from TSTS facts", "partial", "csharp-backend"],
  ["declaration.type-alias", "Type aliases erase or emit by target facts", "partial", "target-provider"],
  ["declaration.generic-parameters", "Generic params and constraints emit from TSTS and provider facts", "partial", "target-provider"],
  ["declaration.heritage", "extends and implements emit from TSTS plus target facts", "partial", "tsts-api"],
  ["declaration.attributes", "Attribute facts render at target-valid locations", "partial", "source-core-provider"],
  ["declaration.generated-structural", "Generated structural declarations are deterministic", "partial", "csharp-backend"],

  ["carrier.primitive", "Primitive carriers come from source/target facts", "partial", "target-provider"],
  ["carrier.array", "Array carriers provide length, index, iteration, and conversion facts", "partial", "target-provider"],
  ["carrier.tuple", "Tuple carriers provide arity and element facts", "partial", "target-provider"],
  ["carrier.object-shape", "Object-shape carriers are deterministic and fact-backed", "partial", "target-provider"],
  ["carrier.dictionary-record", "Record and index-signature carriers are fact-backed", "partial", "target-provider"],
  ["carrier.union", "Runtime unions exist only when facts require them", "not-started", "target-provider"],
  ["carrier.null-undefined", "Null and undefined are represented consistently by target mode", "partial", "target-provider"],
  ["carrier.function-delegate", "Function values and callbacks use fact-backed delegate carriers", "partial", "target-provider"],
  ["carrier.any-tsvalue", "any uses explicit compatibility carrier only in compat mode", "not-started", "target-provider"],

  ["surface.js.console", "JS console operations use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.console-log", "console.log uses selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.array-methods", "JS array methods use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.string-methods", "JS string methods use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.math-json-regexp", "Math, JSON, and RegExp use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.math", "Math operations use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.object-runtime", "Object runtime operations use selected JS surface facts", "not-started", "surface-provider"],
  ["surface.node.fs-path-process", "node:fs, node:path, and process use selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.buffer-crypto-os", "Buffer, crypto, and os use selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.fs", "node:fs uses selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.process", "node:process uses selected Node surface facts", "partial", "surface-provider"],

  ["compat.mode.strict-native", "Strict-native mode rejects unsupported dynamic behavior", "partial", "target-provider"],
  ["compat.mode.compat", "Compatibility mode enables explicit dynamic carriers", "not-started", "target-provider"],
  ["compat.any.property", "any property operations use dynamic carrier facts", "not-started", "target-provider"],
  ["compat.any.dynamic-get", "any dynamic get uses explicit carrier facts", "not-started", "target-provider"],
  ["compat.any.dynamic-set", "any dynamic set uses explicit carrier facts", "not-started", "target-provider"],
  ["compat.any.call-construct", "any call/new use dynamic carrier facts", "not-started", "target-provider"],
  ["compat.any.dynamic-call", "any dynamic call uses explicit carrier facts", "not-started", "target-provider"],
  ["compat.any.operators", "any operators use dynamic carrier facts", "not-started", "target-provider"],
  ["compat.any.typed-boundary-cast", "any typed-boundary casts are explicit", "not-started", "target-provider"],
  ["compat.object.no-dynamic-access", "object is not treated like any", "not-started", "target-provider"],
  ["compat.unknown.no-dynamic-access", "unknown is not treated like any", "not-started", "target-provider"],
  ["compat.prototype-mutation", "Prototype mutation is explicit runtime support or diagnostic", "not-started", "target-provider"],
  ["compat.proxy-eval-function-with", "proxy, eval, Function, and with are rejected unless explicit runtime exists", "not-started", "target-provider"],
  ["runtime.union.carrier", "Union carrier is explicit runtime capability", "not-started", "target-provider"],
  ["runtime.undefined.carrier", "Undefined carrier is explicit runtime capability", "partial", "target-provider"],
  ["runtime.dynamic.carrier", "Dynamic carrier is explicit runtime capability", "not-started", "target-provider"],

  ["backend.ast.only", "Backend constructs target AST only", "partial", "csharp-backend"],
  ["backend.no-semantic-strings", "Semantic output is never direct strings", "partial", "csharp-backend"],
  ["backend.fail-closed-facts", "Missing backend-required facts are diagnostics", "partial", "csharp-backend"],
  ["backend.project-source-declarations", "Project declarations emit from TSTS AST and facts", "partial", "csharp-backend"],
  ["backend.generated-declarations", "Generated declarations are deterministic", "partial", "csharp-backend"],
  ["backend.diagnostics", "Backend diagnostics identify missing facts and capabilities", "partial", "csharp-backend"],
  ["backend.csharp.ast-expression", "C# expressions are Roslyn-compatible AST", "partial", "csharp-backend"],
  ["backend.csharp.ast-statement", "C# statements are Roslyn-compatible AST", "partial", "csharp-backend"],
  ["backend.csharp.printer", "C# printer renders AST only", "partial", "csharp-backend"],
  ["backend.csharp.no-direct-semantic-string-output", "C# backend never emits semantic strings directly", "complete", "csharp-backend"],
  ["backend.csharp.project-sdk-emit", "C# backend emits SDK-style project files", "partial", "csharp-backend"],
  ["backend.csharp.runtime-artifacts", "C# backend includes selected runtime artifacts only", "partial", "csharp-backend"],

  ["toolchain.csharp.project", "Emit C# project from target options", "partial", "csharp-toolchain"],
  ["toolchain.csharp.build-run", "dotnet build/run succeeds for executable tests", "partial", "csharp-toolchain"],
  ["toolchain.csharp.library", "Library output path and artifacts are deterministic", "partial", "csharp-toolchain"],
  ["toolchain.csharp.nativeaot", "NativeAOT is a target toolchain project option", "not-started", "csharp-toolchain"],
  ["runtime.csharp.js", "C# JS runtime artifacts are selected by js surface", "partial", "csharp-runtime"],
  ["runtime.csharp.nodejs", "C# NodeJS runtime artifacts are selected by nodejs surface", "partial", "csharp-runtime"],
  ["runtime.no-reflection-semantics", "Product runtime and generated code avoid reflection semantics", "partial", "csharp-runtime"],

  ["native.dotnet.assembly-model", ".NET provider models assemblies and namespaces", "not-started", "target-provider"],
  ["native.dotnet.type-model", ".NET provider models generic, nested, static, and instance types", "not-started", "target-provider"],
  ["native.dotnet.member-methods", ".NET provider models methods, overloads, extension methods, and generic methods", "not-started", "target-provider"],
  ["native.dotnet.member-fields-properties-events", ".NET provider models fields, properties, and events", "not-started", "target-provider"],
  ["native.dotnet.constructors", ".NET provider models constructors and accessibility", "not-started", "target-provider"],
  ["native.dotnet.parameter-modes", ".NET provider models out, ref, in, optional, default, and params array parameters", "partial", "target-provider"],
  ["native.dotnet.attributes", ".NET provider models attributes, constructors, and named args", "not-started", "target-provider"],
  ["native.dotnet.constraints", ".NET provider models target generic constraints", "not-started", "target-provider"],
  ["native.dotnet.conversions", ".NET provider models implicit and explicit conversions", "not-started", "target-provider"],
  ["native.dotnet.unsupported-diagnostics", ".NET provider reports deterministic unsupported-member diagnostics", "not-started", "target-provider"],

  ["diagnostic.missing-target-fact", "Missing target facts produce deterministic diagnostics", "partial", "target-provider"],
  ["diagnostic.missing-provider-fact", "Missing provider facts produce deterministic diagnostics", "partial", "target-provider"],
  ["diagnostic.unsupported-surface", "Unsupported selected surfaces produce diagnostics", "partial", "surface-provider"],
  ["diagnostic.unsupported-target-operation", "Unsupported target operations produce diagnostics", "partial", "target-provider"],
  ["diagnostic.provider-conflict", "Provider ownership conflicts fail", "partial", "target-provider"],
  ["diagnostic.target-constraint", "Target constraint failure points to source", "partial", "target-provider"],
  ["diagnostic.ts-invalid-not-rescued", "Target extensions cannot rescue TS-invalid source", "complete", "tsts-api"],
  ["diagnostic.dynamic-strict-mode", "Strict mode rejects dynamic operations clearly", "not-started", "target-provider"],
  ["diagnostic.strict-mode-slow-op", "Strict mode rejects slow compatibility operations", "not-started", "target-provider"],
  ["diagnostic.source-spans", "Diagnostics identify precise source spans", "partial", "tests"],
  ["diagnostic.evidence", "Diagnostics include capability/fact evidence where useful", "partial", "tests"],

  ["downstream.smoke.simple-apps", "Representative small projects compile and run", "partial", "tests"],
  ["downstream.dotnet.aspnet", "ASP.NET and EF-like projects compile after provider data exists", "blocked", "tests"],
  ["downstream.nodejs-source", "Node-style source projects compile with selected surfaces", "blocked", "tests"],
  ["downstream.no-old-runtime-reflection", "Generated and runtime code remain reflection-free", "partial", "tests"],

  ["target.shared.operation-contract", "Targets share operation/fact contracts without C# shortcuts", "partial", "tests"],
  ["target.shared.ownership-placeholder", "Shared contracts preserve future ownership facts", "not-started", "rust-future"],
  ["target.rust.future-borrow-checker-boundary", "Rust borrow/move remains provider diagnostic plus rustc authority", "not-started", "rust-future"],
  ["rust.boundary.target-pack", "Rust target pack can implement shared interfaces", "not-started", "rust-future"],
  ["rust.provider.modules", "Rust provider supplies virtual modules and target facts", "not-started", "rust-future"],
  ["rust.backend.ast", "Rust backend emits Rust AST/source from facts", "not-started", "rust-future"],
  ["rust.flow.borrow-move-facts", "Borrow and move facts remain target diagnostics", "not-started", "rust-future"],
  ["rust.union-carriers", "Rust union carriers are fact-backed", "not-started", "rust-future"],
  ["rust.surfaces", "Rust surfaces are target-selected, not C# assumptions", "not-started", "rust-future"],
]);

export const requiredCapabilityIds = Object.freeze(baseCapabilityDefinitions.map(([capabilityId]) => capabilityId));

const reviewedCapabilityEvidence = Object.freeze({
  "host.project.target-selection": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/config-cases/resolve-basics.test.ts",
      "packages/cli/src/config.test.ts",
      "test/fixtures/dotnet-test-command/",
    ]),
    notes:
      "Reviewed proof: project target ids come from the current targets[] config shape; unknown target ids emit TARGET_SELECTION before provider/backend artifact creation.",
  }),
  "host.project.surface-selection": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/config-cases/resolve-surfaces.test.ts",
      "packages/cli/src/surface/profiles.test.ts",
      "packages/frontend/src/surface/profiles.test.ts",
    ]),
    notes:
      "Reviewed proof: selected surface ids are passed to the target provider as owned surface instances; unknown, dependency-missing, stale, and unselected surfaces fail closed.",
  }),
  "host.project.provider-composition": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/commands/build.test.ts",
      "test/fixtures/hello-world/",
    ]),
    notes:
      "Reviewed proof: provider extensions and runtime artifacts are composed before backend/toolchain handoff; missing providers and stale supplied surface composition stop before backend emission.",
  }),
  "host.project.surface-extension-composition": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/surface/profiles.test.ts",
      "packages/frontend/src/surface/profiles.test.ts",
      "test/fixtures/js-surface-runtime-builtins/",
      "test/fixtures/nodejs-surface-alias-coverage/",
    ]),
    notes:
      "Reviewed proof: selected surfaces contribute their own compiler extensions after the target provider and in selected-surface order; unselected, stale, and dependency-missing surfaces cannot contribute semantic extensions or runtime artifacts.",
  }),
  "tsts.no-target-overrides": Object.freeze({
    positiveTests: Object.freeze([
      "packages/tsts/src/services/embedding-api.test.ts",
      "packages/tsts/src/extensions/provider-program.test.ts",
    ]),
    negativeTests: Object.freeze([
      "packages/tsts/src/services/embedding-api.test.ts",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/frontend/src/validator.test.ts",
    ]),
    notes:
      "Reviewed proof: provider/extension observations can add facts after TS-Go accepts source, and TSTS diagnostics stop artifact emission when source TypeScript is invalid.",
  }),
  "provider.module.no-file-backed-fallback": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
      "packages/cli/src/commands/restore.test.ts",
    ]),
    notes:
      "Reviewed proof: selected providers create compiler-visible modules; .d.ts and provider metadata files are excluded from semantic input, so unselected or missing provider modules fail closed without file-backed fallback.",
  }),
  "provider.module.missing-provider-diagnostic": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/commands/add-deps.test.ts",
      "packages/cli/src/commands/restore.test.ts",
    ]),
    notes:
      "Reviewed proof: target packs without providers emit TARGET_PROVIDER before backend emission, and provider-owned imports missing from selected virtual modules surface diagnostics instead of falling back to generated package files.",
  }),
  "native.dotnet.parameter-modes": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/lang/stackalloc/StackAlloc.ts",
      "test/fixtures/param-modifiers/",
    ]),
    notes:
      "Reviewed partial proof: external-current C# tests preserve out, optional, and params-array facts and reject wrong optional/params arities; remains partial until ref, in, and reflected default-value facts have positive and negative coverage.",
  }),
  "operation.call.provider-selected-method": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/extensions/linq/ExtensionMethods.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
    ]),
    notes:
      "Reviewed proof: provider-owned calls select exact signature identity from provider facts, including overload groups, extension receivers, byref parameters, and optional/params arity; backend rejects mutated call facts.",
  }),
  "function.default-rest-optional-params": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/default-params/DefaultParams.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/optional-callbacks/OptionalParams.ts",
      "test/fixtures/optional-function-params/",
    ]),
    notes:
      "Reviewed partial proof: current CLI emits TypeScript rest, default, and optional callable parameters from finalized C# carriers, while external-current C# provider tests enforce optional/params arity; remains partial until source-function negative coverage proves missing parameter facts fail closed.",
  }),
  "operation.member.no-name-guess": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/linq/ExtensionMethods.ts",
    ]),
    notes:
      "Reviewed proof: provider-owned calls/properties map from selected provider declaration or signature identity; same-spelling target members outside that identity are rejected.",
  }),
  "backend.csharp.no-direct-semantic-string-output": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../tsonic-csharp/test/csharp-printer.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
      "packages/targets/csharp/emitter/testcases/common/expected/operators/in-operator/InOperator.cs",
    ]),
    notes:
      "Reviewed proof: C# backend exposes Roslyn-compatible syntax as the only output AST boundary; printer/planner tests reject legacy semantic string/custom AST paths.",
  }),
  "diagnostic.ts-invalid-not-rescued": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
      "packages/tsts/src/services/embedding-api.test.ts",
    ]),
    negativeTests: Object.freeze([
      "packages/tsts/src/services/embedding-api.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator.test.ts",
      "packages/frontend/src/validator-cases/generic-validation.test.ts",
    ]),
    notes:
      "Reviewed proof: invalid TypeScript remains invalid even when extensions/providers are present; target emission stops before artifact creation.",
  }),
});

function capabilityDefaults(capabilityId, owner) {
  if (capabilityId.startsWith("host.") || capabilityId.startsWith("module.")) {
    return {
      sourceExamples: ["tsonic build --target csharp --surface js"],
      tstsDecision:
        "TSTS owns source graph and TypeScript module semantics; the host composes providers without legacy discovery.",
      providerFacts: ["providerOwnershipFact", "providerCompositionFact"],
      backendContract:
        "Backend receives a finalized project model and must not rediscover source files or provider ownership.",
    };
  }

  if (capabilityId.startsWith("tsts.") || capabilityId.startsWith("type.")) {
    return {
      sourceExamples: ["const value = id(1);", "if (typeof value === \"string\") value.length;"],
      tstsDecision:
        "TSTS/TS-Go owns the TypeScript language decision; consumers query the resulting symbol, type, signature, and flow facts.",
      providerFacts: ["sourceTypeFact", "typeShapeFact"],
      backendContract:
        "Backend consumes public TSTS query results and target facts; it must not reimplement TypeScript type analysis.",
    };
  }

  if (capabilityId.startsWith("provider.") || capabilityId.startsWith("native.")) {
    return {
      sourceExamples: ["import { Dictionary } from \"@tsonic/dotnet/System.Collections.Generic.js\";"],
      tstsDecision:
        "TSTS checks the source-visible virtual declaration shape and records provider-sourced diagnostics.",
      providerFacts: ["providerVirtualDeclarationFact", "targetIdentityFact", "targetConstraintFact"],
      backendContract:
        "Backend emits target AST only from finalized provider facts; missing facts are diagnostics.",
    };
  }

  if (capabilityId.startsWith("source.") || capabilityId.startsWith("source-core.")) {
    return {
      sourceExamples: ["let value: int32 = 1;", "dict.tryGetValue(key, out(value));"],
      tstsDecision:
        "TSTS checks ordinary TypeScript syntax and calls; source semantics attach facts without changing TS-Go language rules.",
      providerFacts: ["sourcePrimitiveFact", "sourceMarkerFact", "argumentStorageFact"],
      backendContract:
        "Backend consumes marker and primitive facts and must not infer source semantics from names.",
    };
  }

  if (capabilityId.startsWith("surface.")) {
    return {
      sourceExamples: ["console.log(values.join(\"|\"));"],
      tstsDecision:
        "TSTS validates the source operation against selected virtual declarations.",
      providerFacts: ["surfaceOperationFact", "surfaceRuntimeArtifactFact"],
      backendContract:
        "Backend emits selected surface operation AST only when the chosen target/surface provider finalized the operation fact.",
      runtimeContract:
        "Runtime artifact is included only when the configured surface requires it.",
    };
  }

  if (capabilityId.startsWith("operation.") || capabilityId.startsWith("expression.") || capabilityId.startsWith("statement.") || capabilityId.startsWith("binding.") || capabilityId.startsWith("function.")) {
    return {
      sourceExamples: ["const result = maybe?.value ?? fallback();"],
      tstsDecision:
        "TSTS owns source validity, contextual types, flow types, generic inference, and selected source signatures.",
      providerFacts: ["targetOperationFact", "targetConversionFact", "targetCarrierFact"],
      backendContract:
        "Backend emits target AST from source AST plus finalized facts; no source-name guessing or semantic fallback is allowed.",
    };
  }

  if (capabilityId.startsWith("declaration.") || capabilityId.startsWith("carrier.")) {
    return {
      sourceExamples: ["export class Box<T> { value: T; }"],
      tstsDecision:
        "TSTS owns declaration binding, type relationships, and source generic facts.",
      providerFacts: ["targetDeclarationFact", "targetCarrierFact", "targetConstraintFact"],
      backendContract:
        "Backend emits declarations and carriers from TSTS AST plus finalized target facts only.",
    };
  }

  if (capabilityId.startsWith("compat.") || capabilityId.startsWith("runtime.")) {
    return {
      sourceExamples: ["const value: any = source; value.missing();"],
      tstsDecision:
        "TSTS checks TypeScript source; strict-native mode rejects unsupported dynamic behavior before target emission.",
      providerFacts: ["runtimeCarrierFact", "compatModeFact"],
      backendContract:
        "Backend emits dynamic/runtime carrier operations only from explicit compatibility facts.",
      runtimeContract:
        "Runtime behavior must be closed and deterministic; open reflection and dynamic target fallback are banned.",
    };
  }

  if (capabilityId.startsWith("backend.") || capabilityId.startsWith("toolchain.")) {
    return {
      sourceExamples: ["tsonic build --target csharp"],
      tstsDecision:
        "TSTS and providers finalize source and target facts before backend execution.",
      providerFacts: ["targetProjectFact", "targetRuntimeArtifactFact"],
      backendContract:
        "Backend constructs target AST/project artifacts and the printer/toolchain consume those artifacts without semantic rediscovery.",
      runtimeContract:
        "Target toolchain owns build, run, publish, NativeAOT, and deployment settings.",
    };
  }

  if (capabilityId.startsWith("diagnostic.") || capabilityId.startsWith("downstream.") || capabilityId.startsWith("target.") || capabilityId.startsWith("rust.")) {
    return {
      sourceExamples: ["values.add(1);"],
      tstsDecision:
        "TSTS reports source diagnostics and preserves provider diagnostics without allowing target extensions to override TS-Go decisions.",
      providerFacts: ["diagnosticEvidenceFact", "targetCapabilityFact"],
      backendContract:
        "Backend and tests fail closed when required evidence is missing.",
    };
  }

  return {
    sourceExamples: ["const value = 1;"],
    tstsDecision: "TSTS owns TypeScript source semantics.",
    providerFacts: [],
    backendContract: "Consumers fail closed when capability evidence is absent.",
  };
}

function capability([capabilityId, title, status, owner]) {
  const defaults = capabilityDefaults(capabilityId, owner);
  const reviewedEvidence = reviewedCapabilityEvidence[capabilityId];

  return Object.freeze({
    capabilityId,
    title,
    status,
    owner,
    sourceExamples: Object.freeze(defaults.sourceExamples),
    tstsDecision: defaults.tstsDecision,
    providerFacts: Object.freeze(defaults.providerFacts),
    backendContract: defaults.backendContract,
    runtimeContract: defaults.runtimeContract,
    evidenceReview: reviewedEvidence === undefined ? "seeded" : "reviewed",
    positiveTests: Object.freeze(reviewedEvidence?.positiveTests ?? []),
    negativeTests: Object.freeze(reviewedEvidence?.negativeTests ?? []),
    oldEvidence: Object.freeze(reviewedEvidence?.oldEvidence ?? []),
    blockers: Object.freeze(status === "blocked" ? ["Requires provider/runtime implementation before completion."] : []),
    notes: reviewedEvidence?.notes ??
      "Machine-readable entry seeded from .analysis/test-plan-20260623-075726; old tests are evidence, capability coverage is the source of truth.",
  });
}

export const capabilityLedger = Object.freeze(baseCapabilityDefinitions.map(capability));

export const capabilityIdSet = Object.freeze(new Set(capabilityLedger.map((entry) => entry.capabilityId)));
