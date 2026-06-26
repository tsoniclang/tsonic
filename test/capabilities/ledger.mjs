export const capabilityStatuses = Object.freeze([
  "not-started",
  "partial",
  "complete",
  "blocked",
  "invalid",
]);

export const capabilityEvidenceReviewStatuses = Object.freeze([
  "seeded",
  "reviewed",
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

export const capabilityCompatRuntimeCarriers = Object.freeze([
  "GeneratedProviderAdapter",
  "SelectedSurfaceRuntime",
  "TsArray",
  "TsFunction",
  "TsIterator",
  "TsObject",
  "TsThrownValueException",
  "TsUnion",
  "TsValue",
]);

const capabilityStatusSet = new Set(capabilityStatuses);
const capabilityEvidenceReviewStatusSet = new Set(capabilityEvidenceReviewStatuses);
const capabilityOwnerSet = new Set(capabilityOwners);
const capabilityLaneSet = new Set(capabilityLaneNames);
const capabilityCompatRuntimeCarrierSet = new Set(capabilityCompatRuntimeCarriers);
const bannedCompatMechanismPattern = /QuickJS|Reflection|dynamic|GetProperty|GetProperties|GetMethod|GetMethods|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load/u;

export const coreLangIntrinsicModuleSpecifier = "@tsonic/core/lang.js";

export const coreLangIntrinsicCoverage = Object.freeze([
  { exportName: "out", factSlug: "out", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.out" },
  { exportName: "ref", factSlug: "ref", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.ref" },
  { exportName: "inref", factSlug: "inref", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.inref" },
  { exportName: "borrow", factSlug: "borrow", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.borrow" },
  { exportName: "borrowMut", factSlug: "borrow-mut", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.borrow-mut" },
  { exportName: "move", factSlug: "move", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.move" },
  { exportName: "struct", factSlug: "struct", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.struct" },
  { exportName: "field", factSlug: "field", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.field" },
  { exportName: "attribute", factSlug: "attribute", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.attribute" },
  { exportName: "defaultof", factSlug: "defaultof", sourceKind: "call-marker", capabilityId: "source-core.lang.portable-intrinsics.defaultof" },
  { exportName: "ptr", factSlug: "ptr", sourceKind: "type-marker", capabilityId: "source-core.lang.portable-intrinsics.ptr" },
  { exportName: "fnptr", factSlug: "fnptr", sourceKind: "type-marker", capabilityId: "source-core.lang.portable-intrinsics.fnptr" },
].map(freezeCoreLangIntrinsicCoverageEntry));

const coreLangIntrinsicCoverageByCapabilityId = new Map(
  coreLangIntrinsicCoverage.map((entry) => [entry.capabilityId, entry]),
);
const coreLangIntrinsicSourceKindSet = new Set(["call-marker", "type-marker"]);
const coreLangUnsupportedTargetBehaviorSet = new Set(["deterministic-diagnostic"]);

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
  ["host.project.surface-dependency-validation", "Validate selected surface dependency graph before providers run", "partial", "tsonic-host"],
  ["host.project.provider-composition", "Compose provider set for a compile session", "complete", "tsonic-host"],
  ["host.project.surface-extension-composition", "Compose selected surface extensions as first-class compiler contributors", "complete", "tsonic-host"],
  ["host.project.module-graph", "Create one deterministic project module graph from TSTS source files", "partial", "tsonic-host"],
  ["host.project.package-path-resolution", "Resolve project packages, package exports, and paths without package-root shims", "partial", "tsonic-host"],
  ["host.project.deterministic-output-paths", "Derive deterministic output paths from validated project-relative source paths", "partial", "tsonic-host"],
  ["host.project.clean-rebuild", "Clean rebuild removes stale target artifacts without preserving legacy output", "partial", "tsonic-host"],
  ["host.project.top-level-initialization-order", "Preserve deterministic module top-level initialization order", "partial", "tsonic-host"],

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
  ["provider.virtual-module.overload-identity", "Provider supplies exact overload/member identity", "complete", "target-provider"],
  ["provider.module.virtual-import", "Provider-backed virtual imports become compiler state", "partial", "target-provider"],
  ["provider.module.no-file-backed-fallback", "Provider module resolution has no declaration-file fallback", "complete", "target-provider"],
  ["provider.module.missing-provider-diagnostic", "Missing provider-owned modules produce diagnostics", "complete", "target-provider"],

  ["source-core.module.single-owner", "@tsonic/core source modules are owned once by the source-core provider, not replicated by target packs", "partial", "source-core-provider"],
  ["source-core.target-alias-consumption", "Target packs consume source-core facts and add target-specific aliases without redefining portable core contracts", "partial", "target-provider"],
  ["source.primitive.numeric", "Neutral source numeric primitives attach facts", "partial", "source-core-provider"],
  ["source.primitive.char-bool", "Neutral char and bool primitives attach facts", "partial", "source-core-provider"],
  ["source.primitive.configured-type", "Configured source primitive aliases map to canonical facts", "partial", "source-core-provider"],
  ["source.marker.out-ref-inref", "out, ref, and inref markers attach storage facts", "partial", "source-core-provider"],
  ["source.marker.field", "field marker attaches storage facts", "partial", "source-core-provider"],
  ["source.marker.struct", "struct marker attaches value-type source facts", "partial", "source-core-provider"],
  ["source.marker.attribute", "attribute marker attaches target attribute facts", "partial", "source-core-provider"],
  ["source.marker.defaultof", "defaultof marker attaches target default facts", "partial", "source-core-provider"],
  ["source.marker.ptr-fnptr", "pointer and function-pointer markers attach target-validated facts", "partial", "source-core-provider"],
  ["source.marker.borrow-move", "borrow, borrowMut, and move markers attach target-validated flow facts", "partial", "source-core-provider"],
  ["source-core.out.storage-binding", "out marker resolves to assignable storage", "partial", "source-core-provider"],
  ["source-core.ref.parameter-mode", "ref and inref markers resolve to parameter passing facts", "partial", "source-core-provider"],
  ["source-core.struct.field-facts", "struct and field markers combine into value-shape facts", "partial", "source-core-provider"],
  ["source-core.flow.borrow-move-facts", "borrow and move source facts require explicit target behavior", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics", "@tsonic/core/lang.js intrinsics require portable facts and per-target implementation or rejection", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.out", "out intrinsic attaches neutral write-only byref storage facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.ref", "ref intrinsic attaches neutral read-write byref storage facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.inref", "inref intrinsic attaches neutral read-only byref storage facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.borrow", "borrow intrinsic attaches neutral shared-borrow flow facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.borrow-mut", "borrowMut intrinsic attaches neutral mutable-borrow flow facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.move", "move intrinsic attaches neutral moved-value flow facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.struct", "struct intrinsic attaches neutral value-type shape facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.field", "field intrinsic attaches neutral field facts from explicit type evidence", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.attribute", "attribute intrinsic attaches neutral attribute application facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.defaultof", "defaultof intrinsic attaches neutral target-default value facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.ptr", "ptr intrinsic attaches neutral pointer type facts", "partial", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.fnptr", "fnptr intrinsic attaches neutral function-pointer type facts", "partial", "source-core-provider"],

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
  ["type.assertion", "Type assertions consume TSTS type facts and target casts", "complete", "tsts-api"],
  ["type.non-null-assertion", "Non-null assertions consume TSTS nullable facts", "partial", "tsts-api"],
  ["type.generic.provider-target-arguments", "Map TSTS-inferred type arguments to target type arguments", "partial", "target-provider"],
  ["type.generic.provider-target-constraints", "Validate provider target generic constraints", "partial", "target-provider"],

  ["operation.call.provider-selected-method", "Provider-owned calls emit from selected signature facts", "complete", "target-provider"],
  ["operation.call.provider-argument-conversion", "Provider-owned calls record target argument conversion facts", "partial", "target-provider"],
  ["operation.call.provider-parameter-mode", "Provider-owned calls record parameter mode facts", "partial", "target-provider"],
  ["operation.construct.provider-selected-constructor", "Provider-owned constructors emit from selected constructor facts", "complete", "target-provider"],
  ["operation.constructor.provider-selected-target", "Constructors map to selected target constructor facts", "complete", "target-provider"],
  ["operation.property.provider-selected-member", "Provider-owned property access emits from selected member facts", "complete", "target-provider"],
  ["operation.member.provider-property", "Member properties map through selected provider declarations", "complete", "target-provider"],
  ["operation.member.provider-indexer", "Member indexers map through selected provider declarations", "complete", "target-provider"],
  ["operation.member.no-name-guess", "Target member mapping cannot guess from source spelling", "complete", "target-provider"],
  ["operation.element.provider-indexer", "Element access emits from selected indexer or carrier facts", "complete", "target-provider"],
  ["operation.operator.checked-target-operation", "Operators emit from checked target operation facts", "partial", "target-provider"],
  ["operation.conversion.checked-target-conversion", "Target conversions are explicit facts", "complete", "target-provider"],
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
  ["carrier.array.public-abi-policy", "Source T[] remains TS Array<T>; public target ABI uses fact-backed IEnumerable/IReadOnlyList/List/native-array/compat lanes without leaking JSArray by default", "partial", "target-provider"],
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
  ["surface.js.array-constructor", "JS Array construction uses selected JS surface facts or diagnostics", "partial", "surface-provider"],
  ["surface.js.array.length-index", "JS array length and index operations use selected array carrier facts", "partial", "surface-provider"],
  ["surface.js.array.sparse-delete-holes", "JS array delete, sparse slots, holes, and length mutation require closed JSArray semantics or diagnostics", "partial", "surface-provider"],
  ["analysis.abstraction.policy-enforcement", "Generic analysis code is driven by policy, provider metadata, finalized facts, or explicit exceptions instead of source-family and target-member algorithm branches", "complete", "tests"],
  ["surface.js.string-methods", "JS string methods use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.boolean-methods", "JS Boolean primitive methods use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.number-methods", "JS Number primitive and static operations use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.math-json-regexp", "Math, JSON, and RegExp use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.map-set", "Map and Set use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.math", "Math operations use selected JS surface facts", "partial", "surface-provider"],
  ["surface.js.date", "Date operations use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.object-runtime", "Object runtime operations use selected JS surface facts", "partial", "surface-provider"],
  ["surface.node.fs-path-process", "node:fs, node:path, and process use selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.buffer-crypto-os", "Buffer, crypto, and os use selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.fs", "node:fs uses selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.fs-stats-date", "node:fs Stats Date members use selected Node and JS surface facts", "partial", "surface-provider"],
  ["surface.node.process", "node:process uses selected Node surface facts", "partial", "surface-provider"],
  ["surface.node.util", "node:util uses selected Node surface facts and rejects open-carrier helpers without fallback", "partial", "surface-provider"],
  ["surface.node.url", "node:url uses selected Node surface facts and rejects open-object URL helpers without fallback", "partial", "surface-provider"],

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
  ["native.dotnet.constructors", ".NET provider models constructors and accessibility", "complete", "target-provider"],
  ["native.dotnet.parameter-modes", ".NET provider models out, ref, in, optional, default, and params array parameters", "partial", "target-provider"],
  ["native.dotnet.attributes", ".NET provider models attributes, constructors, and named args", "partial", "target-provider"],
  ["native.dotnet.constraints", ".NET provider models target generic constraints", "partial", "target-provider"],
  ["native.dotnet.conversions", ".NET provider models implicit and explicit conversions", "partial", "target-provider"],
  ["native.dotnet.array.explicit", "Provider-owned @tsonic/dotnet native Array<T> gives explicit CLR array interop without changing normal TS Array<T> semantics", "partial", "target-provider"],
  ["native.dotnet.unsupported-diagnostics", ".NET provider reports deterministic unsupported-member diagnostics", "partial", "target-provider"],

  ["diagnostic.missing-target-fact", "Missing target facts produce deterministic diagnostics", "partial", "target-provider"],
  ["diagnostic.missing-provider-fact", "Missing provider facts produce deterministic diagnostics", "partial", "target-provider"],
  ["diagnostic.unsupported-surface", "Unsupported selected surfaces produce diagnostics", "partial", "surface-provider"],
  ["diagnostic.unsupported-selected-surface-operation", "Unsupported selected surface operations fail closed with provider diagnostics", "partial", "surface-provider"],
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
  ["architecture.native-compilable.esm-only", "Product compiler/runtime source remains ESM-only and native-compilable", "complete", "tests"],
  ["architecture.native-compilable.no-unapproved-deps", "Product compiler/runtime paths avoid unapproved third-party dependencies", "complete", "tests"],
  ["architecture.target-pack.boundaries", "Target pack packages keep provider, surfaces, backend, runtime, and toolchain as explicit modules", "complete", "tests"],
  ["architecture.target-pack.no-catch-all-semantics", "Target packs avoid catch-all semantic blobs and hidden source-family helpers", "complete", "tests"],
  ["architecture.target-pack.no-procedural-policy", "Policy files are declarative data, generic selectors, or explicit exception records only", "complete", "tests"],
  ["target.csharp.source-flow-marker-contract", "C# explicitly implements or rejects portable source flow markers", "partial", "target-provider"],
  ["target.csharp.core-lang-intrinsics", "C# implements or rejects every portable @tsonic/core/lang.js intrinsic from finalized facts", "partial", "target-provider"],
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
      "Reviewed partial proof: targets[] is mandatory and non-empty, target ids must be safe canonical output path segments, duplicate target ids are rejected before compilation, unknown selected target ids become TARGET_SELECTION diagnostics, and target-specific options are delegated to the selected target pack rather than host-level guessing.",
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
      "Reviewed partial proof: configured surfaces are explicit target-owned canonical ids, unsafe surface ids and duplicate requested surfaces are rejected, unknown target surfaces and missing required surfaces become TARGET_SURFACE_SELECTION diagnostics, and unselected surfaces cannot contribute compiler extensions or runtime artifacts.",
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
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "module.import.default remains partial until default imports are mapped to old fixture coverage and backend emission capabilities.",
    ]),
    notes:
      "Reviewed partial proof: default relative ESM imports are resolved by TSTS source graph and CLI C# emission uses the selected TSTS export symbol for default function imports; hidden generated declaration and package discovery fallbacks are rejected.",
  }),
  "module.import.namespace": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
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
      "Reviewed partial proof: namespace relative ESM imports are resolved by TSTS source graph and CLI C# emission dereferences the resolved project source symbol instead of backend source-name or package fallback discovery.",
  }),
  "module.import.type-only": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/multi-file-types/",
    ]),
    blockers: Object.freeze([
      "module.import.type-only remains partial until every old import-type fixture is mapped and invalid type-only-as-value forms have current focused diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: type-only relative ESM imports participate in the TSTS source graph without creating generated declaration fallback input, CLI runtime proof shows type-only dependencies do not trigger generated C# module initialization, and imported interface annotations can drive object-shape adapter facts without forcing the imported type-only module to run.",
  }),
  "module.import.side-effect": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/top-level-code/",
    ]),
    blockers: Object.freeze([
      "module.import.side-effect remains partial until every old side-effect import fixture and package-style side-effect import path is mapped to current TSTS module graph expectations.",
    ]),
    notes:
      "Reviewed partial proof: side-effect relative ESM imports enter the TSTS-resolved module dependency graph and are runtime-verified through generated C# static module initializers; package-style side-effect import parity remains tracked separately.",
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
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "module.export.default remains partial until default class exports and every old default-export fixture form are mapped to current backend emission capabilities.",
    ]),
    notes:
      "Reviewed partial proof: default exports participate in TSTS module graph resolution, CLI C# emission uses TSTS symbols for default export expression snapshots and default function imports, and the host does not synthesize default export declarations.",
  }),
  "module.export.reexport": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([
      "test/fixtures/barrel-reexports/",
    ]),
    blockers: Object.freeze([
      "module.export.reexport remains partial until export-star, aliased re-export, and source-package re-export fixture coverage is fully mapped.",
    ]),
    notes:
      "Reviewed partial proof: aliased named re-exports, default re-exports, export-star, and export-star-as edges enter through TSTS module graph rather than host-side barrel scanning, with CLI C# emission preserving export-star module initialization before re-exported values are read.",
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
      "Reviewed partial proof: ordinary package exports/subpaths that resolve to source files enter through the TSTS graph, provider and surface imports use explicit ESM subpaths, and package-root imports, declaration-only package exports, and same-named package files outside the selected package export target are not treated as bootstrap shims or hidden generated-declaration fallbacks.",
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
  "module.emit.multi-file": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-output-identity.test.mjs",
      "../tsonic-csharp/test/module-graph.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-output-identity.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/multi-file/",
      "test/fixtures/multi-file-imports/",
      "test/fixtures/namespace-imports/",
    ]),
    blockers: Object.freeze([
      "module.emit.multi-file remains partial until every old multi-file/source-package fixture is classified and every exported declaration form has current CLI/toolchain proof.",
    ]),
    notes:
      "Reviewed partial proof: the C# backend emits one Roslyn compilation unit per non-declaration project source file and derives artifact/class identity only from validated project-relative TSTS source graph paths. It rejects outside-root files, deterministic class/artifact path collisions, and attempts to plan source artifacts without the validated output identity registry. It no longer inspects top-level source declaration names as a hidden collision-avoidance heuristic; future same-file target declaration collisions must be deterministic diagnostics or stable naming policy, not source-name guessing.",
  }),
  "module.emit.top-level-order": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/entrypoint-planner.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/entrypoint-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/top-level-code/",
      "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
    ]),
    blockers: Object.freeze([
      "module.emit.top-level-order remains partial until export initialization, cycles, package-style imports, and all old module/top-level fixtures have current runtime proof.",
    ]),
    notes:
      "Reviewed partial proof: C# emission now evaluates runtime imports through static constructors before importer top-level statements, keeps top-level field initializers inside module initialization order rather than C# field initializers, synthesizes an executable entrypoint only for Exe outputs, and does not synthesize an entrypoint for library outputs.",
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
  "host.project.surface-dependency-validation": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "host.project.surface-dependency-validation has focused proof for selected surface dependencies, but remains partial until old surface profile inventory is fully mapped to target-owned surface dependencies.",
    ]),
    notes:
      "Reviewed partial proof: selected surfaces are validated against target-owned requiredSurfaces before provider, surface extension, runtime contribution, backend, or toolchain execution. Missing dependencies produce TARGET_SURFACE_SELECTION diagnostics and no target artifacts.",
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
  "host.project.deterministic-output-paths": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
      "test/architecture-contract.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
      "test/architecture-contract.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "host.project.deterministic-output-paths has target-id and artifact containment proof, but remains partial until every backend artifact family is covered by deterministic output identity tests.",
    ]),
    notes:
      "Reviewed partial proof: target ids and selected surface ids are safe canonical path segments; target pack and surface ids are registry-validated; target output roots are resolved under the configured outDir; CLI artifact writing rejects absolute or escaping artifact paths before writing.",
  }),
  "host.project.clean-rebuild": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "host.project.clean-rebuild has focused stale-artifact proof for CLI output, but remains partial until runtime assets, multi-target projects, diagnostic-only targets, and every toolchain artifact family are covered.",
    ]),
    notes:
      "Reviewed partial proof: CLI build removes the selected target output root before writing current artifacts, so stale generated source/runtime files do not survive a clean rebuild. Target-id validation and artifact containment prevent clean rebuild from escaping the configured output root.",
  }),
  "tsts.parse-bind-check": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/target-config.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/target-config.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator.test.ts",
      "packages/frontend/src/validator.maximus.test.ts",
    ]),
    blockers: Object.freeze([
      "tsts.parse-bind-check remains partial until every legacy frontend validator assumption is mapped to a current TSTS diagnostic or provider-fact capability and every target build path proves no artifact emission after TSTS source rejection.",
    ]),
    notes:
      "Reviewed partial proof: current CLI type-form tests consume TSTS parse/bind/check results for accepted source forms and reject incompatible source programs before target artifacts are emitted. Source-core tests prove extension facts attach after ordinary TSTS binding rather than replacing TypeScript checking.",
  }),
  "tsts.flow-narrowing": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "tsts.flow-narrowing remains partial until every narrowing family used by supported emission has current positive and fail-closed proof: typeof, instanceof, equality, discriminants, nullish checks, truthiness policy, optional chains, and provider-owned runtime carrier facts.",
    ]),
    notes:
      "Reviewed partial proof: typeof and object-shape flow tests consume TSTS-narrowed source meaning before backend planning. The backend still requires selected target facts for the narrowed operation, so narrowing evidence cannot turn an unsupported target operation into emission.",
  }),
  "tsts.contextual-typing": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "tsts.contextual-typing remains partial until lambdas, object literals, array literals, callback parameters, generic callbacks, provider delegates, optional/rest parameters, and missing-context diagnostics are all proven through current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: current executable and declaration tests emit contextually typed lambdas and reject lambdas without finalized contextual delegate/function facts. TSTS supplies the source callable meaning; target emission remains fact-gated.",
  }),
  "tsts.generic-inference": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/generic-validation.test.ts",
      "packages/frontend/src/validator-maximus-cases/generic-function-values.test.ts",
    ]),
    blockers: Object.freeze([
      "tsts.generic-inference remains partial until generic functions, methods, constructors, callbacks, object-shape inference, provider generic members, constraint failures, and target type-argument mapping all have current positive and fail-closed evidence.",
    ]),
    notes:
      "Reviewed partial proof: current module/declaration and provider tests emit source generic calls, contextual generic source calls, provider generic collection constructors, and provider generic constraint diagnostics from TSTS-selected source signatures plus target facts; no backend generic inference fallback is counted as proof.",
  }),
  "tsts.overload-resolution": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "tsts.overload-resolution remains partial until source overloads, provider overloads, constructors, generic methods, extension receivers, optional/rest/params arity, and unsupported selected overload diagnostics are covered across current CLI and provider tests.",
    ]),
    notes:
      "Reviewed partial proof: current provider CLI tests accept .NET overloads selected through TSTS/provider virtual declarations and reject unsupported or unselected provider operations without searching by source spelling. Target providers map the selected source signature to target identity after TSTS source resolution.",
  }),
  "tsts.consumer-queries": Object.freeze({
    positiveTests: Object.freeze([
      "packages/tsts/src/services/embedding-api.test.ts",
      "packages/source-core/src/source-extension.test.ts",
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/tsts/src/services/embedding-api.test.ts",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator.test.ts",
    ]),
    blockers: Object.freeze([
      "tsts.consumer-queries remains partial until every backend consumption path is proven to use public TSTS queries/finalized facts rather than compiler internals or legacy frontend analysis.",
      "Provider virtual declaration consumer queries do not yet expose a truthful default-export/default-alias contract, so provider-backed default imports such as import fs from 'node:fs' cannot be implemented without a TSTS API addition.",
    ]),
    notes:
      "Reviewed partial proof: embedding/source-core tests use public TSTS consumer queries for facts and diagnostics, and host tests route compiler sessions through composed extensions instead of raw filesystem crawling. Remaining proof must be capability-specific per backend consumer.",
  }),
  "tsts.type-query.flow-narrowed-type": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "tsts.type-query.flow-narrowed-type remains partial until backend consumers prove every supported narrowed operation queries TSTS flow type or selected finalized facts at the use site, including provider and runtime-carrier cases.",
    ]),
    notes:
      "Reviewed partial proof: typeof narrowing CLI evidence shows emitter-visible operations are based on TSTS flow decisions plus selected target runtime-kind facts, and standalone typeof without those facts remains a diagnostic rather than backend inference.",
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
  "tsts.program.create-with-extensions": Object.freeze({
    positiveTests: Object.freeze([
      "packages/tsts/src/services/embedding-api.test.ts",
      "packages/tsts/src/extensions/extension-host.test.ts",
    ]),
    negativeTests: Object.freeze([
      "packages/tsts/src/extensions/extension-host.test.ts",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "tsts.program.create-with-extensions remains partial until old extension-host/frontend integration evidence is explicitly mapped in the old product unit inventory.",
    ]),
    notes:
      "Reviewed proof: TSTS compiler sessions can be created with provider/source extensions through the public embedding path, extension attachment contributes compiler-visible facts, and malformed extension configuration is rejected before consumers run.",
  }),
  "tsts.diagnostic.provider-sourced": Object.freeze({
    positiveTests: Object.freeze([
      "packages/tsts/src/extensions/provider-program.test.ts",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "packages/tsts/src/extensions/provider-program.test.ts",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "tsts.diagnostic.provider-sourced remains partial until old validator/source-extension diagnostics evidence is explicitly mapped in the old product unit inventory.",
    ]),
    notes:
      "Reviewed proof: provider and source extensions surface diagnostics through standard TSTS diagnostics with deterministic codes, source spans, and no backend artifact fallback.",
  }),
  "type.utility": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.utility remains partial until utility type coverage includes Partial/Required/Readonly/Pick/Omit/Record/Exclude/Extract/NonNullable/ReturnType/Parameters/Awaited across object, callable, provider, and source-core primitive boundaries.",
    ]),
    notes:
      "Reviewed partial proof: Extract is accepted or rejected by TSTS before backend emission, and the C# backend consumes the resolved string source shape without preserving utility type syntax or reimplementing utility type compatibility.",
  }),
  "type.conditional": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.conditional remains partial until distributive/non-distributive conditionals, generic constraints, provider virtual types, source-core primitives, nested conditions, and negative assignability proof are covered through current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: conditional type aliases resolve through TSTS, including tuple-head extraction, and invalid assignment to the resolved conditional result stops before backend artifacts are produced.",
  }),
  "type.mapped": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.mapped remains partial until readonly/optional modifiers, key remapping, template literal keys, provider virtual declarations, source-core primitive fields, and object-literal freshness are proven end to end.",
    ]),
    notes:
      "Reviewed partial proof: mapped type aliases are resolved by TSTS and consumed through indexed access as ordinary source types in C# emission; backend output contains no mapped-type syntax or source-name inference.",
  }),
  "type.indexed-access": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.indexed-access remains partial until tuple, array, object, union-key, keyof, mapped-type, provider virtual declaration, and invalid key forms are covered by current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: indexed access into a mapped type resolves to string via TSTS and an incompatible numeric assignment is rejected by TSTS before backend artifacts are produced.",
  }),
  "type.keyof": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.keyof remains partial until object, array, tuple, mapped, provider virtual declaration, symbol/numeric key, and key-remapping forms are proven across current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: keyof drives a mapped type entirely inside TSTS; C# emission consumes the resolved value type and does not inspect source property names as type evidence.",
  }),
  "type.infer": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.infer remains partial until nested infer positions, rest tuple inference, callable return/parameter inference, provider generic types, source-core primitive aliases, and failing inference branches are covered.",
    ]),
    notes:
      "Reviewed partial proof: infer in a conditional tuple type resolves through TSTS to the selected tuple head, and backend emission consumes the resolved string type without implementing infer semantics.",
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
  "type.non-null-assertion": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "type.non-null-assertion remains partial until expression, property, call, provider-owned, source-core primitive, generic, and optional-chain forms are covered with current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: non-null assertion is checked by TSTS, valid source emits the underlying expression without backend nullability inference, and invalid member access after the assertion is rejected by TSTS before backend artifacts are produced.",
  }),
  "type.assertion": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
      "packages/targets/csharp/emitter/testcases/common/types/variable-decls/VariableDecls.ts",
    ]),
    notes:
      "Reviewed proof: TypeScript assertion wrappers erase after TSTS validation, source primitive and reference assertions emit only from finalized C# conversion facts, and broad object assertions fail closed without finalized carrier facts.",
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
      "Reviewed partial proof: .NET provider imports such as @tsonic/dotnet/System.js and @tsonic/dotnet/System.Reflection.js become TSTS compiler virtual modules, including cross-module inherited member refs whose provider-ref module ownership is preserved instead of rewritten to the inheriting base module. Sliced imports and encoded dependency modules now preserve requested export slices through declaration-model loading instead of upgrading dependencies to broad namespace imports.",
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
      "../tsonic-csharp/test/dotnet-provider-performance.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-performance.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
      "packages/cli/src/commands/restore.test.ts",
    ]),
    blockers: Object.freeze([
      "provider.virtual-module.no-fallback remains partial until every provider-owned module failure mode has current CLI/toolchain coverage and precise diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: provider-owned virtual modules have no generated declaration, metadata JSON, package-root shim, or file-backed compatibility lane; selected .NET modules win over shadow package files, missing provider facts remain diagnostics/blockers, unsliced .NET provider module/declaration requests fail before provider loading instead of silently widening to a broad import, and sliced requests fail closed when a requested export is not provider-proven.",
  }),
  "provider.virtual-module.source-shape": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-performance.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-performance.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
    ]),
    blockers: Object.freeze([
      "provider.virtual-module.source-shape remains partial until all source-visible shape families, inherited declarations, target-only omissions, unsupported exports, and selected surface modules are proven end to end.",
    ]),
    notes:
      "Reviewed partial proof: reflected .NET declarations produce source-visible provider shapes for classes, delegates, properties, methods, constructors, overloads, inherited members, and explicit unsupported omissions; dependency declarations are resolved through exact requested export slices; sliced System imports expose only requested declarations such as Convert instead of broad unrelated namespaces such as System.Xml or System.ComponentModel; unsupported by-ref delegate returns remain target-only instead of leaking fake source declarations.",
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
      "Reviewed proof: selected providers create compiler-visible modules; .d.ts, provider metadata files, package-root shims, and shadow package source files cannot replace provider-owned virtual modules, so unselected or missing provider modules fail closed without file-backed fallback.",
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
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "provider.virtual-module.constraints remains partial until all reflected constraint families, inherited generic substitutions, source-level provider diagnostics, and CLI/toolchain paths are covered; current proof covers target-only declaration preservation and selected C# target constraint validation but not the full provider matrix.",
    ]),
    notes:
      "Reviewed partial proof: provider virtual declarations keep target-only generic constraints out of source-visible TypeScript shapes while retaining full reflected target binding facts for backend/provider consumers, including C# notnull as a target-specific constraint and unsupported target-only constraints as deterministic rejected target facts. The C# semantic provider validates those constraints only from finalized target facts after TSTS has accepted source syntax, and source primitive constraints are accepted only when reflected primitive target bindings prove the exact implemented contract and type arguments. Old TypeScript constraint fixtures are not mapped here because they prove source generic declarations, not provider-owned virtual-module constraints.",
  }),
  "source.primitive.numeric": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/numeric-primitives.test.ts",
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    blockers: Object.freeze([
      "source.primitive.numeric remains partial until every neutral numeric width, decimal/native alias, numeric literal flow, assertion/conversion boundary, and backend carrier emission has positive and negative proof.",
    ]),
    notes:
      "Reviewed partial proof: @tsonic/core/types.js exposes neutral bool, char, int8 through uint128, nativeInt/nativeUint, float16/32/64, and decimal without C# alias names; source-core package tests prove every primitive export carries exact width, sign, runtimeBase, and module identity through direct, aliased, and namespace imports, while same-spelling local imports and aliases do not create source-primitive facts.",
  }),
  "source.primitive.char-bool": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/char-primitive/",
    ]),
    blockers: Object.freeze([
      "source.primitive.char-bool remains partial until char literal/Rune interop, bool flow through operators/calls, backend carrier emission, and invalid char/bool source forms have positive and negative proof.",
    ]),
    notes:
      "Reviewed partial proof: neutral bool and char imports attach source-primitive facts with boolean and string runtime bases, char width/sign data is preserved, bool field facts flow through struct field collection, and source-core package tests prove direct/alias/namespace imports plus local same-spelling no-guessing behavior. Old char-primitive coverage is broader than the current backend proof and remains regression evidence only.",
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
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/param-modifiers/",
    ]),
    blockers: Object.freeze([
      "source.marker.out-ref-inref remains partial until every assignable storage form, non-storage diagnostic, call/constructor propagation path, mutation flow, and emitted parameter-mode AST path is proven.",
    ]),
    notes:
      "Reviewed partial proof: imported and namespace out/ref/inref markers attach byref-writeonly-must-init, byref-readwrite, and byref-readonly argument-passing facts for identifier, property, and element storage; unproven storage like out(value + 1) produces SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT; local and shadowed same-spelling functions do not create marker facts.",
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
      "test/fixtures/struct-basic/",
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
    negativeTests: Object.freeze([
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/comprehensive/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/targets/Attributes.ts",
    ]),
    blockers: Object.freeze([
      "source.marker.attribute remains partial until unsupported constructor/named argument values, every placement target, and generated declaration attribute AST output are proven.",
    ]),
    notes:
      "Reviewed partial proof: provider-backed attribute<User>() selectors attach attribute facts for type, constructor, constructor parameter, method, return, method parameter, property, and field-target placements with exact application targets and arguments. Missing explicit attribute target evidence, unproven selector bodies, non-literal parameter names, and non-literal target specifiers now fail closed with source-semantics diagnostics. Unsupported constructor/named argument value diagnostics and end-to-end emission breadth remain open.",
  }),
  "source.marker.defaultof": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/defaultof-intrinsic/",
    ]),
    blockers: Object.freeze([
      "source.marker.defaultof remains partial until default facts cover primitive, struct, nullable, reference, provider generic, and emitted target-default expression cases.",
    ]),
    notes:
      "Reviewed partial proof: defaultof<char>() attaches a default-value fact whose type is the finalized source type node. Missing explicit default type evidence now fails closed with SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE. Old defaultof-intrinsic coverage remains regression evidence for future backend emission, not proof that every target default lane is complete.",
  }),
  "source.marker.ptr-fnptr": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "test/fixtures/pointer-types/",
    ]),
    blockers: Object.freeze([
      "source.marker.ptr-fnptr remains partial until pointer/function-pointer facts cover explicit mutability variants, non-arity invalid type-argument forms, provider pointer boundaries, source spans, and all selected-target diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: neutral ptr<int32> and fnptr<[int32, bool], char> aliases plus core namespace marker imports attach pointer and function-pointer facts with target-defined mutability, unsafe requirements, parameter/result type nodes, and target-default ABI; local same-spelling markers do not attach facts, invalid arity is rejected by TSTS checking, C# CLI emits unsafe pointer/function-pointer output from finalized neutral facts, and .NET provider tests prove unsupported pointer signatures are target diagnostics instead of source declarations.",
  }),
  "source.marker.borrow-move": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "source.marker.borrow-move remains partial until borrow, borrowMut, and move have complete per-target behavior evidence for C#, future Rust, and post-move/borrow flow-use diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: neutral @tsonic/core/lang.js borrow, borrowMut, and move calls attach finalized TSTS flow facts from alias and namespace imports, local/shadowed same-spelling calls do not attach facts, invalid no-argument and extra-argument calls are rejected by TSTS checking without source-core facts, and source-core keeps flow facts on the exact marker call plus argument subjects rather than marking later use-sites as validated. The C# target now rejects those facts explicitly with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED instead of silently erasing the marker calls.",
  }),
  "source-core.out.storage-binding": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/param-modifiers/",
    ]),
    blockers: Object.freeze([
      "source-core.out.storage-binding remains partial until destructured, provider-owned, readonly/non-assignable, source-span, and every selected-target byref write path have closed positive and negative proof.",
    ]),
    notes:
      "Reviewed partial proof: out(value), namespace out(box.field), and property storage record write-only byref facts, while out(value + 1) records the same marker shape but emits SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT because the argument is not assignable storage.",
  }),
  "source-core.ref.parameter-mode": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/param-modifiers/",
    ]),
    blockers: Object.freeze([
      "source-core.ref.parameter-mode remains partial until ref/inref facts are consumed by every call, constructor, delegate, provider overload, invalid readonly, source-span, and emitted target parameter path.",
    ]),
    notes:
      "Reviewed partial proof: ref(value), inref(value), namespace ref(value), and element/property storage attach readwrite and readonly parameter-mode facts to proven storage; local and shadowed functions named like markers do not receive source-core parameter facts. Remaining proof must connect those facts through provider selection and C# AST emission.",
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
  "source-core.flow.borrow-move-facts": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "source-core.flow.borrow-move-facts remains partial until post-borrow/post-move source-flow checks and every selected target either implements or rejects the finalized facts with capability-scoped diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: TSTS records borrowed-shared, borrowed-mut, and moved flow facts for aliased and namespaced neutral markers, rejects invalid no-argument and extra-argument forms during TypeScript checking without source-core facts, avoids facts for local/shadowed same-spelling calls, and records neutral facts only on the exact call and argument subjects, not later post-flow use-sites. C# consumes those finalized facts only to emit explicit unsupported-target diagnostics; it does not erase them as identity calls.",
  }),
  "source-core.lang.portable-intrinsics": Object.freeze({
    sourceExamples: Object.freeze([
      "import { out, ref as refArg, inref, borrow, borrowMut, move, struct, field, attribute, defaultof } from \"@tsonic/core/lang.js\";",
      "import type { ptr, fnptr } from \"@tsonic/core/lang.js\";",
      "out(value); refArg(value); inref(value); borrow(value); borrowMut(value); move(value);",
      "const Point = struct({ x: field<int32>() }); const zero = defaultof<int32>(); type Raw = ptr<int32>; type Callback = fnptr<[int32], int32>; attribute<Point>().add(RouteAttribute);",
    ]),
    tstsDecision:
      "TSTS checks ordinary imports/calls/types from @tsonic/core/lang.js; source-core attaches marker facts only from the provider-owned module identity.",
    providerFacts: Object.freeze([
      "sourceCoreModuleIdentityFact",
      "sourceCallMarkerFact",
      "sourceTypeMarkerFact",
      "sourceMarkerEvidenceFact",
      "portableIntrinsicCoverageFact",
      "perTargetIntrinsicContractFact",
    ]),
    backendContract:
      "Backends may consume portable source-core facts only after the selected target implements or explicitly rejects the intrinsic; name-spelling fallback is forbidden.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/core-intrinsics-provenance/",
      "test/fixtures/defaultof-intrinsic/",
    ]),
    blockers: Object.freeze([
      "source-core.lang.portable-intrinsics remains partial until re-export marker forms, missing type-evidence breadth, per-target implementation/rejection, source-span coverage, and emitted target AST proof are complete.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "portable-source-core-intrinsic",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "source-core-module-identity",
          "source-marker-fact",
          "selected-target-intrinsic-contract",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-source-core-module-identity",
          "missing-target-intrinsic-contract",
          "source-spelling-only",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "source-core-module-identity",
          "source-marker-fact",
          "selected-target-intrinsic-contract",
        ]),
        operation: "attach-portable-intrinsic-fact",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "missing-target-intrinsic-contract",
          "source-spelling-only",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: @tsonic/core/lang.js exports out/ref/inref/borrow/borrowMut/move/struct/field/attribute/defaultof call markers and ptr/fnptr type markers from one source-core-owned module, with each export tracked by a source-core.lang.portable-intrinsics.* child capability. Source-core package tests prove direct provider-owned facts for every current intrinsic, alias and namespace import facts for storage, flow, struct, field, attribute, defaultof, ptr, and fnptr markers, invalid arity rejection through TSTS checking, fail-closed missing storage/type evidence, no-name-guessing for local/shadowed markers, and fail-closed unsupported local barrel re-export imports that attach no portable facts; CLI and C# tests prove selected target implementation/rejection for current paths. Completion requires every child intrinsic to have full per-target implementation or explicit rejection evidence, including positive direct re-export/barrel source forms once TSTS exposes stable canonical re-export identity.",
  }),
  "source-core.lang.portable-intrinsics.out": coreLangIntrinsicEvidence({
    exportName: "out",
    factSlug: "out",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { out } from \"@tsonic/core/lang.js\";",
      "let value: int32 = 0; if (values.tryGetValue(key, out(value))) return value;",
    ],
    sourceContract:
      "Core owns out(value) as a portable write-only byref marker over proven assignable storage; it does not declare a C# out parameter by spelling.",
    providerFacts: [
      "sourceCoreOutMarkerFact",
      "argumentStorageFact",
      "byrefWriteonlyMustInitFact",
    ],
    targetContract:
      "Targets map finalized out storage facts to their own byref/write initialization operation or emit a deterministic unsupported-target diagnostic; backends must not erase out(value) as an identity call.",
    targetRequiredFacts: [
      "argument-storage",
      "byref-writeonly-must-init",
    ],
    staticOperation: "emit-target-out-argument",
    hardRejectReasons: [
      "non-assignable-storage",
      "target-missing-out-argument-contract",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/param-modifiers/",
    ],
    blockers: [
      "source-core.lang.portable-intrinsics.out remains partial until destructuring, provider-owned, readonly, source-span, and every selected-target byref write path have closed positive and negative proof.",
    ],
    notes:
      "Reviewed partial proof: TSTS/source-core records byref-writeonly-must-init only for aliased or namespaced imported core out markers and proven identifier/property storage; out(value + 1) reports SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT, invalid arity is rejected by TSTS checking, local/shadowed out calls do not attach facts, and C# provider calls consume the finalized fact as out value rather than by name.",
  }),
  "source-core.lang.portable-intrinsics.ref": coreLangIntrinsicEvidence({
    exportName: "ref",
    factSlug: "ref",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { ref as refArg } from \"@tsonic/core/lang.js\";",
      "let value: int32 = 1; mutate(refArg(value));",
    ],
    sourceContract:
      "Core owns ref(value) as a portable read-write byref marker over proven assignable storage; targets decide whether that storage can be passed by mutable reference.",
    providerFacts: [
      "sourceCoreRefMarkerFact",
      "argumentStorageFact",
      "byrefReadwriteFact",
    ],
    targetContract:
      "Targets map finalized ref storage facts to their own read-write byref operation or emit a deterministic unsupported-target diagnostic; backends must not infer ref from export spelling.",
    targetRequiredFacts: [
      "argument-storage",
      "byref-readwrite",
    ],
    staticOperation: "emit-target-ref-argument",
    hardRejectReasons: [
      "non-assignable-storage",
      "readonly-storage",
      "target-missing-ref-argument-contract",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/param-modifiers/",
    ],
    blockers: [
      "source-core.lang.portable-intrinsics.ref remains partial until every mutable storage family, readonly rejection, provider overload, delegate, constructor, source-span, and target emission path has direct proof.",
    ],
    notes:
      "Reviewed partial proof: TSTS/source-core records byref-readwrite for imported ref aliases such as ref as refArg and namespace ref(value), while same-spelling local and shadowed functions do not receive marker facts. Non-storage arguments diagnose, invalid arity is rejected by TSTS checking, and remaining proof must cover target-owned legality.",
  }),
  "source-core.lang.portable-intrinsics.inref": coreLangIntrinsicEvidence({
    exportName: "inref",
    factSlug: "inref",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { inref } from \"@tsonic/core/lang.js\";",
      "let value: int32 = 1; inspect(inref(value));",
    ],
    sourceContract:
      "Core owns inref(value) as a portable read-only byref marker over proven storage; targets decide their immutable byref mapping or rejection.",
    providerFacts: [
      "sourceCoreInrefMarkerFact",
      "argumentStorageFact",
      "byrefReadonlyFact",
    ],
    targetContract:
      "Targets map finalized inref facts to their own read-only byref operation or emit a deterministic unsupported-target diagnostic; backends must not treat inref(value) as an ordinary value call.",
    targetRequiredFacts: [
      "argument-storage",
      "byref-readonly",
    ],
    staticOperation: "emit-target-inref-argument",
    hardRejectReasons: [
      "non-storage-expression",
      "target-missing-inref-argument-contract",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/param-modifiers/",
    ],
    blockers: [
      "source-core.lang.portable-intrinsics.inref remains partial until readonly storage, temporary expression rejection, provider overloads, delegates, constructors, source spans, and every selected target's immutable byref operation are proven.",
    ],
    notes:
      "Reviewed partial proof: imported and namespace inref records byref-readonly on the call marker, does not place argument-passing facts on the storage expression itself, diagnoses non-storage expressions, rejects invalid arity through TSTS checking, and C# CLI emission uses in value only from finalized facts.",
  }),
  "source-core.lang.portable-intrinsics.borrow": coreLangIntrinsicEvidence({
    exportName: "borrow",
    factSlug: "borrow",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { borrow } from \"@tsonic/core/lang.js\";",
      "const view = borrow(value);",
    ],
    sourceContract:
      "Core owns borrow(value) as a portable shared-borrow flow marker; it records neutral source-flow state and leaves aliasing rules to the selected target.",
    providerFacts: [
      "sourceCoreBorrowMarkerFact",
      "borrowedSharedFlowFact",
      "targetFlowValidationRequiredFact",
    ],
    targetContract:
      "Targets either validate shared-borrow flow with target-owned rules or emit a deterministic unsupported-target diagnostic; backends must not silently erase borrow(value).",
    targetRequiredFacts: [
      "borrowed-shared-flow",
      "target-flow-validation-contract",
    ],
    staticOperation: "validate-target-shared-borrow",
    hardRejectReasons: [
      "target-missing-borrow-flow-contract",
      "target-rejects-shared-borrow",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [],
    blockers: [
      "source-core.lang.portable-intrinsics.borrow remains partial until post-borrow source-flow checks, C# unsupported diagnostic breadth, and future Rust implementation/rejection proof are complete.",
    ],
    notes:
      "Reviewed partial proof: TSTS/source-core records borrowed-shared flow for aliased and namespace borrow calls on the exact call and argument subjects, rejects invalid no-argument and extra-argument forms through TSTS checking without source-core facts, avoids facts for local/shadowed same-spelling calls, and does not mark later use-sites as source-validated borrow flow. C# is target-owned and currently rejects finalized borrow facts with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED instead of erasing the call; C# call mapping also rejects source-flow marker erasure when the finalized FlowStateFact is absent.",
  }),
  "source-core.lang.portable-intrinsics.borrow-mut": coreLangIntrinsicEvidence({
    exportName: "borrowMut",
    factSlug: "borrow-mut",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { borrowMut } from \"@tsonic/core/lang.js\";",
      "const writable = borrowMut(value);",
    ],
    sourceContract:
      "Core owns borrowMut(value) as a portable mutable-borrow flow marker; target packs own mutation exclusivity and aliasing diagnostics.",
    providerFacts: [
      "sourceCoreBorrowMutMarkerFact",
      "borrowedMutFlowFact",
      "targetFlowValidationRequiredFact",
    ],
    targetContract:
      "Targets either validate mutable-borrow flow with target-owned rules or emit a deterministic unsupported-target diagnostic; backends must not compile borrowMut as an identity value.",
    targetRequiredFacts: [
      "borrowed-mut-flow",
      "target-flow-validation-contract",
    ],
    staticOperation: "validate-target-mutable-borrow",
    hardRejectReasons: [
      "target-missing-borrow-mut-flow-contract",
      "target-rejects-mutable-borrow",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [],
    blockers: [
      "source-core.lang.portable-intrinsics.borrow-mut remains partial until mutable aliasing, nested borrows, C# unsupported diagnostic breadth, and future Rust implementation/rejection proof are complete.",
    ],
    notes:
      "Reviewed partial proof: TSTS/source-core records borrowed-mut flow for aliased and namespace borrowMut calls on the exact call and argument subjects, rejects invalid no-argument and extra-argument forms through TSTS checking without source-core facts, avoids facts for local/shadowed same-spelling calls, and does not mark later use-sites as source-validated mutable-borrow flow. Selected targets own exclusivity; unsupported targets must diagnose rather than lower the marker away, and C# call mapping now rejects finalized borrowMut facts with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED while still rejecting missing FlowStateFact with CSHARP_FLOW_MARKER_FACT_NOT_PROVEN.",
  }),
  "source-core.lang.portable-intrinsics.move": coreLangIntrinsicEvidence({
    exportName: "move",
    factSlug: "move",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { move } from \"@tsonic/core/lang.js\";",
      "const owned = move(value);",
    ],
    sourceContract:
      "Core owns move(value) as a portable moved-value flow marker; it records neutral moved state without deciding target ownership transfer legality.",
    providerFacts: [
      "sourceCoreMoveMarkerFact",
      "movedFlowFact",
      "targetFlowValidationRequiredFact",
    ],
    targetContract:
      "Targets either validate move flow and post-move use with target-owned rules or emit a deterministic unsupported-target diagnostic; backends must not erase move(value).",
    targetRequiredFacts: [
      "moved-flow",
      "target-flow-validation-contract",
    ],
    staticOperation: "validate-target-move-flow",
    hardRejectReasons: [
      "target-missing-move-flow-contract",
      "post-move-use-rejected",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "packages/tsts/src/extensions/provider-program.test.ts",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "packages/tsts/src/extensions/provider-program.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [],
    blockers: [
      "source-core.lang.portable-intrinsics.move remains partial until move assignment, post-move reads/writes, selected-target unsupported diagnostic breadth, and future Rust ownership proof are complete.",
    ],
    notes:
      "Reviewed partial proof: TSTS/source-core records moved flow on aliased and namespace move calls plus the exact moved argument subject, rejects invalid no-argument and extra-argument forms through TSTS checking without source-core facts, avoids facts for local/shadowed same-spelling calls, and provider-program tests show target validation can reject post-move use. C# remains explicit unsupported-target diagnostics, not silent marker erasure, and call mapping now rejects finalized move facts with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED while still rejecting missing FlowStateFact with CSHARP_FLOW_MARKER_FACT_NOT_PROVEN.",
  }),
  "source-core.lang.portable-intrinsics.struct": coreLangIntrinsicEvidence({
    exportName: "struct",
    factSlug: "struct",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { struct, field } from \"@tsonic/core/lang.js\";",
      "export const Point = struct({ x: field<int32>(), y: field<int32>() });",
    ],
    sourceContract:
      "Core owns struct(shape) as a portable value-type shape marker that collects finalized field facts; target layout, declaration syntax, and unsupported members are target-owned.",
    providerFacts: [
      "sourceCoreStructMarkerFact",
      "structValueTypeFact",
      "finalizedFieldFact",
    ],
    targetContract:
      "Targets map finalized struct facts to target value declarations or emit deterministic diagnostics for unsupported shape members; backends must not infer structs from object-literal spelling.",
    targetRequiredFacts: [
      "struct-value-type",
      "finalized-field-facts",
      "target-value-type-contract",
    ],
    staticOperation: "emit-target-value-type",
    hardRejectReasons: [
      "struct-member-without-field-fact",
      "target-missing-value-type-contract",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
      "test/cli-build/classes-value-types.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/classes-value-types.test.mjs",
    ],
    oldEvidence: [
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "test/fixtures/struct-basic/",
    ],
    blockers: [
      "source-core.lang.portable-intrinsics.struct remains partial until duplicate fields, non-field members, methods, constructors, generics, nested structs, target layout diagnostics, and all emitted target AST paths are proven.",
    ],
    notes:
      "Reviewed partial proof: struct({ x: field<int32>() }) and namespace lang.struct({ x: lang.field<int32>() }) record valueType struct facts from finalized field facts; local same-spelling struct functions do not attach source-core facts. C# CLI tests emit public struct only from those facts. Invalid value-type members without field facts fail closed.",
  }),
  "source-core.lang.portable-intrinsics.field": coreLangIntrinsicEvidence({
    exportName: "field",
    factSlug: "field",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { field } from \"@tsonic/core/lang.js\";",
      "export class Counter { value = field<int32>(); }",
    ],
    sourceContract:
      "Core owns field<T>() as a portable field marker requiring explicit type evidence and a proven field-containing context; target accessibility and storage layout are target-owned.",
    providerFacts: [
      "sourceCoreFieldMarkerFact",
      "fieldTypeEvidenceFact",
      "fieldContainingContextFact",
    ],
    targetContract:
      "Targets map finalized field facts to target fields/properties or emit deterministic diagnostics when the field context, type, or target storage contract is missing.",
    targetRequiredFacts: [
      "field-type-evidence",
      "field-containing-context",
      "target-field-contract",
    ],
    staticOperation: "emit-target-field",
    hardRejectReasons: [
      "missing-field-type-evidence",
      "missing-field-containing-context",
      "target-missing-field-contract",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
      "test/cli-build/classes-value-types.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/classes-value-types.test.mjs",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "test/fixtures/struct-basic/",
    ],
    blockers: [
      "source-core.lang.portable-intrinsics.field remains partial until orphan fields, duplicate fields, class-vs-struct context, target mutability/accessibility, source spans, and every emitted field AST path are proven.",
    ],
    notes:
      "Reviewed partial proof: field<int32>() and namespace lang.field<int32>() attach field facts only from explicit type evidence and proven containing context; local same-spelling field functions do not attach facts. field() without type evidence and non-field struct members produce deterministic diagnostics instead of inferred target fields.",
  }),
  "source-core.lang.portable-intrinsics.attribute": coreLangIntrinsicEvidence({
    exportName: "attribute",
    factSlug: "attribute",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { attribute } from \"@tsonic/core/lang.js\";",
      "attribute<Annotated>().method((target) => target.run).parameter(\"input\").target(\"param\").add(CLSCompliantAttribute, false);",
    ],
    sourceContract:
      "Core owns attribute<T>() as a portable attribute-application builder that records exact source declaration targets and arguments; provider/target facts own target attribute identity and legal placements.",
    providerFacts: [
      "sourceCoreAttributeMarkerFact",
      "attributeTargetEvidenceFact",
      "providerTargetAttributeFact",
    ],
    targetContract:
      "Targets map finalized attribute facts to legal target attributes or emit deterministic diagnostics for unsupported targets, arguments, placements, or missing provider identity.",
    targetRequiredFacts: [
      "attribute-target-evidence",
      "provider-target-attribute",
      "target-attribute-placement-contract",
    ],
    staticOperation: "emit-target-attribute",
    hardRejectReasons: [
      "missing-attribute-target-evidence",
      "unsupported-attribute-target-specifier",
      "target-missing-attribute-contract",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/provider-dotnet.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/provider-dotnet.test.mjs",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/comprehensive/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/targets/Attributes.ts",
    ],
    blockers: [
      "source-core.lang.portable-intrinsics.attribute remains partial until every constructor/named argument value, every placement target, unsupported value diagnostic, source span, and generated declaration attribute AST path is proven.",
    ],
    notes:
      "Reviewed partial proof: attribute<T>() and namespace lang.attribute<T>() record target, parameter, and specifier facts only when selectors and strings prove exact declarations; local same-spelling builders do not attach facts. Provider-backed C# attributes emit from target identity facts, while unproven builder chains and unsupported target specifiers fail closed.",
  }),
  "source-core.lang.portable-intrinsics.defaultof": coreLangIntrinsicEvidence({
    exportName: "defaultof",
    factSlug: "defaultof",
    sourceKind: "call-marker",
    sourceExamples: [
      "import { defaultof } from \"@tsonic/core/lang.js\";",
      "export function zero(): int32 { return defaultof<int32>(); }",
    ],
    sourceContract:
      "Core owns defaultof<T>() as a portable default-value marker requiring explicit type evidence; targets own the target default expression or diagnostic.",
    providerFacts: [
      "sourceCoreDefaultofMarkerFact",
      "defaultValueTypeEvidenceFact",
      "targetDefaultValueContractFact",
    ],
    targetContract:
      "Targets map finalized default-value facts to target default expressions or emit deterministic diagnostics when the type or selected target default contract is missing.",
    targetRequiredFacts: [
      "default-value-type-evidence",
      "target-default-value-contract",
    ],
    staticOperation: "emit-target-default-value",
    hardRejectReasons: [
      "missing-default-type-evidence",
      "target-missing-default-value-contract",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
    ],
    oldEvidence: [
      "test/fixtures/defaultof-intrinsic/",
    ],
    blockers: [
      "source-core.lang.portable-intrinsics.defaultof remains partial until primitives, structs, nullable/reference types, provider generics, invalid type evidence, source spans, and every selected target default-expression path are proven.",
    ],
    notes:
      "Reviewed partial proof: defaultof<char>(), defaultof<int32>(), and namespace lang.defaultof<bool>() attach default-value facts from explicit type evidence, while local same-spelling defaultof functions do not attach facts. defaultof() fails with SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE, and C# emits default(int) only after consuming finalized facts.",
  }),
  "source-core.lang.portable-intrinsics.ptr": coreLangIntrinsicEvidence({
    exportName: "ptr",
    factSlug: "ptr",
    sourceKind: "type-marker",
    sourceExamples: [
      "import type { ptr } from \"@tsonic/core/lang.js\";",
      "export function accept(value: ptr<int32>): void {}",
    ],
    sourceContract:
      "Core owns ptr<T> as a portable pointer type marker carrying pointee type evidence; targets own unsafe requirements, mutability, ABI, and unsupported diagnostics.",
    providerFacts: [
      "sourceCorePointerTypeMarkerFact",
      "pointerPointeeTypeFact",
      "targetPointerContractFact",
    ],
    targetContract:
      "Targets map finalized pointer facts to target pointer types or emit deterministic diagnostics; backends must not infer pointer types from type alias names.",
    targetRequiredFacts: [
      "pointer-pointee-type",
      "target-pointer-contract",
      "unsafe-requirement-contract",
    ],
    staticOperation: "emit-target-pointer-type",
    hardRejectReasons: [
      "missing-pointer-pointee-type",
      "target-missing-pointer-contract",
      "unsafe-target-mode-unavailable",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ],
    oldEvidence: [
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "test/fixtures/pointer-types/",
    ],
    blockers: [
      "source-core.lang.portable-intrinsics.ptr remains partial until explicit mutability variants, non-arity invalid type forms, unsafe project settings, provider pointer boundaries, source spans, and all target diagnostics are proven.",
    ],
    notes:
      "Reviewed partial proof: aliased ptr<int32>, namespace lang.ptr<int32>, and nested ptr facts attach target-defined mutability plus unsafe-required evidence; local same-spelling ptr aliases do not attach pointer facts; invalid arity is rejected by TSTS checking; and C# CLI emits int* with AllowUnsafeBlocks only from finalized facts. Unsupported pointer shapes remain target diagnostics.",
  }),
  "source-core.lang.portable-intrinsics.fnptr": coreLangIntrinsicEvidence({
    exportName: "fnptr",
    factSlug: "fnptr",
    sourceKind: "type-marker",
    sourceExamples: [
      "import type { fnptr } from \"@tsonic/core/lang.js\";",
      "type Callback = fnptr<[int32, bool], int32>;",
    ],
    sourceContract:
      "Core owns fnptr<Args, Result> as a portable function-pointer type marker carrying parameter/result type evidence; targets own ABI, calling convention, unsafe requirements, and diagnostics.",
    providerFacts: [
      "sourceCoreFunctionPointerTypeMarkerFact",
      "functionPointerParameterTypeFacts",
      "functionPointerResultTypeFact",
      "targetFunctionPointerContractFact",
    ],
    targetContract:
      "Targets map finalized function-pointer facts to target function-pointer types or emit deterministic diagnostics; backends must not synthesize delegates or erased functions without target facts.",
    targetRequiredFacts: [
      "function-pointer-parameter-types",
      "function-pointer-result-type",
      "target-function-pointer-contract",
      "unsafe-requirement-contract",
    ],
    staticOperation: "emit-target-function-pointer-type",
    hardRejectReasons: [
      "missing-function-pointer-parameter-types",
      "missing-function-pointer-result-type",
      "target-missing-function-pointer-contract",
    ],
    positiveTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "packages/tsts/src/extensions/source-semantics.test.ts",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ],
    oldEvidence: [
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "test/fixtures/pointer-types/",
    ],
    blockers: [
      "source-core.lang.portable-intrinsics.fnptr remains partial until non-arity invalid Args/Result forms, ABI/calling convention facts, provider boundaries, source spans, and all selected-target diagnostics are proven.",
    ],
    notes:
      "Reviewed partial proof: source-semantics records fnptr parameter/result type facts from aliased and namespace core type marker imports, rejects local same-spelling aliases, relies on TSTS checking for invalid arity, and C# CLI emits delegate* output with AllowUnsafeBlocks only from finalized neutral facts. Complete target ABI diagnostics remain open.",
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
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
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
      "Reviewed proof: .NET provider records public reflected constructors as constructor members with exact signature ids, excludes non-public constructors from raw/source/target models, preserves constructor overload groups, array-literal element metadata, cross-namespace parameter provider refs, optional/default/params/byref facts, and selected constructor identity; source conversion omits constructor-named non-constructor members, records unsupported constructor signatures instead of dropping them, and CLI/provider-selection tests prove provider-owned new expressions and selected unsupported constructor diagnostics end to end.",
  }),
  "native.dotnet.constraints": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    notes:
      "Reviewed partial proof: .NET reflection records class, struct, new, unmanaged, notnull, interface, base-class, generic-method, variance, and unsupported constraints as target facts with assembly-qualified target identities, keeps those target-only constraints out of source declarations, maps notnull to C# target-specific constraint facts, and maps unsupported constraints to fail-closed target diagnostics. The C# semantic provider accepts or rejects generic constraints from finalized target binding facts instead of changing TSTS source assignability, including exact reflected primitive contract facts for source primitives such as int32. Remains partial until full base-vs-interface substitution evidence and broader source-level provider constraint diagnostics are complete.",
  }),
  "native.dotnet.conversions": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/implicit-int-to-double/",
      "test/fixtures/default-param-int-to-double/",
      "packages/targets/csharp/emitter/testcases/common/types/type-assertions/TypeAssertions.ts",
    ]),
    blockers: Object.freeze([
      "native.dotnet.conversions remains partial until reflected conversion operators are exercised through current CLI/runtime source calls, assertions, assignments, returns, generic substitutions, unsupported lifted/pointer/interface operators, and exact source-span diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: .NET reflection records op_Implicit and op_Explicit as target-only conversion operator facts, keeps them out of source-visible provider members, selects conversion operators by reflected source/target type identity, reports ambiguity rather than choosing by order, and records pointer-source conversion operators as unsupported provider evidence instead of exposing them. Remains partial until provider-owned conversions are proven through end-to-end source calls/assertions and unsupported conversion diagnostics cover every unsupported operator shape.",
  }),
  "native.dotnet.parameter-modes": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/lang/stackalloc/StackAlloc.ts",
      "test/fixtures/param-modifiers/",
    ]),
    notes:
      "Reviewed partial proof: external-current C# tests preserve out, ref, in, optional, default-value, and params-array facts across declaration models, function source shapes, extension receivers, constructors, and reflected signature identities; CLI provider tests prove omitted optional target arguments emit only when a deterministic reflected default exists, reject omitted optional arguments without reflected defaults, and emit reflected params-array extra arguments from selected target facts. Unsupported default values carry deterministic parameter identity/evidence, unsupported pointer parameter source shapes and wrong optional/params arities reject. Remains partial until mutated/missing parameter-mode facts and provider-owned call emission cover every method, constructor, indexer, and delegate path.",
  }),
  "native.dotnet.array.explicit": Object.freeze({
    sourceExamples: Object.freeze([
      "import { Array as DotNetArray } from \"@tsonic/dotnet/System.js\";",
      "const values: DotNetArray<int32> = DotNetArray.create<int32>(size); values[0] = 7; return values.length;",
      "function invalid(values: DotNetArray<int32>): void { values.length = 3; }",
    ]),
    tstsDecision:
      "TSTS checks the provider-owned .NET declarations and ordinary TypeScript array syntax; native CLR array identity is supplied only by provider facts.",
    providerFacts: Object.freeze([
      "dotnetArrayTypeRef",
      "nativeClrArrayCarrierFact",
      "providerSelectedMemberFact",
      "selectedArrayLengthOrIndexerFact",
      "readOnlyNativeArrayLengthFact",
    ]),
    backendContract:
      "C# emission may use T[] element access and Length only from finalized provider/native-array facts; assignment to native-array length must remain a read-only diagnostic, and normal source T[] stays TypeScript Array<T> semantics instead of becoming explicit CLR Array<T> by spelling.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-index-dotnet/",
      "test/fixtures/native-array-push-mutation/",
      "test/fixtures/readonly-array-property-mutation/",
    ]),
    blockers: Object.freeze([
      "native.dotnet.array.explicit remains partial until covariance, returned CLR arrays from broad BCL APIs, native-array public ABI boundaries, ranked-array rejection breadth, and runtime/toolchain behavior across the full provider matrix are proven; explicit Array<T> source shape, construction, element assignment, read-only length, index access, mutator rejection, and selected-fact C# emission already have current proof.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "dotnet-native-array-carrier",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "dotnet-array-type-ref",
          "provider-selected-array-member",
          "native-clr-array-carrier",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-dotnet-array-type-ref",
          "missing-provider-selected-array-member",
          "source-array-spelling-only",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "dotnet-array-type-ref",
          "provider-selected-array-member",
          "native-clr-array-carrier",
        ]),
        operation: "emit-clr-array-operation",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "ranked-clr-array-without-approved-source-shape",
          "source-array-spelling-only",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: current C# provider tests prove CLR SZArray type refs, explicit provider-owned @tsonic/dotnet Array<T> virtual declarations, collection literal metadata, unsupported ranked arrays, and selected member/indexer facts; CLI proof emits int[] from DotNetArray.create<int32>(size), maps values.length to values.Length, maps values[index] to CLR array indexing, dotnet-builds the generated project, and rejects JS mutators such as push plus length assignment on explicit native arrays. Completion still requires covariance, returned CLR arrays from broad BCL APIs, native-array ABI boundaries, and ranked-array rejection coverage across the full provider matrix.",
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
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/linq/ExtensionMethods.ts",
    ]),
    notes:
      "Reviewed proof: provider-owned overload identity is selected from exact declaration/signature facts, including same-spelling overload groups, assembly-qualified duplicate source names, generic method arity, byref parameter modes, optional/params arity, constructors, indexers, extension receivers, selected JS/Node surface signatures, and selected signatures whose source argument facts would otherwise match sibling overloads. TSTS-selected provider identity is the proof boundary: exact selected signatures map only to the matching target member id and may not search sibling overloads; provider refinement is allowed only inside a proven overload group without source spelling lookup. Valid selected-signature target conversions remain explicit provider facts; missing selected identity, unsupported selected identities, ambiguous group refinement, contradictory generic argument facts, and unproven conversion facts fail closed.",
  }),
  "type.generic.provider-target-arguments": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-lifecycle.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-lifecycle.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/SingleConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/VariableInit.ts",
    ]),
    blockers: Object.freeze([
      "type.generic.provider-target-arguments remains partial until provider-owned constructors, indexers, delegates, extension calls, inherited generic members, and every old generic call fixture have current CLI/toolchain proof.",
    ]),
    notes:
      "Reviewed partial proof: C# provider call facts close selected generic target members from TSTS-selected source signatures and proven target argument facts, reject unresolved or contradictory selected generic facts, and CLI module tests prove imported/re-exported generic source calls emit explicit C# generic arguments from TSTS-selected declarations. Backend type rendering still requires finalized target argument facts and fails closed without them.",
  }),
  "type.generic.provider-target-constraints": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/declaration-generics.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
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
      "Reviewed partial proof: source and provider generic constraints render only from finalized target constraint facts, primitive constraint failures produce diagnostics, C# provider target constraints are accepted only when finalized value/reference/constructible/unmanaged/notnull/implemented-contract facts prove them, source primitive implemented-contract constraints require reflected primitive binding evidence with exact type-argument equality, unsupported provider constraints reject from explicit target facts, reflected notnull type references produce source-level C# target diagnostics after TSTS accepts the source syntax, and old generic-constraint emitter/fixture coverage is mapped as evidence. Remains partial until every reflected constraint form has end-to-end CLI/toolchain tests.",
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
  "carrier.array": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-maximus-cases/array-and-literal-inference.test.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/destructuring/ArrayDestructure.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/multidimensional/MultiDimensional.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/spread/ArraySpread.ts",
      "test/fixtures/array-destructuring/",
      "test/fixtures/array-double/",
      "test/fixtures/array-literal/",
      "test/fixtures/array-multidimensional/",
      "test/fixtures/array-spread/",
      "test/fixtures/array-type-emission/",
    ]),
    blockers: Object.freeze([
      "carrier.array remains partial until every array carrier lane has current positive and negative proof: readonly/read-write ABI, nested/generic arrays, inferred returns, tuple interaction, native CLR boundaries, sparse/full-JS carriers, and provider-fact absence diagnostics.",
    ]),
    notes:
      "Reviewed partial proof for the old array inventory slice: old emitter and fixture array cases are mapped to finalized array carrier facts rather than old frontend inference. Current CLI proof covers typed, empty, nested, double, multidimensional, spread, and JS-surface array carriers, including fail-closed diagnostics for untyped empty returns and native length access without selected facts.",
  }),
  "operation.array.literal": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-maximus-cases/array-and-literal-inference.test.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/destructuring/ArrayDestructure.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/multidimensional/MultiDimensional.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/spread/ArraySpread.ts",
      "test/fixtures/array-destructuring/",
      "test/fixtures/array-double/",
      "test/fixtures/array-literal/",
      "test/fixtures/array-multidimensional/",
      "test/fixtures/array-spread/",
      "test/fixtures/array-type-emission/",
    ]),
    blockers: Object.freeze([
      "operation.array.literal remains partial until literal holes, readonly tuple/literal preservation, contextual empty arrays, provider native-array literals, sparse/full-JS array construction, and every old deferred array fixture have current positive and fail-closed tests.",
    ]),
    notes:
      "Reviewed partial proof for the old array-literal slice: current CLI tests build and run typed source array literals, empty typed literals, nested literals, spread literals, double-array returns, and primitive element carriers from finalized provider/surface facts. The old validator array inference test is mapped as stale evidence only; TSTS owns source typing and target array emission now requires explicit carrier facts.",
  }),
  "expression.array-literal": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/multidimensional/MultiDimensional.ts",
      "test/fixtures/array-double/",
      "test/fixtures/array-literal/",
      "test/fixtures/array-multidimensional/",
      "test/fixtures/array-type-emission/",
    ]),
    blockers: Object.freeze([
      "expression.array-literal remains partial until the old inventory is split between syntax-level expression coverage and target operation coverage, and until every expression-only array literal form has focused positive and negative evidence.",
    ]),
    notes:
      "Reviewed partial proof: array literal expression coverage is now tied to the same old literal fixtures that prove carrier and operation behavior, but it is kept separate so expression syntax coverage cannot imply carrier completeness. Current negative proof rejects literal emission when element evidence is absent instead of synthesizing an array carrier from syntax.",
  }),
  "operation.spread.array": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/spread/ArraySpread.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/ArraySpread.ts",
      "test/fixtures/array-spread/",
    ]),
    blockers: Object.freeze([
      "operation.spread.array remains partial until spread over readonly, tuple, provider-native arrays, iterable providers, sparse/full-JS arrays, nested spreads, and unsupported spread operands have complete current proof.",
    ]),
    notes:
      "Reviewed partial proof: old spread emitter and fixture cases are mapped to current array spread evidence. Current CLI proof renders spread only from finalized expected array facts through structured array-helper AST, validates module-scope spread constants, builds generated C# projects, and does not revive old expected-type-threading logic inside Tsonic.",
  }),
  "binding.array.fixed-rest-default": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/destructuring/ArrayDestructure.ts",
      "test/fixtures/array-destructuring/",
    ]),
    blockers: Object.freeze([
      "binding.array.fixed-rest-default remains partial until assignment destructuring, nested default values, tuple rest, provider-native array extraction, and sparse/full-JS array extraction have current positive and fail-closed proof.",
    ]),
    notes:
      "Reviewed partial proof: old array destructuring inventory maps to current binding-pattern tests for fixed positions, rest, defaults, and nested array extraction using finalized carrier facts. Missing carrier facts diagnose instead of falling back to stale array destructuring lowering.",
  }),
  "carrier.array.public-abi-policy": Object.freeze({
    sourceExamples: Object.freeze([
      "export function sequence(values: int32[]): int32 { let total: int32 = 0; for (const value of values) { total += value; } return total; }",
      "export function indexed(values: int32[]): int32 { return values[0] + values.length; }",
      "export function dense(values: int32[], index: int32, value: int32): int32 { values[index] = value; return values.length; }",
      "export function sparse(values: int32[], index: int32): int32 { delete values[index]; return values.length; }",
    ]),
    tstsDecision:
      "TSTS checks every source expression as ordinary TypeScript Array<T>/T[] syntax; selected JS surface/provider facts, not source spelling, choose the C# public ABI and internal carrier lane.",
    providerFacts: Object.freeze([
      "csharpArrayBoundaryFact",
      "csharpArrayCarrierFact",
      "runtimeCarrierFact",
      "targetIterationFact",
      "targetOperationFact",
      "csharpTargetMutationOperationFact",
    ]),
    backendContract:
      "C# parameter and return types render from finalized array boundary/carrier facts: unused native arrays may expose T[], sequential reads use IEnumerable<T>, length/index reads use IReadOnlyList<T>, caller-visible dense mutation uses List<T>, array returns use List<T>, and JSArray<T> appears only as a copy-in local for full JS semantics.",
    positiveTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-literal/",
      "test/fixtures/array-index-dotnet/",
      "test/fixtures/array-spread/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([
      "carrier.array.public-abi-policy remains partial until readonly arrays, inferred array returns, nested/generic public ABI carriers, native-array provider boundaries, and every full-JS copy-in/copy-out requirement are covered by focused evidence.",
    ]),
    notes:
      "Reviewed partial proof: CLI evidence compiles ordinary source int32[] parameters unchanged through the JS surface while finalized facts select int[] for unused native-array lanes, IEnumerable<int> for for-of sequential reads, IReadOnlyList<int> for length/index reads, List<int> for dense mutation and array returns, and a JSArray<int> local only for delete/hole semantics. This proves the public ABI policy is fact-backed and does not infer CLR arrays or JSArray carriers from TypeScript T[] spelling alone.",
  }),
  "surface.js.array-methods": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-constructor/",
      "test/fixtures/array-spread/",
      "test/fixtures/js-surface-array-from-map-keys/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([
      "surface.js.array-methods remains partial until every Array constructor, length read/write, sparse slot, delete, hole-presence, mutation, callback, iterator, native-array-boundary, runtime artifact, and fail-closed unsupported lane is covered by sub-capability evidence.",
    ]),
    notes:
      "Reviewed partial proof: selected JS surface facts keep source TypeScript Array<T>/T[] as normal TS array semantics while selecting fact-backed C# ABI/carrier lanes: IEnumerable<T> for read-only iteration, IReadOnlyList<T> for index/length reads, List<T> for dense caller-visible mutation/array-return values, explicit native arrays for provider-owned native boundaries, and closed JS carriers only for full JS behavior. Covered length/index access, concat/includes/index/search/slice/join helpers, nullish-producing at/pop/shift/find/findLast value/reference helpers, selected callback method arities, array destructuring/rest, spread, Array.from, Array.of, Array.isArray, and array for-in. No-surface array mutators and sparse delete/length mutation fail closed without selected surface facts. Length/index reads are tracked under surface.js.array.length-index; sparse/delete/hole/length-mutation semantics remain partial under surface.js.array.sparse-delete-holes; Array constructor coverage is tracked under surface.js.array-constructor; explicit CLR arrays remain partial under native.dotnet.array.explicit.",
  }),
  "surface.js.array-constructor": Object.freeze({
    sourceExamples: Object.freeze([
      "const values = new Array<int32>(size);",
      "const fixed = new Array<string>(5);",
    ]),
    tstsDecision:
      "TSTS validates Array constructor value usage only when the selected JS surface supplies a value declaration; without that declaration, Array<T> remains a type-only source shape and must fail before backend emission.",
    providerFacts: Object.freeze([
      "selectedJsArrayConstructorDeclaration",
      "arrayConstructorOperationFact",
      "arrayConstructorElementCarrierFact",
      "closedJsArrayCarrierFact",
    ]),
    backendContract:
      "C# must emit Array construction only from finalized selected-surface constructor facts; it must not reinterpret type-only Array<T> usage as a CLR allocation or native array fallback.",
    positiveTests: Object.freeze([
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-constructor/",
    ]),
    blockers: Object.freeze([
      "surface.js.array-constructor remains partial because current proof is runtime-only; it still needs selected-surface CLI/provider proof for new Array<T>(size), no-surface/type-only Array constructor rejection, and exact diagnostics that do not lower to CLR arrays or dense List<T> by spelling.",
    ]),
    notes:
      "Reviewed partial proof: the C# JS runtime has current JSArray construction behavior, but the current source-to-source surface does not yet have explicit selected Array constructor facts or a focused no-surface Array constructor diagnostic. The old array-constructor fixture therefore remains blocker evidence, not completion proof.",
  }),
  "surface.js.array.length-index": Object.freeze({
    sourceExamples: Object.freeze([
      "export function count(values: int32[]): int32 { return values.length; }",
      "export function pick(values: int32[], index: int32): int32 { return values[index]; }",
    ]),
    tstsDecision:
      "TSTS validates Array<T> property and element access against selected JS declarations; the surface provider must prove the receiver carrier and integral index.",
    providerFacts: Object.freeze([
      "selectedJsArrayDeclaration",
      "arrayReceiverCarrierFact",
      "arrayLengthOperationFact",
      "arrayElementOperationFact",
      "integralIndexFact",
    ]),
    backendContract:
      "C# length/index emission uses Count, Length, or indexer only from selected array operation facts; missing receiver, declaration, or index facts fail before emission.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-literal/",
      "test/fixtures/array-index-dotnet/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([
      "surface.js.array.length-index remains partial until length assignment/truncation/growth, readonly vs mutable receiver policies, native-array length bridges, every integer conversion lane, and runtime behavior are proven or rejected with exact diagnostics.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "js-array-length-index-operation",
      possibleLanes: Object.freeze(["static-native", "compat-runtime", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-array-declaration",
          "array-receiver-carrier",
          "array-length-or-index-operation",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-selected-js-array-declaration",
          "missing-array-receiver-carrier",
          "non-integral-index",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-array-declaration",
          "array-receiver-carrier",
          "array-length-or-index-operation",
        ]),
        operation: "emit-array-length-or-index",
      },
      compat: {
        lane: "compat-runtime",
        requiredFacts: Object.freeze([
          "selected-compat-mode",
          "closed-jsarray-carrier",
          "array-length-or-index-operation",
        ]),
        runtimeCarrier: "TsArray",
        operation: "ArrayLengthOrIndex",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "missing-selected-js-array-declaration",
          "non-integral-index",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: selected JS surface Array.length and element access map only from the standard-library declaration plus finalized array receiver carrier facts; provider tests defer when the declaration or carrier is absent, reject non-integral indexes, and finalize source-level element operation facts from carrier evidence before backend emission. CLI tests emit IReadOnlyList<T>.Count/List indexer, JSArray<T>.setLength for full-JS length mutation, and native byte[].Length only when selected facts exist, and reject native array length or element access without those facts.",
  }),
  "surface.js.array.sparse-delete-holes": Object.freeze({
    sourceExamples: Object.freeze([
      "delete values[1];",
      "values.length = 10; const hole = !(1 in values);",
    ]),
    tstsDecision:
      "TSTS accepts JavaScript array syntax, but the selected surface must prove sparse slot, hole-presence, delete, and length-mutation semantics before target emission.",
    providerFacts: Object.freeze([
      "closedJsArrayCarrierFact",
      "arrayHolePresenceFact",
      "arrayDeleteOperationFact",
      "arrayLengthMutationFact",
    ]),
    backendContract:
      "Backends must reject sparse/delete/hole/length-mutation operations unless a closed JSArray carrier supplies deterministic operations; dense List<T> or CLR T[] carriers cannot silently approximate them.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-constructor/",
    ]),
    blockers: Object.freeze([
      "surface.js.array.sparse-delete-holes remains partial until supported sparse array construction, supported hole-presence operators, iteration over holes, JSON/stringification interactions, assignment-value-position length mutation, and complete fail-closed diagnostics across native CLR and dense List carriers are proven.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "js-array-sparse-hole-semantics",
      possibleLanes: Object.freeze(["compat-runtime", "hard-reject"]),
      strictNative: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "sparse-js-array-semantics-require-closed-jsarray-carrier",
          "missing-required-facts",
        ]),
      },
      compat: {
        lane: "compat-runtime",
        requiredFacts: Object.freeze([
          "selected-compat-mode",
          "closed-jsarray-carrier",
          "array-hole-presence-fact",
          "array-delete-operation-fact",
          "array-length-mutation-fact",
        ]),
        runtimeCarrier: "TsArray",
        operation: "SparseArrayDeleteLengthHoleOperation",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "dense-carrier-cannot-model-holes",
          "native-clr-array-cannot-model-js-delete",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: selected JS surface delete and Array.length mutation on TypeScript arrays now require a closed JSArray carrier and emit JSArray.deleteAt/setLength through finalized operation facts, while no-surface sparse operations reject before emission. Surface-boundary tests classify `index in values` as requiring the full-JS carrier before the unsupported operator fails closed, and sparse array literal elisions produce an exact planner diagnostic before dense lowering can compact holes. Runtime JSArray tests prove hole preservation across callbacks, search, copying, concat, flat, and flatMap. Remaining supported sparse/hole runtime lanes stay blocked rather than approximated with List<T>, IReadOnlyList<T>, or CLR T[].",
  }),
  "analysis.abstraction.policy-enforcement": Object.freeze({
    sourceExamples: Object.freeze([
      "const counts = new Map<string, number>(); counts.set(\"alpha\", 1);",
      "const values = [1, 2, 3]; values.map((value) => value + 1);",
      "const payload = JSON.stringify({ ok: true });",
      "async function load(): Promise<string> { return \"ready\"; }",
      "import { readFile } from \"node:fs/promises\";",
    ]),
    tstsDecision:
      "TSTS selects the TypeScript declaration, signature, source type, flow result, overload, contextual type, and generic substitution. Tsonic may classify that checked result into source identities and policy entries, but generic analysis paths must not branch on source-family names such as Map, Set, Date, JSON, Array, Promise, Buffer, or fs.",
    providerFacts: Object.freeze([
      "selectedSourceDeclarationOrSignature",
      "selectedSourceIdentityPolicy",
      "selectedSurfacePolicy",
      "providerTargetMemberMetadata",
      "typeClassificationFact",
      "runtimeCarrierFact",
      "explicitExceptionFact",
    ]),
    backendContract:
      "Backends consume finalized policy/provider facts and target AST. They do not rediscover target members from source spelling, source-family branches, target member names, or fallback inference.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/analysis-abstraction-policy.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/analysis-abstraction-policy.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    blockers: Object.freeze([]),
    laneClassification: freezeLaneClassification({
      patternKind: "analysis-abstraction-policy-violation",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "architecture-validator-rule",
          "reviewed-debt-catalog-entry-or-zero-finding",
          "capability-ledger-status",
        ]),
        diagnostics: Object.freeze([
          "unclassified-source-family-algorithm",
          "unclassified-target-member-selection",
          "unclassified-array-specific-use-classifier",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "architecture-validator-rule",
          "reviewed-debt-catalog-entry-or-zero-finding",
          "capability-ledger-status",
          "lazy-generic-analysis-replacement-plan",
        ]),
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "source-family-generic-control-flow",
          "target-member-guessing",
          "procedural-policy-instead-of-declarative-metadata",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: the C# target architecture guard now scans product source for the known false-green classes reported by review. Array-specific use discovery has been replaced with the generic lazy analysis service, and Map/Set executable member templates have been replaced with declarative member shapes. The remaining debt catalog is therefore a burn-down ledger for the still-procedural JS call-provider registry and receiver closed-fact validator table.",
  }),
  "architecture.native-compilable.esm-only": Object.freeze({
    sourceExamples: Object.freeze([
      "import { compileProject } from \"@tsonic/host\";",
      "export { createTargetRegistry } from \"@tsonic/target-api/registry.js\";",
    ]),
    tstsDecision:
      "TSTS is a source-analysis dependency only. Product compiler/runtime code must be plain ESM TypeScript that can be compiled toward native targets without CommonJS, triple-slash references, or namespace/module shims.",
    providerFacts: Object.freeze([
      "architectureValidationFact",
      "validatedProductSourceRoot",
      "nativeCompilableModuleFact",
    ]),
    backendContract:
      "Product paths use ESM imports/exports and explicit module boundaries. CommonJS require/module.exports/exports mutations, TypeScript export assignments, triple-slash references, namespaces, and ambient module shims are rejected by the architecture gate.",
    positiveTests: Object.freeze([
      "test/architecture-contract.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/architecture-contract.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: architecture-contract scans every first-party Tsonic product source root and includes negative snippets for require, module.exports, exports mutation, export assignment, triple-slash references, namespace declarations, and ambient module shims.",
  }),
  "architecture.native-compilable.no-unapproved-deps": Object.freeze({
    sourceExamples: Object.freeze([
      "import type { TargetPack } from \"@tsonic/target-api\";",
      "import { readFile } from \"node:fs/promises\";",
    ]),
    tstsDecision:
      "TSTS supplies compiler services through approved first-party packages. Product compiler/runtime paths do not take unreviewed third-party runtime/compiler dependencies.",
    providerFacts: Object.freeze([
      "architectureValidationFact",
      "approvedDependencyFact",
      "validatedPackageManifestFact",
    ]),
    backendContract:
      "Product package manifests may depend on first-party @tsonic packages. Root-only development dependencies are limited to approved compiler/profile tooling. Any new package dependency must be consciously approved and reflected in this gate.",
    positiveTests: Object.freeze([
      "test/architecture-contract.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/architecture-contract.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: architecture-contract validates package.json files for the root and all current first-party product packages, and the negative test proves non-@tsonic product dependencies and unapproved root devDependencies are rejected.",
  }),
  "architecture.target-pack.boundaries": Object.freeze({
    sourceExamples: Object.freeze([
      "const pack: TargetPack = { id: 'csharp', provider, surfaces, createBackend, createToolchain };",
    ]),
    tstsDecision:
      "TSTS owns source parse/bind/check/query state. Target packs compose explicit provider, surface, backend, runtime contribution, and toolchain modules around finalized TSTS facts.",
    providerFacts: Object.freeze([
      "targetPackBoundaryFact",
      "targetProviderFact",
      "targetSurfaceFact",
      "targetBackendFact",
      "targetToolchainFact",
      "targetRuntimeContributionFact",
    ]),
    backendContract:
      "Target pack APIs expose provider, surfaces, backend, runtime contribution, and toolchain contracts as explicit modules. They must not collapse into one catch-all semantic blob or hidden helper path.",
    positiveTests: Object.freeze([
      "test/architecture-contract.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/architecture-contract.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: architecture-contract asserts the public target-pack API exposes TargetProvider, TargetSurfaceImplementation, TargetBackend, TargetToolchain, runtime contribution context, and TargetPack provider/surfaces/createBackend/createToolchain boundaries.",
  }),
  "architecture.target-pack.no-catch-all-semantics": Object.freeze({
    sourceExamples: Object.freeze([
      "input.targetFacts.resolveRuntimeCarrierForNode(node, { sourceFile });",
      "input.analysis.lazy.mutationsOf(symbol);",
    ]),
    tstsDecision:
      "TSTS exposes source checker and fact queries. Target packs must consume specific analysis, provider, target fact, backend, runtime, and toolchain APIs rather than catch-all semantic facade objects.",
    providerFacts: Object.freeze([
      "architectureValidationFact",
      "specificTargetFactQuery",
      "specificLazyAnalysisQuery",
      "targetPackBoundaryFact",
    ]),
    backendContract:
      "Product source cannot introduce semantic/semantics directories or TargetSemantic* facade names that accumulate source-family behavior. New behavior must land in explicit provider, policy-data, selector, analysis, target-fact, backend, runtime, or toolchain modules.",
    positiveTests: Object.freeze([
      "test/architecture-contract.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/architecture-contract.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: architecture-contract scans all current Tsonic product source roots for catch-all semantic directories and TargetSemantic facade names, and includes negative cases proving both classes are rejected.",
  }),
  "architecture.target-pack.no-procedural-policy": Object.freeze({
    sourceExamples: Object.freeze([
      "const values = [1, 2, 3]; values.map((value) => value + 1);",
      "const created = new Date(0);",
      "const payload = JSON.stringify({ ok: true });",
    ]),
    tstsDecision:
      "TSTS selects checked TypeScript declarations, signatures, types, and flow results. Target-pack files named as policy modules are not allowed to become procedural source-family selectors over those results.",
    providerFacts: Object.freeze([
      "selectedSourceDeclarationOrSignature",
      "declarativePolicyRecord",
      "providerTargetMetadata",
      "explicitSemanticExceptionRecord",
      "architectureValidationFact",
    ]),
    backendContract:
      "Target packs must express source identities as data, policy as declarative records, and true semantic mismatches as explicit exception records. Product files named policy.ts, selection-policy.ts, property-policy.ts, or array-use-policy.ts are rejected before they can accumulate source-family branches.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/analysis-abstraction-policy.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/analysis-abstraction-policy.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    notes:
      "Reviewed proof: the C# architecture validator now has an explicit procedural-policy-file rule. The negative test proves final-forbidden filenames are rejected, while the positive side proves renamed final modules such as target-selection.ts, array-use-rules.ts, member-providers.ts, receiver-facts.ts, and source-identity.ts are accepted. This closes the policy-file loophole instead of treating renamed procedural policy as compliant.",
  }),
  "surface.js.string-methods": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/clr-string-indexer-dotnet/",
      "test/fixtures/js-string-array-returns/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed partial proof: selected JS surface facts cover string element access, code-point for-of, selected string instance/helper calls including trim/toUpperCase chaining, normalize/at/locale/search/well-formed helpers, split returning the selected JS surface List<string> array-return ABI, and fail-closed rejection without closed string receiver facts. Remains partial until all JS String methods and Boolean/String object surface conversions have positive and negative runtime coverage.",
  }),
  "surface.js.boolean-methods": Object.freeze({
    sourceExamples: Object.freeze([
      "const text = false.toString();",
      "const value = maybe.valueOf();",
    ]),
    tstsDecision:
      "TSTS validates Boolean primitive member calls against selected JS surface declarations; the surface provider must prove a closed boolean receiver and selected Boolean prototype operation.",
    providerFacts: Object.freeze([
      "selectedJsBooleanDeclaration",
      "booleanPrimitiveReceiverFact",
      "booleanToStringOperationFact",
      "booleanValueOfOperationFact",
    ]),
    backendContract:
      "C# emits BooleanOps.toString/valueOf extension calls only from finalized selected Boolean operation facts; bool.ToString() casing or native object fallback must not be used as JavaScript semantics.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/BooleanTests.cs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-boolean-tostring/",
      "test/fixtures/js-surface-node-boolean-tostring/",
    ]),
    blockers: Object.freeze([
      "surface.js.boolean-methods remains partial until Node-returned boolean chaining, Boolean object wrapper edge cases, missing-surface diagnostics, non-boolean receiver rejection, and complete fail-closed diagnostics when Boolean prototype facts are absent are proven with focused positive and negative coverage.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "js-boolean-method-operation",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-boolean-prototype-declaration",
          "closed-boolean-receiver-target-type",
          "selected-boolean-target-signature",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-selected-js-surface",
          "missing-boolean-prototype-declaration",
          "missing-closed-boolean-receiver",
          "missing-selected-target-signature",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-boolean-prototype-declaration",
          "closed-boolean-receiver-target-type",
          "selected-boolean-target-signature",
        ]),
        operation: "emit-selected-js-boolean-method",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "unsupported-boolean-method",
          "receiver-not-closed-boolean",
          "source-spelling-only",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: selected JS surface facts now cover Boolean.toString and Boolean.valueOf only from selected Boolean declaration identity plus closed bool receiver facts; C# JS runtime tests prove lowercase JavaScript boolean toString() and valueOf() behavior; the tsonic CLI test emits boolean toString/valueOf as Tsonic.CSharp.Js.BooleanOps calls and dotnet-builds the generated project. Remaining gaps are explicit missing-surface diagnostics, non-boolean receiver rejection, Node-returned boolean chaining, and Boolean object wrapper edge cases.",
  }),
  "surface.js.number-methods": Object.freeze({
    sourceExamples: Object.freeze([
      "export function fromNumber(value: number): string { return value.toString(); }",
      "const root: { count: number } = { count: 2 }; return root.count.toString();",
      "export function fromPrimitive(value: int32): string { return value.toString(); }",
      "export function fromStatic(value: number): boolean { return Number.isFinite(value) && Number.isInteger(value); }",
      "export function fromParsed(value: string): number { return Number.parseFloat(value) + Number.MAX_SAFE_INTEGER; }",
    ]),
    tstsDecision:
      "TSTS validates Number primitive member calls, Number static calls, and Number static properties against selected JS surface declarations; the surface provider must prove selected Number declarations plus closed receiver or argument facts before target facts are finalized.",
    providerFacts: Object.freeze([
      "selectedJsNumberDeclaration",
      "numberPrimitiveReceiverFact",
      "numberToStringOperationFact",
      "numberStaticOperationFact",
      "numberStaticPropertyFact",
      "selectedTargetSignatureFact",
    ]),
    backendContract:
      "C# emits Tsonic.CSharp.Js.Number operations only from finalized selected Number operation/signature/property facts; CLR ToString(), culture-sensitive formatting, boxing, dynamic, source-spelling lookup, or static property name guessing must not provide JavaScript number semantics.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/NumberTests.cs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([
      "surface.js.number-methods remains partial until Number.valueOf(), radix-aware toString(), toFixed(), toExponential(), toPrecision(), locale formatting, parseInt variable-radix coercion, non-number receiver rejection, missing-surface diagnostics, and NaN/Infinity/-0/runtime edge cases are proven with focused positive and negative coverage.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "js-number-operation",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-number-declaration",
          "closed-number-receiver-or-argument-target-type",
          "selected-number-target-signature-or-property",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-selected-js-surface",
          "missing-number-declaration",
          "missing-closed-number-receiver-or-argument",
          "missing-selected-target-signature-or-property",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-number-declaration",
          "closed-number-receiver-or-argument-target-type",
          "selected-number-target-signature-or-property",
        ]),
        operation: "emit-selected-js-number-operation",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "unsupported-number-operation",
          "receiver-or-argument-not-closed-number",
          "source-spelling-only",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: tsonic-csharp surface-boundary evidence maps Number.toString only from selected Number declaration identity plus closed number receiver facts, and maps Number.isFinite plus Number.MAX_SAFE_INTEGER only from selected NumberConstructor declarations; csharp-js runtime tests prove invariant toString formatting and static predicate helpers for double/int/long and nullable integral receivers; the tsonic CLI test emits primitive number toString, object-shape number property toString, int32 toString, Number.isFinite, Number.isInteger, Number.parseFloat, and Number.MAX_SAFE_INTEGER through Tsonic.CSharp.Js.Number and dotnet-builds the generated project. Negative evidence is limited to existing missing-fact surface-boundary and no-selected-JS-surface diagnostics, so number-specific unsupported method and receiver rejection coverage remains a blocker.",
  }),
  "surface.js.console": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
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
      "Reviewed partial proof: selected JS surface facts cover Math runtime method/property operations including zero-argument max/min JS semantics, RegExp literal/constructor/test/property carriers with C# build coverage, and JSON parse/stringify direct surface facts with closed TsValue carriers. Remains partial until nested JSON carrier flow and every RegExp operation have selected-surface facts and runtime/toolchain tests; Map and Set are tracked separately by surface.js.map-set; Date is tracked separately by surface.js.date.",
  }),
  "surface.js.map-set": Object.freeze({
    sourceExamples: Object.freeze([
      "const counts = new Map<string, number>(); counts.set(\"alpha\", 1);",
      "const names = new Set<string>(); names.add(\"alpha\");",
      "const keys = Array.from(counts.keys());",
    ]),
    tstsDecision:
      "TSTS validates Map and Set only when the selected JS surface supplies standard declarations; without selected declarations, Map and Set must remain ordinary unresolved source names.",
    providerFacts: Object.freeze([
      "selectedJsMapDeclaration",
      "selectedJsSetDeclaration",
      "mapSetConstructorOperationFact",
      "mapSetInstanceOperationFact",
      "mapSetIteratorCarrierFact",
    ]),
    backendContract:
      "C# emits Map/Set runtime operations only from finalized selected-surface facts; unresolved globals, foreign declarations, and missing iterator carriers must diagnose instead of falling back to dictionaries, HashSet, reflection, or name-based helpers.",
    positiveTests: Object.freeze([
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/MapTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/SetTests.cs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-array-from-map-keys/",
      "test/fixtures/js-surface-runtime-builtins/",
      "test/fixtures/map-set-not-in-globals/",
    ]),
    blockers: Object.freeze([
      "surface.js.map-set remains partial until no-surface Map/Set name-resolution diagnostics, Map.get nullish expected-target threading, Map/Set iterable constructor overloads, entries/values/size/delete/clear/forEach operations, and complete runtime/toolchain edge coverage are proven.",
    ]),
    notes:
      "Reviewed partial proof: current provider evidence maps selected Map/Set declarations, constructors, set/get/has/add calls, and collection iterator carriers without spelling fallback; current CLI/toolchain evidence compiles TypeScript new Map<string, int32>(), set/get/has, new Set<string>(), add/has, and Array.from(counts.keys()) to Tsonic.CSharp.Js.Map, Tsonic.CSharp.Js.Set, and Tsonic.CSharp.Js.Array.from, then dotnet-builds the generated C# project. Negative evidence rejects missing closed collection carrier facts in provider tests and asserts generated CLI output contains no InvalidExpression, __unsupported, dynamic/reflection, Dictionary/HashSet substitution, or unqualified Map/Set constructor spelling. The focused CLI proof intentionally keeps Map.get as int32 | undefined because Map.get(key) ?? fallback currently belongs to the separate nullish expected-target blocker. The old Map/Set fixtures stay mapped as regression evidence and blockers, not completion proof.",
  }),
  "surface.js.math": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([
      "surface.js.math remains partial until every selected Math static method/property has current CLI and runtime proof plus focused missing-declaration, missing-carrier, and unsupported-operation diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: selected JS surface facts map standard Math calls and constants to Tsonic.CSharp.Js.Math runtime operations, preserve JavaScript zero-argument max/min behavior through the selected JS surface runtime, and reject unselected/unsupported forms without spelling-based fallback. Remains partial until every Math static member has current runtime/toolchain coverage.",
  }),
  "surface.js.date": Object.freeze({
    sourceExamples: Object.freeze([
      "const date = new Date(Date.UTC(2023, 5, 15, 12, 30, 45, 123));",
      "return date.toISOString();",
      "return date.getTime();",
      "return Date();",
    ]),
    tstsDecision:
      "TSTS validates Date construction, call, static calls, and instance calls against selected JS surface declarations; local or unselected Date spellings do not provide target facts.",
    providerFacts: Object.freeze([
      "selectedJsDateDeclarationFact",
      "jsDateRuntimeCarrierFact",
      "dateConstructorOperationFact",
      "dateStaticOperationFact",
      "dateInstanceOperationFact",
    ]),
    backendContract:
      "C# emits Tsonic.CSharp.Js.Date construction, static calls, call(), and instance calls only from finalized selected-surface Date operation facts; without selected facts, Date calls and constructors fail before artifact creation.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/DateTests.cs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/date-not-global/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed proof: selected JS surface Date declarations map Date.UTC, Date(), new Date(...), toISOString(), and getTime() to the closed Tsonic.CSharp.Js.Date runtime carrier; CLI output includes JS runtime artifacts, generated C# build succeeds, no unqualified Date target spelling leaks, and no-surface Date construction fails closed with a selected-target-signature diagnostic.",
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
      "surface.js.object-runtime remains partial until nested JSON value flow, object carrier writes, prototype/static helpers, runtime execution, and toolchain coverage are complete.",
    ]),
    notes:
      "Reviewed partial proof: Object.keys, Object.values, and Object.entries map from selected standard-library Object declarations only when finalized argument facts prove a closed JSObject, JSArray, string, or Record<string, T>/Dictionary<string, T> carrier; unchanged TypeScript Object.keys(values).join('|') chains finalize from selected Object and Array facts; Record helper output is verified through CLI emission and C# toolchain build; missing carrier facts reject, foreign same-spelling declarations defer, and JSON direct parse/stringify uses selected facts plus closed TsValue carrier facts while nested JSON carrier flow remains incomplete.",
  }),
  "surface.node.fs-path-process": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-path-posix-join/",
      "test/fixtures/nodejs-surface-imports-negative/",
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    blockers: Object.freeze([
      "surface.node.fs-path-process remains partial for default imports until TSTS provider virtual declarations support truthful default exports or default namespace-object aliases with identity propagation to selected members.",
    ]),
    notes:
      "Reviewed partial proof: selected NodeJS surface facts cover unchanged ESM Node imports for bare fs/assert/buffer/url/util and canonical node:path/node:process modules, canonical node:path imports, bare path imports, namespace imports for bare fs/crypto/os/process and canonical node:* modules, process property access, and rejection of node:path/fs without the NodeJS surface. Remains partial until fs/path/process behavior is runtime-verified across the full old Node fixture matrix and all unsupported module members fail closed.",
  }),
  "surface.node.fs": Object.freeze({
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
    blockers: Object.freeze([
      "surface.node.fs remains partial until every supported node:fs and bare fs operation has selected-declaration target facts, every unsupported fs member has precise selected-surface diagnostics, and the old Node fixture matrix has runtime/toolchain proof.",
    ]),
    notes:
      "Reviewed partial proof: selected NodeJS surface facts cover unchanged bare fs imports, bare fs and node:fs namespace imports, existsSync/readFileSync/statSync/write-style target mappings, no-surface negative paths block Node-owned modules before artifact emission, and unsupported selected fs.watchFile fails closed without runtime fallback. Stats Date-valued members are tracked under surface.node.fs-stats-date. Remains partial until the complete node:fs API surface has provider facts, precise unsupported-operation diagnostics, and runtime coverage.",
  }),
  "surface.node.fs-stats-date": Object.freeze({
    sourceExamples: Object.freeze([
      "const resolved = maybeDate ?? statSync(\"tsonic.json\").mtime;",
      "return resolved.toISOString().length.toString();",
    ]),
    tstsDecision:
      "TSTS validates node:fs Stats members from selected NodeJS virtual declarations and Date instance calls from selected JS declarations; nullish Date unions must preserve the closed Date carrier across both surfaces.",
    providerFacts: Object.freeze([
      "nodeFsStatSyncOperationFact",
      "nodeFsStatsMtimeMemberFact",
      "selectedJsDateDeclarationFact",
      "dateInstanceOperationFact",
      "crossSurfaceDateCarrierFact",
    ]),
    backendContract:
      "C# emits Stats.mtime Date access and Date instance calls only from finalized NodeJS and JS surface facts; it must not reinterpret Stats timestamps as native DateTime, string, dynamic object, or unproven nullable union carriers.",
    positiveTests: Object.freeze([
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/statSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/fstatSync.tests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/DateTests.cs",
    ]),
    negativeTests: Object.freeze([]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-node-date-union/",
    ]),
    blockers: Object.freeze([
      "surface.node.fs-stats-date remains partial because current proof is runtime-only for Stats Date values; the NodeJS surface currently proves statSync/Stats.size/isFile/isDirectory, but not Stats.mtime Date member facts, cross-surface Date union flow, CLI/toolchain emission, or no-surface diagnostics for the old node date-union fixture.",
    ]),
    notes:
      "Reviewed partial proof: csharp-nodejs runtime Stats exposes Date-valued timestamp fields and runtime tests cover timestamp behavior, while C# JS Date tests cover Date operations. The compiler surface still lacks current selected-provider proof for Stats.mtime and the Date | undefined nullish chain used by the old fixture, so this remains blocker evidence only.",
  }),
  "surface.node.process": Object.freeze({
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
    blockers: Object.freeze([
      "surface.node.process remains partial until cwd, argv, env, exit, pid, platform, version, ESM process import forms, unsupported members, and platform-specific runtime behavior all have selected-surface facts plus positive and fail-closed tests.",
    ]),
    notes:
      "Reviewed partial proof: selected NodeJS surface facts cover bare process and node:process cwd(), argv, and platform target mappings through named and namespace import facts, and unselected Node modules fail during provider-aware resolution. Remains partial until process environment, exit, pid, version, and platform-specific behavior are covered through closed runtime facts.",
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
      "Reviewed partial proof: selected NodeJS surface facts cover Buffer provider virtual declarations, Buffer static calls, Buffer instance length/toString, bare crypto/os and canonical node:crypto/node:os imports, crypto.randomUUID/randomInt overload-family mapping, getHashes array returns, os.homedir, and os.platform by selected provider declaration/member/signature identity. Remains partial until the full Buffer/crypto/os old fixture matrix has runtime/toolchain coverage and unsupported members fail closed with precise diagnostics.",
  }),
  "surface.node.util": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "surface.node.util remains partial until format, formatWithOptions, inspect, debuglog, deprecate, isDeepStrictEqual, and other open-object helpers have closed TsValue/provider-adapter semantics or explicit unsupported diagnostics through unit, CLI, toolchain, and runtime tests.",
    ]),
    notes:
      "Reviewed partial proof: selected node:util and bare util provider modules expose source-visible declarations, closed stripVTControlCharacters/toUSVString operations map by selected provider signature identity to Tsonic.CSharp.Node.util calls, and open-carrier format/inspect declarations fail closed without routing to reflection, dynamic dispatch, JsonSerializer object inspection, or generic runtime fallback.",
  }),
  "surface.node.url": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "surface.node.url remains partial until live URLSearchParams semantics, URLPattern, url.format, urlToHttpOptions, open-object option carriers, runtime execution, and complete selected-surface diagnostics have closed carrier implementations or explicit unsupported diagnostics through unit, CLI, toolchain, and runtime tests.",
    ]),
    notes:
      "Reviewed partial proof: selected node:url and bare url provider modules expose URL and module function declarations; closed URL constructor/properties/static methods and domain/file-path helpers map by selected provider declaration/signature identity to Tsonic.CSharp.Node.URL/url calls; open-object url.format, urlToHttpOptions, URL.searchParams live-mutation semantics, URLSearchParams operations, and URLPattern fail closed without reflection, dynamic dispatch, object dictionary projection, or generic runtime fallback.",
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
      "test/cli-build/runtime-toolchain-proof.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/runtime-toolchain-proof.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-array-from-map-keys/",
      "test/fixtures/js-surface-boolean-tostring/",
      "test/fixtures/js-surface-json-typed-parse/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed partial proof: selected JS surface runtime contributions are represented in host composition, current JS surface tests require closed C# JS runtime carriers for array and RegExp behavior, generated C# library projects include the real csharp-runtime/csharp-js project references while excluding csharp-nodejs when only js is selected, a JS-only generated executable runs console and Math through the C# JS runtime without NodeJS, and a generated JS+Node executable runs through the C# JS runtime console path. Remains partial until every JS runtime carrier operation has executable runtime coverage and strict unsupported-operation diagnostics.",
  }),
  "runtime.csharp.nodejs": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/runtime-toolchain-proof.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/runtime-toolchain-proof.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-path-posix-join/",
      "test/fixtures/nodejs-surface-alias-coverage/",
      "test/fixtures/nodejs-surface-imports-negative/",
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    notes:
      "Reviewed partial proof: selected NodeJS surface runtime contributions are represented in host composition, generated C# library projects include the real csharp-nodejs project reference together with the required csharp-runtime/csharp-js references, current NodeJS surface tests build node:path/fs/crypto/os/process mappings through that reference, and a generated JS+Node executable runs node:path.join through the C# Node runtime. Remains partial until executable tests cover the old Node fixture matrix and all unsupported Node module members fail closed.",
  }),
  "runtime.no-reflection-semantics": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/runtime-toolchain-proof.test.mjs",
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/NoReflectionSemanticsTests.cs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/runtime-toolchain-proof.test.mjs",
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/NoReflectionSemanticsTests.cs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-maximus-cases/json-static-safety.test.ts",
    ]),
    notes:
      "Reviewed partial proof: backend/printer source gates ban C# dynamic, CLR reflection, late MethodInfo invocation, generic method construction, Activator construction, and Assembly.Load as generated-language semantics; CLI runtime/toolchain proof scans generated C# library projects across runtime-only, js, and nodejs selections, and now scans csharp-runtime, csharp-js, and csharp-nodejs source packages for the same banned mechanisms. The separate build-time .NET reflection provider remains tooling input, not product runtime semantics. Remains partial until every generated C# fixture family is scanned or built through this gate.",
  }),
  "source-core.module.single-owner": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    notes:
      "Reviewed partial proof: source-core package tests prove the source-core virtual module provider owns only @tsonic/core/types.js and @tsonic/core/lang.js, rejects unowned @tsonic/csharp/* resolution, and exposes portable lang.js exports without target alias names. External C# tests prove the C# source alias provider explicitly returns unowned for both portable core modules and owns only @tsonic/csharp/types.js and @tsonic/csharp/lang.js. Remains partial until every target pack proves the same non-redefinition boundary.",
  }),
  "source-core.target-alias-consumption": Object.freeze({
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
    notes:
      "Reviewed partial proof: C# target aliases live under @tsonic/csharp/* and map to canonical source-core primitive and marker facts such as int32, int64, uint8, out, ref, field, attribute, defaultof, ptr, and fnptr without redefining @tsonic/core/* modules. Remains partial until every C# alias has direct CLI proof and future targets prove their alias modules consume the same source-core facts.",
  }),
  "expression.literal.null-undefined": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nullish-coalescing/",
      "test/fixtures/nullish-coalescing-threading/",
    ]),
    blockers: Object.freeze([
      "expression.literal.null-undefined remains partial until null and undefined literals are covered across every target mode, JS surface carrier, compat carrier, contextual literal site, and old nullability fixture family.",
    ]),
    notes:
      "Reviewed partial proof: C# expression planning emits source null directly as Roslyn literal null and now emits TSTS-proven global undefined as the same current C# nullish carrier instead of leaking an unbound C# identifier; the CLI test validates generated C# with dotnet build and asserts no emitted undefined token. C# JS runtime tests prove the selected JS surface exposes undefined as its closed nullish carrier.",
  }),
  "expression.nullish-optional": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nullish-coalescing/",
      "test/fixtures/nullish-coalescing-threading/",
    ]),
    blockers: Object.freeze([
      "expression.nullish-optional remains partial until optional calls, optional element access, delete/void interactions, provider-owned nullable members, compat-mode nullish carriers, and every old nullish/optional fixture are covered by current executable evidence.",
    ]),
    notes:
      "Reviewed partial proof: nullish coalescing and optional property/call/element emission consume TSTS flow plus provider nullable carrier facts, including int32/char expected-target threading and invalid char fallback diagnostics before C# emission. Remains partial because coverage is not yet exhaustive across every optional-chain form and provider-owned nullable operation.",
  }),
  "carrier.null-undefined": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/StringTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nullish-coalescing/",
      "test/fixtures/nullish-coalescing-threading/",
    ]),
    blockers: Object.freeze([
      "carrier.null-undefined remains partial until all target modes classify null and undefined per resolved pattern instance, including native nullable value/reference types, JS surface nullish helpers, compat carriers, runtime-union nullish arms, and explicit hard rejects.",
    ]),
    notes:
      "Reviewed partial proof: no-surface C# maps number/string/bool/reference unions with null or undefined to nullable C# carriers and fails generated C# builds if an unproven undefined identifier leaks; JS surface runtime helpers for Array.at/pop/shift/find/findLast, String.at/codePointAt/match, and global undefined expose closed nullish carrier behavior. Remains partial until every nullish carrier lane is classified and tested.",
  }),
  "runtime.undefined.carrier": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/StringTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "runtime.undefined.carrier remains partial until strict-native, JS surface, Node surface, compat-runtime, object/array holes, optional APIs, and typed/native provider boundaries all use explicit undefined/nullish carriers or deterministic diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: the C# backend now treats only TSTS-proven global undefined as a nullish carrier and preserves the fail-closed distinction from ordinary identifiers; JS surface runtime tests prove undefined and nullish-returning helpers use closed runtime-owned carriers. Remains partial because full JS sparse/hole semantics and compat TsValue undefined are not complete.",
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
      "Reviewed partial proof: reflection provider records unsupported constructor/property/indexer/field/method/operator/event members instead of silently dropping static interface members, generic static members, multi-parameter indexers, pointer signatures, ranked CLR arrays, by-reference returns, generic operators, pointer-source conversion operators, unsupported generic constraints, and unsupported default parameter values; unsupported target-only type refs now fail closed during source-shape conversion for pointers, function pointers, ranked arrays, nested provider refs, and opaque source shapes; selected unsupported member/constraint identities become fail-closed target diagnostics instead of generic not-found errors. Remains partial until every attribute/default-value omission path has explicit provider diagnostics.",
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
      "Reviewed proof: provider-owned calls select exact signature identity from provider facts, including overload groups, extension receivers, byref parameters, generic target arguments, and optional/params arity. Exact selected signatures no longer search sibling overloads when source argument facts would match another overload, and backend emission rejects mutated operation kind, receiver, parameter-passing, or selected-member facts.",
  }),
  "operation.call.provider-argument-conversion": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/VariableInit.ts",
    ]),
    blockers: Object.freeze([
      "operation.call.provider-argument-conversion remains partial until constructor, delegate, indexer, and extension-call arguments each prove explicit source-to-target conversion facts, source spans, and CLI/toolchain emission.",
    ]),
    notes:
      "Reviewed partial proof: provider-selection, conversion planner, and argument-emission tests prove selected target argument conversion facts take precedence over expected-type threading, must match the finalized selected parameter target type, and fail closed when missing or mutated instead of recovering from parameter names or target type spelling.",
  }),
  "operation.call.provider-parameter-mode": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
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
      "test/fixtures/param-modifiers/",
    ]),
    blockers: Object.freeze([
      "operation.call.provider-parameter-mode remains partial until delegate/callable invocation, constructor, indexer, extension receiver, source-span diagnostics, and mutated/missing parameter-mode fact rejections all have current CLI/toolchain proof.",
    ]),
    notes:
      "Reviewed partial proof: provider-owned call facts carry selected parameter modes from reflected signatures, including out, ref, in, by-value, optional, default values, constructors, and params arrays; exact selected signature identity enforces optional/params arity without searching sibling overloads, and CLI provider tests prove omitted optional arguments are accepted only when the selected target parameter carries a supported reflected default value. Target member selection rejects malformed provider parameter facts such as missing/noncanonical passingMode, paramsArray on non-array types, paramsArray byref parameters, and default values without optional arity. Constructor, indexer, and extension-call selections require finalized source marker facts for byref parameters; call emission rejects mutated receiver/parameter-passing facts and unsupported finalized passing modes. Remains partial until delegate/callable invocation parameter-mode consumers and CLI/toolchain source-span diagnostics have full missing/mutated fact rejection coverage.",
  }),
  "operation.construct.provider-selected-constructor": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
      "packages/targets/csharp/emitter/testcases/common/collections/list-initializer/ListInitializer.ts",
    ]),
    notes:
      "Reviewed proof: provider-owned new expressions map only from TSTS-selected provider constructor declaration/signature identity; exact selected constructor signatures win over sibling overload search, overload refinement stays inside the proven provider constructor group, constructor byref parameters require finalized source marker facts, unsupported selected constructors report provider reasons, and non-source-owned constructors without selected target signature facts fail closed.",
  }),
  "operation.constructor.provider-selected-target": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
      "packages/targets/csharp/emitter/testcases/common/collections/list-initializer/ListInitializer.ts",
    ]),
    notes:
      "Reviewed proof: C# constructor operation facts carry the selected target constructor and constructed target result type from provider target facts; missing declaring/constructed type facts reject before backend emission, and the backend consumes finalized constructor operation facts rather than deriving target type from source spelling.",
  }),
  "operation.conversion.checked-target-conversion": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/type-assertions/TypeAssertions.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/VariableInit.ts",
      "test/fixtures/implicit-int-to-double/",
      "test/fixtures/default-param-int-to-double/",
    ]),
    notes:
      "Reviewed proof: target conversions are finalized as TSTS targetConversion facts, C# emission requires a matching C# target conversion operation fact, source assertion CLI coverage emits explicit System.Convert/cast output from finalized facts, provider conversion operators carry source and target type evidence, and mismatched, missing, or ambiguous conversion facts fail closed.",
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
      "operation.iteration.for-of.sync remains partial until destructuring iteration, async iteration policy, CLI execution, and old fixture parity are proven.",
    ]),
    notes:
      "Reviewed partial proof: for-of emits Roslyn loop AST only from finalized targetIteration facts. Provider foreach, selected JS string code-point iteration, missing-fact diagnostics, and wrong-kind/wrong-lowering rejections are covered; destructuring, async, and runtime/toolchain iteration coverage remain open.",
  }),
  "operation.property.provider-selected-member": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
    ]),
    notes:
      "Reviewed proof: provider-owned property and field access maps only from selected provider declaration identity, backend property access emits from a finalized C# operation fact rather than source spelling, same-spelling target members without selected identity reject, selected unsupported properties diagnose with provider reasons, and selected events reject until explicit source event semantics exist.",
  }),
  "operation.member.provider-property": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    notes:
      "Reviewed proof: selected provider member identity, not property source spelling, owns property/field operation mapping; CLI coverage emits provider static and instance member access from selected facts, and unsupported provider members fail closed with the recorded provider reason.",
  }),
  "operation.member.provider-indexer": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/collections/list-initializer/ListInitializer.ts",
      "packages/targets/csharp/emitter/testcases/common/types/dictionaries/Dictionaries.ts",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed proof: selected provider indexer identity and provider-owned Dictionary/List/native-array indexer facts map element access without target-name guessing; backend element access requires both the generic selected indexer fact and the finalized C# operation fact; missing or unsupported indexer facts reject.",
  }),
  "operation.element.provider-indexer": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/dictionaries/Dictionaries.ts",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    notes:
      "Reviewed proof: checked element access reaches the backend only through selected provider/surface indexer facts; backend emission stops after the primary missing C# operation diagnostic when the generic selected indexer fact is not enough, and emits Roslyn ElementAccessExpression only from finalized selected indexer facts.",
  }),
  "operation.throw.catch": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "operation.throw.catch remains partial until throw/catch/finally coverage spans provider exceptions, source-owned exception carriers, catch filters if supported, invalid destructured catch variables, and old fixture parity.",
    ]),
    notes:
      "Reviewed partial proof: statement planner requires finalized throwable/catch carrier facts, provider-dotnet CLI rejects throw statements until provider exception facts are finalized, and provider-backed throw/catch/finally execution builds and runs through the generated C# toolchain.",
  }),
  "operation.iteration.for-in.keys": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
    ]),
    blockers: Object.freeze([
      "operation.iteration.for-in.keys remains partial until provider-native keyed collections, destructuring keys, async interaction policy, runtime execution, precise source spans, and every old for-in fixture have current positive and fail-closed proof.",
    ]),
    notes:
      "Reviewed partial proof: for-in emission is driven by finalized C# targetIteration facts recorded only after TSTS accepts for-in. JS surface array/string for-in uses index-key facts, object-shape for-in uses object-shape key facts, and Record<string, T> for-in uses provider-owned Dictionary.Keys facts. Missing facts, wrong iteration kinds/lowerings, unsupported selected surface targets, and non-string key facts fail closed instead of falling back to syntax or source-name inference.",
  }),
  "operation.iteration.provider-target": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
    ]),
    blockers: Object.freeze([
      "operation.iteration.provider-target remains partial until every selected target iteration family has CLI/toolchain positive proof and missing/wrong-kind/unsupported targetIteration facts reject with capability-specific diagnostics across arrays, strings, records, provider collections, object shapes, and future async iteration policy.",
    ]),
    notes:
      "Reviewed partial proof: current array, JS surface, and object-shape CLI tests plus C# statement/surface tests prove iteration is not syntax-lowered directly. for-of and for-in require finalized targetIteration facts after TSTS accepts the source operation; JS arrays, strings, object-shape keys, Record/Dictionary keys, and standard array foreach emit from selected provider/surface facts, while missing or wrong iteration facts fail closed.",
  }),
  "operation.destructure.array-object": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/destructuring/ArrayDestructure.ts",
      "test/fixtures/array-destructuring/",
    ]),
    blockers: Object.freeze([
      "operation.destructure.array-object remains partial until assignment destructuring has finalized target storage/extraction facts, expression/statement assignment positives, object rest/default parity, provider-native array extraction, and every old destructuring fixture has current CLI/toolchain proof.",
    ]),
    notes:
      "Reviewed partial proof: old array destructuring emitter and fixture evidence is mapped to current binding-pattern and CLI proof. Parameter and variable binding patterns consume finalized array, tuple, and object-shape extraction facts; missing facts produce diagnostics; expression and statement assignment destructuring both fail closed instead of ordinary assignment fallback or stale lowering.",
  }),
  "expression.object-literal": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/edge-cases/inline-object-param/InlineObjectParam.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/object-literal-type-parameter/ObjectLiteralTypeParameter.ts",
      "packages/targets/csharp/emitter/testcases/common/types/anonymous-objects/AnonymousObjects.ts",
      "test/fixtures/object-literal-method-shorthand/",
      "test/fixtures/object-literal-object/",
    ]),
    blockers: Object.freeze([
      "expression.object-literal remains partial until inline parameters, generic type-parameter object literals, nested object literals, spread/rest/default members, and every old object-literal fixture are mapped to current provider facts and runtime/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: object literals receive expression-local generated adapter carriers such as __TsonicShape_Marker_* from finalized object-shape facts. Imported interface annotations remain storage/type facts on the declared variable and TypeReferenceNode, so the object literal does not overwrite the interface carrier or create a dual runtimeCarrier path.",
  }),
  "expression.property-access": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
    ]),
    blockers: Object.freeze([
      "expression.property-access remains partial until project-source properties, provider properties, fields, events, object-shape members, optional access, CLI/runtime execution, and old fixture parity are complete.",
    ]),
    notes:
      "Reviewed partial proof: source-owned object-shape property access uses finalized structural member facts; provider-owned property access requires selected TSTS/provider facts plus a finalized C# operation fact; backend emission does not choose target members from the source property spelling.",
  }),
  "expression.element-access": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/dictionaries/Dictionaries.ts",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([
      "expression.element-access remains partial until arrays, tuples, strings, dictionaries, provider indexers, optional element access, write operations, CLI/runtime execution, and old fixture parity are complete.",
    ]),
    notes:
      "Reviewed partial proof: element access emits only when selected provider/surface indexer facts and finalized C# operation facts exist; generic selected target facts alone block emission with diagnostics.",
  }),
  "expression.assignment": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-destructuring/",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    blockers: Object.freeze([
      "expression.assignment remains partial until property/indexer writes, compound assignments, destructuring storage facts, readonly diagnostics, CLI/runtime execution, and old fixture parity are complete.",
    ]),
    notes:
      "Reviewed partial proof: assignment emits canonical Roslyn AssignmentExpression only when the operator fact is finalized and both operands plan successfully; provider-owned assignment storage without selected target facts fails closed, and post-check target assignability validates writable provider members without redefining TypeScript assignability.",
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
      "statement.loop remains partial until destructuring iteration, top-level loop ordering, runtime/toolchain coverage, and old fixture parity are complete.",
    ]),
    notes:
      "Reviewed partial proof: while/for/do conditions require finalized bool carriers; for-of and for-in require finalized provider/surface iteration facts; wrong iteration facts and missing facts fail closed before C# AST emission.",
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
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/entrypoint-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
    ]),
    blockers: Object.freeze([
      "statement.top-level remains partial until export initialization, cycles, package-style imports, and old module fixture parity are complete.",
    ]),
    notes:
      "Reviewed partial proof: executable output creates a separate Roslyn AST entrypoint that calls the entry source module initializer, library output does not synthesize an entrypoint, and CLI/toolchain proof covers side-effect import order plus top-level field assignment inside static module constructors.",
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
  "carrier.object-shape": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/edge-cases/inline-object-param/InlineObjectParam.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/object-literal-type-parameter/ObjectLiteralTypeParameter.ts",
      "packages/targets/csharp/emitter/testcases/common/types/anonymous-objects/AnonymousObjects.ts",
      "packages/targets/csharp/emitter/testcases/common/types/interfaces/Interfaces.ts",
      "test/fixtures/object-literal-method-shorthand/",
      "test/fixtures/object-literal-object/",
    ]),
    blockers: Object.freeze([
      "carrier.object-shape remains partial until structural interface storage, generated adapter emission, inline object parameters, generic object literal paths, object spread/rest/default extraction, and full old fixture parity are covered end to end.",
    ]),
    notes:
      "Reviewed partial proof: generated object-shape adapters are expression-local carriers, while shared semantic Type and Symbol subjects retain declared interface/class/struct carriers. This prevents imported interface object literals from conflicting with declaration carriers and keeps missing shape/provider facts fail-closed instead of falling back to source spelling.",
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
      "Reviewed partial proof: opaque any property and element operations are not source-owned fallbacks; strict-native rejects them, compat rejects missing operation facts, backend property reads and property/element writes emit only from explicit closed operation facts with explicit argument projection, and direct property-assignment operation facts are rejected as insufficient evidence. Remains partial until real carrier get/set provider facts and runtime artifacts exist.",
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
      "Reviewed partial proof: any property/element reads require closed compat-runtime get facts; strict-native fails even if a fact is present, while compat mode requires the finalized operation fact before backend AST output. Backend C# AST planning now renders any element reads only from closed carrier facts with explicit key projection and fails closed when projection evidence is missing. Remains partial until TsValue/TsObject key semantics are real provider facts and runtime artifacts.",
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
      "Reviewed partial proof: property and element writes through any are caught at the opaque any operation node and require closed compat-runtime method operation facts with explicit source-argument projection rather than backend assignment guessing. Backend C# AST planning rejects direct property-assignment operation facts and renders property/element writes only from closed carrier facts with explicit value or key/value projection. Remains partial until explicit set/delete/update provider facts and runtime artifacts exist.",
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
      "Reviewed partial proof: current CLI emits TypeScript rest, default, and optional callable parameters from finalized C# carriers, while external-current C# provider tests enforce optional/params arity and reject omitted provider optional arguments when the reflected target default is missing or unsupported; remains partial until source-function negative coverage proves missing parameter facts fail closed.",
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
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
    ]),
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
      "Reviewed partial proof: stale old frontend lowering and validator units are mapped as fail-closed evidence, not as a legacy frontend path. Current C# backend tests reject semantic-only primitive/utility/callable type shapes, missing selected target call facts, bare instance target operations without value receivers, and non-static conversion-method facts. The final architecture requires missing facts to block emission with diagnostics instead of recovering through backend semantic inference.",
  }),
  "backend.no-semantic-strings": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../tsonic-csharp/test/csharp-printer.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/roslyn-boundary.test.mjs",
      "../tsonic-csharp/test/csharp-printer.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    ]),
    blockers: Object.freeze([
      "backend.no-semantic-strings remains partial because backend.csharp.no-direct-semantic-string-output is complete only for the C# AST/printer boundary; this broader backend gate still needs every backend/project/runtime artifact path to prove Roslyn-compatible AST or structured project artifacts without semantic string fallbacks.",
    ]),
    notes:
      "Reviewed partial proof: C# boundary tests prove no raw semantic output node kinds and printer tests fail closed for foreign raw syntax. The broad backend capability stays partial so the complete C# child does not imply every backend/project artifact path has finished no-semantic-string proof.",
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
      "test/cli-build/runtime-toolchain-proof.test.mjs",
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/runtime-toolchain-proof.test.mjs",
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-test-command/",
    ]),
    blockers: Object.freeze([
      "toolchain.csharp.project remains partial until every target-owned project property and reference shape has CLI build/run coverage through the current toolchain path.",
    ]),
    notes:
      "Reviewed partial proof: C# target options own project OutputType/PublishAot/target-framework related artifacts, generic custom properties cannot override target-owned properties, invalid option shapes fail before artifact emission, and current CLI proof builds generated projects with runtime-only, js, and nodejs reference selections.",
  }),
  "toolchain.csharp.build-run": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-test-command/",
      "test/fixtures/js-surface-runtime-builtins/",
      "test/fixtures/nodejs-path-posix-join/",
    ]),
    blockers: Object.freeze([
      "toolchain.csharp.build-run remains partial until all complete language capabilities have generated C# project build/run proof and downstream projects execute against the current architecture.",
    ]),
    notes:
      "Reviewed partial proof: provider-dotnet CLI suite now builds generated C# projects for provider-owned static/instance/nested/byref/generic/delegate/attribute/exception operations and runs provider-backed exception semantics; JS and Node surface suites provide separate selected-runtime build proof.",
  }),
  "toolchain.csharp.library": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/runtime-toolchain-proof.test.mjs",
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/runtime-toolchain-proof.test.mjs",
      "../tsonic-csharp/test/project-artifacts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-test-command/",
    ]),
    blockers: Object.freeze([
      "toolchain.csharp.library remains partial until library packaging, downstream consumption, and all target-owned reference combinations are covered through current CLI/toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: C# project emission defaults to deterministic Library OutputType, only emits executable output from explicit target options, and current CLI proof builds an explicitly configured library project without synthesizing a TsonicEntrypoint source artifact.",
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
  "diagnostic.missing-target-fact": Object.freeze({
    sourceExamples: Object.freeze([
      "return typeof value;",
      "return bytes.length;",
    ]),
    tstsDecision:
      "TSTS may accept the source operation, but emission requires selected target facts from providers or surfaces.",
    providerFacts: Object.freeze([
      "diagnosticSourceSpan",
      "missingTargetFactEvidence",
      "selectedOperationRequirement",
    ]),
    backendContract:
      "Backends and host gates emit diagnostics and suppress artifacts/toolchain work when required target facts are absent; they must not synthesize operations from syntax or names.",
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/lowering/plan-builders.test.ts",
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
      "packages/frontend/src/validator-maximus-cases/feature-gating.test.ts",
      "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs",
      "packages/targets/csharp/emitter/testcases/common/expected/operators/in-operator/InOperator.cs",
    ]),
    blockers: Object.freeze([
      "diagnostic.missing-target-fact remains partial until missing-fact negatives cover each backend operation family separately: provider calls/properties/indexers/conversions, JS/Node surface operations, object/array/tuple/union/nullish carriers, iteration/spread/destructuring, runtime artifacts, precise source spans, and no artifact/toolchain handoff.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "fail-closed-missing-target-fact",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-target-fact",
          "source-spelling-only",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-target-operation",
          "diagnostic-source-span",
          "target-fact-evidence",
        ]),
        operation: "emit-target-operation-after-facts",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "missing-target-fact-evidence",
          "source-spelling-only",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: current tests reject standalone typeof without a selected typeof operator fact, native array length without JS/provider length facts, structural operators without selected target facts, backend missing-fact diagnostics before artifact/toolchain handoff, and old unknown/object/in-operator assumptions as missing-fact replacements. This proves fail-closed behavior for selected holes, not exhaustive missing-fact coverage.",
  }),
  "diagnostic.missing-provider-fact": Object.freeze({
    sourceExamples: Object.freeze([
      "targets: [{ id: \"demo\" }]",
      "import { File } from \"@tsonic/dotnet/System.IO.js\";",
    ]),
    tstsDecision:
      "TSTS can only bind provider-owned modules after the selected target contributes a provider; no generated declaration or metadata file can stand in for a missing provider.",
    providerFacts: Object.freeze([
      "selectedTargetProviderFact",
      "providerOwnershipFact",
      "providerVirtualModuleFact",
      "missingProviderDiagnosticFact",
    ]),
    backendContract:
      "The host must diagnose missing providers before backend execution; backends must never synthesize provider facts from package names, declaration files, or metadata JSON.",
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/commands/restore.test.ts",
      "packages/cli/src/package-manifests/bindings.test.ts",
    ]),
    blockers: Object.freeze([
      "diagnostic.missing-provider-fact remains partial until every selected target, provider-owned virtual module, surface-owned virtual module, unowned import, missing dependency, and target-without-provider path has exact source-span diagnostics and proves no backend artifact emission.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "fail-closed-missing-provider-fact",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-selected-provider",
          "provider-owned-module-without-owner",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-target-provider",
          "provider-ownership",
          "provider-virtual-module",
        ]),
        operation: "bind-provider-owned-module",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "missing-provider-fact-evidence",
          "file-backed-provider-fallback-banned",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: host surface-composition tests diagnose target packs without providers before backend emission, and target-config tests reject generated .d.ts plus provider metadata JSON as hidden module fallbacks. This proves the provider path fails closed for selected missing-provider cases, not exhaustive provider ownership diagnostics.",
  }),
  "diagnostic.unsupported-surface": Object.freeze({
    sourceExamples: Object.freeze([
      "targets: [{ id: \"csharp\", surfaces: [\"nodejs\"] }]",
      "import path from \"node:path\";",
    ]),
    tstsDecision:
      "TSTS source acceptance does not select target surfaces; the host and surface provider own selected-surface validation.",
    providerFacts: Object.freeze([
      "selectedSurfaceFact",
      "surfaceDependencyFact",
      "surfaceOwnershipFact",
      "unsupportedSurfaceDiagnosticFact",
    ]),
    backendContract:
      "Unsupported, unknown, stale, missing-dependency, or unselected surfaces must diagnose before backend artifacts are emitted.",
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-surface-imports-negative/",
      "test/fixtures/source-package-surface-mismatch/",
    ]),
    blockers: Object.freeze([
      "diagnostic.unsupported-surface remains partial until every first-party surface selection, dependency, target compatibility, stale ownership, and unselected module path is covered with current diagnostics and source spans.",
    ]),
    notes:
      "Reviewed partial proof: host composition rejects stale/unowned selected surfaces, unknown surfaces, missing surface dependencies, and unselected Node-owned imports before backend artifacts. Operation-level selected-surface rejection is tracked separately by diagnostic.unsupported-selected-surface-operation.",
  }),
  "diagnostic.unsupported-selected-surface-operation": Object.freeze({
    sourceExamples: Object.freeze([
      "Object.assign({}, value);",
      "const assign = Object.assign;",
    ]),
    tstsDecision:
      "TSTS checks the selected JS declaration; the selected surface provider decides whether that declaration has target/runtime facts.",
    providerFacts: Object.freeze([
      "selectedSurfaceOperationFact",
      "unsupportedSurfaceOperationFact",
      "surfaceDiagnosticEvidenceFact",
    ]),
    backendContract:
      "Selected but unsupported surface operations must reject with the owning surface diagnostic and must not defer to backend name lookup or emit placeholder calls.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-disallowed-js-builtins/",
    ]),
    blockers: Object.freeze([
      "diagnostic.unsupported-selected-surface-operation remains partial until every selected JS/Node surface member without implementation has CLI/toolchain diagnostics, exact source spans, and no placeholder/runtime fallback.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "fail-closed-unsupported-selected-surface-operation",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "selected-surface-operation-unsupported",
          "missing-surface-target-operation",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-surface-operation",
          "surface-target-operation",
          "surface-runtime-artifact",
        ]),
        operation: "emit-selected-surface-operation",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "selected-surface-operation-unsupported",
          "property-valued-surface-member-unsupported",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: C# JS surface tests hard-reject selected Object.assign calls and property-valued access with CSHARP_JS_SURFACE_OPERATION_UNSUPPORTED instead of deferring to spelling, backend lookup, or placeholder runtime code. Completion requires the same fail-closed lane for all unsupported selected JS and Node surface operations.",
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
  "target.csharp.source-flow-marker-contract": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "target.csharp.source-flow-marker-contract remains partial until C# explicitly covers every portable source-flow marker with implemented or unsupported diagnostics through unit, CLI, and toolchain tests.",
    ]),
    notes:
      "Reviewed partial proof: C# currently rejects borrow, borrowMut, and move with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED from finalized TSTS flow facts. This is the explicit target contract until C# has a defined non-erased implementation.",
  }),
  "target.csharp.core-lang-intrinsics": Object.freeze({
    sourceExamples: Object.freeze([
      "import { defaultof, out, struct, field, borrow } from \"@tsonic/core/lang.js\";",
      "consume(out(value)); const zero = defaultof<int32>(); borrow(value);",
    ]),
    tstsDecision:
      "TSTS/source-core attach portable @tsonic/core/lang.js facts first; the C# target extension must then implement or reject each fact explicitly.",
    providerFacts: Object.freeze([
      "sourceCoreIntrinsicFact",
      "csharpIntrinsicImplementationFact",
      "csharpIntrinsicUnsupportedDiagnosticFact",
    ]),
    backendContract:
      "C# backend may emit intrinsic behavior only from finalized C# target facts; unsupported portable intrinsics must stop with capability-scoped diagnostics.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/core-intrinsics-provenance/",
      "test/fixtures/defaultof-intrinsic/",
      "test/fixtures/param-modifiers/",
    ]),
    blockers: Object.freeze([
      "target.csharp.core-lang-intrinsics remains partial until every portable @tsonic/core/lang.js intrinsic has C# implementation or explicit rejection proof through unit, CLI, build, runtime, invalid-source, source-span, and missing-fact gates.",
    ]),
    laneClassification: freezeLaneClassification({
      patternKind: "csharp-core-lang-intrinsic-contract",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "source-core-intrinsic-fact",
          "csharp-target-intrinsic-contract",
          "renderable-csharp-operation",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-csharp-target-intrinsic-contract",
          "unsupported-portable-intrinsic",
          "source-spelling-only",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "source-core-intrinsic-fact",
          "csharp-target-intrinsic-contract",
          "renderable-csharp-operation",
        ]),
        operation: "emit-or-diagnose-csharp-core-intrinsic",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "unsupported-portable-intrinsic",
          "source-spelling-only",
        ]),
      },
    }),
    notes:
      "Reviewed partial proof: C# currently implements storage passing markers as out/ref/in, emits neutral struct/field/defaultof facts in CLI paths, uses source-core out with provider .NET calls, records ptr/fnptr facts, and explicitly rejects borrow/borrowMut/move with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED. It is not complete until every source-core intrinsic has implementation or rejection evidence across all C# emission and diagnostic paths.",
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

  if (capabilityId.startsWith("architecture.")) {
    return {
      sourceExamples: ["import { compileProject } from \"@tsonic/host\";"],
      tstsDecision:
        "TSTS remains a source-analysis dependency only; product compiler/runtime source must stay ESM-only and native-compilable.",
      providerFacts: ["architectureValidationFact", "targetPackBoundaryFact"],
      backendContract:
        "Backends and target packs must expose final modules directly, not bridge through legacy shims, procedural policy blobs, or unapproved dependencies.",
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
  if (capabilityId.startsWith("architecture.")) {
    return "architecture-contract";
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
  if (capabilityId.startsWith("architecture.")) {
    return Object.freeze(["validated-product-path", "approved-package-boundary"]);
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
  if (capabilityId.startsWith("architecture.")) {
    return "validate-product-architecture";
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

function coreLangIntrinsicEvidence({
  exportName,
  factSlug,
  sourceKind,
  sourceExamples,
  sourceContract,
  providerFacts,
  targetContract,
  targetRequiredFacts,
  staticOperation,
  hardRejectReasons,
  positiveTests,
  negativeTests,
  oldEvidence,
  blockers,
  notes,
}) {
  const requiredFacts = Object.freeze([
    "source-core-module-identity",
    `source-core-lang.${factSlug}`,
    ...targetRequiredFacts,
    "selected-target-intrinsic-contract",
  ]);
  const rejectReasons = Object.freeze([...new Set([
    "missing-required-facts",
    "missing-source-core-module-identity",
    "missing-selected-target-intrinsic-contract",
    "source-spelling-only",
    "unsupported-target-intrinsic",
    ...hardRejectReasons,
  ])]);

  return Object.freeze({
    sourceExamples: Object.freeze([...sourceExamples]),
    tstsDecision:
      `TSTS checks ${exportName} as ordinary TypeScript ${sourceKind === "type-marker" ? "type syntax" : "call syntax"}; source-core attaches the portable intrinsic fact only from ${coreLangIntrinsicModuleSpecifier} module identity.`,
    providerFacts: Object.freeze([
      "sourceCoreModuleIdentityFact",
      "sourceCoreIntrinsicExportFact",
      ...providerFacts,
      "selectedTargetIntrinsicContractFact",
    ]),
    backendContract: targetContract,
    positiveTests: Object.freeze([...positiveTests]),
    negativeTests: Object.freeze([...negativeTests]),
    oldEvidence: Object.freeze([...oldEvidence]),
    blockers: Object.freeze([...blockers]),
    coreIntrinsic: freezeCoreIntrinsicContract({
      moduleSpecifier: coreLangIntrinsicModuleSpecifier,
      exportName,
      factSlug,
      sourceKind,
      sourceContract,
      targetContract,
      unsupportedTargetBehavior: "deterministic-diagnostic",
      requiredFacts,
    }),
    laneClassification: freezeLaneClassification({
      patternKind: "portable-source-core-intrinsic",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts,
        hardRejectIfMissing: rejectReasons,
      },
      staticNative: {
        lane: "static-native",
        requiredFacts,
        operation: staticOperation,
      },
      hardReject: {
        lane: "hard-reject",
        reasons: rejectReasons,
      },
    }),
    notes,
  });
}

function freezeCoreLangIntrinsicCoverageEntry(entry) {
  return Object.freeze({
    exportName: entry.exportName,
    factSlug: entry.factSlug,
    sourceKind: entry.sourceKind,
    capabilityId: entry.capabilityId,
  });
}

function freezeCoreIntrinsicContract(contract) {
  return Object.freeze({
    moduleSpecifier: contract.moduleSpecifier,
    exportName: contract.exportName,
    factSlug: contract.factSlug,
    sourceKind: contract.sourceKind,
    sourceContract: contract.sourceContract,
    targetContract: contract.targetContract,
    unsupportedTargetBehavior: contract.unsupportedTargetBehavior,
    requiredFacts: Object.freeze([...contract.requiredFacts]),
  });
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
    sourceExamples: Object.freeze(reviewedEvidence?.sourceExamples ?? defaults.sourceExamples),
    tstsDecision: reviewedEvidence?.tstsDecision ?? defaults.tstsDecision,
    providerFacts: Object.freeze(reviewedEvidence?.providerFacts ?? defaults.providerFacts),
    backendContract: reviewedEvidence?.backendContract ?? defaults.backendContract,
    runtimeContract: reviewedEvidence?.runtimeContract ?? defaults.runtimeContract,
    evidenceReview: reviewedEvidence === undefined ? "seeded" : "reviewed",
    positiveTests: Object.freeze(reviewedEvidence?.positiveTests ?? []),
    negativeTests: Object.freeze(reviewedEvidence?.negativeTests ?? []),
    oldEvidence: Object.freeze(reviewedEvidence?.oldEvidence ?? []),
    laneClassification,
    ...(reviewedEvidence?.coreIntrinsic === undefined ? {} : {
      coreIntrinsic: freezeCoreIntrinsicContract(reviewedEvidence.coreIntrinsic),
    }),
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

export function validateCapabilityLedger(entries, {
  requiredIds = requiredCapabilityIds,
  oldEvidencePaths = [],
} = {}) {
  if (!Array.isArray(entries)) {
    return ["capability ledger must be an array"];
  }

  const oldEvidencePathSet = new Set(oldEvidencePaths);
  return [
    ...validateCapabilityLedgerEntrySet(entries, requiredIds),
    ...entries.flatMap((entry) =>
      validateCapabilityLedgerEntry(entry).map((error) => `${capabilityIdForValidationError(entry)}: ${error}`)
    ),
    ...validateCompleteCapabilityCurrentProof(entries, oldEvidencePathSet),
    ...validateCompleteBroadCapabilityEvidence(entries),
  ];
}

function capabilityIdForValidationError(entry) {
  if (isPlainObject(entry) && typeof entry.capabilityId === "string" && entry.capabilityId.length > 0) {
    return entry.capabilityId;
  }
  return "<unknown>";
}

function validateCapabilityLedgerEntrySet(entries, requiredIds) {
  const errors = [];
  const seenCapabilityIds = new Set();

  for (const entry of entries) {
    if (!isPlainObject(entry) || typeof entry.capabilityId !== "string") {
      continue;
    }

    if (seenCapabilityIds.has(entry.capabilityId)) {
      errors.push(`duplicate capabilityId: ${entry.capabilityId}`);
    }
    seenCapabilityIds.add(entry.capabilityId);
  }

  for (const capabilityId of requiredIds) {
    if (!seenCapabilityIds.has(capabilityId)) {
      errors.push(`missing required capabilityId: ${capabilityId}`);
    }
  }

  return errors;
}

function validateCompleteBroadCapabilityEvidence(entries) {
  const errors = [];
  const entriesByCapabilityId = new Map(entries
    .filter((entry) => isPlainObject(entry) && typeof entry.capabilityId === "string")
    .map((entry) => [entry.capabilityId, entry]));

  for (const entry of entriesByCapabilityId.values()) {
    if (entry.status !== "complete") {
      continue;
    }

    const subCapabilities = [...entriesByCapabilityId.values()]
      .filter((candidate) => candidate.capabilityId.startsWith(`${entry.capabilityId}.`));
    for (const subCapability of subCapabilities) {
      if (subCapability.status !== "complete") {
        errors.push(
          `${entry.capabilityId}: complete broad capabilities require complete sub-capability evidence; ${subCapability.capabilityId} is ${subCapability.status}`,
        );
      }
    }
  }

  return errors;
}

function validateCompleteCapabilityCurrentProof(entries, oldEvidencePathSet) {
  if (oldEvidencePathSet.size === 0) {
    return [];
  }

  const errors = [];
  for (const entry of entries) {
    if (!isPlainObject(entry) || entry.status !== "complete") {
      continue;
    }

    const positiveTests = Array.isArray(entry.positiveTests) ? entry.positiveTests : [];
    const negativeTests = Array.isArray(entry.negativeTests) ? entry.negativeTests : [];
    const oldPositiveTests = positiveTests.filter((testPath) => oldEvidencePathSet.has(testPath));
    const oldNegativeTests = negativeTests.filter((testPath) => oldEvidencePathSet.has(testPath));

    if (positiveTests.length > 0 && oldPositiveTests.length === positiveTests.length) {
      errors.push(`${entry.capabilityId}: complete capabilities must have current positiveTests`);
    }
    if (negativeTests.length > 0 && oldNegativeTests.length === negativeTests.length) {
      errors.push(`${entry.capabilityId}: complete capabilities must have current negativeTests`);
    }
    if (oldPositiveTests.length > 0) {
      errors.push(`${entry.capabilityId}: positiveTests must not reference old evidence paths`);
    }
    if (oldNegativeTests.length > 0) {
      errors.push(`${entry.capabilityId}: negativeTests must not reference old evidence paths`);
    }
  }

  return errors;
}

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
  validateEnumField(errors, entry, "evidenceReview", capabilityEvidenceReviewStatusSet, capabilityEvidenceReviewStatuses);
  validateStringArrayField(errors, entry, "positiveTests");
  validateStringArrayField(errors, entry, "negativeTests");
  validateStringArrayField(errors, entry, "oldEvidence");
  validateEvidenceArrays(errors, entry);
  validateCompleteCapabilityProof(errors, entry);
  validateStringArrayField(errors, entry, "blockers");
  validateBlockerCompleteness(errors, entry);
  validateStringField(errors, entry, "notes");
  validateCoreIntrinsicContract(errors, entry);
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

function validateEvidenceArrays(errors, entry) {
  validateUniqueStringArray(errors, entry.positiveTests, "positiveTests");
  validateUniqueStringArray(errors, entry.negativeTests, "negativeTests");
  validateUniqueStringArray(errors, entry.oldEvidence, "oldEvidence");

  if (!Array.isArray(entry.oldEvidence)) {
    return;
  }

  const oldEvidenceSet = new Set(entry.oldEvidence);
  if (Array.isArray(entry.positiveTests)) {
    for (const positiveTest of entry.positiveTests) {
      if (oldEvidenceSet.has(positiveTest)) {
        errors.push("positiveTests must not reuse oldEvidence paths");
        break;
      }
    }
  }
  if (Array.isArray(entry.negativeTests)) {
    for (const negativeTest of entry.negativeTests) {
      if (oldEvidenceSet.has(negativeTest)) {
        errors.push("negativeTests must not reuse oldEvidence paths");
        break;
      }
    }
  }
}

function validateUniqueStringArray(errors, value, field) {
  if (!Array.isArray(value)) {
    return;
  }
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    if (seen.has(item)) {
      errors.push(`${field} must not contain duplicate entries`);
      return;
    }
    seen.add(item);
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

function validateCoreIntrinsicContract(errors, entry) {
  const expectedIntrinsic = coreLangIntrinsicCoverageByCapabilityId.get(entry.capabilityId);
  if (expectedIntrinsic === undefined) {
    return;
  }

  const contract = entry.coreIntrinsic;
  if (!isPlainObject(contract)) {
    errors.push("coreIntrinsic must be an object");
    return;
  }

  if (contract.moduleSpecifier !== coreLangIntrinsicModuleSpecifier) {
    errors.push(`coreIntrinsic.moduleSpecifier must be ${coreLangIntrinsicModuleSpecifier}`);
  }
  if (contract.exportName !== expectedIntrinsic.exportName) {
    errors.push(`coreIntrinsic.exportName must be ${expectedIntrinsic.exportName}`);
  }
  if (contract.factSlug !== expectedIntrinsic.factSlug) {
    errors.push(`coreIntrinsic.factSlug must be ${expectedIntrinsic.factSlug}`);
  }
  if (contract.sourceKind !== expectedIntrinsic.sourceKind) {
    errors.push(`coreIntrinsic.sourceKind must be ${expectedIntrinsic.sourceKind}`);
  } else if (!coreLangIntrinsicSourceKindSet.has(contract.sourceKind)) {
    errors.push("coreIntrinsic.sourceKind must be call-marker or type-marker");
  }
  validateNestedStringField(errors, contract, "coreIntrinsic.sourceContract");
  validateNestedStringField(errors, contract, "coreIntrinsic.targetContract");
  if (!coreLangUnsupportedTargetBehaviorSet.has(contract.unsupportedTargetBehavior)) {
    errors.push("coreIntrinsic.unsupportedTargetBehavior must be deterministic-diagnostic");
  }
  validateRequiredFacts(errors, contract, "coreIntrinsic.requiredFacts");
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
    if (!possibleLanes.includes("hard-reject")) {
      errors.push("laneClassification.possibleLanes must include hard-reject");
    }
  }
  validateLaneBehavior(errors, classification.strictNative, "laneClassification.strictNative");
  validateStrictNativeBehavior(errors, classification.strictNative, possibleLanes);
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
    } else if (!capabilityCompatRuntimeCarrierSet.has(classification.compat.runtimeCarrier)) {
      errors.push(`laneClassification.compat.runtimeCarrier must be one of ${capabilityCompatRuntimeCarriers.join(", ")}`);
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

function validateStrictNativeBehavior(errors, behavior, possibleLanes) {
  if (!isPlainObject(behavior) || typeof behavior.lane !== "string" || !capabilityLaneSet.has(behavior.lane)) {
    return;
  }
  if (behavior.lane === "compat-runtime") {
    errors.push("laneClassification.strictNative.lane must be static-native or hard-reject");
  }
  if (Array.isArray(possibleLanes) && possibleLanes.length > 0 && !possibleLanes.includes(behavior.lane)) {
    errors.push("laneClassification.strictNative.lane must be listed in laneClassification.possibleLanes");
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
