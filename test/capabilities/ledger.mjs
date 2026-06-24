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

export const capabilityLaneNames = Object.freeze([
  "static-native",
  "compat-runtime",
  "hard-reject",
]);

const capabilityStatusSet = new Set(capabilityStatuses);
const capabilityOwnerSet = new Set(capabilityOwners);
const capabilityLaneSet = new Set(capabilityLaneNames);
const bannedCompatMechanismPattern = /QuickJS|Reflection|dynamic|GetProperty|GetProperties|GetMethod|GetMethods|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load/u;

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
  ["module.path-mapping", "Support or diagnose tsconfig path mapping", "partial", "tsonic-host"],
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
  ["type.template-literal", "Template literal types are consumed from TSTS results", "partial", "tsts-api"],
  ["type.variadic-tuple", "Variadic tuple types are consumed from TSTS results", "partial", "tsts-api"],
  ["type.satisfies", "satisfies checks source without target emission", "partial", "tsts-api"],
  ["type.as-const", "as const preserves literal and readonly facts", "partial", "tsts-api"],
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
  ["operation.iteration.for-in.keys", "for-in emits only with key enumeration facts", "partial", "target-provider"],
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
  ["expression.literal.bigint-regex-template", "bigint, regex, and template literals use target facts", "partial", "target-provider"],
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
  ["binding.parameter", "Parameter destructuring emits from TSTS binding facts", "partial", "target-provider"],
  ["binding.assignment", "Assignment destructuring emits deterministic storage writes", "partial", "target-provider"],
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
  ["declaration.class.visibility", "Visibility emits only from source and target-legal facts", "partial", "target-provider"],
  ["declaration.class.private-fields", "#private fields get a target representation or diagnostic", "partial", "target-provider"],
  ["declaration.class.static-blocks", "Static blocks get target support or diagnostic", "partial", "target-provider"],
  ["declaration.class.inheritance", "Class inheritance emits from TSTS heritage facts", "partial", "tsts-api"],
  ["declaration.class.abstract", "Abstract classes and members emit target abstract declarations", "partial", "target-provider"],
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
  ["carrier.union", "Runtime unions exist only when facts require them", "partial", "target-provider"],
  ["carrier.null-undefined", "Null and undefined are represented consistently by target mode", "partial", "target-provider"],
  ["carrier.function-delegate", "Function values and callbacks use fact-backed delegate carriers", "partial", "target-provider"],
  ["carrier.any-tsvalue", "any uses explicit compatibility carrier only in compat mode", "partial", "target-provider"],

  ["surface.js.console", "JS console operations use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.console-log", "console.log uses selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.array-methods", "JS array methods use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.string-methods", "JS string methods use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.math-json-regexp", "Math, JSON, and RegExp use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.math", "Math operations use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.object-runtime", "Object runtime operations use selected JS surface facts", "partial", "surface-provider"],
  ["surface.node.fs-path-process", "node:fs, node:path, and process use selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.buffer-crypto-os", "Buffer, crypto, and os use selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.fs", "node:fs uses selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.process", "node:process uses selected Node surface facts", "partial", "surface-provider"],

  ["compat.mode.strict-native", "Strict-native mode rejects unsupported compat-runtime behavior", "partial", "target-provider"],
  ["compat.mode.compat", "Compatibility mode enables explicit compat-runtime carriers", "partial", "target-provider"],
  ["compat.any.property", "any property operations use compat-runtime carrier facts", "partial", "target-provider"],
  ["compat.any.dynamic-get", "any property reads use explicit compat-runtime carrier facts", "partial", "target-provider"],
  ["compat.any.dynamic-set", "any property writes use explicit compat-runtime carrier facts", "partial", "target-provider"],
  ["compat.any.call-construct", "any call/new use compat-runtime carrier facts", "partial", "target-provider"],
  ["compat.any.dynamic-call", "any calls use explicit compat-runtime carrier facts", "partial", "target-provider"],
  ["compat.any.operators", "any operators use compat-runtime carrier facts", "partial", "target-provider"],
  ["compat.any.typed-boundary-cast", "any typed-boundary casts are explicit", "partial", "target-provider"],
  ["compat.object.no-dynamic-access", "object is not treated like any", "partial", "target-provider"],
  ["compat.unknown.no-dynamic-access", "unknown is not treated like any", "partial", "target-provider"],
  ["compat.prototype-mutation", "Prototype mutation is explicit runtime support or diagnostic", "partial", "target-provider"],
  ["compat.proxy-eval-function-with", "proxy, eval, Function, and with are rejected unless explicit runtime exists", "partial", "target-provider"],
  ["runtime.union.carrier", "Union carrier is explicit runtime capability", "partial", "target-provider"],
  ["runtime.undefined.carrier", "Undefined carrier is explicit runtime capability", "partial", "target-provider"],
  ["runtime.dynamic.carrier", "TypeScript any compat-runtime carrier is explicit runtime capability", "partial", "target-provider"],

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
  ["toolchain.csharp.nativeaot", "NativeAOT is a target toolchain project option", "partial", "csharp-toolchain"],
  ["runtime.csharp.js", "C# JS runtime artifacts are selected by js surface", "partial", "csharp-runtime"],
  ["runtime.csharp.nodejs", "C# NodeJS runtime artifacts are selected by nodejs surface", "partial", "csharp-runtime"],
  ["runtime.no-reflection-semantics", "Product runtime and generated code avoid reflection semantics", "partial", "csharp-runtime"],

  ["native.dotnet.assembly-model", ".NET provider models assemblies and namespaces", "partial", "target-provider"],
  ["native.dotnet.type-model", ".NET provider models generic, nested, static, and instance types", "partial", "target-provider"],
  ["native.dotnet.member-methods", ".NET provider models methods, overloads, extension methods, and generic methods", "partial", "target-provider"],
  ["native.dotnet.member-fields-properties-events", ".NET provider models fields, properties, and events", "partial", "target-provider"],
  ["native.dotnet.constructors", ".NET provider models constructors and accessibility", "partial", "target-provider"],
  ["native.dotnet.parameter-modes", ".NET provider models out, ref, in, optional, default, and params array parameters", "partial", "target-provider"],
  ["native.dotnet.attributes", ".NET provider models attributes, constructors, and named args", "partial", "target-provider"],
  ["native.dotnet.constraints", ".NET provider models target generic constraints", "partial", "target-provider"],
  ["native.dotnet.conversions", ".NET provider models implicit and explicit conversions", "partial", "target-provider"],
  ["native.dotnet.unsupported-diagnostics", ".NET provider reports deterministic unsupported-member diagnostics", "partial", "target-provider"],

  ["diagnostic.missing-target-fact", "Missing target facts produce deterministic diagnostics", "partial", "target-provider"],
  ["diagnostic.missing-provider-fact", "Missing provider facts produce deterministic diagnostics", "partial", "target-provider"],
  ["diagnostic.unsupported-surface", "Unsupported selected surfaces produce diagnostics", "partial", "surface-provider"],
  ["diagnostic.unsupported-target-operation", "Unsupported target operations produce diagnostics", "partial", "target-provider"],
  ["diagnostic.provider-conflict", "Provider ownership conflicts fail", "partial", "target-provider"],
  ["diagnostic.target-constraint", "Target constraint failure points to source", "partial", "target-provider"],
  ["diagnostic.ts-invalid-not-rescued", "Target extensions cannot rescue TS-invalid source", "complete", "tsts-api"],
  ["diagnostic.dynamic-strict-mode", "Strict mode rejects dynamic operations clearly", "partial", "target-provider"],
  ["diagnostic.strict-mode-slow-op", "Strict mode rejects slow compatibility operations", "partial", "target-provider"],
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
  "host.config.project-load": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/cli/parser.test.ts",
      "packages/cli/src/config.test.ts",
      "test/fixtures/dotnet-test-command/",
    ]),
    blockers: Object.freeze([
      "host.config.project-load has current strict-shape proof, but remains partial until every old CLI config/build inventory entry is explicitly reviewed against the new tsonic.json contract.",
    ]),
    notes:
      "Reviewed partial proof: project loading accepts only the current entryPoint/rootDir/outDir/targets shape, rejects declaration entrypoints and unsupported top-level fields, and creates semantic input from the selected tsonic.json without reading legacy output/test-command config.",
  }),
  "host.config.target-selection": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/config-cases/resolve-basics.test.ts",
      "packages/cli/src/config.test.ts",
      "test/fixtures/dotnet-test-command/",
    ]),
    blockers: Object.freeze([
      "host.config.target-selection has current parse/build proof, but remains partial until the old config inventory is fully mapped to current target-selection behavior.",
    ]),
    notes:
      "Reviewed partial proof: targets[] is mandatory and non-empty, duplicate target ids are rejected before compilation, unknown selected target ids become TARGET_SELECTION diagnostics, and target-specific options are delegated to the selected target pack rather than host-level guessing.",
  }),
  "host.config.surface-selection": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/config-cases/resolve-surfaces.test.ts",
      "packages/cli/src/surface/profiles.test.ts",
      "packages/frontend/src/surface/profiles.test.ts",
    ]),
    blockers: Object.freeze([
      "host.config.surface-selection has current selected-surface proof, but remains partial until every old surface profile/config case is explicitly reviewed against target-owned surfaces.",
    ]),
    notes:
      "Reviewed partial proof: configured surfaces are explicit target-owned ids, duplicate requested surfaces are rejected, unknown target surfaces and missing required surfaces become TARGET_SURFACE_SELECTION diagnostics, and unselected surfaces cannot contribute compiler extensions or runtime artifacts.",
  }),
  "host.config.no-legacy-config": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-test-command/",
      "test/fixtures/source-package-basic/",
      "test/fixtures/source-package-subpath/",
    ]),
    blockers: Object.freeze([
      "host.config.no-legacy-config remains partial until all old invalid-stale config, package, and fixture paths are reviewed and mapped to current replacements.",
    ]),
    notes:
      "Reviewed partial proof: stale output/nativeAOT/rootNamespace/namespace-at-target-level and TypeScript compilerOptions/baseUrl/paths/tsconfig-style fields are rejected instead of being normalized through compatibility readers.",
  }),
  "host.graph.source-files": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/multi-file/",
      "test/fixtures/multi-file-imports/",
      "test/fixtures/multi-file-types/",
    ]),
    blockers: Object.freeze([
      "host.graph.source-files has current source-graph proof, but remains partial until the full old multi-file/module fixture inventory is mapped to TSTS source graph expectations.",
    ]),
    notes:
      "Reviewed partial proof: host loads resolver-visible source files into TSTS, excludes generated .d.ts and metadata JSON from semantic input, follows relative and package exports/subpath edges through the TSTS graph, omits orphan files, and passes the backend the TSTS emit graph rather than the raw project filesystem crawl.",
  }),
  "host.package.composition": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/commands/add-deps.test.ts",
      "packages/cli/src/commands/add-npm-cases/package-manifest-transitive.test.ts",
      "packages/cli/src/commands/add-npm-cases/package-manifest.test.ts",
      "packages/cli/src/commands/add-npm.test.ts",
      "packages/cli/src/commands/restore-cases/external-types.test.ts",
      "packages/cli/src/commands/restore-cases/nuget-bindings.test.ts",
      "packages/cli/src/commands/restore-cases/runtime-dlls.test.ts",
      "packages/cli/src/commands/restore.test.ts",
      "packages/cli/src/package-manifests/bindings-cases/discovery-and-overlay.test.ts",
      "packages/cli/src/package-manifests/bindings-cases/manifest-resolution.test.ts",
      "packages/cli/src/package-manifests/bindings-cases/runtime-overrides-and-validation.test.ts",
      "packages/cli/src/package-manifests/bindings.test.ts",
      "test/fixtures/anonymous-object-type-literal/",
      "test/fixtures/array-destructuring/",
      "test/fixtures/array-double/",
      "test/fixtures/array-literal/",
      "test/fixtures/array-multidimensional/",
      "test/fixtures/array-spread/",
      "test/fixtures/array-type-emission/",
      "test/fixtures/arrow-function/",
      "test/fixtures/arrow-inference/",
      "test/fixtures/closures/",
      "test/fixtures/default-param-int-to-double/",
      "test/fixtures/dotnet-test-command/",
      "test/fixtures/file-io/",
      "test/fixtures/function-basic/",
      "test/fixtures/function-types-in-collections/",
      "test/fixtures/functions-returning-functions/",
      "test/fixtures/generic-constraints-object-struct/",
      "test/fixtures/generic-constraints-single/",
      "test/fixtures/generic-interface-inheritance/",
      "test/fixtures/generic-method-standalone/",
      "test/fixtures/generic-multiple-constraints/",
      "test/fixtures/generic-nested-substitution/",
      "test/fixtures/hello-world/",
      "test/fixtures/implicit-int-to-double/",
      "test/fixtures/interface-with-functions/",
      "test/fixtures/js-surface-runtime-builtins/",
      "test/fixtures/module-constants/",
      "test/fixtures/namespace-imports/",
      "test/fixtures/nested-scopes/",
      "test/fixtures/nullable-narrowing/",
      "test/fixtures/nullish-coalescing-threading/",
      "test/fixtures/nullish-coalescing/",
      "test/fixtures/nodejs-surface-alias-coverage/",
      "test/fixtures/object-literal-method-shorthand/",
      "test/fixtures/object-literal-object/",
      "test/fixtures/object-prop-int-to-int/",
      "test/fixtures/optional-chaining/",
      "test/fixtures/optional-function-params/",
      "test/fixtures/return-in-control-flow/",
      "test/fixtures/shadowing/",
      "test/fixtures/switch-statement/",
      "test/fixtures/ternary-int-threading/",
      "test/fixtures/top-level-code/",
      "test/fixtures/variable-decls/",
    ]),
    blockers: Object.freeze([
      "host.package.composition remains partial until provider/surface/runtime/toolchain composition is proven across the full old package and fixture inventory.",
    ]),
    notes:
      "Reviewed partial proof: provider runtime contributions, selected-surface runtime contributions, backend artifacts, and toolchain handoff are ordered through one host path; duplicate runtime artifacts or references become TARGET_RUNTIME diagnostics before backend emission.",
  }),
  "host.project.package-discovery": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/commands/add-deps.test.ts",
      "packages/cli/src/commands/restore.test.ts",
      "packages/cli/src/package-manifests/bindings.test.ts",
    ]),
    blockers: Object.freeze([
      "host.project.package-discovery remains partial until every old add/restore/package-manifest path is explicitly classified as provider-owned virtual module input or invalid stale package discovery.",
    ]),
    notes:
      "Reviewed partial proof: current host includes package.json only as TSTS resolver input, follows package exports/subpaths to source .ts/.mts files, and excludes package declarations/metadata from backend semantic input; provider-owned modules must enter through selected target/surface extensions, and package-root shim imports fail closed instead of being rescued by legacy package discovery.",
  }),
  "module.graph.source-files": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/multi-file/",
      "test/fixtures/multi-file-imports/",
      "test/fixtures/multi-file-types/",
    ]),
    blockers: Object.freeze([
      "module.graph.source-files remains partial until every old module fixture and package-style source graph case is mapped to current TSTS graph expectations.",
    ]),
    notes:
      "Reviewed partial proof: relative ESM named/default/namespace/type-only/side-effect imports and re-export edges enter the backend only through TSTS sourceFiles, while orphan files, generated declarations, metadata JSON, and hidden package discovery paths are excluded or diagnosed.",
  }),
  "module.import.named": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/multi-file-imports/",
    ]),
    blockers: Object.freeze([
      "module.import.named remains partial until named imports are covered across all old source-package/module fixture forms and backend emission capabilities.",
    ]),
    notes:
      "Reviewed partial proof: named relative ESM imports are resolved by TSTS source graph; generated declaration, metadata JSON, tsconfig paths, and package-root/package-exports fallback imports fail closed instead of being rescued by host discovery.",
  }),
  "module.import.default": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "module.import.default remains partial until default imports are mapped to old fixture coverage and backend emission capabilities.",
    ]),
    notes:
      "Reviewed partial proof: default relative ESM imports are resolved by TSTS source graph; hidden generated declaration and package discovery fallbacks are rejected.",
  }),
  "module.import.namespace": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/namespace-imports/",
    ]),
    blockers: Object.freeze([
      "module.import.namespace remains partial until namespace imports are mapped across old fixtures and backend emission capabilities.",
    ]),
    notes:
      "Reviewed partial proof: namespace relative ESM imports are resolved by TSTS source graph and not by backend source-name or package fallback discovery.",
  }),
  "module.import.type-only": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/multi-file-types/",
    ]),
    blockers: Object.freeze([
      "module.import.type-only remains partial until type-only import erasure and old import-type fixture coverage are fully mapped.",
    ]),
    notes:
      "Reviewed partial proof: type-only relative ESM imports participate in the TSTS source graph without creating generated declaration fallback input.",
  }),
  "module.import.side-effect": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/top-level-code/",
    ]),
    blockers: Object.freeze([
      "module.import.side-effect remains partial until side-effect module initialization order is implemented and proven by backend/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: side-effect relative ESM imports enter the TSTS graph; initialization-order emission remains tracked separately under module.emit.top-level-order.",
  }),
  "module.export.named": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([
      "test/fixtures/module-constants/",
    ]),
    blockers: Object.freeze([
      "module.export.named remains partial until named export declarations are fully mapped across old module fixtures and backend emission capabilities.",
    ]),
    notes:
      "Reviewed partial proof: named exports and named re-export edges are represented through TSTS module symbols/sourceFiles rather than host-side export scanning.",
  }),
  "module.export.default": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "module.export.default remains partial until default export forms are mapped to old coverage and backend emission capabilities.",
    ]),
    notes:
      "Reviewed partial proof: default exports participate in TSTS module graph resolution; the host does not synthesize default export declarations.",
  }),
  "module.export.reexport": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([
      "test/fixtures/barrel-reexports/",
    ]),
    blockers: Object.freeze([
      "module.export.reexport remains partial until export-star, aliased re-export, and source-package re-export fixture coverage is fully mapped.",
    ]),
    notes:
      "Reviewed partial proof: aliased named re-exports, default re-exports, export-star, and export-star-as edges enter through TSTS module graph rather than host-side barrel scanning.",
  }),
  "module.package.exports-subpath": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/source-package-basic/",
      "test/fixtures/source-package-subpath/",
      "test/fixtures/source-package-surface-mismatch/",
    ]),
    blockers: Object.freeze([
      "module.package.exports-subpath remains partial until package exports/subpath behavior is proven for ordinary project packages and provider-owned virtual modules without a file-backed fallback lane.",
    ]),
    notes:
      "Reviewed partial proof: ordinary package exports/subpaths that resolve to source files enter through the TSTS graph, provider and surface imports use explicit ESM subpaths, and package-root imports plus declaration-only package exports are not treated as bootstrap shims or hidden generated-declaration fallbacks.",
  }),
  "module.path-mapping": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "module.path-mapping is intentionally unsupported in current host config, but remains partial until old path-alias evidence is inventoried and every alias form has focused current diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: tsonic.json compilerOptions/baseUrl/paths are rejected, and a colocated tsconfig paths mapping is not used as a hidden fallback for module resolution.",
  }),
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
  "type.template-literal": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.template-literal remains partial until template literal type evidence covers generic substitution, unions, intrinsic string manipulation types, property keys, mapped types, and old/current emitter parity through full CLI/toolchain gates.",
    ]),
    notes:
      "Reviewed partial proof: a template literal type alias is accepted by TSTS, emitted as ordinary target string source after TSTS resolves it, and an incompatible literal is rejected by TSTS before backend artifacts are produced. The backend does not reimplement template literal type compatibility or preserve template type syntax in C# emission.",
  }),
  "type.variadic-tuple": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/tuples-arity/TuplesArity.ts",
    ]),
    blockers: Object.freeze([
      "type.variadic-tuple remains partial until variadic tuple evidence covers readonly tuples, labels, optional/rest elements, generic inference across calls, spreads, destructuring, and every old tuple arity fixture through current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: a variadic tuple type alias is resolved by TSTS into a concrete tuple consumed by the C# backend as a value tuple, tuple element access emits from finalized element facts, and incompatible tuple arity is rejected by TSTS before backend artifacts are produced.",
  }),
  "type.satisfies": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.satisfies remains partial until object-literal freshness, generic contextual typing, source primitive facts, provider virtual declarations, and all expression-position erasure cases are covered by current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: satisfies is checked by TSTS as a source-only validation construct, valid satisfies expressions erase to the underlying expression in target emission, and invalid satisfies constraints stop before backend artifacts are produced. Tsonic does not attach target semantics to satisfies.",
  }),
  "type.as-const": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.as-const remains partial until literal narrowing and readonly evidence covers object literals, arrays, nested objects, provider calls, source primitives, mutation diagnostics, and target carrier selection across current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: as const is consumed as a TSTS literal/readonly decision, valid readonly tuple literals emit from resolved tuple facts without target-specific as-const syntax, and readonly mutation is rejected by TSTS before backend artifacts are produced.",
  }),
  "provider.module.virtual-import": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
      "packages/cli/src/commands/restore.test.ts",
    ]),
    blockers: Object.freeze([
      "provider.module.virtual-import remains partial until provider virtual imports cover every reflected namespace, explicit assembly reference, provider-owned module alias, selected surface module, and missing-provider diagnostic path through CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: .NET provider imports such as @tsonic/dotnet/System.js and @tsonic/dotnet/System.Reflection.js become TSTS compiler virtual modules, including cross-module inherited member refs whose provider-ref module ownership is preserved instead of rewritten to the inheriting base module.",
  }),
  "provider.virtual-module.ownership": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
      "packages/cli/src/commands/add-deps.test.ts",
      "packages/cli/src/commands/restore.test.ts",
    ]),
    blockers: Object.freeze([
      "provider.virtual-module.ownership remains partial until every target and surface provider has explicit ownership tests for owned, unowned, rejected, missing, and unsupported module specifiers.",
    ]),
    notes:
      "Reviewed partial proof: C# target and selected surface providers explicitly own their virtual module specifiers, unselected providers do not rescue imports, and target packs without providers fail before backend emission instead of falling back to package files.",
  }),
  "provider.virtual-module.no-fallback": Object.freeze({
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
    blockers: Object.freeze([
      "provider.virtual-module.no-fallback remains partial until every provider-owned module failure mode has current CLI/toolchain coverage and precise diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: provider-owned virtual modules have no generated declaration, metadata JSON, package-root shim, or file-backed compatibility lane; missing provider facts remain diagnostics/blockers.",
  }),
  "provider.virtual-module.source-shape": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
    ]),
    blockers: Object.freeze([
      "provider.virtual-module.source-shape remains partial until all source-visible shape families, inherited declarations, target-only omissions, unsupported exports, and selected surface modules are proven end to end.",
    ]),
    notes:
      "Reviewed partial proof: reflected .NET declarations produce source-visible provider shapes for classes, delegates, properties, methods, constructors, overloads, inherited members, and explicit unsupported omissions; unsupported by-ref delegate returns remain target-only instead of leaking fake source declarations.",
  }),
  "provider.virtual-module.target-identity": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
    ]),
    blockers: Object.freeze([
      "provider.virtual-module.target-identity remains partial until target identity proof covers all assembly-qualified collisions, inherited member origins, explicit references, unsupported exports, and selected surface modules.",
    ]),
    notes:
      "Reviewed partial proof: provider virtual declarations carry assembly-qualified target identities into TSTS facts and C# emission, including inherited .NET members and reflected overloads; selected operations emit from these identities rather than source spelling.",
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
  "provider.virtual-module.constraints": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    notes:
      "Reviewed partial proof: provider virtual declarations keep target-only generic constraints out of source-visible TypeScript shapes while retaining reflected target constraint facts for backend/provider consumers. Old TypeScript constraint fixtures are not mapped here because they prove source generic declarations, not provider-owned virtual-module constraints.",
  }),
  "source.primitive.numeric": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/numeric-primitives.test.ts",
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    blockers: Object.freeze([
      "source.primitive.numeric remains partial until every neutral numeric width, decimal/native alias, numeric literal flow, assertion/conversion boundary, and backend carrier emission has positive and negative proof.",
    ]),
    notes:
      "Reviewed partial proof: @tsonic/core/types.js exposes neutral int8 through uint128, nativeInt/nativeUint, float16/32/64, and decimal without C# alias names; imported int32/float64 facts carry width, sign, and runtimeBase; configured @tsonic/csharp int/long/byte aliases map to canonical source primitives; local number/int spellings do not create source-primitive facts.",
  }),
  "source.primitive.char-bool": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([
      "test/fixtures/char-primitive/",
    ]),
    blockers: Object.freeze([
      "source.primitive.char-bool remains partial until char literal/Rune interop, bool flow through operators/calls, backend carrier emission, and invalid char/bool source forms have positive and negative proof.",
    ]),
    notes:
      "Reviewed partial proof: neutral bool and char imports attach source-primitive facts with boolean and string runtime bases, char width/sign data is preserved, and bool field facts flow through struct field collection. Old char-primitive coverage is broader than the current fact proof and remains regression evidence only.",
  }),
  "source.primitive.configured-type": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/numeric-primitives.test.ts",
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    blockers: Object.freeze([
      "source.primitive.configured-type remains partial until all target-configured primitive aliases, invalid alias declarations, namespace imports, re-exports, and no-guessing shadow cases are covered.",
    ]),
    notes:
      "Reviewed partial proof: configured @tsonic/csharp primitive aliases are source-visible only through selected provider modules and map to canonical facts such as int32, int64, and uint8; neutral @tsonic/core exports intentionally omit C# alias spellings; public CLI proof shows local TypeScript aliases to number emit as number/double instead of guessed configured primitive facts.",
  }),
  "source.marker.out-ref-inref": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    blockers: Object.freeze([
      "source.marker.out-ref-inref remains partial until every assignable storage form, non-storage diagnostic, call/constructor propagation path, mutation flow, and emitted parameter-mode AST path is proven.",
    ]),
    notes:
      "Reviewed partial proof: imported out/ref/inref markers attach byref-writeonly-must-init, byref-readwrite, and byref-readonly argument-passing facts; unproven storage like out(value + 1) produces SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT; local functions named out do not create marker facts.",
  }),
  "source.marker.field": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
    ]),
    blockers: Object.freeze([
      "source.marker.field remains partial until field markers cover all valid containing declarations, invalid orphan/duplicate/member-name forms, target accessibility/mutability facts, and emitted field AST output.",
    ]),
    notes:
      "Reviewed partial proof: field<int32>() and field<bool>() inside struct() attach finalized field facts with names and source-primitive type facts; orphan field<int32>() fails closed with SOURCE_SEMANTICS_FIELD_TARGET_NOT_PROVEN instead of inferring a declaration from spelling.",
  }),
  "source.marker.struct": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "test/fixtures/struct-basic/",
    ]),
    blockers: Object.freeze([
      "source.marker.struct remains partial until struct value-shape facts cover methods, constructors, generics, nested structs, invalid non-field members, and C# struct declaration/build output.",
    ]),
    notes:
      "Reviewed partial proof: struct({ x: field<int32>(), ok: field<bool>() }) records a valueType struct fact whose fields are the finalized field facts; old interface-extends-struct evidence is treated only as regression history for the final struct()/field() source shape.",
  }),
  "source.marker.attribute": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/comprehensive/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/targets/Attributes.ts",
    ]),
    blockers: Object.freeze([
      "source.marker.attribute remains partial until invalid selector chains, unsupported constructor/named argument values, every placement target, and generated declaration attribute AST output are proven.",
    ]),
    notes:
      "Reviewed partial proof: provider-backed attribute<User>() selectors attach attribute facts for type, constructor, constructor parameter, method, return, method parameter, property, and field-target placements with exact application targets and arguments. Negative source-authored selector diagnostics and end-to-end emission breadth remain open.",
  }),
  "source.marker.defaultof": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([
      "test/fixtures/defaultof-intrinsic/",
    ]),
    blockers: Object.freeze([
      "source.marker.defaultof remains partial until default facts cover primitive, struct, nullable, reference, provider generic, invalid missing-type, and emitted target-default expression cases.",
    ]),
    notes:
      "Reviewed partial proof: defaultof<char>() attaches a default-value fact whose type is the finalized source type node. Old defaultof-intrinsic coverage remains regression evidence for future backend emission, not proof that every target default lane is complete.",
  }),
  "source.marker.ptr-fnptr": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "test/fixtures/pointer-types/",
    ]),
    blockers: Object.freeze([
      "source.marker.ptr-fnptr remains partial until pointer/function-pointer facts cover mutability, unsafe requirements, ABI/calling conventions, invalid type-argument forms, target diagnostics, and backend unsafe AST output.",
    ]),
    notes:
      "Reviewed partial proof: neutral ptr<int32> and fnptr<[int32, bool], char> aliases attach pointer and function-pointer facts with target-defined mutability, unsafe requirements, parameter/result type nodes, and target-default ABI; .NET provider tests prove unsupported pointer signatures are recorded as target diagnostics instead of silently becoming source declarations.",
  }),
  "source-core.out.storage-binding": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    blockers: Object.freeze([
      "source-core.out.storage-binding remains partial until identifier, property, element, destructured, provider-owned, and readonly/non-assignable storage cases have closed positive and negative proof.",
    ]),
    notes:
      "Reviewed partial proof: out(value) records a write-only byref fact tied to an identifier storage node, while out(value + 1) records the same marker shape but emits SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT because the argument is not assignable storage.",
  }),
  "source-core.ref.parameter-mode": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    blockers: Object.freeze([
      "source-core.ref.parameter-mode remains partial until ref/inref facts are consumed by every call, constructor, delegate, provider overload, invalid readonly, and emitted target parameter path.",
    ]),
    notes:
      "Reviewed partial proof: ref(value) and inref(value) attach readwrite and readonly parameter-mode facts to proven storage, and local functions named like markers do not receive source-core parameter facts. Remaining proof must connect those facts through provider selection and C# AST emission.",
  }),
  "source-core.struct.field-facts": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "test/fixtures/struct-basic/",
    ]),
    blockers: Object.freeze([
      "source-core.struct.field-facts remains partial until struct/field facts cover duplicate fields, non-field expressions, member ordering, target mutability/accessibility, nested value shapes, and generated C# struct output.",
    ]),
    notes:
      "Reviewed partial proof: struct facts collect only finalized field facts from the struct object literal, preserve field names x/ok and source-primitive type facts, and reject orphan field markers without a proven target field context.",
  }),
  "native.dotnet.assembly-model": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-assembly-identity.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-assembly-identity.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/linq/ExtensionMethods.ts",
    ]),
    notes:
      "Reviewed partial proof: .NET provider target identity is assembly-qualified targetId while CLR metadataName remains display/provenance only; duplicate Shared.Widget across assemblies cannot resolve by metadata-name-only lookup and must either expose distinct assembly-qualified declarations or explicit unsupported collision evidence. Remains partial until all assembly/version selection, aliases, and target project references are modeled end to end.",
  }),
  "native.dotnet.type-model": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/InheritanceChain.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-interface-inheritance/InterfaceInheritance.ts",
      "test/fixtures/generic-nested-substitution/",
    ]),
    notes:
      "Reviewed partial proof: .NET reflection exposes source-visible and target-only type models for classes, structs, interfaces, enums, delegates, generic type parameters, cross-namespace provider refs, unique nested CLR types, type families, base types, implemented contracts, and assembly-qualified target identities. Negative proof keeps ambiguous type families out of source declarations while retaining target-only bindings and unsupported-export evidence. Remains partial until same-source-name type-family source declarations, assembly alias/version selection, and every unsupported type-ref conversion path has an end-to-end diagnostic.",
  }),
  "native.dotnet.member-methods": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/generic-methods/MethodInGenericClass.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-methods/MethodInNonGenericClass.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/linq/ExtensionMethods.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "test/fixtures/generic-method-standalone/",
      "test/fixtures/extension-methods-system/",
    ]),
    notes:
      "Reviewed partial proof: .NET provider records reflected methods, overload groups, generic method arity, extension receiver passing, receiver/out parameter metadata, and selected-signature identity; provider selection maps calls from exact selected provider declaration/signature identity, rejects missing identity, rejects ambiguous same-spelling selections, and does not search target members outside the selected overload group. Remains partial until all extension-method discovery inputs, inherited overload surfaces, optional generic method type-argument proofs, and unsupported method families have complete end-to-end diagnostics.",
  }),
  "native.dotnet.member-fields-properties-events": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/basic/Person.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/field-inference/Counter.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    notes:
      "Reviewed partial proof: .NET provider records reflected properties, fields, numeric indexers, generic Dictionary indexers, enum fields, static/instance target facts, and event target facts; selected property and field access maps only from selected provider member identity, selected events reject until explicit source event semantics exist, and source declaration conversion omits events plus unsupported/non-source-shaped members while target bindings retain deterministic facts. Remains partial until event subscription semantics, property setter writes, field writes, inherited member projection, and emitted-source/runtime coverage are complete.",
  }),
  "native.dotnet.constructors": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "test/fixtures/generic-nested-substitution/",
    ]),
    notes:
      "Reviewed partial proof: .NET provider records reflected constructors as constructor members with exact signature ids, preserves constructor array-literal element metadata, cross-namespace parameter provider refs, optional/default/params facts, and selected constructor identity; source conversion omits constructor-named non-constructor members and records unsupported constructor signatures instead of dropping them. Remains partial until accessibility, all constructor overload groups, provider-owned new-expression facts, and unsupported constructor diagnostics are complete end to end.",
  }),
  "native.dotnet.constraints": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    notes:
      "Reviewed partial proof: .NET reflection records class, struct, new, unmanaged, interface, base-class, generic-method, and variance constraints as target facts with assembly-qualified target identities, and keeps those target-only constraints out of source declarations. Remains partial until notnull policy, base-vs-interface distinction, unsupported constraint evidence, and source-level provider constraint diagnostics are complete.",
  }),
  "native.dotnet.conversions": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/implicit-int-to-double/",
      "test/fixtures/default-param-int-to-double/",
      "packages/targets/csharp/emitter/testcases/common/types/type-assertions/TypeAssertions.ts",
    ]),
    notes:
      "Reviewed partial proof: .NET reflection records op_Implicit and op_Explicit as target-only conversion operator facts, keeps them out of source-visible provider members, selects conversion operators by reflected source/target type identity, and reports ambiguity rather than choosing by order. Remains partial until provider-owned conversions are proven through end-to-end source calls/assertions and unsupported conversion diagnostics cover all unsupported operator shapes.",
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
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/lang/stackalloc/StackAlloc.ts",
      "test/fixtures/param-modifiers/",
    ]),
    notes:
      "Reviewed partial proof: external-current C# tests preserve out, ref, in, optional, default-value, and params-array facts across declaration models, function source shapes, extension receivers, constructors, and reflected signature identities, and reject unsupported pointer parameter source shapes plus wrong optional/params arities; remains partial until mutated/missing parameter-mode facts and provider-owned call emission cover every method, constructor, indexer, and delegate path.",
  }),
  "native.dotnet.attributes": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/comprehensive/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/targets/Attributes.ts",
    ]),
    notes:
      "Reviewed partial proof: .NET reflection records target/provider attributes on types, constructors, methods, properties, fields, parameters, and returns; target binding facts preserve constructor identity, constructor/named arguments, enum/type/array/source-primitive values, placement, and evidence; unsupported attribute values are recorded as unsupported attribute facts instead of being dropped. Remains partial until source-authored attribute markers are wired end to end into C# declaration emission.",
  }),
  "declaration.class.visibility": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/basic/Person.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    blockers: Object.freeze([
      "declaration.class.visibility remains partial until every visibility-relevant old class fixture is mapped and target/provider visibility facts cover all supported source declaration placements.",
    ]),
    notes:
      "Reviewed partial proof: C# class member emission treats omitted TypeScript accessibility as public, emits static members from source AST, and rejects explicit TypeScript-only visibility modifiers as diagnostics instead of inferring C# visibility from stale modifier spelling.",
  }),
  "declaration.class.private-fields": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
    ]),
    blockers: Object.freeze([
      "declaration.class.private-fields remains partial until private identifiers are proven end-to-end through TSTS facts, target-name facts, backend emission, and runtime behavior across all field/method/access forms.",
    ]),
    notes:
      "Reviewed partial proof: #private field emission requires a finalized C# target-name fact and fails closed without it; backend does not derive private field names from source spelling.",
  }),
  "declaration.class.static-blocks": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    blockers: Object.freeze([
      "declaration.class.static-blocks remains partial until static blocks with statements, captured class static state, ordering, and runtime execution are proven end to end.",
    ]),
    notes:
      "Reviewed partial proof: class static block AST plans to a Roslyn-compatible static constructor and prints as static C# constructor syntax.",
  }),
  "declaration.class.abstract": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "declaration.class.abstract remains partial until an approved source syntax or provider fact model owns abstract target shape; current source-syntax discipline treats TypeScript abstract modifiers as non-ECMAScript runtime-shape syntax.",
    ]),
    notes:
      "Reviewed partial proof: abstract class/member modifier spelling currently produces deterministic diagnostics and does not cause the backend to synthesize C# abstract semantics from TypeScript-only runtime-shape syntax.",
  }),
  "provider.virtual-module.overload-identity": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/linq/ExtensionMethods.ts",
    ]),
    notes:
      "Reviewed partial proof: provider-owned overload identity is selected from declaration/signature facts, including same-spelling overload groups, generic method arity, and byref parameter modes; remains partial until assembly-qualified identities and unsupported-member diagnostics cover collision/drop cases.",
  }),
  "type.generic.provider-target-constraints": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-generics.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/SingleConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/MultipleConstraints.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/ObjectConstraint.ts",
      "test/fixtures/generic-constraints-single/",
      "test/fixtures/generic-multiple-constraints/",
      "test/fixtures/generic-constraints-object-struct/",
    ]),
    notes:
      "Reviewed partial proof: source and provider generic constraints render only from finalized target constraint facts, primitive constraint failures produce diagnostics, and old generic-constraint emitter/fixture coverage is mapped as evidence. Remains partial until provider-owned invalid type-argument validation and source-span evidence are complete.",
  }),
  "declaration.generic-parameters": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-generics.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-generics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/SingleConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/MultipleConstraints.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/ObjectConstraint.ts",
      "test/fixtures/generic-constraints-single/",
      "test/fixtures/generic-multiple-constraints/",
      "test/fixtures/generic-constraints-object-struct/",
    ]),
    notes:
      "Reviewed partial proof: generic declarations and constraints emit from source AST plus finalized target facts and compile under dotnet. This evidence does not close provider constraint validation by itself; provider-specific constraint legality remains tracked under type.generic.provider-target-constraints and native.dotnet.constraints.",
  }),
  "surface.js.array-methods": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-spread/",
      "test/fixtures/js-surface-array-from-map-keys/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed partial proof: selected JS surface facts cover fixed array length/index access, concat/includes/index/search/slice/join helpers, selected callback method arities, array for-in, and fail-closed rejection when selected declarations lack closed receiver/argument carrier facts. Remains partial until every Array constructor/from/of/map/set carrier operation and runtime artifact is covered end to end.",
  }),
  "surface.js.string-methods": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/clr-string-indexer-dotnet/",
      "test/fixtures/js-string-array-returns/",
      "test/fixtures/js-surface-boolean-tostring/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed partial proof: selected JS surface facts cover string element access, code-point for-of, selected string instance/helper calls including normalize/at/locale/search/well-formed helpers, and fail-closed rejection without closed string receiver facts. Remains partial until all JS String methods and Boolean/String object surface conversions have positive and negative runtime coverage.",
  }),
  "surface.js.console": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([
      "surface.js.console remains partial until every Console member has selected-declaration proof, closed argument carrier/conversion facts, runtime/toolchain coverage, and diagnostics for unsupported members.",
    ]),
    notes:
      "Reviewed partial proof: selected JS Console declarations map only through the checked standard-library declaration identity; console property access defers to the selected call, foreign same-spelling declarations do not map, and console calls reject without finalized closed target facts and runtime-member-compatible argument shapes.",
  }),
  "surface.js.console-log": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([
      "surface.js.console-log remains partial until console.log argument conversion facts and runtime/toolchain coverage prove every supported source argument family.",
    ]),
    notes:
      "Reviewed partial proof: console.log maps to Tsonic.CSharp.Js.console.log only from the selected bundled Console.log declaration and only when every argument has a finalized closed target fact; missing argument facts reject instead of boxing unknown values. Console shape validation is shared with assert/dirxml/timeLog-style members.",
  }),
  "surface.js.math-json-regexp": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-maximus-cases/json-static-safety.test.ts",
      "test/fixtures/js-surface-json-typed-parse/",
      "test/fixtures/js-surface-runtime-builtins/",
      "test/fixtures/json-native-inline-stringify/",
      "test/fixtures/json-native-typed-stringify/",
    ]),
    notes:
      "Reviewed partial proof: selected JS surface facts cover Math runtime method/property operations, RegExp literal/constructor/test/property carriers with C# build coverage, and hard-reject JSON parse/stringify until closed JSON value carriers exist. Remains partial until JSON value carriers, Date, Map, Set, and every RegExp operation have selected-surface facts and runtime/toolchain tests.",
  }),
  "surface.js.math": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed partial proof: selected JS surface facts map standard Math calls and constants to Tsonic.CSharp.Js.Math runtime operations, reject unselected/unsupported forms without spelling-based fallback, and reject Math.max without provider-proven runtime-compatible arguments. Remains partial until every Math static member has current runtime/toolchain coverage.",
  }),
  "surface.js.object-runtime": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-json-typed-parse/",
      "test/fixtures/json-native-inline-stringify/",
      "test/fixtures/json-native-typed-stringify/",
    ]),
    blockers: Object.freeze([
      "surface.js.object-runtime remains partial until JSON parse/stringify, object carrier writes, prototype/static helpers, runtime execution, and toolchain coverage are complete.",
    ]),
    notes:
      "Reviewed partial proof: Object.keys, Object.values, and Object.entries map from selected standard-library Object declarations only when finalized argument facts prove a closed JSObject carrier; missing carrier facts reject, foreign same-spelling declarations defer, and JSON remains fail-closed until closed JSON carrier facts exist.",
  }),
  "surface.node.fs-path-process": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-path-posix-join/",
      "test/fixtures/nodejs-surface-imports-negative/",
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    notes:
      "Reviewed partial proof: selected NodeJS surface facts cover node:path join, namespace imports for node:fs/node:crypto/node:os/node:process, process property access, and rejection of node:path without the NodeJS surface. Remains partial until fs/path/process behavior is runtime-verified across the full old Node fixture matrix and all unsupported module members fail closed.",
  }),
  "surface.node.fs": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    notes:
      "Reviewed partial proof: selected NodeJS surface facts cover node:fs namespace import and existsSync target mapping, and the no-surface negative path blocks Node-owned modules before artifact emission. Remains partial until the complete node:fs API surface has provider facts and runtime coverage.",
  }),
  "surface.node.process": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    notes:
      "Reviewed partial proof: selected NodeJS surface facts cover node:process cwd() and platform target mappings through namespace import facts, and unselected Node modules fail during provider-aware resolution. Remains partial until process environment, argv, exit, and platform-specific behavior are covered through closed runtime facts.",
  }),
  "surface.node.buffer-crypto-os": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    notes:
      "Reviewed partial proof: selected NodeJS surface facts cover Buffer provider virtual declarations, Buffer static calls, Buffer instance length, crypto.randomUUID, os.homedir, and os.platform by selected provider declaration/member/signature identity. Remains partial until the full Buffer/crypto/os old fixture matrix has runtime/toolchain coverage and unsupported members fail closed with precise diagnostics.",
  }),
  "backend.csharp.runtime-artifacts": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/commands/restore-cases/runtime-dlls.test.ts",
      "packages/cli/src/package-manifests/bindings-cases/runtime-overrides-and-validation.test.ts",
      "test/fixtures/js-surface-runtime-builtins/",
      "test/fixtures/nodejs-surface-alias-coverage/",
    ]),
    notes:
      "Reviewed partial proof: host composition includes provider and selected-surface runtime contributions before backend/toolchain handoff, omits unselected surface runtime contributions, emits no target artifacts when TSTS rejects the source program, and selected C# JS/Node surfaces now add real runtime project references without test-local reference configuration. Remains partial until runtime contribution coverage spans every selected first-party surface and unsupported target/toolchain combinations fail with focused diagnostics.",
  }),
  "runtime.csharp.js": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-array-from-map-keys/",
      "test/fixtures/js-surface-boolean-tostring/",
      "test/fixtures/js-surface-json-typed-parse/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed partial proof: selected JS surface runtime contributions are represented in host composition, current JS surface tests require closed C# JS runtime carriers for array and RegExp behavior, and generated C# projects include the real csharp-runtime/csharp-js project references automatically. Remains partial until every JS runtime carrier operation has executable runtime coverage and strict unsupported-operation diagnostics.",
  }),
  "runtime.csharp.nodejs": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-path-posix-join/",
      "test/fixtures/nodejs-surface-alias-coverage/",
      "test/fixtures/nodejs-surface-imports-negative/",
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    notes:
      "Reviewed partial proof: selected NodeJS surface runtime contributions are represented in host composition, generated C# projects include the real csharp-nodejs project reference automatically, and current NodeJS surface tests build node:path/fs/crypto/os/process mappings through that reference. Remains partial until executable tests cover the old Node fixture matrix and all unsupported Node module members fail closed.",
  }),
  "native.dotnet.unsupported-diagnostics": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    notes:
      "Reviewed partial proof: reflection provider records unsupported constructor/property/indexer/field/method/operator/event members instead of silently dropping static interface members, generic static members, multi-parameter indexers, pointer signatures, ranked CLR arrays, by-reference returns, and generic operators; unsupported target-only type refs now fail closed during source-shape conversion for pointers, function pointers, ranked arrays, nested provider refs, and opaque source shapes; selected unsupported member identities become fail-closed target diagnostics instead of generic not-found errors. Remains partial until constraint drops, default-value omissions, and attribute omissions are explicit diagnostics.",
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
  "operation.call.provider-parameter-mode": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/param-modifiers/",
    ]),
    notes:
      "Reviewed partial proof: provider-owned call facts carry selected parameter modes from reflected signatures, including out, ref, in, optional, and params arrays; remains partial until every parameter-mode consumer has missing/mutated fact rejection coverage.",
  }),
  "operation.conversion.checked-target-conversion": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/type-assertions/TypeAssertions.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/VariableInit.ts",
      "test/fixtures/implicit-int-to-double/",
      "test/fixtures/default-param-int-to-double/",
    ]),
    notes:
      "Reviewed partial proof: target conversions are finalized as TSTS targetConversion facts, C# emission requires a matching C# target conversion operation fact, provider conversion operators carry source and target type evidence, and mismatched/missing/ambiguous conversion facts fail closed. Remains partial until provider-owned conversions have full CLI/runtime coverage across calls, returns, assignments, assertions, and generic substitutions.",
  }),
  "operation.iteration.for-of.sync": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
    ]),
    blockers: Object.freeze([
      "operation.iteration.for-of.sync remains partial until provider-owned foreach, string code-point iteration, destructuring iteration, CLI execution, and old fixture parity are proven.",
    ]),
    notes:
      "Reviewed partial proof: for-of emits a Roslyn ForEachStatement only from a finalized provider targetIteration fact, and missing iteration facts fail closed before emission. This proof does not complete string, destructuring, async, or runtime/toolchain iteration coverage.",
  }),
  "operation.property.provider-selected-member": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
    ]),
    blockers: Object.freeze([
      "operation.property.provider-selected-member remains partial until fields, properties, events, indexers, inherited members, and unsupported-member diagnostics are proven through full CLI/runtime/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: provider-owned property and field access maps only from selected provider declaration identity, same-spelling target members without selected identity reject, selected unsupported properties diagnose with provider reasons, and selected events reject until explicit source event semantics exist.",
  }),
  "operation.member.provider-property": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    blockers: Object.freeze([
      "operation.member.provider-property remains partial until provider-owned instance/static property and field reads/writes have source-span diagnostics, runtime/toolchain coverage, and old fixture parity.",
    ]),
    notes:
      "Reviewed partial proof: selected provider member identity, not property source spelling, owns property/field operation mapping; unsupported provider members fail closed with the recorded provider reason.",
  }),
  "operation.member.provider-indexer": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/collections/list-initializer/ListInitializer.ts",
      "packages/targets/csharp/emitter/testcases/common/types/dictionaries/Dictionaries.ts",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([
      "operation.member.provider-indexer remains partial until provider-owned indexer overloads, unsupported indexers, dictionary surface indexers, and mutable index assignments are proven through current CLI/runtime/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: selected provider indexer identity and provider-owned Dictionary indexer facts map element access without target-name guessing; missing or unsupported indexer facts reject.",
  }),
  "operation.iteration.for-in.keys": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
    ]),
    notes:
      "Reviewed partial proof: for-in emission is driven by finalized C# targetIteration facts recorded only after TSTS accepts for-in. JS surface array/string for-in uses index-key facts, object-shape for-in uses object-shape key facts, and Record<string, T> for-in uses provider-owned Dictionary.Keys facts. Missing/non-string key facts fail closed instead of falling back to syntax or source-name inference.",
  }),
  "operation.destructure.array-object": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-destructuring/",
    ]),
    blockers: Object.freeze([
      "operation.destructure.array-object remains partial until assignment destructuring has finalized target storage/extraction facts, expression/statement assignment positives, and old destructuring fixtures are ported through current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: parameter and variable binding patterns now consume finalized array, tuple, and object-shape extraction facts; missing facts produce diagnostics; expression and statement assignment destructuring both fail closed instead of ordinary assignment fallback or stale lowering. This is not complete until target storage-write facts and end-to-end old fixture parity exist.",
  }),
  "expression.literal.bigint-regex-template": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-maximus-cases/array-and-literal-inference.test.ts",
    ]),
    blockers: Object.freeze([
      "expression.literal.bigint-regex-template remains partial until real source/provider facts cover all bigint, RegExp, and template literal paths through CLI/runtime tests.",
    ]),
    notes:
      "Reviewed partial proof: bigint literals require BigInteger carrier facts, RegExp literals require literal pattern/flags plus matching runtime carrier and constructor operation facts, and template literals require finalized System.String carrier facts before Roslyn AST emission. Missing facts fail closed.",
  }),
  "statement.switch": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/control-flow/switch/SwitchStatement.ts",
    ]),
    blockers: Object.freeze([
      "statement.switch remains partial until switch expression carrier rules, all fallthrough/termination variants, CLI execution, and old switch fixture parity are proven.",
    ]),
    notes:
      "Reviewed partial proof: switch planning emits Roslyn SwitchStatement sections, deterministic goto fallthrough/break termination, and rejects non-constant case labels instead of inventing target lowering.",
  }),
  "statement.loop": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/nested-scopes/NestedScopes.ts",
    ]),
    blockers: Object.freeze([
      "statement.loop remains partial until for/while/do/for-in/for-of, destructuring iteration, top-level loop ordering, runtime/toolchain coverage, and old fixture parity are complete.",
    ]),
    notes:
      "Reviewed partial proof: while conditions require finalized bool carriers, for-of requires finalized provider iteration facts, and selected for-in provider/surface facts are tested separately. Missing facts fail closed.",
  }),
  "statement.control-transfer": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/control-flow/switch/SwitchStatement.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/nested-scopes/NestedScopes.ts",
    ]),
    blockers: Object.freeze([
      "statement.control-transfer remains partial until unlabeled/labeled break and continue across every supported loop/switch nesting shape are covered by current CLI/runtime tests.",
    ]),
    notes:
      "Reviewed partial proof: labeled break/continue lower to deterministic target labels held in planner state, not source-name target guessing, and missing labels already diagnose through the statement planner.",
  }),
  "statement.throw-catch-finally": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "statement.throw-catch-finally remains partial until catch variable carriers, catch destructuring rejection, finally behavior, provider exception mappings, CLI execution, and old fixture parity are complete.",
    ]),
    notes:
      "Reviewed partial proof: throw emission requires finalized throwable target carriers and rejects missing exception-carrier facts before C# emission.",
  }),
  "statement.top-level": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/entrypoint-planner.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/entrypoint-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
    ]),
    blockers: Object.freeze([
      "statement.top-level remains partial until multi-file source graph order, import side-effect order, export initialization, CLI execution, and old module fixture parity are complete.",
    ]),
    notes:
      "Reviewed partial proof: executable output creates a separate Roslyn AST entrypoint that calls source module initializers; library output does not synthesize an entrypoint.",
  }),
  "binding.parameter": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-destructuring/",
    ]),
    blockers: Object.freeze([
      "binding.parameter remains partial until every array/object/rest/default/nested parameter destructuring form is covered by current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: parameter destructuring now queries facts on the owning parameter declaration, not only the syntactic type node, so parameter array, object, and nested object destructuring emit only from finalized carrier/object-shape facts; missing nested object-shape facts fail closed.",
  }),
  "binding.assignment": Object.freeze({
    positiveTests: Object.freeze([]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-destructuring/",
    ]),
    blockers: Object.freeze([
      "binding.assignment remains partial because assignment destructuring currently fails closed; implementation requires finalized target storage and extraction facts before positive emission can be added.",
    ]),
    notes:
      "Reviewed partial proof: destructuring assignment is recognized as a binding-storage capability in expression and statement planning, not lowered through ordinary assignment; until storage/extraction facts exist, the backend emits diagnostics instead of guessing.",
  }),
  "carrier.any-tsvalue": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    blockers: Object.freeze([
      "carrier.any-tsvalue remains partial until concrete TsValue/TsObject/TsFunction carrier types, runtime artifacts, and backend AST emission are implemented.",
    ]),
    notes:
      "Reviewed partial proof: TypeScript any receives only an opaque carrier fact; strict-native rejects it, compat mode requires explicit closed operation facts, and object/unknown are not promoted to any-like dynamic carriers.",
  }),
  "carrier.union": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/runtime-union.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/runtime-union.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "carrier.union remains partial until all union arities, nullish unions, discriminated unions, provider-owned union constituents, runtime arm projection, and end-to-end old fixture parity are covered.",
    ]),
    notes:
      "Reviewed partial proof: heterogeneous non-nullish unions now create explicit Tsonic.CSharp.Runtime.Union<T...> carrier facts only after constituent carrier facts exist; narrowed branch expressions prefer checked flow carrier facts and do not emit union arm projection by spelling.",
  }),
  "runtime.union.carrier": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/runtime-union.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/runtime-union.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "runtime.union.carrier remains partial until runtime Union<T...> construction, arm selection, conversion, serialization boundaries, and target toolchain tests cover every supported arity and narrowing pattern.",
    ]),
    notes:
      "Reviewed partial proof: the C# target records runtime union target identities for arities 2 through 8 and rejects union type annotation emission without finalized carrier facts; branch-narrowed values consume checked flow carrier facts directly.",
  }),
  "compat.prototype-mutation": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    blockers: Object.freeze([
      "compat.prototype-mutation remains partial until every prototype-affecting pattern is classified per resolved pattern instance with provider facts; source spelling alone is banned.",
    ]),
    notes:
      "Reviewed partial proof: object-literal __proto__ prototype mutation and resolved standard-library Object.setPrototypeOf/getPrototypeOf/create prototype APIs are hard-rejected with closed-carrier evidence, while shadowable property/member names are not classified by spelling. Future prototype support requires explicit closed compat-runtime facts.",
  }),
  "compat.proxy-eval-function-with": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    blockers: Object.freeze([
      "compat.proxy-eval-function-with remains partial until resolved global eval/Function/Proxy identity coverage spans every selected JS surface/lib source and any supported compat-runtime replacement has closed carrier facts.",
    ]),
    notes:
      "Reviewed partial proof: resolved standard-library eval, Function, Proxy, and with statements are hard-rejected because dynamic code/dynamic scope cannot be represented by closed target facts; shadowable local Function, Proxy, and Object names produce no diagnostics, preventing source-name guessing.",
  }),
  "compat.mode.strict-native": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: C# target options default to strict-native, strict-native hard-rejects opaque TypeScript any property read/write, element get, call, construction, and operator operations before emission, and a test-injected closed compat operation fact cannot rescue strict-native dynamic any behavior. Remains partial until runtime/toolchain diagnostics and all non-any compat-runtime lanes are covered end to end.",
  }),
  "compat.mode.compat": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: explicit typescriptCompatibility=compat is parsed, compat mode still rejects opaque any property read/write, element get, call, construction, and operator operations when closed operation facts are missing, emits property get/set/call/new only from finalized closed compat-runtime operation facts, and rejects closed compat facts attached to non-any object operations. Remains partial until real TsValue/TsObject/TsFunction runtime artifacts and provider-produced facts exist.",
  }),
  "compat.any.property": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: opaque any property and element operations are not source-owned fallbacks; strict-native rejects them, compat rejects missing operation facts, and the backend emits property get/set only from explicit closed operation facts with explicit argument projection. Remains partial until real carrier get/set provider facts and runtime artifacts exist.",
  }),
  "compat.any.call-construct": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: calls and new expressions through opaque any are diagnosed in strict-native and in compat mode without closed target operation facts; backend AST emission for call and construction now requires finalized closed operation facts with explicit argument projection. Remains partial until real TsFunction/TsValue call/construct provider facts and runtime artifacts exist.",
  }),
  "compat.any.dynamic-get": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: any property/element reads require closed compat-runtime get facts; strict-native fails even if a fact is present, while compat mode requires the finalized operation fact before backend AST output. Remains partial until TsValue/TsObject key semantics are real provider facts and runtime artifacts.",
  }),
  "compat.any.dynamic-set": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: property writes through any are caught at the opaque any property node and require closed compat-runtime operation facts with explicit source-argument projection rather than backend assignment guessing. Remains partial until explicit set/delete/update provider facts and runtime artifacts exist.",
  }),
  "compat.any.dynamic-call": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    notes:
      "Reviewed partial proof: calls through opaque any record no selected signature and emit deterministic missing-operation diagnostics in strict-native and compat-without-facts; compat mode emits a call only when a finalized closed carrier operation fact exists. Remains partial until TsFunction/TsValue call provider facts and runtime artifacts exist.",
  }),
  "compat.any.operators": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    notes:
      "Reviewed partial proof: operators with opaque any operands do not synthesize C# operator facts and produce deterministic diagnostics without compat operation facts. Remains partial until every JS operator policy has a closed carrier operation or hard-reject classification.",
  }),
  "compat.any.typed-boundary-cast": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: assignment/return/initializer boundaries between opaque any and typed target carriers produce target diagnostics unless an explicit target conversion fact exists. Remains partial until compat typed-boundary cast helpers are implemented as closed runtime facts.",
  }),
  "compat.object.no-dynamic-access": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: TypeScript object is not promoted to opaque any, receives no dynamic runtime carrier, and property access remains a TSTS source diagnostic rather than target/provider recovery; public CLI proof blocks object.foo before C# planning artifacts are emitted. Remains partial until all object surface operations are separately classified as object-shape, provider adapter, compat carrier, or hard reject.",
  }),
  "compat.unknown.no-dynamic-access": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs",
    ]),
    notes:
      "Reviewed partial proof: unknown is not promoted to opaque any, receives no dynamic runtime carrier, and public CLI proof shows unknown.foo remains a TSTS source diagnostic before backend emission. Old object-literal-unknown coverage is mapped as fail-closed evidence, not as a legacy lowering pattern.",
  }),
  "runtime.dynamic.carrier": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: the current runtime carrier fact for TypeScript any is opaque and non-renderable by itself; compat-runtime behavior requires separate closed operation facts and mode checks. Property get/set, call, and construct backend AST paths now consume those facts. Remains partial until concrete TsValue/TsObject/TsFunction runtime artifacts and provider-produced facts exist.",
  }),
  "diagnostic.dynamic-strict-mode": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: strict-native dynamic any diagnostics explicitly say strict-native and continue to fire even when a compatibility fact exists. Remains partial until source spans and all dynamic operation families have current CLI/runtime tests.",
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
  "backend.ast.only": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../tsonic-csharp/test/csharp-printer.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../tsonic-csharp/test/csharp-printer.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/destructuring/ArrayDestructure.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/multidimensional/MultiDimensional.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/spread/ArraySpread.ts",
      "packages/targets/csharp/emitter/testcases/common/async/basic/AsyncFunction.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/targets/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/basic/Person.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/field-inference/Counter.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/field-marker/FieldMarker.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/ConcreteExtends.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/GenericExtends.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/InheritanceChain.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-methods/MethodInGenericClass.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-methods/MethodInNonGenericClass.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/inheritance/Inheritance.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
      "packages/targets/csharp/emitter/testcases/common/collections/list-initializer/ListInitializer.ts",
      "packages/targets/csharp/emitter/testcases/common/control-flow/switch/SwitchStatement.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/nested-scopes/NestedScopes.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/shadowing/Shadowing.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/void-expression/VoidExpression.ts",
      "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs",
      "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/record-nested-object/RecordNestedObject.cs",
      "packages/targets/csharp/emitter/testcases/common/expected/operators/in-operator/InOperator.cs",
      "packages/targets/csharp/emitter/testcases/common/extensions/linq/ExtensionMethods.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/arrow-inference/ArrowInference.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/arrow/ArrowFunction.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/async-hof/AsyncReturningFunctions.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/basic/Greet.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/closures/Closures.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/default-params/DefaultParams.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/delegates/ActionFunc.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/higher-order/ReturningFunctions.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/optional-callbacks/OptionalParams.ts",
      "packages/targets/csharp/emitter/testcases/common/operators/nullish-coalescing/NullishCoalescing.ts",
      "packages/targets/csharp/emitter/testcases/common/operators/optional-chaining/OptionalChaining.ts",
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
      "packages/targets/csharp/emitter/testcases/common/types/dictionaries/Dictionaries.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/ArraySpread.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/NullishCoalescing.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/NullishFull.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/ReturnInControlFlow.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/TernaryTyping.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/VariableInit.ts",
      "packages/targets/csharp/emitter/testcases/common/types/function-collections/FunctionArrays.ts",
      "packages/targets/csharp/emitter/testcases/common/types/function-type-aliases/GenericAliases.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/MultipleConstraints.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/ObjectConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/SingleConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-interface-inheritance/InterfaceInheritance.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-substitution/NestedSubstitution.ts",
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "packages/targets/csharp/emitter/testcases/common/types/type-assertions/TypeAssertions.ts",
      "packages/targets/csharp/emitter/testcases/common/types/variable-decls/VariableDecls.ts",
    ]),
    blockers: Object.freeze([
      "backend.ast.only remains partial until the full C# backend emits every supported capability through Roslyn-compatible target AST nodes and no semantic string/custom AST paths remain.",
    ]),
    notes:
      "Reviewed partial proof: every reviewed old C# emitter inventory case is represented as backend.ast.only ledger evidence, Roslyn-boundary tests enforce no custom/raw syntax node kinds, and printer tests fail closed for invalid or foreign raw syntax nodes. Completion still requires every supported capability batch to prove Roslyn-compatible AST output end-to-end.",
  }),
  "backend.fail-closed-facts": Object.freeze({
    positiveTests: Object.freeze([]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/lowering/plan-builders.test.ts",
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
      "packages/frontend/src/validator-cases/generic-validation.test.ts",
      "packages/frontend/src/validator-cases/parameters-and-dict-keys.test.ts",
      "packages/frontend/src/validator-cases/utility-types.test.ts",
      "packages/frontend/src/validator-maximus-cases/array-and-literal-inference.test.ts",
      "packages/frontend/src/validator-maximus-cases/deterministic-typing.test.ts",
      "packages/frontend/src/validator-maximus-cases/dictionary-and-object-literal.test.ts",
      "packages/frontend/src/validator-maximus-cases/feature-gating.test.ts",
      "packages/frontend/src/validator-maximus-cases/generic-function-values.test.ts",
      "packages/frontend/src/validator-maximus-cases/json-static-safety.test.ts",
      "packages/frontend/src/validator-maximus-cases/type-syntax.test.ts",
      "packages/frontend/src/validator.maximus.test.ts",
      "packages/frontend/src/validator.test.ts",
    ]),
    blockers: Object.freeze([
      "backend.fail-closed-facts remains partial until every missing-fact branch has current negative tests and old frontend validation assumptions are replaced by capability-specific diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: stale old frontend lowering and validator units are mapped as fail-closed evidence, not as a legacy frontend path. The final architecture requires missing facts to block emission with diagnostics instead of recovering through backend semantic inference.",
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
      "Reviewed proof: C# backend exposes Roslyn-compatible syntax as the only output AST boundary, backend text materialization is limited to the output-plan printer boundary, and printer/planner tests reject legacy semantic string/custom AST paths plus malformed raw syntax nodes.",
  }),
  "backend.csharp.ast-expression": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/csharp-printer.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/csharp-printer.test.mjs",
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    blockers: Object.freeze([
      "backend.csharp.ast-expression remains partial until every supported expression capability is proven to produce Roslyn-compatible expression nodes from finalized facts.",
    ]),
    notes:
      "Reviewed partial proof: expression printing accepts Roslyn-compatible expression nodes, rejects InvalidExpression, and fails closed for foreign RawExpression-like syntax instead of rendering semantic text.",
  }),
  "backend.csharp.ast-statement": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/csharp-printer.test.mjs",
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/csharp-printer.test.mjs",
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    blockers: Object.freeze([
      "backend.csharp.ast-statement remains partial until every supported statement capability is proven to produce Roslyn-compatible statement nodes from finalized facts.",
    ]),
    notes:
      "Reviewed partial proof: statement printing accepts Roslyn-compatible statement nodes, fails closed for foreign RawStatement-like syntax, and boundary tests reject legacy custom statement kind names.",
  }),
  "backend.csharp.printer": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/csharp-printer.test.mjs",
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/csharp-printer.test.mjs",
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    blockers: Object.freeze([
      "backend.csharp.printer remains partial until all generated C# source and project artifacts are validated through full backend/toolchain gates.",
    ]),
    notes:
      "Reviewed partial proof: the printer renders only Roslyn-compatible AST nodes, throws for invalid or unknown syntax nodes, and is reachable from backend planning only through the single output-plan materialization boundary.",
  }),
  "backend.csharp.project-sdk-emit": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-test-command/",
    ]),
    blockers: Object.freeze([
      "backend.csharp.project-sdk-emit remains partial until SDK project emission is validated through full CLI/runtime/toolchain coverage and old project-output fixtures are fully mapped.",
    ]),
    notes:
      "Reviewed partial proof: SDK project artifacts now emit deterministic target-owned properties, reject unknown custom project-property shapes, and include runtime references only from selected target/surface contributions.",
  }),
  "toolchain.csharp.project": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-test-command/",
    ]),
    blockers: Object.freeze([
      "toolchain.csharp.project remains partial until generated projects are built and run through current end-to-end CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: C# target options own project OutputType/PublishAot/target-framework related artifacts, generic custom properties cannot override target-owned properties, and invalid option shapes fail before artifact emission.",
  }),
  "toolchain.csharp.library": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-test-command/",
    ]),
    blockers: Object.freeze([
      "toolchain.csharp.library remains partial until library output paths and artifacts are covered by current CLI/toolchain tests against generated project output.",
    ]),
    notes:
      "Reviewed partial proof: C# project emission defaults to deterministic Library OutputType and only emits executable output from explicit target options.",
  }),
  "toolchain.csharp.nativeaot": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-test-command/",
    ]),
    blockers: Object.freeze([
      "toolchain.csharp.nativeaot remains partial until NativeAOT project settings are built/published through target toolchain tests and runtime compatibility is proven.",
    ]),
    notes:
      "Reviewed partial proof: NativeAOT is an explicit C# target project property, not generic compiler architecture; invalid PublishAot option shapes are rejected and source-to-source artifact reporting remains deterministic.",
  }),
  "diagnostic.unsupported-target-operation": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    blockers: Object.freeze([
      "diagnostic.unsupported-target-operation remains partial until every unsupported provider/surface/runtime lane has precise source spans, provider evidence, and current CLI/runtime/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: selected provider calls, properties, indexers, reflected constructors, unsupported type families, pointer/unsupported member signatures, attributes, and JS surface operations diagnose unsupported target operations from finalized provider/surface facts; the backend does not guess from source spelling or silently fall through to not-found behavior when explicit unsupported evidence exists.",
  }),
  "diagnostic.strict-mode-slow-op": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    blockers: Object.freeze([
      "diagnostic.strict-mode-slow-op remains partial until all strict-native slow/compat operations have precise source spans and runtime/toolchain diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: strict-native diagnostics now cover dynamic any and syntax-level compat-runtime rejections with evidence that names the closed-runtime-carrier requirement and bans QuickJS, reflection dispatch, C# dynamic, and source-name guessing.",
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

function laneClassificationDefaults(capabilityId, owner) {
  const patternKind = lanePatternKind(capabilityId);
  const staticRequiredFacts = laneStaticRequiredFacts(capabilityId, owner);
  const hardRejectReasons = laneHardRejectReasons(capabilityId);
  const compat = laneCompatBehavior(capabilityId);
  const strictNative = laneStrictNativeBehavior(capabilityId, staticRequiredFacts, hardRejectReasons);
  const hasStaticNativeLane = strictNative.lane === "static-native" || !isCompatOnlyCapability(capabilityId);
  const possibleLanes = Object.freeze([
    ...(hasStaticNativeLane ? ["static-native"] : []),
    ...(compat === undefined ? [] : ["compat-runtime"]),
    "hard-reject",
  ]);

  return freezeLaneClassification({
    patternKind,
    possibleLanes,
    strictNative,
    ...(hasStaticNativeLane
      ? {
          staticNative: {
            lane: "static-native",
            requiredFacts: staticRequiredFacts,
            operation: laneStaticOperation(capabilityId),
          },
        }
      : {}),
    ...(compat === undefined ? {} : { compat }),
    hardReject: {
      lane: "hard-reject",
      reasons: hardRejectReasons,
    },
  });
}

function laneStrictNativeBehavior(capabilityId, staticRequiredFacts, hardRejectReasons) {
  if (isCompatOnlyCapability(capabilityId)) {
    return {
      lane: "hard-reject",
      reasons: Object.freeze(["strict-native-selected", ...hardRejectReasons]),
    };
  }
  return {
    lane: "static-native",
    requiredFacts: staticRequiredFacts,
    hardRejectIfMissing: hardRejectReasons,
  };
}

function isCompatOnlyCapability(capabilityId) {
  return capabilityId.startsWith("compat.") ||
    capabilityId.startsWith("runtime.dynamic") ||
    capabilityId.startsWith("carrier.any");
}

function lanePatternKind(capabilityId) {
  if (capabilityId.startsWith("compat.any.dynamic-call") || capabilityId.startsWith("compat.any.call-construct")) {
    return "dynamic-call-or-construct";
  }
  if (capabilityId.startsWith("compat.any.dynamic-get") || capabilityId.startsWith("compat.any.property")) {
    return "dynamic-property-read";
  }
  if (capabilityId.startsWith("compat.any.dynamic-set")) {
    return "dynamic-property-write";
  }
  if (capabilityId.startsWith("compat.any.operators")) {
    return "dynamic-operator";
  }
  if (capabilityId.startsWith("compat.any.typed-boundary-cast")) {
    return "dynamic-typed-boundary";
  }
  if (capabilityId.startsWith("compat.object") || capabilityId.startsWith("compat.unknown")) {
    return "broad-carrier-access";
  }
  if (capabilityId.startsWith("compat.prototype") || capabilityId.startsWith("compat.proxy")) {
    return "dynamic-language-feature";
  }
  if (capabilityId.startsWith("runtime.dynamic") || capabilityId.startsWith("carrier.any")) {
    return "dynamic-runtime-carrier";
  }
  if (capabilityId.startsWith("runtime.union") || capabilityId.startsWith("carrier.union")) {
    return "union-runtime-carrier";
  }
  if (capabilityId.startsWith("runtime.undefined") || capabilityId.startsWith("carrier.null")) {
    return "null-undefined-carrier";
  }
  if (capabilityId.startsWith("operation.call")) {
    return "provider-call";
  }
  if (capabilityId.startsWith("operation.construct") || capabilityId.startsWith("operation.constructor") || capabilityId.startsWith("expression.new")) {
    return "provider-constructor";
  }
  if (capabilityId.startsWith("operation.property") || capabilityId.startsWith("operation.member") || capabilityId.startsWith("expression.property")) {
    return "member-access";
  }
  if (capabilityId.startsWith("operation.element") || capabilityId.startsWith("expression.element")) {
    return "element-access";
  }
  if (capabilityId.startsWith("operation.operator") || capabilityId.startsWith("expression.operator")) {
    return "operator";
  }
  if (capabilityId.startsWith("operation.conversion") || capabilityId.startsWith("type.assertion")) {
    return "target-conversion";
  }
  if (capabilityId.startsWith("operation.iteration") || capabilityId.startsWith("statement.loop")) {
    return "iteration";
  }
  if (capabilityId.startsWith("operation.spread")) {
    return "spread";
  }
  if (capabilityId.startsWith("operation.destructure") || capabilityId.startsWith("binding.")) {
    return "binding-pattern";
  }
  if (capabilityId.startsWith("operation.await") || capabilityId.startsWith("function.async")) {
    return "async-await";
  }
  if (capabilityId.startsWith("operation.throw") || capabilityId.startsWith("statement.throw")) {
    return "throw-catch";
  }
  if (capabilityId.startsWith("expression.literal.bigint-regex-template")) {
    return "bigint-regexp-template-literal";
  }
  if (capabilityId.startsWith("expression.object") || capabilityId.startsWith("carrier.object")) {
    return "object-shape";
  }
  if (capabilityId.startsWith("expression.array") || capabilityId.startsWith("operation.array") || capabilityId.startsWith("carrier.array")) {
    return "array-carrier";
  }
  if (capabilityId.startsWith("carrier.tuple") || capabilityId.startsWith("type.variadic-tuple")) {
    return "tuple-carrier";
  }
  if (capabilityId.startsWith("type.template-literal")) {
    return "template-literal-type-result";
  }
  if (capabilityId.startsWith("type.satisfies")) {
    return "satisfies-source-validation";
  }
  if (capabilityId.startsWith("type.as-const")) {
    return "literal-readonly-type-result";
  }
  if (capabilityId.startsWith("surface.js")) {
    return "js-surface-operation";
  }
  if (capabilityId.startsWith("surface.node")) {
    return "nodejs-surface-operation";
  }
  if (capabilityId.startsWith("native.dotnet")) {
    return "dotnet-provider-model";
  }
  if (capabilityId.startsWith("toolchain.")) {
    return "target-toolchain";
  }
  if (capabilityId.startsWith("module.")) {
    return "module-graph";
  }
  if (capabilityId.startsWith("host.")) {
    return "host-composition";
  }
  if (capabilityId.startsWith("backend.")) {
    return "backend-target-ast";
  }
  if (capabilityId.startsWith("declaration.")) {
    return "declaration-emission";
  }
  if (capabilityId.startsWith("source." ) || capabilityId.startsWith("source-core.")) {
    return "source-marker-or-primitive";
  }
  if (capabilityId.startsWith("diagnostic.")) {
    return "diagnostic-evidence";
  }
  if (capabilityId.startsWith("downstream.")) {
    return "downstream-proof";
  }
  if (capabilityId.startsWith("rust.") || capabilityId.startsWith("target.rust") || capabilityId.startsWith("target.shared")) {
    return "future-target-contract";
  }
  return "compiler-capability";
}

function laneStaticRequiredFacts(capabilityId, owner) {
  if (capabilityId.startsWith("host.") || capabilityId.startsWith("module.")) {
    return Object.freeze(["resolved-project-config", "resolved-source-graph"]);
  }
  if (capabilityId.startsWith("tsts.") || capabilityId.startsWith("type.")) {
    return Object.freeze(["tsts-source-decision", "public-tsts-query-result"]);
  }
  if (capabilityId.startsWith("provider.") || capabilityId.startsWith("native.")) {
    return Object.freeze(["provider-ownership", "provider-virtual-declaration", "target-identity"]);
  }
  if (capabilityId.startsWith("source.") || capabilityId.startsWith("source-core.")) {
    return Object.freeze(["source-marker-identity", "source-fact", "target-carrier-fact"]);
  }
  if (capabilityId.startsWith("surface.")) {
    return Object.freeze(["selected-surface", "selected-source-declaration", "surface-target-operation"]);
  }
  if (capabilityId.startsWith("operation.") || capabilityId.startsWith("expression.") || capabilityId.startsWith("statement.") || capabilityId.startsWith("binding.") || capabilityId.startsWith("function.")) {
    return Object.freeze(["tsts-checked-source-operation", "target-operation-fact", "renderable-target-ast"]);
  }
  if (capabilityId.startsWith("declaration.") || capabilityId.startsWith("carrier.")) {
    return Object.freeze(["tsts-declaration-fact", "target-carrier-fact", "renderable-target-declaration"]);
  }
  if (capabilityId.startsWith("compat.") || capabilityId.startsWith("runtime.")) {
    return Object.freeze(["explicit-runtime-carrier-fact", "selected-target-mode"]);
  }
  if (capabilityId.startsWith("backend.")) {
    return Object.freeze(["finalized-target-facts", "roslyn-compatible-target-ast"]);
  }
  if (capabilityId.startsWith("toolchain.")) {
    return Object.freeze(["target-project-artifact", "toolchain-option-fact"]);
  }
  if (capabilityId.startsWith("diagnostic.")) {
    return Object.freeze(["diagnostic-source-span", "missing-fact-evidence"]);
  }
  if (capabilityId.startsWith("downstream.")) {
    return Object.freeze(["representative-project", "capability-coverage-proof"]);
  }
  if (owner === "rust-future") {
    return Object.freeze(["shared-target-contract", "target-owned-facts"]);
  }
  return Object.freeze(["finalized-capability-facts"]);
}

function laneStaticOperation(capabilityId) {
  if (capabilityId.startsWith("operation.") || capabilityId.startsWith("expression.")) {
    return "emit-target-operation-ast";
  }
  if (capabilityId.startsWith("statement.")) {
    return "emit-target-statement-ast";
  }
  if (capabilityId.startsWith("declaration.")) {
    return "emit-target-declaration-ast";
  }
  if (capabilityId.startsWith("host.") || capabilityId.startsWith("module.")) {
    return "compose-compiler-input";
  }
  if (capabilityId.startsWith("provider.") || capabilityId.startsWith("native.")) {
    return "provide-target-facts";
  }
  if (capabilityId.startsWith("surface.")) {
    return "provide-surface-target-facts";
  }
  if (capabilityId.startsWith("backend.")) {
    return "render-target-ast";
  }
  return "finalize-capability";
}

function laneHardRejectReasons(capabilityId) {
  const reasons = ["missing-required-facts"];
  if (capabilityId.startsWith("compat.") || capabilityId.startsWith("runtime.dynamic") || capabilityId.startsWith("carrier.any")) {
    reasons.push("strict-native-selected");
  }
  if (capabilityId.includes("no-name-guess") || capabilityId.startsWith("operation.member") || capabilityId.startsWith("operation.property") || capabilityId.startsWith("operation.call")) {
    reasons.push("source-spelling-only");
  }
  if (capabilityId.startsWith("compat.proxy") || capabilityId.startsWith("compat.prototype")) {
    reasons.push("unsupported-dynamic-language-semantics");
  }
  if (capabilityId.startsWith("toolchain.csharp.nativeaot") || capabilityId.startsWith("runtime.")) {
    reasons.push("nativeaot-incompatible-runtime");
  }
  if (capabilityId.startsWith("module.path")) {
    reasons.push("unresolved-module-specifier");
  }
  return Object.freeze(reasons);
}

function laneCompatBehavior(capabilityId) {
  const carrier = compatRuntimeCarrier(capabilityId);
  if (carrier === undefined) {
    return undefined;
  }
  return {
    lane: "compat-runtime",
    requiredFacts: Object.freeze([
      "selected-compat-mode",
      `${capabilityId}-fact`,
      `${carrier}-carrier-fact`,
    ]),
    runtimeCarrier: carrier,
    operation: compatRuntimeOperation(capabilityId),
  };
}

function compatRuntimeCarrier(capabilityId) {
  if (capabilityId.startsWith("compat.any.dynamic-call") || capabilityId.startsWith("compat.any.call-construct")) {
    return "TsFunction";
  }
  if (capabilityId.startsWith("compat.any.dynamic-get") || capabilityId.startsWith("compat.any.dynamic-set") || capabilityId.startsWith("compat.any.property") || capabilityId.startsWith("compat.any.operators") || capabilityId.startsWith("compat.any.typed-boundary-cast") || capabilityId.startsWith("carrier.any") || capabilityId.startsWith("runtime.dynamic")) {
    return "TsValue";
  }
  if (capabilityId.startsWith("surface.js.object-runtime")) {
    return "TsObject";
  }
  if (capabilityId.startsWith("carrier.array") || capabilityId.startsWith("operation.spread.array") || capabilityId.startsWith("binding.array") || capabilityId.startsWith("type.variadic-tuple")) {
    return "TsArray";
  }
  if (capabilityId.startsWith("carrier.union") || capabilityId.startsWith("runtime.union")) {
    return "TsUnion";
  }
  if (capabilityId.startsWith("expression.literal.bigint")) {
    return "TsValue";
  }
  if (capabilityId.startsWith("surface.js") || capabilityId.startsWith("surface.node")) {
    return "SelectedSurfaceRuntime";
  }
  if (capabilityId.startsWith("operation.call.provider") || capabilityId.startsWith("operation.property.provider") || capabilityId.startsWith("operation.member.provider") || capabilityId.startsWith("operation.construct.provider") || capabilityId.startsWith("operation.constructor.provider") || capabilityId.startsWith("native.dotnet")) {
    return "GeneratedProviderAdapter";
  }
  if (capabilityId.startsWith("operation.iteration.for-in") || capabilityId.startsWith("operation.iteration.for-of")) {
    return "TsIterator";
  }
  if (capabilityId.startsWith("operation.throw") || capabilityId.startsWith("statement.throw")) {
    return "TsThrownValueException";
  }
  if (capabilityId.startsWith("operation.spread.object") || capabilityId.startsWith("binding.object")) {
    return "TsObject";
  }
  return undefined;
}

function compatRuntimeOperation(capabilityId) {
  if (capabilityId.startsWith("compat.any.dynamic-call")) {
    return "CallProperty";
  }
  if (capabilityId.startsWith("compat.any.dynamic-get") || capabilityId.startsWith("compat.any.property")) {
    return "GetProperty";
  }
  if (capabilityId.startsWith("compat.any.dynamic-set")) {
    return "SetProperty";
  }
  if (capabilityId.startsWith("compat.any.call-construct")) {
    return "Construct";
  }
  if (capabilityId.startsWith("compat.any.operators")) {
    return "ApplyOperator";
  }
  if (capabilityId.startsWith("compat.any.typed-boundary-cast")) {
    return "CheckedCarrierConversion";
  }
  if (capabilityId.startsWith("carrier.union") || capabilityId.startsWith("runtime.union")) {
    return "SelectUnionArm";
  }
  if (capabilityId.startsWith("operation.iteration")) {
    return "Iterate";
  }
  if (capabilityId.startsWith("operation.spread.object") || capabilityId.startsWith("binding.object")) {
    return "ObjectExtractOrSpread";
  }
  if (capabilityId.startsWith("operation.spread.array") || capabilityId.startsWith("binding.array")) {
    return "ArrayExtractOrSpread";
  }
  if (capabilityId.startsWith("native.dotnet") || capabilityId.startsWith("operation.call.provider") || capabilityId.startsWith("operation.property.provider") || capabilityId.startsWith("operation.member.provider")) {
    return "GeneratedProviderAdapterCall";
  }
  return "ClosedRuntimeCarrierOperation";
}

function freezeLaneClassification(classification) {
  return Object.freeze({
    patternKind: classification.patternKind,
    possibleLanes: Object.freeze([...classification.possibleLanes]),
    strictNative: freezeLaneBehavior(classification.strictNative),
    ...(classification.staticNative === undefined ? {} : { staticNative: freezeLaneBehavior(classification.staticNative) }),
    ...(classification.compat === undefined ? {} : { compat: freezeLaneBehavior(classification.compat) }),
    hardReject: freezeLaneBehavior(classification.hardReject),
  });
}

function freezeLaneBehavior(behavior) {
  return Object.freeze({
    ...behavior,
    ...(behavior.requiredFacts === undefined ? {} : { requiredFacts: Object.freeze([...behavior.requiredFacts]) }),
    ...(behavior.hardRejectIfMissing === undefined ? {} : { hardRejectIfMissing: Object.freeze([...behavior.hardRejectIfMissing]) }),
    ...(behavior.reasons === undefined ? {} : { reasons: Object.freeze([...behavior.reasons]) }),
  });
}

function capability([capabilityId, title, status, owner]) {
  const defaults = capabilityDefaults(capabilityId, owner);
  const reviewedEvidence = reviewedCapabilityEvidence[capabilityId];
  const laneClassification = reviewedEvidence?.laneClassification ?? laneClassificationDefaults(capabilityId, owner);
  const blockers = reviewedEvidence?.blockers ?? defaultCapabilityBlockers(capabilityId, status);

  const entry = Object.freeze({
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
    laneClassification,
    blockers: Object.freeze(blockers),
    notes: reviewedEvidence?.notes ??
      "Machine-readable entry seeded from .analysis/test-plan-20260623-075726; old tests are evidence, capability coverage is the source of truth.",
  });
  const validationErrors = validateCapabilityLedgerEntry(entry);
  if (validationErrors.length > 0) {
    throw new Error(`invalid capability ledger entry ${capabilityId}: ${validationErrors.join("; ")}`);
  }
  return entry;
}

function defaultCapabilityBlockers(capabilityId, status) {
  if (status === "complete" || status === "invalid") {
    return [];
  }
  if (status === "blocked") {
    return [`${capabilityId} requires an upstream provider, runtime, or target contract before implementation can be completed.`];
  }
  if (status === "not-started") {
    return [`${capabilityId} has no current implementation batch or current positive/negative proof yet.`];
  }
  return [`${capabilityId} still requires remaining implementation and current positive/negative proof before it can be marked complete.`];
}

export const capabilityLedger = Object.freeze(baseCapabilityDefinitions.map(capability));

export const capabilityIdSet = Object.freeze(new Set(capabilityLedger.map((entry) => entry.capabilityId)));

export function validateCapabilityLedgerEntry(entry) {
  const errors = [];
  if (!isPlainObject(entry)) {
    return ["entry must be an object"];
  }
  validateStringField(errors, entry, "capabilityId");
  validateStringField(errors, entry, "title");
  validateEnumField(errors, entry, "status", capabilityStatusSet, capabilityStatuses);
  validateEnumField(errors, entry, "owner", capabilityOwnerSet, capabilityOwners);
  validateStringArrayField(errors, entry, "sourceExamples", { nonEmpty: true });
  validateStringField(errors, entry, "tstsDecision");
  validateStringArrayField(errors, entry, "providerFacts");
  validateStringField(errors, entry, "backendContract");
  validateStringField(errors, entry, "evidenceReview");
  validateStringArrayField(errors, entry, "positiveTests");
  validateStringArrayField(errors, entry, "negativeTests");
  validateStringArrayField(errors, entry, "oldEvidence");
  validateCompleteCapabilityProof(errors, entry);
  validateStringArrayField(errors, entry, "blockers");
  validateBlockerCompleteness(errors, entry);
  validateStringField(errors, entry, "notes");
  errors.push(...validateCapabilityLaneClassification(entry));
  return errors;
}

function validateCompleteCapabilityProof(errors, entry) {
  if (entry.status !== "complete") {
    return;
  }
  if (!Array.isArray(entry.positiveTests) || entry.positiveTests.length === 0) {
    errors.push("complete capabilities must have positiveTests");
  }
  if (!Array.isArray(entry.negativeTests) || entry.negativeTests.length === 0) {
    errors.push("complete capabilities must have negativeTests");
  }
  if (entry.evidenceReview !== "reviewed") {
    errors.push("complete capabilities must have reviewed evidence");
  }
  if (!Array.isArray(entry.oldEvidence) || entry.oldEvidence.length === 0) {
    errors.push("complete capabilities must have oldEvidence");
  }
}

function validateBlockerCompleteness(errors, entry) {
  if (entry.status === "partial" || entry.status === "not-started" || entry.status === "blocked") {
    if (!Array.isArray(entry.blockers) || entry.blockers.length === 0) {
      errors.push(`${entry.status} capabilities must have blockers`);
    }
    return;
  }
  if ((entry.status === "complete" || entry.status === "invalid") && Array.isArray(entry.blockers) && entry.blockers.length > 0) {
    errors.push(`${entry.status} capabilities must not have blockers`);
  }
}

export function validateCapabilityLaneClassification(entry) {
  const errors = [];
  validateLaneClassification(errors, entry);
  return errors;
}

function validateLaneClassification(errors, entry) {
  const classification = entry.laneClassification;
  if (!isPlainObject(classification)) {
    errors.push("laneClassification must be an object");
    return;
  }
  validateNestedStringField(errors, classification, "laneClassification.patternKind");
  const possibleLanes = classification.possibleLanes;
  if (!Array.isArray(possibleLanes) || possibleLanes.length === 0) {
    errors.push("laneClassification.possibleLanes must be a non-empty array");
  } else {
    for (const lane of possibleLanes) {
      if (!capabilityLaneSet.has(lane)) {
        errors.push(`laneClassification.possibleLanes must contain only ${capabilityLaneNames.join(", ")}`);
        break;
      }
    }
  }
  validateLaneBehavior(errors, classification.strictNative, "laneClassification.strictNative");
  if (possibleLanes?.includes?.("static-native")) {
    validateLaneBehavior(errors, classification.staticNative, "laneClassification.staticNative", "static-native");
    validateRequiredFacts(errors, classification.staticNative, "laneClassification.staticNative.requiredFacts");
  }
  if (possibleLanes?.includes?.("compat-runtime")) {
    validateLaneBehavior(errors, classification.compat, "laneClassification.compat", "compat-runtime");
    validateRequiredFacts(errors, classification.compat, "laneClassification.compat.requiredFacts");
    if (!isPlainObject(classification.compat) || typeof classification.compat.runtimeCarrier !== "string" || classification.compat.runtimeCarrier.length === 0) {
      errors.push("laneClassification.compat.runtimeCarrier must be a non-empty string when lane is compat-runtime");
    } else if (bannedCompatMechanismPattern.test(classification.compat.runtimeCarrier)) {
      errors.push("laneClassification.compat.runtimeCarrier must not name a banned runtime mechanism");
    }
    if (!isPlainObject(classification.compat) || typeof classification.compat.operation !== "string" || classification.compat.operation.length === 0) {
      errors.push("laneClassification.compat.operation must be a non-empty string when lane is compat-runtime");
    }
  }
  if (!isPlainObject(classification.hardReject)) {
    errors.push("laneClassification.hardReject must be an object");
  } else {
    validateLaneBehavior(errors, classification.hardReject, "laneClassification.hardReject", "hard-reject");
  }
  if (!isPlainObject(classification.hardReject) || !Array.isArray(classification.hardReject.reasons) || classification.hardReject.reasons.length === 0) {
    errors.push("laneClassification.hardReject.reasons must be a non-empty array");
  }
}

function validateLaneBehavior(errors, behavior, path, expectedLane) {
  if (!isPlainObject(behavior)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof behavior.lane !== "string" || !capabilityLaneSet.has(behavior.lane)) {
    errors.push(`${path}.lane must be one of ${capabilityLaneNames.join(", ")}`);
    return;
  }
  if (expectedLane !== undefined && behavior.lane !== expectedLane) {
    errors.push(`${path}.lane must be ${expectedLane}`);
  }
}

function validateRequiredFacts(errors, behavior, path) {
  if (!isPlainObject(behavior) || !Array.isArray(behavior.requiredFacts) || behavior.requiredFacts.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return;
  }
  for (const fact of behavior.requiredFacts) {
    if (typeof fact !== "string" || fact.length === 0) {
      errors.push(`${path} must contain only non-empty strings`);
      return;
    }
  }
}

function validateStringField(errors, entry, field) {
  if (typeof entry[field] !== "string" || entry[field].length === 0) {
    errors.push(`${field} must be a non-empty string`);
  }
}

function validateNestedStringField(errors, entry, path) {
  const field = path.split(".").at(-1);
  if (typeof entry[field] !== "string" || entry[field].length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function validateEnumField(errors, entry, field, values, valueList) {
  if (!values.has(entry[field])) {
    errors.push(`${field} must be one of ${valueList.join(", ")}`);
  }
}

function validateStringArrayField(errors, entry, field, options = {}) {
  if (!Array.isArray(entry[field])) {
    errors.push(`${field} must be an array`);
    return;
  }
  if (options.nonEmpty === true && entry[field].length === 0) {
    errors.push(`${field} must be a non-empty array`);
  }
  for (const value of entry[field]) {
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`${field} must contain only non-empty strings`);
      return;
    }
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
