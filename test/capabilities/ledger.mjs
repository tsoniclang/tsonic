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

  ["surface.js.console", "JS console operations use selected JS surface facts", "blocked", "surface-provider"],
  ["surface.js.console-log", "console.log uses selected JS surface facts", "blocked", "surface-provider"],
  ["surface.js.array-methods", "JS array methods use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.string-methods", "JS string methods use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.math-json-regexp", "Math, JSON, and RegExp use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.math", "Math operations use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.object-runtime", "Object runtime operations use selected JS surface facts", "blocked", "surface-provider"],
  ["surface.node.fs-path-process", "node:fs, node:path, and process use selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.buffer-crypto-os", "Buffer, crypto, and os use selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.fs", "node:fs uses selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.process", "node:process uses selected Node surface facts", "partial", "surface-provider"],

  ["compat.mode.strict-native", "Strict-native mode rejects unsupported dynamic behavior", "partial", "target-provider"],
  ["compat.mode.compat", "Compatibility mode enables explicit dynamic carriers", "partial", "target-provider"],
  ["compat.any.property", "any property operations use dynamic carrier facts", "partial", "target-provider"],
  ["compat.any.dynamic-get", "any dynamic get uses explicit carrier facts", "partial", "target-provider"],
  ["compat.any.dynamic-set", "any dynamic set uses explicit carrier facts", "partial", "target-provider"],
  ["compat.any.call-construct", "any call/new use dynamic carrier facts", "partial", "target-provider"],
  ["compat.any.dynamic-call", "any dynamic call uses explicit carrier facts", "partial", "target-provider"],
  ["compat.any.operators", "any operators use dynamic carrier facts", "partial", "target-provider"],
  ["compat.any.typed-boundary-cast", "any typed-boundary casts are explicit", "partial", "target-provider"],
  ["compat.object.no-dynamic-access", "object is not treated like any", "partial", "target-provider"],
  ["compat.unknown.no-dynamic-access", "unknown is not treated like any", "partial", "target-provider"],
  ["compat.prototype-mutation", "Prototype mutation is explicit runtime support or diagnostic", "not-started", "target-provider"],
  ["compat.proxy-eval-function-with", "proxy, eval, Function, and with are rejected unless explicit runtime exists", "not-started", "target-provider"],
  ["runtime.union.carrier", "Union carrier is explicit runtime capability", "not-started", "target-provider"],
  ["runtime.undefined.carrier", "Undefined carrier is explicit runtime capability", "partial", "target-provider"],
  ["runtime.dynamic.carrier", "Dynamic carrier is explicit runtime capability", "partial", "target-provider"],

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
      "Reviewed partial proof: host loads source files into TSTS, excludes generated .d.ts and metadata JSON from semantic input, and passes the backend the TSTS graph files rather than the raw project filesystem crawl.",
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
      "Reviewed partial proof: current host does not discover package roots, generated declaration files, or metadata JSON as semantic input; provider-owned modules must enter through selected target/surface extensions, and package-root shim imports fail closed instead of being rescued by legacy package discovery.",
  }),
  "module.package.exports-subpath": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
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
      "Reviewed partial proof: current provider and surface imports use explicit ESM subpaths, while package-root imports are not treated as bootstrap shims. Full completion requires an explicit package-exports ledger slice rather than relying on TSTS unresolved-module diagnostics alone.",
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
      "Reviewed partial proof: .NET provider records reflected properties, fields, numeric indexers, generic Dictionary indexers, enum fields, static/instance target facts, and event target facts; source declaration conversion omits events and unsupported/non-source-shaped members, while target bindings retain deterministic event/property/field facts. Remains partial until event subscription semantics, property setter facts, field mutability facts, inherited member projection, and unsupported member diagnostics are end-to-end across emitted source.",
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
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/lang/stackalloc/StackAlloc.ts",
      "test/fixtures/param-modifiers/",
    ]),
    notes:
      "Reviewed partial proof: external-current C# tests preserve out, ref, in, optional, and params-array facts with exact reflected signature identity, and reject wrong optional/params arities; remains partial until reflected default-value facts and mutated/missing parameter-mode facts have full negative coverage.",
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
      "Reviewed partial proof: selected JS surface facts cover fixed array length/index access, selected array methods, array callback arities, array for-in, and fail-closed rejection for CLR array mutators without JSArray carrier facts. Remains partial until every Array constructor/from/of/map/set carrier operation and runtime artifact is covered end to end.",
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
      "Reviewed partial proof: selected JS surface facts cover string element access, code-point for-of, and selected string instance calls, while unsupported string methods fail without exact provider-backed JS semantics. Remains partial until all JS String methods and Boolean/String object surface conversions have positive and negative runtime coverage.",
  }),
  "surface.js.console": Object.freeze({
    positiveTests: Object.freeze([]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed blocker: selected JS Console declarations are recognized, but the available C# console runtime takes broad object[] inputs rather than closed TsValue/TsObject/TsFunction carrier facts. The JS surface hard-rejects Console operations from bundled declarations and defers foreign same-spelling declarations; implementation remains blocked until closed console argument carriers and runtime AST emission exist.",
  }),
  "surface.js.console-log": Object.freeze({
    positiveTests: Object.freeze([]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed blocker: console.log is not mapped to Tsonic.CSharp.Js.console.log because that runtime signature is params object[] and would introduce broad CLR object semantics. It remains hard-rejected until selected JS surface facts can prove closed console argument carrier conversion.",
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
      "Reviewed partial proof: selected JS surface facts cover Math runtime method/property operations and RegExp literal/constructor carriers with C# build coverage; JSON operations are hard-rejected until closed JSON carrier facts exist. Remains partial until JSON parse/stringify, Date, Map, Set, and every RegExp operation have selected-surface facts and runtime/toolchain tests.",
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
    positiveTests: Object.freeze([]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-json-typed-parse/",
      "test/fixtures/json-native-inline-stringify/",
      "test/fixtures/json-native-typed-stringify/",
    ]),
    notes:
      "Reviewed blocker: Object and JSON selected standard-library declarations are recognized and fail closed because current runtime entrypoints accept broad object? instead of a closed TsObject/TsArray/TsValue carrier. Object.keys/values/entries and JSON.parse/stringify remain blocked until selected-surface facts can prove the closed carrier and backend AST operation.",
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
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    notes:
      "Reviewed partial proof: reflection provider records unsupported constructor/property/field/method/operator/event members instead of silently dropping static interface members, generic static members, multi-parameter indexers, pointer signatures, and generic operators; remains partial until type-ref conversion drops, constraint drops, default-value omissions, and attribute omissions are explicit diagnostics.",
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
      "Reviewed partial proof: C# target options default to strict-native, strict-native hard-rejects opaque TypeScript any operations before emission, and a test-injected target operation fact cannot rescue strict-native dynamic any behavior. Remains partial until all dynamic operation families and runtime/toolchain diagnostics are covered end to end.",
  }),
  "compat.mode.compat": Object.freeze({
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
      "Reviewed partial proof: explicit typescriptCompatibility=compat is parsed, compat mode still rejects opaque any operations when closed operation facts are missing, and a test-injected closed operation fact permits the operation only in compat mode. Remains partial until real TsValue/TsObject/TsFunction carriers and runtime artifacts exist.",
  }),
  "compat.any.property": Object.freeze({
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
    notes:
      "Reviewed partial proof: opaque any property and element operations are not source-owned dynamic fallbacks; strict-native rejects them, compat rejects missing operation facts, and only explicit operation facts suppress the compat diagnostic. Remains partial until real carrier get/set operations are implemented and emitted.",
  }),
  "compat.any.call-construct": Object.freeze({
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
      "Reviewed partial proof: calls and new expressions through opaque any are diagnosed in strict-native and in compat mode without closed target operation facts; a test-injected closed operation fact can suppress the compat diagnostic for construction only in compat mode. Remains partial until real TsFunction/TsValue construct carriers and backend AST emission exist.",
  }),
  "compat.any.dynamic-get": Object.freeze({
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
    notes:
      "Reviewed partial proof: any property/element reads require closed dynamic get facts; strict-native fails even if a fact is present, while compat mode requires the finalized operation fact before suppressing diagnostics. Remains partial until TsValue.GetProperty/TsObject key semantics are real runtime facts and backend AST output.",
  }),
  "compat.any.dynamic-set": Object.freeze({
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
      "Reviewed partial proof: property writes through any are caught at the opaque any property node and require compat carrier operation facts rather than backend assignment guessing. Remains partial until explicit set/delete/update operation facts and runtime AST emission exist.",
  }),
  "compat.any.dynamic-call": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    notes:
      "Reviewed partial proof: calls through opaque any record no selected signature and emit deterministic missing-operation diagnostics in strict-native and compat-without-facts. Remains partial until TsFunction/TsValue call operation facts and target AST emission exist.",
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
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed partial proof: TypeScript object is not promoted to opaque any, receives no dynamic runtime carrier, and property access remains a TSTS source diagnostic rather than target/provider recovery. Remains partial until all object surface operations are separately classified as object-shape, provider adapter, compat carrier, or hard reject.",
  }),
  "compat.unknown.no-dynamic-access": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs",
    ]),
    notes:
      "Reviewed partial proof: unknown is not promoted to opaque any, receives no dynamic runtime carrier, and property access remains a TSTS source diagnostic. Old object-literal-unknown coverage is mapped as fail-closed evidence, not as a legacy lowering pattern.",
  }),
  "runtime.dynamic.carrier": Object.freeze({
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
    notes:
      "Reviewed partial proof: the current runtime carrier fact for TypeScript any is opaque and non-renderable by itself; dynamic behavior requires separate operation facts and mode checks. Remains partial until concrete TsValue/TsObject/TsFunction carriers, backend AST emission, and runtime artifacts exist.",
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
    positiveTests: Object.freeze([]),
    negativeTests: Object.freeze([]),
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
      "Reviewed partial proof: every reviewed old C# emitter inventory case is now represented as backend.ast.only ledger evidence; old cases remain regression evidence only, and completion still requires current positive/negative Roslyn AST tests for each capability batch.",
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
