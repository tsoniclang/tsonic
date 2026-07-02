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

export const capabilityOldEvidenceAbsenceStatuses = Object.freeze([
  "reviewed-none-found",
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

export const capabilitySurfaceEvidenceGateNames = Object.freeze([
  "selectedOperationFacts",
  "providerFacts",
  "backendEmission",
  "runtimeBehavior",
  "failClosedDiagnostics",
  "backendNoFallback",
]);

const capabilityStatusSet = new Set(capabilityStatuses);
const capabilityEvidenceReviewStatusSet = new Set(capabilityEvidenceReviewStatuses);
const capabilityOldEvidenceAbsenceStatusSet = new Set(capabilityOldEvidenceAbsenceStatuses);
const capabilityOwnerSet = new Set(capabilityOwners);
const capabilityLaneSet = new Set(capabilityLaneNames);
const capabilityCompatRuntimeCarrierSet = new Set(capabilityCompatRuntimeCarriers);
const bannedCompatMechanismPattern = /QuickJS|Reflection|dynamic|GetProperty|GetProperties|GetMethod|GetMethods|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load/u;
const mapSetCapabilityId = "surface.js.map-set";
const mapSetRequiredPossibleLanes = Object.freeze(["static-native", "compat-runtime", "hard-reject"]);
const mapSetRequiredStaticNativeFacts = Object.freeze([
  "selected static-native Map/Set lane",
  "provider equality semantics evidence",
]);
const mapSetRequiredCompatFacts = Object.freeze([
  "closed JS Map/Set runtime carrier",
  "JS SameValueZero equality metadata",
]);
const mapSetRequiredHardRejectReasons = Object.freeze([
  "clr-equality-not-full-js-compat",
  "unsupported-selected-map-set-operation",
]);

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
const slice4DotnetProviderContractPositiveTests = Object.freeze([
  "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
  "../tsonic-csharp/test/dotnet-provider.test.mjs",
]);
const slice4DotnetProviderContractNegativeTests = Object.freeze([
  "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
  "../tsonic-csharp/test/dotnet-provider.test.mjs",
]);
const slice4DotnetProviderContractOldEvidence = Object.freeze([
  "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
  "packages/targets/csharp/emitter/testcases/common/extensions/linq/ExtensionMethods.ts",
]);
const slice4DotnetProviderContractRows = Object.freeze([
  {
    capabilityId: "native.dotnet.contract.provider-ref-qualification",
    title: ".NET provider refs are fully qualified before TSTS declaration conversion",
    notes:
      "Reviewed proof: raw .NET provider refs that reach sourceShape, heritage, signatures, or target declarations must carry moduleSpecifier/exportName and must not use the legacy name-only shape. Provider-model and TSTS declaration-model contract tests reject incomplete provider refs before virtual declaration conversion; reflected CLSCompliantAttribute proves the valid base provider-ref shape.",
  },
  {
    capabilityId: "native.dotnet.contract.assembly-qualified-target-id",
    title: ".NET provider target identities are assembly-qualified where assemblies are known",
    notes:
      "Reviewed proof: .NET provider contracts reject metadataName-only target identities when assembly facts exist, assembly identity tests prove duplicate Shared.Widget declarations do not first-win by source name, and target binding lookup does not accept metadata-only identities.",
  },
  {
    capabilityId: "native.dotnet.contract.unsupported-export-evidence",
    title: ".NET unsupported exports preserve deterministic target evidence",
    notes:
      "Reviewed proof: requested unsupported exports return DOTNET_PROVIDER_REQUESTED_EXPORT_UNSUPPORTED with sourceName, targetId/metadataName or targetIds/metadataNames, and reason evidence, instead of collapsing to a generic missing export or silently omitting the declaration.",
  },
  {
    capabilityId: "native.dotnet.contract.unsupported-type-family-evidence",
    title: ".NET unsupported type families identify every rejected target identity",
    notes:
      "Reviewed proof: unsupported type-family exports must carry matching targetIds and metadataNames arrays, non-empty reason evidence, and assembly references when present; contract tests reject holes before provider declaration conversion.",
  },
  {
    capabilityId: "native.dotnet.contract.signature-return-type",
    title: ".NET callable provider signatures carry explicit return metadata",
    notes:
      "Reviewed proof: provider declaration and raw model contracts require non-constructor source-callable signatures to carry explicit returnType and reject invalid callable source declarations before TSTS consumes them.",
  },
  {
    capabilityId: "native.dotnet.contract.parameter-passing-mode-values",
    title: ".NET provider parameters use a closed passing-mode enum",
    notes:
      "Reviewed proof: .NET provider contracts accept only by-value, byref-readonly, byref-readwrite, and byref-writeonly-must-init passing modes; invalid modes are deterministic provider-model diagnostics, not backend guesses.",
  },
  {
    capabilityId: "native.dotnet.contract.params-array-shape",
    title: ".NET params-array facts require final by-value array parameters",
    notes:
      "Reviewed proof: provider contracts reject params/rest parameters that are not final, not by-value, or not array-typed, and reflected Console.WriteLine/fixture params signatures preserve the target paramsArray facts consumed by selection.",
  },
  {
    capabilityId: "native.dotnet.contract.default-value-optional-only",
    title: ".NET default parameter values only appear on optional parameters",
    notes:
      "Reviewed proof: provider contracts reject defaultValue on non-optional parameters; reflection tests prove supported default values remain target metadata only and source virtual declarations expose optionality without fabricating source default expressions.",
  },
  {
    capabilityId: "native.dotnet.contract.unsupported-default-exclusive",
    title: ".NET unsupported defaults are exclusive provider evidence",
    notes:
      "Reviewed proof: provider contracts reject parameters that carry both supported and unsupported defaults, and unsupported default tests prove DateTime defaults remain unsupported provider evidence without source-visible defaults.",
  },
  {
    capabilityId: "native.dotnet.contract.type-parameter-identity",
    title: ".NET generic type parameters have stable names and variance contracts",
    notes:
      "Reviewed proof: provider contracts reject missing/duplicate type parameter names and unsupported variance values; reflected List<T>, Dictionary<TKey,TValue>, delegates, and constraint fixtures preserve generic arity and stable names across raw model, declaration model, and target bindings.",
  },
  {
    capabilityId: "native.dotnet.contract.constraint-evidence",
    title: ".NET generic constraints remain provider target facts",
    notes:
      "Reviewed proof: reflected constraints are preserved as target facts and kept out of source virtual declarations; invalid constraint metadata is contract-diagnosed and unsupported constraints carry deterministic target-only evidence.",
  },
  {
    capabilityId: "native.dotnet.contract.event-unsupported-evidence",
    title: ".NET source-visible events require explicit unsupported evidence",
    notes:
      "Reviewed proof: events are retained as target facts but rejected as source-visible members unless matching unsupported event evidence exists, preventing silent event omission or fake source event semantics.",
  },
  {
    capabilityId: "native.dotnet.contract.native-array-source-shape",
    title: ".NET explicit native Array<T> source shape is provider-owned",
    notes:
      "Reviewed proof: explicit @tsonic/dotnet Array<T> is discoverable by provider target id, carries provider-ref return shapes for Array.create<T>(), and does not alter ordinary TypeScript T[] semantics.",
  },
  {
    capabilityId: "native.dotnet.contract.delegate-source-shape",
    title: ".NET delegates expose source callable shells only with function sourceShape",
    notes:
      "Reviewed proof: reflected delegates preserve real provider target identity and attach csharpDelegateSignature only when sourceShape.kind is function; unsupported pointer/byref delegates remain target-only and do not fabricate callable source shells.",
  },
  {
    capabilityId: "native.dotnet.contract.target-binding-index",
    title: ".NET target bindings are indexed by provider target identity",
    notes:
      "Reviewed proof: provider invariant scans require every reflected supported and target-only type declaration to have a matching target binding by targetId; metadataName-only lookup is not accepted for provider semantics.",
  },
  {
    capabilityId: "provider.virtual-module.contract.export-identity",
    title: "Provider virtual exports preserve stable declaration identity",
    notes:
      "Reviewed proof: .NET virtual declaration models validate export ids, export names, targetIdentity, and duplicate export names before TSTS binding; unsupported exports diagnose with provider evidence rather than file fallback.",
  },
  {
    capabilityId: "provider.virtual-module.contract.member-signature-identity",
    title: "Provider virtual members and signatures preserve selected identity",
    notes:
      "Reviewed proof: provider declaration-model contracts require unique member ids and signature ids, and provider-selection tests consume exact selected declaration/signature identity without sibling overload fallback or source spelling search.",
  },
  {
    capabilityId: "provider.virtual-module.contract.dependency-provider-ref-slice",
    title: "Provider dependency refs keep module ownership across slices",
    notes:
      "Reviewed proof: declaration-model dependency refs are qualified through provider dependency module specifiers, dependency slices resolve through provider virtual files, and cross-module inherited refs keep owning module identity.",
  },
  {
    capabilityId: "provider.virtual-module.contract.unsliced-request-rejection",
    title: "Provider declaration requests reject implicit broad imports",
    notes:
      "Reviewed proof: .NET provider declaration loading requires requestedExports or explicit broadImport, rejects unsliced declaration-model requests, and does not silently widen to broad namespace imports.",
  },
  {
    capabilityId: "diagnostic.provider-contract-invalid",
    title: "Invalid provider metadata produces structured deterministic diagnostics",
    notes:
      "Reviewed proof: provider-model and declaration-model contract violations return structured DOTNET_PROVIDER_* diagnostics with path/value evidence before TSTS declaration conversion or backend planning.",
  },
]);
const slice4SourceCoreContractPositiveTests = Object.freeze([
  "packages/source-core/src/source-extension.test.ts",
  "../tsonic-csharp/test/source-semantics.test.mjs",
  "../tsonic-csharp/test/core-lang-planner.test.mjs",
]);
const slice4SourceCoreContractNegativeTests = Object.freeze([
  "packages/source-core/src/source-extension.test.ts",
  "../tsonic-csharp/test/source-semantics.test.mjs",
  "../tsonic-csharp/test/core-lang-planner.test.mjs",
]);
const slice4SourceCoreCommonOldEvidence = Object.freeze([
  "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
]);
const slice4SourceCoreFieldOldEvidence = Object.freeze([
  ...slice4SourceCoreCommonOldEvidence,
  "packages/targets/csharp/emitter/testcases/common/classes/field-marker/FieldMarker.ts",
]);
const slice4SourceCoreStructOldEvidence = Object.freeze([
  ...slice4SourceCoreCommonOldEvidence,
  "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
]);
const slice4SourceCoreAttributeOldEvidence = Object.freeze([
  ...slice4SourceCoreCommonOldEvidence,
  "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
]);
const slice4SourceCorePointerOldEvidence = Object.freeze([
  ...slice4SourceCoreCommonOldEvidence,
  "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
]);
const slice4SourceCoreContractRows = Object.freeze([
  {
    capabilityId: "source-core.contract.module-ownership",
    title: "Source-core owns portable core modules exactly once",
    notes:
      "Reviewed proof: @tsonic/core/lang.js and @tsonic/core/types.js are owned by the source-core provider, while C# aliases do not own or redefine those portable modules.",
  },
  {
    capabilityId: "source-core.contract.target-alias-nonownership",
    title: "Target aliases consume source-core facts without redefining core contracts",
    notes:
      "Reviewed proof: C# target aliases map to target facts after source-core primitive/marker facts exist, and source-semantics tests prove C# alias provider does not own portable core modules.",
  },
  {
    capabilityId: "source-core.contract.storage-marker-alias",
    title: "Storage markers preserve facts through imports, aliases, and namespaces",
    notes:
      "Reviewed proof: out/ref/inref facts are recorded from direct, aliased, and namespace imports by provider identity rather than source spelling.",
  },
  {
    capabilityId: "source-core.contract.storage-marker-no-local-guess",
    title: "Storage markers do not attach facts to local or shadowed names",
    notes:
      "Reviewed proof: same-spelling local functions, declared local modules, and shadowed marker names receive no storage facts and do not become backend parameter-mode evidence.",
  },
  {
    capabilityId: "source-core.contract.non-storage-diagnostics",
    title: "Byref source markers reject non-storage expressions deterministically",
    notes:
      "Reviewed proof: out/ref/inref calls on non-storage expressions produce source-core diagnostics and do not produce selected target argument facts for C# emission.",
  },
  {
    capabilityId: "source-core.contract.struct-field-owner-finalization",
    title: "Struct and default facts finalize owner evidence",
    oldEvidence: slice4SourceCoreStructOldEvidence,
    notes:
      "Reviewed proof: struct and default owner facts are finalized from static source AST evidence, including non-identifier field names, without backend inference.",
  },
  {
    capabilityId: "source-core.contract.field-type-evidence-required",
    title: "Field markers require explicit type evidence",
    oldEvidence: slice4SourceCoreFieldOldEvidence,
    notes:
      "Reviewed proof: field() without explicit type evidence is diagnosed for direct, namespace, and alias forms; no FieldFact is attached by spelling or fallback.",
  },
  {
    capabilityId: "source-core.contract.attribute-type-evidence-required",
    title: "Attribute markers require explicit type evidence",
    oldEvidence: slice4SourceCoreAttributeOldEvidence,
    notes:
      "Reviewed proof: attribute() without explicit type evidence is diagnosed for direct, namespace, and alias forms; C# attribute emission consumes finalized attribute facts only.",
  },
  {
    capabilityId: "source-core.contract.defaultof-type-evidence-required",
    title: "defaultof markers require explicit type evidence",
    notes:
      "Reviewed proof: defaultof() without explicit type evidence is diagnosed for direct, namespace, and alias forms; C# default expression emission consumes finalized target-default facts only.",
  },
  {
    capabilityId: "source-core.contract.ptr-type-marker-evidence",
    title: "ptr type markers attach pointer facts only from provider-owned type references",
    oldEvidence: slice4SourceCorePointerOldEvidence,
    notes:
      "Reviewed proof: ptr<T> facts are recorded from direct, alias, and namespace imports, including nested pointer forms, and shadowed local type aliases receive no pointer facts.",
  },
  {
    capabilityId: "source-core.contract.fnptr-type-marker-evidence",
    title: "fnptr type markers attach function-pointer facts only from provider-owned type references",
    oldEvidence: slice4SourceCorePointerOldEvidence,
    notes:
      "Reviewed proof: fnptr<TArgs,TReturn> facts are recorded from direct, alias, namespace, tuple, and scalar parameter forms, while invalid arity remains a TSTS diagnostic and no source-core fact is attached.",
  },
  {
    capabilityId: "source-core.contract.type-marker-shadowing",
    title: "Pointer type markers are shadow-safe",
    oldEvidence: slice4SourceCorePointerOldEvidence,
    notes:
      "Reviewed proof: local generic type aliases and shadowed namespace generic type names do not receive ptr/fnptr facts even when the source spelling matches portable marker names.",
  },
  {
    capabilityId: "source.marker.contract.out-ref-inref-facts",
    title: "out/ref/inref marker facts are neutral source facts",
    notes:
      "Reviewed proof: source-core records neutral argument-passing and storage facts for out/ref/inref without C# policy, and C# consumes those facts only after selected provider signatures require the modes.",
  },
  {
    capabilityId: "source.marker.contract.attribute-facts",
    title: "attribute marker facts are neutral source facts",
    oldEvidence: slice4SourceCoreAttributeOldEvidence,
    notes:
      "Reviewed proof: source-core records attribute application facts from explicit source evidence, and C# validates placement/arguments instead of source-core hardcoding C# attributes.",
  },
  {
    capabilityId: "source.marker.contract.struct-field-facts",
    title: "struct and field marker facts are neutral value-shape facts",
    oldEvidence: slice4SourceCoreStructOldEvidence,
    notes:
      "Reviewed proof: source-core records struct/field facts as portable value-shape evidence, while C# target semantics map those facts to C# value-type carriers only from finalized facts.",
  },
  {
    capabilityId: "source.marker.contract.ptr-fnptr-facts",
    title: "ptr and fnptr marker facts are neutral pointer type facts",
    oldEvidence: slice4SourceCorePointerOldEvidence,
    notes:
      "Reviewed proof: source-core records ptr/fnptr type facts without target lowering; C# planner renders pointer/function-pointer AST only from finalized nested type facts.",
  },
  {
    capabilityId: "target.csharp.core-lang.out-ref-inref-fact-consumption",
    title: "C# consumes out/ref/inref only from finalized marker facts",
    notes:
      "Reviewed proof: C# source semantics records selected out/ref/inref parameter-mode facts from source-core markers and rejects local/shadowed markers without consuming source spelling.",
  },
  {
    capabilityId: "target.csharp.core-lang.struct-field-carrier",
    title: "C# maps struct/field facts to value-type carriers",
    oldEvidence: slice4SourceCoreStructOldEvidence,
    notes:
      "Reviewed proof: C# source semantics maps source-core struct declarations to one named value-type carrier and preserves field facts without old TypeScript-only inheritance markers.",
  },
  {
    capabilityId: "target.csharp.core-lang.attribute-application",
    title: "C# maps attribute facts to C# attribute applications",
    oldEvidence: slice4SourceCoreAttributeOldEvidence,
    notes:
      "Reviewed proof: C# attribute tests consume finalized AttributeFact data for class/member/parameter/return placement and reject unsupported target specifiers deterministically.",
  },
  {
    capabilityId: "target.csharp.core-lang.ptr-fnptr-rendering",
    title: "C# renders ptr/fnptr only from finalized source-core type facts",
    oldEvidence: slice4SourceCorePointerOldEvidence,
    notes:
      "Reviewed proof: C# planner emits pointer and function-pointer target AST from finalized ptr/fnptr facts and fails closed for unproven type-marker evidence.",
  },
]);
const slice4ProviderCallContractPositiveTests = Object.freeze([
  "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
  "../tsonic-csharp/test/provider-selection.test.mjs",
  "../tsonic-csharp/test/call-operation-facts.test.mjs",
]);
const slice4ProviderCallContractNegativeTests = Object.freeze([
  "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
  "../tsonic-csharp/test/provider-selection.test.mjs",
  "../tsonic-csharp/test/call-operation-facts.test.mjs",
]);
const slice4ProviderCallContractOldEvidence = Object.freeze([
  "packages/targets/csharp/emitter/testcases/common/functions/default-params/DefaultParams.ts",
  "packages/targets/csharp/emitter/testcases/common/functions/optional-callbacks/OptionalParams.ts",
  "test/fixtures/param-modifiers/",
]);
const slice4ProviderCallContractRows = Object.freeze([
  {
    capabilityId: "operation.call.provider.parameter-mode.byref-marker-consumption",
    title: "Provider calls consume out/ref/inref only from finalized marker facts",
    notes:
      "Reviewed proof: selected provider call facts carry reflected byref passing modes, and argument emission requires finalized source marker/storage facts rather than parameter names or byref spelling.",
  },
  {
    capabilityId: "operation.call.provider.parameter-mode.mutated-fact-rejection",
    title: "Provider call emission rejects mutated parameter-mode facts",
    notes:
      "Reviewed proof: call-operation fact tests reject mutated receiver, parameter-passing, selected-member, and unsupported passing-mode facts before C# emission can fall back to syntax or target member lookup.",
  },
  {
    capabilityId: "operation.call.provider.parameter-mode.params-array-arity",
    title: "Provider params-array calls use selected params metadata for arity",
    notes:
      "Reviewed proof: optional-params tests preserve reflected params-array facts, selection accepts extra arguments only through paramsArray metadata, and contract tests reject invalid params-array shapes.",
  },
  {
    capabilityId: "operation.call.provider.parameter-mode.optional-default-arity",
    title: "Provider optional parameters use reflected defaults for omitted arguments",
    notes:
      "Reviewed proof: selected target-member identity accepts omitted optional arguments only when deterministic reflected default metadata exists and rejects optional-without-default omission.",
  },
  {
    capabilityId: "operation.call.provider.parameter-mode.unsupported-default-rejection",
    title: "Provider optional parameters with unsupported defaults fail closed",
    notes:
      "Reviewed proof: unsupported default parameter values remain target evidence, source declarations do not expose fake defaults, and selection rejects omitted arguments when the selected default is unsupported.",
  },
  {
    capabilityId: "function.default-rest-optional-params.provider-defaults",
    title: "Provider default parameters are target metadata, not source syntax defaults",
    notes:
      "Reviewed proof: reflected default metadata is retained only in target facts, source virtual declarations expose optional parameters without defaultValue expressions, and backend selection consumes target defaults.",
  },
  {
    capabilityId: "function.default-rest-optional-params.provider-params-array",
    title: "Provider rest/params parameters are final by-value array target facts",
    notes:
      "Reviewed proof: params-array facts survive raw model, declaration model, target binding, and selected call arity checks, and malformed params metadata is rejected by the provider contract validator.",
  },
  {
    capabilityId: "function.default-rest-optional-params.provider-unsupported-defaults",
    title: "Unsupported provider defaults remain diagnostics, not source defaults",
    notes:
      "Reviewed proof: unsupported defaults carry parameter identity/reason evidence and do not become source defaults or backend omission fallbacks.",
  },
]);

const baseCapabilityDefinitions = Object.freeze([
  ["host.config.project-load", "Load current tsonic project config", "complete", "tsonic-host"],
  ["host.config.target-selection", "Select configured target pack", "complete", "tsonic-host"],
  ["host.config.surface-selection", "Select target-supported compatibility surfaces", "complete", "tsonic-host"],
  ["host.config.no-legacy-config", "Reject legacy config shapes", "complete", "tsonic-host"],
  ["host.graph.source-files", "Use TSTS source graph as project file graph", "complete", "tsonic-host"],
  ["host.package.composition", "Compose target, providers, surfaces, backend, runtime, and toolchain", "complete", "tsonic-host"],
  ["host.project.package-discovery", "Discover project packages without legacy package-root shims", "complete", "tsonic-host"],
  ["host.project.target-selection", "Select target by target id", "complete", "tsonic-host"],
  ["host.project.surface-selection", "Select surfaces by target capability", "complete", "tsonic-host"],
  ["host.project.surface-dependency-validation", "Validate selected surface dependency graph before providers run", "complete", "tsonic-host"],
  ["host.project.provider-composition", "Compose provider set for a compile session", "complete", "tsonic-host"],
  ["host.project.surface-extension-composition", "Compose selected surface extensions as first-class compiler contributors", "complete", "tsonic-host"],
  ["host.project.module-graph", "Create one deterministic project module graph from TSTS source files", "complete", "tsonic-host"],
  ["host.project.package-path-resolution", "Resolve project packages, package exports, and paths without package-root shims", "complete", "tsonic-host"],
  ["host.project.deterministic-output-paths", "Derive deterministic output paths from validated project-relative source paths", "complete", "tsonic-host"],
  ["host.project.clean-rebuild", "Clean rebuild removes stale target artifacts without preserving legacy output", "complete", "tsonic-host"],
  ["host.project.top-level-initialization-order", "Preserve deterministic module top-level initialization order", "complete", "tsonic-host"],

  ["module.graph.source-files", "Resolve ordinary TypeScript source file graph", "complete", "tsts-api"],
  ["module.import.named", "Support named ESM imports", "complete", "tsts-api"],
  ["module.import.default", "Support default ESM imports", "complete", "tsts-api"],
  ["module.import.namespace", "Support namespace ESM imports", "complete", "tsts-api"],
  ["module.import.type-only", "Support type-only ESM imports", "complete", "tsts-api"],
  ["module.import.side-effect", "Support side-effect imports and module initialization order", "complete", "tsts-api"],
  ["module.export.named", "Support named ESM exports", "complete", "tsts-api"],
  ["module.export.default", "Support default ESM exports", "complete", "tsts-api"],
  ["module.export.reexport", "Support re-exports and export-star", "complete", "tsts-api"],
  ["module.package.exports-subpath", "Resolve package exports and subpaths", "complete", "tsonic-host"],
  ["module.path-mapping", "Support or diagnose tsconfig path mapping", "complete", "tsonic-host"],
  ["module.emit.multi-file", "Emit deterministic target files for multi-file source projects", "complete", "csharp-backend"],
  ["module.emit.top-level-order", "Emit deterministic module top-level initialization order", "complete", "csharp-backend"],

  ["tsts.parse-bind-check", "TSTS owns parse, bind, and check", "complete", "tsts-api"],
  ["tsts.flow-narrowing", "TSTS owns source flow narrowing", "complete", "tsts-api"],
  ["tsts.contextual-typing", "TSTS owns source contextual typing", "complete", "tsts-api"],
  ["tsts.generic-inference", "TSTS owns source generic inference", "complete", "tsts-api"],
  ["tsts.overload-resolution", "TSTS owns source overload resolution", "complete", "tsts-api"],
  ["tsts.consumer-queries", "Backends consume stable public TSTS queries", "complete", "tsts-api"],
  ["tsts.package.public-root-artifact", "TSTS package is consumed as a root-only dist artifact", "complete", "tsts-api"],
  ["tsts.no-target-overrides", "Extensions cannot rescue invalid TypeScript", "complete", "tsts-api"],
  ["tsts.program.create-with-extensions", "Create TSTS compiler session with extensions", "complete", "tsts-api"],
  ["tsts.type-query.flow-narrowed-type", "Query flow-narrowed type at a source node", "complete", "tsts-api"],
  ["tsts.diagnostic.provider-sourced", "Surface provider diagnostics through TSTS diagnostics", "complete", "tsts-api"],

  ["provider.virtual-module.ownership", "Provider explicitly owns module specifiers", "complete", "target-provider"],
  ["provider.virtual-module.no-fallback", "Provider-owned module failure has no file fallback", "complete", "target-provider"],
  ["provider.virtual-module.source-shape", "Provider supplies source-visible virtual declarations", "complete", "target-provider"],
  ["provider.virtual-module.target-identity", "Provider attaches target identity to virtual declarations", "complete", "target-provider"],
  ["provider.virtual-module.constraints", "Provider supplies target constraints outside TS source shape", "complete", "target-provider"],
  ["provider.virtual-module.overload-identity", "Provider supplies exact overload/member identity", "complete", "target-provider"],
  ["provider.module.virtual-import", "Provider-backed virtual imports become compiler state", "complete", "target-provider"],
  ["provider.module.no-file-backed-fallback", "Provider module resolution has no declaration-file fallback", "complete", "target-provider"],
  ["provider.module.missing-provider-diagnostic", "Missing provider-owned modules produce diagnostics", "complete", "target-provider"],

  ["source-core.module.single-owner", "@tsonic/core source modules are owned once by the source-core provider, not replicated by target packs", "complete", "source-core-provider"],
  ["source-core.target-alias-consumption", "Target packs consume source-core facts and add target-specific aliases without redefining portable core contracts", "complete", "target-provider"],
  ["source.primitive.numeric", "Neutral source numeric primitives attach facts", "complete", "source-core-provider"],
  ["source.primitive.char-bool", "Neutral char and bool primitives attach facts", "complete", "source-core-provider"],
  ["source.primitive.configured-type", "Configured source primitive aliases map to canonical facts", "complete", "source-core-provider"],
  ["source.marker.out-ref-inref", "out, ref, and inref markers attach storage facts", "complete", "source-core-provider"],
  ["source.marker.field", "field marker attaches storage facts", "complete", "source-core-provider"],
  ["source.marker.struct", "struct marker attaches value-type source facts", "complete", "source-core-provider"],
  ["source.marker.attribute", "attribute marker attaches target attribute facts", "complete", "source-core-provider"],
  ["source.marker.defaultof", "defaultof marker attaches target default facts", "complete", "source-core-provider"],
  ["source.marker.ptr-fnptr", "pointer and function-pointer markers attach target-validated facts", "complete", "source-core-provider"],
  ["source.marker.borrow-move", "borrow, borrowMut, and move markers attach target-validated flow facts", "complete", "source-core-provider"],
  ["source-core.out.storage-binding", "out marker resolves to assignable storage", "complete", "source-core-provider"],
  ["source-core.ref.parameter-mode", "ref and inref markers resolve to parameter passing facts", "complete", "source-core-provider"],
  ["source-core.struct.field-facts", "struct and field markers combine into value-shape facts", "complete", "source-core-provider"],
  ["source-core.flow.borrow-move-facts", "borrow and move source facts require explicit target behavior", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics", "@tsonic/core/lang.js intrinsics require portable facts and per-target implementation or rejection", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.out", "out intrinsic attaches neutral write-only byref storage facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.ref", "ref intrinsic attaches neutral read-write byref storage facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.inref", "inref intrinsic attaches neutral read-only byref storage facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.borrow", "borrow intrinsic attaches neutral shared-borrow flow facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.borrow-mut", "borrowMut intrinsic attaches neutral mutable-borrow flow facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.move", "move intrinsic attaches neutral moved-value flow facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.struct", "struct intrinsic attaches neutral value-type shape facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.field", "field intrinsic attaches neutral field facts from explicit type evidence", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.attribute", "attribute intrinsic attaches neutral attribute application facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.defaultof", "defaultof intrinsic attaches neutral target-default value facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.ptr", "ptr intrinsic attaches neutral pointer type facts", "complete", "source-core-provider"],
  ["source-core.lang.portable-intrinsics.fnptr", "fnptr intrinsic attaches neutral function-pointer type facts", "complete", "source-core-provider"],
  ...slice4SourceCoreContractRows.map((row) => [row.capabilityId, row.title, "complete", row.capabilityId.startsWith("target.csharp.") ? "target-provider" : "source-core-provider"]),

  ["type.utility", "Utility types are consumed from TSTS results", "complete", "tsts-api"],
  ["type.conditional", "Conditional types are consumed from TSTS results", "complete", "tsts-api"],
  ["type.mapped", "Mapped types are consumed from TSTS results", "complete", "tsts-api"],
  ["type.indexed-access", "Indexed access types are consumed from TSTS results", "complete", "tsts-api"],
  ["type.keyof", "keyof types are consumed from TSTS results", "complete", "tsts-api"],
  ["type.infer", "infer in conditional types is consumed from TSTS results", "complete", "tsts-api"],
  ["type.template-literal", "Template literal types are consumed from TSTS results", "complete", "tsts-api"],
  ["type.variadic-tuple", "Variadic tuple types are consumed from TSTS results", "complete", "tsts-api"],
  ["type.satisfies", "satisfies checks source without target emission", "complete", "tsts-api"],
  ["type.as-const", "as const preserves literal and readonly facts", "complete", "tsts-api"],
  ["type.assertion", "Type assertions consume TSTS type facts and target casts", "complete", "tsts-api"],
  ["type.non-null-assertion", "Non-null assertions consume TSTS nullable facts", "complete", "tsts-api"],
  ["type.generic.provider-target-arguments", "Map TSTS-inferred type arguments to target type arguments", "complete", "target-provider"],
  ["type.generic.provider-target-constraints", "Validate provider target generic constraints", "complete", "target-provider"],

  ["operation.call.provider-selected-method", "Provider-owned calls emit from selected signature facts", "complete", "target-provider"],
  ["operation.call.provider-argument-conversion", "Provider-owned calls record target argument conversion facts", "complete", "target-provider"],
  ["operation.call.provider-parameter-mode", "Provider-owned calls record parameter mode facts", "complete", "target-provider"],
  ...slice4ProviderCallContractRows.map((row) => [row.capabilityId, row.title, "complete", row.capabilityId.startsWith("function.") ? "target-provider" : "target-provider"]),
  ["operation.construct.provider-selected-constructor", "Provider-owned constructors emit from selected constructor facts", "complete", "target-provider"],
  ["operation.constructor.provider-selected-target", "Constructors map to selected target constructor facts", "complete", "target-provider"],
  ["operation.property.provider-selected-member", "Provider-owned property access emits from selected member facts", "complete", "target-provider"],
  ["operation.member.provider-property", "Member properties map through selected provider declarations", "complete", "target-provider"],
  ["operation.member.provider-indexer", "Member indexers map through selected provider declarations", "complete", "target-provider"],
  ["operation.member.no-name-guess", "Target member mapping cannot guess from source spelling", "complete", "target-provider"],
  ["operation.element.provider-indexer", "Element access emits from selected indexer or carrier facts", "complete", "target-provider"],
  ["operation.operator.checked-target-operation", "Operators emit from checked target operation facts", "complete", "target-provider"],
  ["operation.conversion.checked-target-conversion", "Target conversions are explicit facts", "complete", "target-provider"],
  ["operation.iteration.for-of.sync", "for-of emits only with sync iteration facts", "complete", "target-provider"],
  ["operation.iteration.for-in.keys", "for-in emits only with key enumeration facts", "complete", "target-provider"],
  ["operation.iteration.provider-target", "Iteration maps to provider target iteration facts", "complete", "target-provider"],
  ["operation.array.literal", "Array literals choose target carrier from facts", "complete", "target-provider"],
  ["operation.spread.array", "Array spread emits from iterable/spread facts", "complete", "target-provider"],
  ["operation.spread.object", "Object spread emits from object-shape facts", "complete", "target-provider"],
  ["operation.spread.provider-target-copy", "Spread emits via provider target copy facts", "complete", "target-provider"],
  ["operation.destructure.array-object", "Binding patterns emit from extraction facts", "complete", "target-provider"],
  ["operation.await.promise-task", "await and async functions emit from promise/task facts", "complete", "target-provider"],
  ["operation.throw.catch", "throw/catch/finally use target exception facts", "complete", "target-provider"],

  ["expression.literal.string-number-boolean", "String, number, and boolean literals emit target literals", "complete", "csharp-backend"],
  ["expression.literal.null-undefined", "null and undefined literals emit target carriers", "complete", "csharp-backend"],
  ["expression.literal.bigint-regex-template", "bigint, regex, and template literals use target facts", "complete", "target-provider"],
  ["expression.object-literal", "Object literal expressions map to target shape facts", "complete", "target-provider"],
  ["expression.array-literal", "Array literal expressions map to target array facts", "complete", "target-provider"],
  ["expression.call", "Call expressions consume TSTS signature and provider facts", "complete", "target-provider"],
  ["expression.new", "new expressions consume TSTS construct signature and provider facts", "complete", "target-provider"],
  ["expression.property-access", "Property access consumes TSTS member and provider facts", "complete", "target-provider"],
  ["expression.element-access", "Element access consumes TSTS element and provider facts", "complete", "target-provider"],
  ["expression.operator", "Operators consume TSTS type facts and provider operation facts", "complete", "target-provider"],
  ["expression.conditional", "Conditional expressions consume TSTS expected types", "complete", "tsts-api"],
  ["expression.nullish-optional", "Nullish and optional operations consume nullable facts", "complete", "target-provider"],
  ["expression.assignment", "Assignments consume TSTS assignment result and target validation facts", "complete", "target-provider"],
  ["expression.lambda", "Lambdas consume TSTS contextual signatures", "complete", "tsts-api"],

  ["statement.block-scope", "Blocks and nested scopes preserve binding identity", "complete", "tsts-api"],
  ["statement.if-else", "if/else emits from source AST and TSTS flow facts", "complete", "tsts-api"],
  ["statement.switch", "switch emits grouped cases and defaults", "complete", "csharp-backend"],
  ["statement.loop", "for, while, do, for-of, and for-in emit target loops", "complete", "target-provider"],
  ["statement.control-transfer", "break, continue, and labels emit target control flow", "complete", "csharp-backend"],
  ["statement.return", "return emits with TSTS return type and target conversion facts", "complete", "target-provider"],
  ["statement.throw-catch-finally", "throw, catch, and finally emit target exception flow", "complete", "target-provider"],
  ["statement.top-level", "Top-level statements emit deterministic entry/module init", "complete", "csharp-backend"],

  ["binding.array.fixed-rest-default", "Array binding supports fixed, rest, defaults, and nested extraction", "complete", "target-provider"],
  ["binding.object.rename-rest-default", "Object binding supports rename, rest, defaults, and nested extraction", "complete", "target-provider"],
  ["binding.parameter", "Parameter destructuring emits from TSTS binding facts", "complete", "target-provider"],
  ["binding.assignment", "Assignment destructuring emits deterministic storage writes", "complete", "target-provider"],
  ["binding.object-shape", "Object-shape destructuring consumes generated shape facts", "complete", "target-provider"],

  ["function.declaration", "Function declarations emit target methods/functions", "complete", "csharp-backend"],
  ["function.arrow", "Arrow functions emit target lambdas/delegates", "complete", "csharp-backend"],
  ["function.default-rest-optional-params", "Default, rest, and optional params use target parameter facts", "complete", "target-provider"],
  ["function.closure", "Closures preserve captured variables and mutation", "complete", "csharp-backend"],
  ["function.higher-order", "Higher-order functions use delegate/function carriers", "complete", "csharp-backend"],
  ["function.delegate-carrier", "Delegate carriers are selected by target facts", "complete", "target-provider"],
  ["function.this-binding", "this binding follows TSTS source decisions and target facts", "complete", "tsts-api"],
  ["function.async", "Async functions map Promise to target task facts", "complete", "target-provider"],

  ["declaration.function", "Function declarations render from AST and TSTS facts", "complete", "csharp-backend"],
  ["declaration.class", "Classes render constructors, fields, methods, static members, and target-supported property dispatch", "complete", "csharp-backend"],
  ["declaration.class.constructor", "Class constructors emit target constructors", "complete", "csharp-backend"],
  ["declaration.class.fields", "Class fields emit from TSTS/property facts", "complete", "target-provider"],
  ["declaration.class.methods", "Class methods emit target methods", "complete", "csharp-backend"],
  ["declaration.class.properties", "Accessors and fact-backed auto-properties emit target properties", "complete", "target-provider"],
  ["declaration.class.visibility", "Visibility emits only from source and target-legal facts", "complete", "target-provider"],
  ["declaration.class.private-fields", "#private fields get a target representation or diagnostic", "complete", "target-provider"],
  ["declaration.class.static-blocks", "Static blocks get target support or diagnostic", "complete", "target-provider"],
  ["declaration.class.inheritance", "Class inheritance emits from TSTS heritage facts", "complete", "tsts-api"],
  ["declaration.class.abstract", "Abstract classes and members require target-owned abstract facts", "complete", "target-provider"],
  ["declaration.interface", "Interfaces render from TSTS and target facts", "complete", "csharp-backend"],
  ["declaration.enum", "Enums and enum constants render from TSTS facts", "complete", "csharp-backend"],
  ["declaration.type-alias", "Type aliases erase or emit by target facts", "complete", "target-provider"],
  ["declaration.generic-parameters", "Generic params and constraints emit from TSTS and provider facts", "complete", "target-provider"],
  ["declaration.heritage", "extends and implements emit from TSTS plus target facts", "complete", "tsts-api"],
  ["declaration.attributes", "Attribute facts render at target-valid locations", "complete", "source-core-provider"],
  ["declaration.generated-structural", "Generated structural declarations are deterministic", "complete", "csharp-backend"],

  ["carrier.primitive", "Primitive carriers come from source/target facts", "complete", "target-provider"],
  ["carrier.array", "Array carriers provide length, index, iteration, and conversion facts", "complete", "target-provider"],
  ["carrier.array.public-abi-policy", "Source T[] remains TS Array<T>; public target ABI uses fact-backed IEnumerable/IReadOnlyList/List/native-array/compat lanes without leaking JSArray by default", "complete", "target-provider"],
  ["carrier.tuple", "Tuple carriers provide arity and element facts", "complete", "target-provider"],
  ["carrier.object-shape", "Object-shape carriers are deterministic and fact-backed", "complete", "target-provider"],
  ["carrier.dictionary-record", "Record and index-signature carriers are fact-backed", "complete", "target-provider"],
  ["carrier.union", "Runtime unions exist only when facts require them", "partial", "target-provider"],
  ["carrier.null-undefined", "Null and undefined are represented consistently by target mode", "partial", "target-provider"],
  ["carrier.function-delegate", "Function values and callbacks use fact-backed delegate carriers", "complete", "target-provider"],
  ["carrier.any-tsvalue", "any uses explicit compatibility carrier only in compat mode", "complete", "target-provider"],

  ["surface.js.console", "JS console operations use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.console-log", "console.log uses selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.array-methods", "JS array methods use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.array-constructor", "JS Array construction uses selected JS surface facts or diagnostics", "complete", "surface-provider"],
  ["surface.js.array.length-index", "JS array length and index operations use selected array carrier facts", "complete", "surface-provider"],
  ["surface.js.array.sparse-delete-holes", "JS array delete, sparse slots, holes, and length mutation require closed JSArray semantics or diagnostics", "complete", "surface-provider"],
  ["analysis.abstraction.policy-enforcement", "Generic analysis code is driven by policy, provider metadata, finalized facts, or explicit exceptions instead of source-family and target-member algorithm branches", "complete", "tests"],
  ["surface.js.string-methods", "JS string methods use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.boolean-methods", "JS Boolean primitive methods and conversion calls use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.number-methods", "JS Number primitive and static operations use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.math-json-regexp", "Math, JSON, and RegExp use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.map-set", "Map and Set use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.math", "Math operations use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.date", "Date operations use selected JS surface facts", "complete", "surface-provider"],
  ["surface.js.object-runtime", "Object runtime operations use selected JS surface facts", "complete", "surface-provider"],
  ["surface.node.fs-path-process", "node:fs, node:path, and process use selected Node provider-package facts", "complete", "surface-provider"],
  ["surface.node.buffer-crypto-os", "Buffer, crypto, and os use selected Node surface facts", "complete", "surface-provider"],
  ["surface.node.fs", "node:fs uses selected Node surface facts", "complete", "surface-provider"],
  ["surface.node.fs-stats-date", "node:fs Stats Date members use selected Node and JS surface facts", "complete", "surface-provider"],
  ["surface.node.process", "node:process uses selected Node provider-package facts", "complete", "surface-provider"],
  ["surface.node.util", "node:util uses selected Node surface facts and rejects open-carrier helpers without fallback", "complete", "surface-provider"],
  ["surface.node.url", "node:url uses selected Node surface facts and rejects open-object URL helpers without fallback", "complete", "surface-provider"],

  ["compat.mode.strict-native", "Strict-native mode rejects unsupported compat-runtime behavior", "complete", "target-provider"],
  ["compat.mode.compat", "Compatibility mode enables explicit compat-runtime carriers", "complete", "target-provider"],
  ["compat.any.property", "any property operations use compat-runtime carrier facts", "complete", "target-provider"],
  ["compat.any.dynamic-get", "any property reads use explicit compat-runtime carrier facts", "complete", "target-provider"],
  ["compat.any.dynamic-set", "any property writes use explicit compat-runtime carrier facts", "complete", "target-provider"],
  ["compat.any.call-construct", "any call/new use compat-runtime carrier facts", "complete", "target-provider"],
  ["compat.any.dynamic-call", "any calls use explicit compat-runtime carrier facts", "complete", "target-provider"],
  ["compat.any.operators", "any operators use compat-runtime carrier facts", "complete", "target-provider"],
  ["compat.any.typed-boundary-cast", "any typed-boundary casts are explicit", "complete", "target-provider"],
  ["compat.object.no-dynamic-access", "object is not treated like any", "complete", "target-provider"],
  ["compat.unknown.no-dynamic-access", "unknown is not treated like any", "complete", "target-provider"],
  ["compat.prototype-mutation", "Prototype mutation is explicit runtime support or diagnostic", "complete", "target-provider"],
  ["compat.proxy-eval-function-with", "proxy, eval, Function, and with are rejected unless explicit runtime exists", "complete", "target-provider"],
  ["runtime.union.carrier", "Union carrier is explicit runtime capability", "partial", "target-provider"],
  ["runtime.undefined.carrier", "Undefined carrier is explicit runtime capability", "partial", "target-provider"],
  ["runtime.dynamic.carrier", "TypeScript any compat-runtime carrier is explicit runtime capability", "complete", "target-provider"],

  ["backend.ast.only", "Backend constructs target AST only", "complete", "csharp-backend"],
  ["backend.no-semantic-strings", "Semantic output is never direct strings", "complete", "csharp-backend"],
  ["backend.fail-closed-facts", "Missing backend-required facts are diagnostics", "complete", "csharp-backend"],
  ["backend.project-source-declarations", "Project declarations emit from TSTS AST and facts", "complete", "csharp-backend"],
  ["backend.generated-declarations", "Generated declarations are deterministic", "partial", "csharp-backend"],
  ["backend.diagnostics", "Backend diagnostics identify missing facts and capabilities", "partial", "csharp-backend"],
  ["backend.csharp.ast-expression", "C# expressions are Roslyn-compatible AST", "complete", "csharp-backend"],
  ["backend.csharp.ast-statement", "C# statements are Roslyn-compatible AST", "complete", "csharp-backend"],
  ["backend.csharp.printer", "C# printer renders AST only", "complete", "csharp-backend"],
  ["backend.csharp.no-direct-semantic-string-output", "C# backend never emits semantic strings directly", "complete", "csharp-backend"],
  ["backend.csharp.project-sdk-emit", "C# backend emits SDK-style project files", "complete", "csharp-backend"],
  ["backend.csharp.runtime-artifacts", "C# backend includes selected runtime artifacts only", "complete", "csharp-backend"],

  ["toolchain.csharp.project", "Emit C# project from target options", "complete", "csharp-toolchain"],
  ["toolchain.csharp.build-run", "dotnet build/run succeeds for executable tests", "complete", "csharp-toolchain"],
  ["toolchain.csharp.library", "Library output path and artifacts are deterministic", "complete", "csharp-toolchain"],
  ["toolchain.csharp.nativeaot", "NativeAOT is a target toolchain project option", "complete", "csharp-toolchain"],
  ["runtime.csharp.js", "C# JS runtime artifacts are selected by js surface", "complete", "csharp-runtime"],
  ["runtime.csharp.nodejs", "C# NodeJS runtime artifacts are selected by nodejs provider package", "complete", "csharp-runtime"],
  ["runtime.no-reflection-semantics", "Product runtime and generated code avoid reflection semantics", "complete", "csharp-runtime"],

  ["native.dotnet.assembly-model", ".NET provider models assemblies and namespaces", "complete", "target-provider"],
  ["native.dotnet.type-model", ".NET provider models generic, nested, static, and instance types", "complete", "target-provider"],
  ["native.dotnet.member-methods", ".NET provider models methods, overloads, extension methods, and generic methods", "complete", "target-provider"],
  ["native.dotnet.member-fields-properties-events", ".NET provider models fields, properties, and events", "complete", "target-provider"],
  ["native.dotnet.constructors", ".NET provider models constructors and accessibility", "complete", "target-provider"],
  ["native.dotnet.parameter-modes", ".NET provider models out, ref, in, optional, default, and params array parameters", "complete", "target-provider"],
  ["native.dotnet.attributes", ".NET provider models attributes, constructors, and named args", "complete", "target-provider"],
  ["native.dotnet.constraints", ".NET provider models target generic constraints", "complete", "target-provider"],
  ["native.dotnet.conversions", ".NET provider models implicit and explicit conversions", "complete", "target-provider"],
  ["native.dotnet.array.explicit", "Provider-owned @tsonic/dotnet native Array<T> gives explicit CLR array interop without changing normal TS Array<T> semantics", "complete", "target-provider"],
  ["native.dotnet.unsupported-diagnostics", ".NET provider reports deterministic unsupported-member diagnostics", "complete", "target-provider"],
  ...slice4DotnetProviderContractRows.map((row) => [row.capabilityId, row.title, "complete", "target-provider"]),

  ["diagnostic.missing-target-fact", "Missing target facts produce deterministic diagnostics", "complete", "target-provider"],
  ["diagnostic.missing-iteration-fact", "Missing iteration facts produce deterministic diagnostics", "complete", "target-provider"],
  ["diagnostic.missing-provider-fact", "Missing provider facts produce deterministic diagnostics", "complete", "target-provider"],
  ["diagnostic.unsupported-surface", "Unsupported selected surfaces produce diagnostics", "complete", "surface-provider"],
  ["diagnostic.unsupported-selected-surface-operation", "Unsupported selected surface operations fail closed with provider diagnostics", "partial", "surface-provider"],
  ["diagnostic.unsupported-target-operation", "Unsupported target operations produce diagnostics", "complete", "target-provider"],
  ["diagnostic.provider-conflict", "Provider ownership conflicts fail", "complete", "target-provider"],
  ["diagnostic.target-constraint", "Target constraint failure points to source", "complete", "target-provider"],
  ["diagnostic.ts-invalid-not-rescued", "Target extensions cannot rescue TS-invalid source", "complete", "tsts-api"],
  ["diagnostic.dynamic-strict-mode", "Strict mode rejects dynamic operations clearly", "complete", "target-provider"],
  ["diagnostic.strict-mode-slow-op", "Strict mode rejects slow compatibility operations", "complete", "target-provider"],
  ["diagnostic.source-spans", "Diagnostics identify precise source spans", "partial", "tests"],
  ["diagnostic.evidence", "Diagnostics include capability/fact evidence where useful", "complete", "tests"],

  ["downstream.smoke.simple-apps", "Representative small projects compile and run", "complete", "tests"],
  ["downstream.dotnet.aspnet", "ASP.NET and EF-like projects compile after provider data exists", "blocked", "tests"],
  ["downstream.nodejs-source", "Node-style source projects compile with selected provider packages", "complete", "tests"],
  ["downstream.no-old-runtime-reflection", "Generated and runtime code remain reflection-free", "complete", "tests"],

  ["target.shared.operation-contract", "Targets share operation/fact contracts without C# shortcuts", "complete", "tests"],
  ["architecture.native-compilable.esm-only", "Product compiler/runtime source remains ESM-only and native-compilable", "complete", "tests"],
  ["architecture.native-compilable.no-unapproved-deps", "Product compiler/runtime paths avoid unapproved third-party dependencies", "complete", "tests"],
  ["architecture.target-pack.boundaries", "Target pack packages keep provider, surfaces, backend, runtime, and toolchain as explicit modules", "complete", "tests"],
  ["architecture.target-pack.no-catch-all-semantics", "Target packs avoid catch-all semantic blobs and hidden source-family helpers", "complete", "tests"],
  ["architecture.target-pack.no-procedural-policy", "Policy files are declarative data, generic selectors, or explicit exception records only", "complete", "tests"],
  ["target.csharp.source-flow-marker-contract", "C# explicitly implements or rejects portable source flow markers", "complete", "target-provider"],
  ["target.csharp.core-lang-intrinsics", "C# implements or rejects every portable @tsonic/core/lang.js intrinsic from finalized facts", "complete", "target-provider"],
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

const slice6WholeProgramClosurePositiveTests = Object.freeze([
  "test/cli-build/whole-program-csharp-closure.test.mjs",
  "test/cli-build/modules-declarations.test.mjs",
  "test/cli-build/target-config.test.mjs",
  "test/cli-build/runtime-toolchain-proof.test.mjs",
  "test/cli/surface-composition.test.mjs",
  "../tsonic-csharp/test/csharp-printer.test.mjs",
  "../tsonic-csharp/test/project-artifacts.test.mjs",
  "../tsonic-csharp/test/roslyn-boundary.test.mjs",
]);

const slice6WholeProgramClosureNegativeTests = Object.freeze([
  "test/cli-build/whole-program-csharp-closure.test.mjs",
  "test/cli-build/modules-declarations.test.mjs",
  "test/cli-build/target-config.test.mjs",
  "test/cli/surface-composition.test.mjs",
  "../tsonic-csharp/test/csharp-printer.test.mjs",
  "../tsonic-csharp/test/project-artifacts.test.mjs",
  "../tsonic-csharp/test/roslyn-boundary.test.mjs",
]);

const slice6WholeProgramClosureOldEvidence = Object.freeze([
  "packages/cli/src/config-cases/resolve-basics.test.ts",
  "packages/cli/src/config-cases/resolve-surfaces.test.ts",
  "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
  "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
  "packages/frontend/src/program/entrypoint-scope.test.ts",
  "packages/frontend/src/program/program-input-discovery.test.ts",
  "packages/frontend/src/resolver/namespace.test.ts",
  "packages/targets/csharp/backend/src/project-generator.test.ts",
  "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
  "packages/targets/csharp/emitter/testcases/common/classes/inheritance/Inheritance.ts",
  "packages/targets/csharp/emitter/testcases/common/classes/basic/Person.ts",
  "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
  "packages/targets/csharp/emitter/testcases/common/control-flow/switch/SwitchStatement.ts",
  "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
  "packages/targets/csharp/emitter/testcases/common/types/function-type-aliases/GenericAliases.ts",
  "packages/targets/csharp/emitter/testcases/common/types/interfaces/Interfaces.ts",
  "test/fixtures/barrel-reexports/",
  "test/fixtures/dotnet-test-command/",
  "test/fixtures/hello-world/",
  "test/fixtures/js-surface-runtime-builtins/",
  "test/fixtures/module-constants/",
  "test/fixtures/multi-file/",
  "test/fixtures/multi-file-imports/",
  "test/fixtures/multi-file-types/",
  "test/fixtures/namespace-imports/",
  "test/fixtures/source-package-basic/",
  "test/fixtures/source-package-subpath/",
  "test/fixtures/source-package-surface-mismatch/",
  "test/fixtures/top-level-code/",
]);

const slice6WholeProgramOldEvidenceByCapability = Object.freeze({
  "host.config.project-load": Object.freeze([
    "packages/cli/src/config-cases/resolve-basics.test.ts",
    "test/fixtures/dotnet-test-command/",
    "test/fixtures/multi-file/",
  ]),
  "host.config.target-selection": Object.freeze([
    "packages/cli/src/config-cases/resolve-basics.test.ts",
    "test/fixtures/dotnet-test-command/",
  ]),
  "host.config.surface-selection": Object.freeze([
    "packages/cli/src/config-cases/resolve-surfaces.test.ts",
    "packages/cli/src/surface/profiles.test.ts",
    "packages/frontend/src/surface/profiles.test.ts",
  ]),
  "host.config.no-legacy-config": Object.freeze([
    "test/fixtures/dotnet-test-command/",
    "test/fixtures/source-package-basic/",
    "test/fixtures/source-package-subpath/",
  ]),
  "host.graph.source-files": Object.freeze([
    "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
    "packages/frontend/src/program/program-input-discovery.test.ts",
    "test/fixtures/multi-file/",
  ]),
  "host.package.composition": Object.freeze([
    "packages/cli/src/cli/parser.test.ts",
    "packages/cli/src/commands/add-deps.test.ts",
    "packages/cli/src/commands/add-npm-cases/package-manifest-transitive.test.ts",
    "packages/cli/src/commands/add-npm-cases/package-manifest.test.ts",
    "packages/cli/src/commands/add-npm.test.ts",
    "packages/cli/src/commands/build.test.ts",
    "packages/cli/src/commands/restore-cases/external-types.test.ts",
    "packages/cli/src/commands/restore-cases/nuget-bindings.test.ts",
    "packages/cli/src/package-manifests/bindings-cases/discovery-and-overlay.test.ts",
    "packages/cli/src/package-manifests/bindings-cases/manifest-resolution.test.ts",
    "test/fixtures/anonymous-object-type-literal/",
    "test/fixtures/arrow-function/",
    "test/fixtures/arrow-inference/",
    "test/fixtures/closures/",
    "test/fixtures/file-io/",
    "test/fixtures/function-types-in-collections/",
    "test/fixtures/functions-returning-functions/",
    "test/fixtures/hello-world/",
    "test/fixtures/js-surface-runtime-builtins/",
    "test/fixtures/nested-scopes/",
    "test/fixtures/object-prop-int-to-int/",
    "test/fixtures/optional-chaining/",
    "test/fixtures/return-in-control-flow/",
    "test/fixtures/shadowing/",
    "test/fixtures/switch-statement/",
    "test/fixtures/ternary-int-threading/",
    "test/fixtures/variable-decls/",
  ]),
  "host.project.package-discovery": Object.freeze([
    "packages/cli/src/commands/add-deps.test.ts",
    "packages/cli/src/commands/build-cases/local-package-ownership.test.ts",
    "packages/frontend/src/program/creation-cases/package-resolution.test.ts",
    "packages/frontend/src/program/package-roots.test.ts",
  ]),
  "host.project.module-graph": Object.freeze([
    "packages/cli/src/commands/build-source-package.test.ts",
    "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
    "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
    "packages/frontend/src/program/entrypoint-scope.test.ts",
    "packages/frontend/src/program/program-input-discovery.test.ts",
    "packages/frontend/src/resolver/namespace.test.ts",
    "test/fixtures/barrel-reexports/",
    "test/fixtures/multi-file/",
    "test/fixtures/multi-file-imports/",
    "test/fixtures/multi-file-types/",
    "test/fixtures/namespace-imports/",
    "test/fixtures/source-package-basic/",
    "test/fixtures/source-package-subpath/",
    "test/fixtures/source-package-surface-mismatch/",
    "test/fixtures/top-level-code/",
  ]),
  "host.project.package-path-resolution": Object.freeze([
    "packages/cli/src/commands/build-cases/local-package-ownership.test.ts",
    "packages/cli/src/commands/build-source-package.test.ts",
    "packages/frontend/src/program/creation-cases/package-resolution.test.ts",
    "packages/frontend/src/program/package-roots.test.ts",
    "test/fixtures/source-package-basic/",
    "test/fixtures/source-package-subpath/",
    "test/fixtures/source-package-surface-mismatch/",
  ]),
  "host.project.deterministic-output-paths": Object.freeze([
    "packages/frontend/src/program/entrypoint-scope.test.ts",
  ]),
  "host.project.top-level-initialization-order": Object.freeze([
    "packages/frontend/src/program/entrypoint-scope.test.ts",
    "test/fixtures/barrel-reexports/",
    "test/fixtures/module-const-array-mutation/",
    "test/fixtures/top-level-code/",
  ]),
  "module.graph.source-files": Object.freeze([
    "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
    "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
    "packages/frontend/src/program/program-input-discovery.test.ts",
    "test/fixtures/multi-file/",
  ]),
  "module.import.named": Object.freeze([
    "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
    "test/fixtures/multi-file-imports/",
  ]),
  "module.import.default": Object.freeze([
    "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
  ]),
  "module.import.namespace": Object.freeze([
    "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
    "packages/frontend/src/resolver/namespace.test.ts",
    "test/fixtures/namespace-imports/",
  ]),
  "module.import.type-only": Object.freeze([
    "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
    "test/fixtures/import-type-erase/",
    "test/fixtures/multi-file-types/",
  ]),
  "module.import.side-effect": Object.freeze([
    "test/fixtures/top-level-code/",
  ]),
  "module.export.named": Object.freeze([
    "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
    "test/fixtures/module-constants/",
  ]),
  "module.export.default": Object.freeze([
    "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
    "test/fixtures/generic-function-value-default-export/",
  ]),
  "module.export.reexport": Object.freeze([
    "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
    "test/fixtures/barrel-reexports/",
  ]),
  "module.package.exports-subpath": Object.freeze([
    "packages/cli/src/commands/build-cases/local-package-ownership.test.ts",
    "packages/cli/src/commands/build-source-package.test.ts",
    "packages/frontend/src/program/creation-cases/package-resolution.test.ts",
    "packages/frontend/src/program/package-roots.test.ts",
    "test/fixtures/source-package-basic/",
    "test/fixtures/source-package-subpath/",
    "test/fixtures/source-package-surface-mismatch/",
  ]),
  "module.emit.multi-file": Object.freeze([
    "packages/cli/src/commands/build-source-package.test.ts",
    "test/fixtures/multi-file/",
    "test/fixtures/multi-file-imports/",
    "test/fixtures/namespace-imports/",
  ]),
  "module.emit.top-level-order": Object.freeze([
    "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
    "test/fixtures/top-level-code/",
  ]),
  "tsts.parse-bind-check": Object.freeze([
    "packages/frontend/src/validator-cases/parameters-and-dict-keys.test.ts",
    "packages/frontend/src/validator-cases/utility-types.test.ts",
    "packages/frontend/src/validator-maximus-cases/deterministic-typing.test.ts",
    "packages/frontend/src/validator-maximus-cases/dictionary-and-object-literal.test.ts",
    "packages/frontend/src/validator-maximus-cases/generic-function-values.test.ts",
    "packages/frontend/src/validator-maximus-cases/type-syntax.test.ts",
    "packages/frontend/src/validator.maximus.test.ts",
    "packages/frontend/src/validator.test.ts",
  ]),
  "tsts.flow-narrowing": Object.freeze([
    "test/fixtures/nullable-narrowing/",
    "test/fixtures/nullish-coalescing/",
  ]),
  "tsts.generic-inference": Object.freeze([
    "packages/frontend/src/validator-cases/generic-validation.test.ts",
    "test/fixtures/generic-method-standalone/",
  ]),
  "tsts.consumer-queries": Object.freeze([
    "packages/frontend/src/lowering/plan-builders.test.ts",
    "packages/frontend/src/validator-cases/utility-types.test.ts",
  ]),
  "tsts.program.create-with-extensions": Object.freeze([
    "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
  ]),
  "type.utility": Object.freeze([
    "packages/frontend/src/validator-cases/utility-types.test.ts",
    "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
  ]),
  "statement.switch": Object.freeze([
    "packages/targets/csharp/emitter/testcases/common/control-flow/switch/SwitchStatement.ts",
    "packages/targets/csharp/emitter/testcases/common/edge-cases/nested-scopes/NestedScopes.ts",
    "packages/targets/csharp/emitter/testcases/common/edge-cases/shadowing/Shadowing.ts",
  ]),
  "statement.control-transfer": Object.freeze([
    "packages/targets/csharp/emitter/testcases/common/control-flow/switch/SwitchStatement.ts",
    "packages/targets/csharp/emitter/testcases/common/edge-cases/nested-scopes/NestedScopes.ts",
    "packages/targets/csharp/emitter/testcases/common/edge-cases/shadowing/Shadowing.ts",
  ]),
  "statement.top-level": Object.freeze([
    "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
  ]),
  "declaration.class.inheritance": Object.freeze([
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
  ]),
  "declaration.heritage": Object.freeze([
    "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/InheritanceChain.ts",
    "packages/targets/csharp/emitter/testcases/common/types/generic-interface-inheritance/InterfaceInheritance.ts",
    "test/fixtures/generic-interface-inheritance/",
  ]),
  "declaration.generated-structural": Object.freeze([
    "packages/targets/csharp/emitter/testcases/common/edge-cases/object-literal-type-parameter/ObjectLiteralTypeParameter.ts",
    "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs",
  ]),
  "backend.ast.only": Object.freeze([
    "packages/frontend/src/lowering/plan-builders.test.ts",
    "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    "packages/targets/csharp/emitter/testcases/common/edge-cases/void-expression/VoidExpression.ts",
    "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/record-nested-object/RecordNestedObject.cs",
    "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/NullishFull.ts",
    "test/fixtures/file-io/",
    "test/fixtures/hello-world/",
    "test/fixtures/namespace-imports/",
  ]),
  "backend.no-semantic-strings": Object.freeze([
    "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs",
    "packages/targets/csharp/emitter/testcases/common/expected/operators/in-operator/InOperator.cs",
  ]),
  "backend.fail-closed-facts": Object.freeze([
    "packages/frontend/src/lowering/plan-builders.test.ts",
    "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    "packages/frontend/src/validator-cases/generic-validation.test.ts",
    "packages/targets/csharp/emitter/testcases/common/edge-cases/void-expression/VoidExpression.ts",
    "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/record-nested-object/RecordNestedObject.cs",
    "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/NullishFull.ts",
  ]),
  "backend.project-source-declarations": Object.freeze([
    "test/fixtures/function-basic/",
    "test/fixtures/generic-interface-inheritance/",
    "test/fixtures/module-constants/",
    "test/fixtures/top-level-code/",
  ]),
  "backend.csharp.ast-expression": Object.freeze([
    "packages/frontend/src/lowering/plan-builders.test.ts",
    "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    "test/fixtures/function-basic/",
  ]),
  "backend.csharp.ast-statement": Object.freeze([
    "packages/frontend/src/lowering/plan-builders.test.ts",
    "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
    "test/fixtures/top-level-code/",
  ]),
  "backend.csharp.printer": Object.freeze([
    "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
  ]),
  "backend.csharp.project-sdk-emit": Object.freeze([
    "packages/cli/src/commands/build.test.ts",
    "packages/frontend/src/lowering/plan-builders.test.ts",
    "test/fixtures/dotnet-test-command/",
  ]),
  "backend.csharp.runtime-artifacts": Object.freeze([
    "packages/cli/src/commands/restore-cases/runtime-dlls.test.ts",
    "packages/cli/src/package-manifests/bindings-cases/runtime-overrides-and-validation.test.ts",
    "test/fixtures/js-surface-runtime-builtins/",
  ]),
  "toolchain.csharp.project": Object.freeze([
    "test/fixtures/dotnet-test-command/",
  ]),
  "toolchain.csharp.build-run": Object.freeze([
    "packages/cli/src/commands/build.test.ts",
    "test/fixtures/file-io/",
    "test/fixtures/hello-world/",
    "test/fixtures/js-surface-runtime-builtins/",
    "test/fixtures/namespace-imports/",
  ]),
  "toolchain.csharp.library": Object.freeze([
    "test/fixtures/dotnet-test-command/",
  ]),
  "runtime.csharp.js": Object.freeze([
    "packages/cli/src/config-cases/resolve-surfaces.test.ts",
    "test/fixtures/js-surface-runtime-builtins/",
  ]),
  "runtime.no-reflection-semantics": Object.freeze([
    "packages/frontend/src/validator-maximus-cases/json-static-safety.test.ts",
    "test/fixtures/json-native-inline-stringify/",
    "test/fixtures/json-native-typed-stringify/",
  ]),
  "diagnostic.missing-target-fact": Object.freeze([
    "packages/frontend/src/lowering/plan-builders.test.ts",
    "packages/frontend/src/validator-maximus-cases/feature-gating.test.ts",
    "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs",
  ]),
  "diagnostic.missing-provider-fact": Object.freeze([
    "packages/cli/src/commands/restore.test.ts",
    "packages/cli/src/package-manifests/bindings.test.ts",
  ]),
  "diagnostic.unsupported-surface": Object.freeze([
    "test/fixtures/nodejs-surface-imports-negative/",
    "test/fixtures/source-package-surface-mismatch/",
  ]),
  "diagnostic.unsupported-target-operation": Object.freeze([
    "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
  ]),
});

const slice6WholeProgramHostRows = Object.freeze([
  "host.config.project-load",
  "host.config.target-selection",
  "host.config.surface-selection",
  "host.config.no-legacy-config",
  "host.graph.source-files",
  "host.package.composition",
  "host.project.package-discovery",
  "host.project.module-graph",
  "host.project.package-path-resolution",
  "host.project.deterministic-output-paths",
  "host.project.top-level-initialization-order",
]);

const slice6WholeProgramModuleRows = Object.freeze([
  "module.graph.source-files",
  "module.import.named",
  "module.import.default",
  "module.import.namespace",
  "module.import.type-only",
  "module.import.side-effect",
  "module.export.named",
  "module.export.default",
  "module.export.reexport",
  "module.package.exports-subpath",
  "module.emit.multi-file",
  "module.emit.top-level-order",
]);

const slice6WholeProgramStatementRows = Object.freeze([
  "statement.control-transfer",
  "statement.top-level",
]);

const slice6WholeProgramDeclarationRows = Object.freeze([
  "declaration.class.inheritance",
  "declaration.heritage",
  "declaration.generated-structural",
]);

const slice6WholeProgramBackendRows = Object.freeze([
  "backend.ast.only",
  "backend.no-semantic-strings",
  "backend.fail-closed-facts",
  "backend.project-source-declarations",
  "backend.csharp.ast-expression",
  "backend.csharp.ast-statement",
  "backend.csharp.printer",
  "backend.csharp.project-sdk-emit",
  "backend.csharp.runtime-artifacts",
]);

const slice6WholeProgramToolchainRows = Object.freeze([
  "toolchain.csharp.project",
  "toolchain.csharp.build-run",
  "toolchain.csharp.library",
]);

const slice6WholeProgramRuntimeRows = Object.freeze([
  "runtime.csharp.js",
  "runtime.no-reflection-semantics",
]);

const slice6WholeProgramDiagnosticRows = Object.freeze([
  "diagnostic.missing-target-fact",
  "diagnostic.missing-provider-fact",
  "diagnostic.unsupported-surface",
  "diagnostic.unsupported-target-operation",
]);

const slice6WholeProgramSourceExamples = Object.freeze([
  "import type { Model } from \"./model.js\"; import \"./startup.js\"; export { makeUser as createUser } from \"./users.js\";",
  "export class User extends Person { static create(name: string): User { return new User(name); } }",
  "export class Role { static Admin = \"Admin\"; }",
  "type ReadonlyModel = Readonly<Model>; const current = createUser(\"Ada\");",
]);

function slice6EvidenceForRows(rows, evidence) {
  return Object.fromEntries(rows.map((capabilityId) => [
    capabilityId,
    Object.freeze({
      sourceExamples: slice6WholeProgramSourceExamples,
      positiveTests: slice6WholeProgramClosurePositiveTests,
      negativeTests: slice6WholeProgramClosureNegativeTests,
      oldEvidence: slice6WholeProgramOldEvidenceByCapability[capabilityId] ?? slice6WholeProgramClosureOldEvidence,
      blockers: Object.freeze([]),
      ...evidence,
    }),
  ]));
}

function slice6WholeProgramClosureEvidence() {
  return {
    ...slice6EvidenceForRows(slice6WholeProgramHostRows, {
      tstsDecision:
        "TSTS owns source graph, ESM import/export binding, type-only imports, and source diagnostics; the host only composes the selected target, surfaces, providers, backend, runtime artifacts, and toolchain from the current tsonic.json shape.",
      providerFacts: Object.freeze([
        "selectedTargetPack",
        "selectedSurfaceSet",
        "providerExtensionSet",
        "resolvedTstsSourceGraph",
        "targetRuntimeArtifactSet",
      ]),
      backendContract:
        "The backend receives one finalized project graph from the host and must not crawl packages, infer selected surfaces, or revive legacy package-root/bootstrap discovery.",
      notes:
        "Reviewed Slice 6 proof: the whole-program CLI test builds a multi-file C# project from current tsonic.json with js surface selection, type-only imports, side-effect imports, aliased re-exports, default imports, deterministic out/csharp paths, selected runtime references, and a clean generated project. Target-config and surface-composition negatives reject invalid target ids, stale config fields, missing surfaces, missing providers, declaration-file fallbacks, and backend diagnostics before artifact/toolchain handoff.",
    }),
    ...slice6EvidenceForRows(slice6WholeProgramModuleRows, {
      tstsDecision:
        "TSTS owns ESM graph semantics and selected import/export declarations; Tsonic consumes that graph and emits project modules without scanning source spellings or generated declarations.",
      providerFacts: Object.freeze([
        "resolvedModuleGraph",
        "runtimeImportDependency",
        "typeOnlyImportElision",
        "reexportBinding",
        "deterministicModuleOutputIdentity",
      ]),
      backendContract:
        "C# module output is derived from TSTS source files and finalized module dependencies; type-only imports produce no runtime dependency and side-effect imports preserve initialization order.",
      notes:
        "Reviewed Slice 6 proof: source examples include import type, side-effect import, named import, default import, aliased re-export, and enum/class cross-file references. Generated C# proves type-only imports are erased, side-effect/runtime imports call __tsonic_module_init in deterministic order, re-exports bind through generated module classes, runtime ESM cycles fail closed before artifact emission, package/path failures are diagnostics rather than fallback file probing, and no orphan or provider virtual files are emitted as project sources.",
    }),
    ...slice6EvidenceForRows(slice6WholeProgramStatementRows, {
      sourceExamples: Object.freeze([
        "import \"./startup.js\"; const current = createUser(\"Ada\"); console.log(current.name);",
        "for (let i = 0; i < 3; i = i + 1) { if (i === 1) continue; break; }",
      ]),
      tstsDecision:
        "TSTS owns statement AST, lexical binding, control-flow validity, and module dependency ordering; target emission consumes those checked structures.",
      providerFacts: Object.freeze([
        "checkedStatementAst",
        "targetStatementAst",
        "moduleInitializationDependencyFact",
        "controlTransferTargetFact",
      ]),
      backendContract:
        "C# statement emission uses structured statement AST and finalized control-flow/module-order facts; unsupported statement forms diagnose before artifact handoff.",
      notes:
        "Reviewed Slice 6 proof: whole-program tests execute top-level statements across side-effect imports, re-exports, and default imports with deterministic __tsonic_module_init calls, while runtime ESM cycles fail closed until live-binding and TDZ facts are implemented. Existing control-flow tests cover break/continue/label planning through structured C# statements; switch and general loop rows remain partial and are not counted in this slice.",
    }),
    ...slice6EvidenceForRows(slice6WholeProgramDeclarationRows, {
      tstsDecision:
        "TSTS owns declaration binding, heritage clauses, static members, erased type-only declarations, and generated structural type inputs; target emission consumes those AST/checker facts and selected target carriers.",
      providerFacts: Object.freeze([
        "tstsDeclarationIdentity",
        "heritageTypeFact",
        "staticMemberFact",
        "erasedTypeAliasFact",
        "generatedStructuralDeclarationFact",
      ]),
      backendContract:
        "C# declarations are emitted from TSTS AST plus finalized target facts; unsupported declaration syntax diagnoses before project artifacts are written.",
      notes:
        "Reviewed Slice 6 proof: the whole-program CLI test emits Person/User inheritance, User.create static member access, Role.Admin static member access, erased type-only declarations, and a deterministic generated object-shape class. Slice 8 CLI declaration proof adds an executable Entity/ScoreCard/Rank/Receipt source graph: TSTS class constructor, field, virtual/override accessor, static member, inheritance, enum, and object-literal-to-interface facts emit C# class/enum/interface/generated-shape declarations, dotnet run prints Ada-score:8:15:gold, and generated C# is scanned for dynamic/reflection mechanisms. Negative scenarios reject TypeScript-only abstract declarations and unsupported enum initializers before csproj creation. Abstract class and class-property breadth retain their own ledger status and are not implied by these declaration rows.",
    }),
    ...slice6EvidenceForRows(slice6WholeProgramBackendRows, {
      tstsDecision:
        "TSTS/providers finalize source and target facts before backend planning; backend planning receives only those facts plus source AST nodes.",
      providerFacts: Object.freeze([
        "finalizedTargetFacts",
        "roslynCompatibleCsharpAst",
        "targetRuntimeArtifactFact",
        "backendDiagnosticEvidence",
        "sdkProjectArtifact",
      ]),
      backendContract:
        "Backend output flows through structured C# AST/project artifacts and diagnostics; semantic C# strings, runtime reflection, and fallback helper guessing are rejected by architecture tests and generated-output scans.",
      notes:
        "Reviewed Slice 6 proof: generated source includes class, enum, static member, module initializer, object-shape, console runtime, and SDK project artifacts, then dotnet build/run proves the artifacts are consumable. Slice 8 declaration runtime proof adds generated class, accessor property, static member, enum, interface, and __TsonicShape_Receipt_* declarations in one non-Node executable and scans the generated C# for dynamic, System.Reflection, GetProperty/GetMethod, MethodInfo.Invoke, MakeGenericMethod, Activator.CreateInstance, and Assembly.Load. Existing Roslyn/printer tests reject invalid/foreign syntax nodes and prove the printer boundary consumes structured AST rather than semantic string shortcuts.",
    }),
    ...slice6EvidenceForRows(slice6WholeProgramToolchainRows, {
      tstsDecision:
        "TSTS and providers finish diagnostics before toolchain handoff; target options select project output shape but do not redefine source semantics.",
      providerFacts: Object.freeze([
        "targetProjectArtifact",
        "runtimeProjectReferenceArtifact",
        "toolchainOptionFact",
        "libraryOutputFact",
      ]),
      backendContract:
        "C# project artifacts are deterministic SDK-style outputs; dotnet build/run/library proof belongs to the target toolchain layer, not generic compiler architecture.",
      notes:
        "Reviewed Slice 6 proof: current CLI tests build/run executable projects with selected js runtime references, verify SDK project output, reject invalid target/project options, and keep library project output deterministic through project-artifact tests. NativeAOT publish proof is tracked by toolchain.csharp.nativeaot and is not implied by these project/build/library rows.",
    }),
    ...slice6EvidenceForRows(slice6WholeProgramRuntimeRows, {
      tstsDecision:
        "TSTS validates source imports and calls; the selected js surface contributes runtime artifacts and finalized call facts.",
      providerFacts: Object.freeze([
        "selectedJsSurfaceFact",
        "csharpJsRuntimeArtifactFact",
        "closedRuntimeEntryPointFact",
      ]),
      backendContract:
        "Generated projects include the JS runtime only when selected and never as a hidden fallback for native or NodeJS behavior.",
      runtimeContract:
        "C# JS runtime use must be closed and deterministic; generated code and selected runtime artifacts must not use open reflection or C# dynamic as language semantics.",
      notes:
        "Reviewed Slice 6 proof: the whole-program C# project selects js, includes Tsonic.CSharp.Js but not Tsonic.CSharp.Node, runs console.log through the selected runtime, and generated-output scans prove no runtime-reflection or dynamic semantic path is emitted. Slice 8 declaration runtime proof repeats the closed generated-output scan over declaration-heavy emitted C# before dotnet run. NodeJS runtime coverage is tracked by runtime.csharp.nodejs and is not counted here.",
    }),
    ...slice6EvidenceForRows(slice6WholeProgramDiagnosticRows, {
      sourceExamples: Object.freeze([
        "export abstract class Base { abstract run(): string; }",
        "export enum Mode { Read = \"read\" }",
        "backend requires finalized target facts before emission",
      ]),
      tstsDecision:
        "TSTS owns source diagnostics and provider diagnostics; target/backend diagnostics are additive fail-closed evidence and cannot rescue invalid TypeScript.",
      providerFacts: Object.freeze([
        "missingTargetFactEvidence",
        "missingProviderDiagnosticFact",
        "unsupportedSurfaceDiagnosticFact",
        "unsupportedTargetOperationFact",
        "diagnosticEvidenceFact",
      ]),
      backendContract:
        "Required missing facts, unsupported surfaces, unsupported target operations, and backend diagnostics stop artifact and toolchain output with deterministic evidence.",
      notes:
        "Reviewed Slice 6 proof: surface-composition diagnostics preserve evidence strings through host/backend handoff and suppress toolchain execution; whole-program negatives reject unsupported declaration and enum shapes before C# artifacts; target-config and provider tests cover missing provider/target/surface facts without file fallback. Precise source-span breadth and selected-surface unsupported-operation breadth are tracked by diagnostic.source-spans and diagnostic.unsupported-selected-surface-operation.",
    }),
  };
}

const reviewedCapabilityEvidence = Object.freeze({
  ...slice4DotnetProviderContractEvidence(),
  ...slice4SourceCoreContractEvidence(),
  ...slice4ProviderCallContractEvidence(),
  "carrier.primitive": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
      "packages/targets/csharp/emitter/testcases/common/types/variable-decls/VariableDecls.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: source-core primitive aliases, TSTS primitive results, literal facts, nullable primitive carriers, provider parameter/return carriers, and utility-projected primitive types resolve to finalized target primitive facts before C# emission. Negative proof rejects lost source-core primitive evidence after TSTS-only transforms, unknown/object dynamic fallback, incompatible provider primitive constraints, and missing target carriers before artifacts. Old constants and variable-declaration emitter cases are mapped to finalized primitive-carrier facts rather than frontend-era type guesses.",
  }),
  "carrier.tuple": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/tuples-arity/TuplesArity.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: tuple carriers preserve arity and element target facts from TSTS tuple results, utility Parameters tuples, readonly/as-const tuples, variadic tuple projections, tuple literals, tuple element reads, and tuple destructuring where finalized extraction facts exist. Negative proof rejects incompatible tuple arity, dynamic tuple indexes, out-of-range indexes, missing tuple element carriers, and unsupported tuple rest/default destructuring without guessing from semantic type strings. Old tuple arity emitter evidence maps to finalized tuple carrier facts and current TSTS tuple type-form proof.",
  }),
  "carrier.dictionary-record": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/iteration-facts.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/collections/list-initializer/ListInitializer.ts",
      "packages/targets/csharp/emitter/testcases/common/types/dictionaries/Dictionaries.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: Record<K,V> and index-signature source shapes lower only through finalized dictionary/record carrier facts, including string and number keys, nested records, empty object dictionary construction, provider Dictionary<TKey,TValue> indexers, for-in key iteration, JS Object.keys/values/entries/hasOwn/assign over typed records, and generated C# Dictionary carriers. Negative proof rejects unknown/object and unsupported object-shape paths without falling back to object, dynamic, or ad hoc dictionaries. Old dictionary/list-initializer emitter evidence is mapped to provider-backed construction, element access, and dictionary carrier facts.",
  }),
  "diagnostic.provider-conflict": Object.freeze({
    sourceExamples: Object.freeze([
      "import { named } from \"@acme/shared/named.js\";",
      "targets: [{ id: \"demo\", packages: [\"acme\", \"helpers\"] }]",
    ]),
    tstsDecision:
      "TSTS provider-aware module resolution asks registered target binding providers for ownership; it does not select a winner when multiple providers claim the same module.",
    providerFacts: Object.freeze([
      "requiredProviderModuleSpec",
      "providerModuleOwnership",
      "providerIdentity",
      "providerOwnershipConflictDiagnostic",
    ]),
    backendContract:
      "Provider ownership conflicts must be diagnostics before backend artifacts exist; the backend must not read files, guess a provider, or let provider ordering decide semantics.",
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/package-resolution.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: current fake-provider host coverage creates two selected provider packages that both claim @acme/shared/* and verifies TSTS reports a multiple-provider ownership diagnostic before backend artifacts or file fallback. Adjacent positive coverage in the same suite proves selected single-owner provider modules and unselected package diagnostics. Old package-resolution product-unit evidence is mapped only as ownership-resolution inventory; current provider conflict semantics are the TSTS/provider-package contract and do not reuse old frontend resolution heuristics.",
  }),
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
      "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
      "packages/frontend/src/program/program-input-discovery.test.ts",
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
  "host.project.module-graph": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
      "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
      "packages/frontend/src/program/entrypoint-scope.test.ts",
      "packages/frontend/src/program/program-input-discovery.test.ts",
      "packages/frontend/src/resolver/namespace.test.ts",
      "test/fixtures/barrel-reexports/",
      "test/fixtures/multi-file/",
      "test/fixtures/multi-file-imports/",
      "test/fixtures/multi-file-types/",
      "test/fixtures/namespace-imports/",
      "test/fixtures/source-package-basic/",
      "test/fixtures/source-package-subpath/",
      "test/fixtures/source-package-surface-mismatch/",
      "test/fixtures/top-level-code/",
    ]),
    blockers: Object.freeze([
      "host.project.module-graph remains partial until every old module/source-package fixture and product unit path is explicitly mapped to current TSTS source graph behavior.",
    ]),
    notes:
      "Reviewed partial proof: the host creates one semantic session from TSTS-resolved non-declaration source files; emitted C# includes entry-reachable relative and package-export source files, excludes orphan source files, excludes provider virtual files, and rejects missing module facts through TSTS diagnostics rather than backend rediscovery.",
  }),
  "host.project.package-path-resolution": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/commands/build-cases/local-package-ownership.test.ts",
      "packages/cli/src/commands/build-source-package.test.ts",
      "packages/frontend/src/program/creation-cases/package-resolution.test.ts",
      "packages/frontend/src/program/package-roots.test.ts",
      "test/fixtures/source-package-basic/",
      "test/fixtures/source-package-subpath/",
      "test/fixtures/source-package-surface-mismatch/",
    ]),
    blockers: Object.freeze([
      "host.project.package-path-resolution remains partial until every old source-package fixture and package path unit test is classified against provider-owned virtual modules or current TSTS package export resolution.",
    ]),
    notes:
      "Reviewed partial proof: package exports/subpaths that resolve to concrete source files enter through the TSTS graph; declaration-only exports, package-root bootstrap imports, tsconfig path aliases, provider metadata JSON, and same-named file probes all fail closed before target artifact emission.",
  }),
  "host.project.top-level-initialization-order": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/entrypoint-scope.test.ts",
      "test/fixtures/barrel-reexports/",
      "test/fixtures/module-const-array-mutation/",
      "test/fixtures/top-level-code/",
    ]),
    blockers: Object.freeze([
      "host.project.top-level-initialization-order remains partial until cycles, export initialization edge cases, and every old module/top-level fixture have current runtime proof.",
    ]),
    notes:
      "Reviewed partial proof: runtime import and re-export dependencies are discovered from TSTS module declarations, type-only imports do not execute dependency modules, package-export source modules initialize before importers, orphan modules never initialize, and invalid module bindings stop before target artifacts are written.",
  }),
  "module.graph.source-files": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
      "packages/frontend/src/program/program-input-discovery.test.ts",
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
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
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
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
    ]),
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
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
      "packages/frontend/src/resolver/namespace.test.ts",
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
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
      "test/fixtures/import-type-erase/",
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
      "test/cli-build/modules-declarations.test.mjs",
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
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
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
    negativeTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
      "test/fixtures/generic-function-value-default-export/",
    ]),
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
    negativeTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/module-bindings.test.ts",
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
      "packages/cli/src/commands/build-cases/local-package-ownership.test.ts",
      "packages/cli/src/commands/build-source-package.test.ts",
      "packages/frontend/src/program/creation-cases/package-resolution.test.ts",
      "packages/frontend/src/program/package-roots.test.ts",
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
    oldEvidence: Object.freeze([
      "packages/cli/src/config.test.ts",
      "packages/frontend/src/program/creation-cases/package-resolution.test.ts",
      "packages/frontend/src/program/package-roots.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: current host config deliberately does not implement tsconfig-style path mapping. tsonic.json compilerOptions/baseUrl/paths, top-level baseUrl/paths/tsconfig/references, and colocated tsconfig paths are all deterministic diagnostics or unresolved-module diagnostics before C# artifact creation; no package/path fallback probes source aliases as a hidden compatibility lane.",
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
    oldEvidence: Object.freeze([
      "packages/cli/src/config-cases/resolve-surfaces.test.ts",
      "packages/cli/src/surface/profiles.test.ts",
      "packages/frontend/src/surface/profiles.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: selected surfaces are validated against target-owned requiredSurfaces before provider, surface extension, runtime contribution, backend, or toolchain execution. Missing dependencies produce TARGET_SURFACE_SELECTION diagnostics, no target artifacts, and no stale/unowned surface extension composition. Old surface profile inventory is mapped as evidence only; the current contract is target-owned surface dependency validation.",
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
    sourceExamples: Object.freeze([
      "out/csharp/src/Stale.cs exists before build",
      "export abstract class Base { abstract run(): string; }",
    ]),
    tstsDecision:
      "TSTS and providers may produce diagnostics instead of artifacts; the host still owns deterministic target output-root cleanup for every selected target result.",
    providerFacts: Object.freeze([
      "selectedTargetOutputRoot",
      "diagnosticOnlyTargetResult",
      "targetArtifactPathContainment",
    ]),
    backendContract:
      "The CLI removes the selected target output root before writing current artifacts, and performs the same cleanup when diagnostics suppress backend/toolchain artifacts.",
    positiveTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/commands/build.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: CLI build removes the selected target output root before writing current artifacts, so stale generated source/runtime/project files do not survive successful rebuilds or backend-diagnostic-only rebuilds. Current tests also build the generated C# project, prove target toolchain artifacts such as isolated output assemblies and obj intermediates exist, then rerun Tsonic and prove those artifacts are removed before current C# sources/projects are written. Target-id validation and artifact containment prevent clean rebuild from escaping the configured output root.",
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
      "packages/frontend/src/validator-cases/parameters-and-dict-keys.test.ts",
      "packages/frontend/src/validator-cases/utility-types.test.ts",
      "packages/frontend/src/validator-maximus-cases/deterministic-typing.test.ts",
      "packages/frontend/src/validator-maximus-cases/dictionary-and-object-literal.test.ts",
      "packages/frontend/src/validator-maximus-cases/type-syntax.test.ts",
      "packages/frontend/src/validator.test.ts",
      "packages/frontend/src/validator.maximus.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: current CLI type-form tests consume TSTS parse/bind/check results for accepted source forms and reject incompatible source programs before target artifacts are emitted, including missing names, narrowed-type misuse, contextual lambda return mismatch, overload result mismatch, generic inference mismatch, incompatible advanced type results, readonly as-const writes, invalid satisfies constraints, and invalid non-null member access. Target-config and host tests prove TSTS diagnostics prevent backend artifacts and fake backend execution. Source-core tests prove extension facts attach after ordinary TSTS binding rather than replacing TypeScript checking; old frontend validator evidence is mapped to current TSTS diagnostics or provider-fact capabilities.",
  }),
  "tsts.flow-narrowing": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nullable-narrowing/",
      "test/fixtures/nullish-coalescing/",
      "test/fixtures/nullish-coalescing-threading/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: host analysis queries expose TSTS flow-narrowed source types for equality/null checks, discriminant checks, truthiness checks, nullish coalescing, and instanceof without returning target carriers, source-family policy, or backend conclusions. CLI/toolchain tests consume TSTS-narrowed values for emitted C# paths and reject invalid narrowed branches before backend artifacts are produced. Backend rows still require finalized target facts for emission, so flow narrowing cannot make an unsupported target operation valid.",
  }),
  "tsts.contextual-typing": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/arrow-inference/ArrowInference.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: CLI type-form, declaration, expression, and runtime-language tests consume TSTS contextual typing for lambdas, callback parameters, generic callbacks, object and array literal contexts, provider delegate arguments, optional/rest callback positions, and inferred return types. Negative evidence rejects contextually typed lambdas with incompatible returns and unsupported callable contexts before target artifacts are written. Target emission remains fact-gated and does not infer callable shapes from lambda spelling.",
  }),
  "tsts.generic-inference": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/generic-validation.test.ts",
      "packages/frontend/src/validator-maximus-cases/generic-function-values.test.ts",
      "test/fixtures/generic-method-standalone/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: CLI type-form, module/declaration, object-shape, and .NET provider tests consume TSTS generic inference for generic functions, contextual callbacks, generic methods, constructors, object-shape inference, provider generic members, provider target type-argument mapping, and generic constraint failures. Negative evidence rejects incompatible inferred assignments, bad provider generic target arguments, unsupported generic operators, and provider constraint failures before C# artifacts are emitted. Backend code consumes selected signatures and finalized target facts rather than inferring type arguments.",
  }),
  "tsts.overload-resolution": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: CLI type-form and .NET provider tests consume TSTS-selected overloads for source overload declarations, provider overload groups, constructors, generic methods, extension receivers, optional/default parameters, params arrays, and rejected unsupported selected overloads. Negative evidence rejects incompatible selected overload results and provider calls lacking selected target facts. C# target selection maps the TSTS-selected declaration/signature identity to provider metadata and does not search sibling overloads by source spelling.",
  }),
  "tsts.consumer-queries": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: source-core package tests import @tsonic/tsts only through the package root and use public consumer queries for facts and diagnostics; host tests route compiler sessions through composed extensions, prove provider default imports and virtual declarations work through public queries, prove the TSTS package is a root-only dist artifact, and keep backend source input on TSTS graph queries instead of raw filesystem crawling. CLI type-form tests prove emitted C# source uses finalized TSTS facts for narrowed values, selected overloads, contextual lambdas, generic calls, and advanced type aliases instead of preserving or reinterpreting TypeScript-only syntax. Backend-facing target-api input exposes analysis, facts, and targetFacts instead of compiler internals.",
  }),
  "tsts.package.public-root-artifact": Object.freeze({
    sourceExamples: Object.freeze([
      "import { createCompilerSession } from \"@tsonic/tsts\";",
      "import type { AstReader, TypeCheckerQueries } from \"@tsonic/tsts\";",
    ]),
    tstsDecision:
      "TSTS exposes the supported embedding surface from the package root; Tsonic product code must not consume checked-in TSTS source paths or package-internal subpaths.",
    providerFacts: Object.freeze([
      "publicTstsPackageRootExport",
      "vendoredTstsDistArtifact",
    ]),
    backendContract:
      "Host, source-core, target-api, and backends import @tsonic/tsts root exports only; generated declarations, vendored source trees, and internal subpath imports are not semantic input.",
    positiveTests: Object.freeze([
      "test/tsts-package-artifact.test.mjs",
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/tsts-package-artifact.test.mjs",
      "test/cli/surface-composition.test.mjs",
      "test/capability-ledger.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: root-package smoke imports @tsonic/tsts and @tsonic/tsts/index.js from the vendored package artifact, rejects internal dist/src and src subpath imports through package exports, asserts package scripts/source/tooling project files are absent, and verifies dist entrypoints plus bundled libs exist. Old TSTS source-program evidence is mapped to the current root-only TSTS package contract.",
  }),
  "tsts.type-query.flow-narrowed-type": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nullable-narrowing/",
      "test/fixtures/nullish-coalescing-threading/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: host backend analysis queries return TSTS flow types at specific narrowed use sites for discriminants, truthiness, nullish coalescing, instanceof, equality, and null checks. CLI tests prove emitted paths consume those TSTS decisions with finalized target facts, while invalid narrowed source is rejected before backend analysis or artifact emission. Query results remain source-type descriptions and do not encode carriers, target members, or runtime policy.",
  }),
  "tsts.no-target-overrides": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/frontend/src/validator.test.ts",
    ]),
    notes:
      "Reviewed proof: source-core and host tests use the public @tsonic/tsts package root to add facts after TS-Go accepts source, invalid source-core arity remains a TypeScript diagnostic rather than an extension rescue, and CLI TSTS diagnostics stop artifact emission when source TypeScript is invalid.",
  }),
  "tsts.program.create-with-extensions": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/program/creation-cases/tsts-source-program.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: source-core tests create compiler sessions with extensions through public @tsonic/tsts root exports, host tests compose source-core, target-provider, provider-package, and selected-surface extensions before semantic input reaches backends, stale/unowned selected extension composition is rejected before consumers run, and old TSTS source-program evidence is mapped to the current extension-session contract.",
  }),
  "tsts.diagnostic.provider-sourced": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: source-core extensions surface diagnostics through standard TSTS diagnostics with deterministic codes, source spans, and no backend artifact fallback while importing the TSTS API only from the package root. Old source-extension diagnostic evidence is mapped to the current provider-sourced diagnostic contract. Provider-owned virtual-module diagnostics remain tracked in provider.module.* and diagnostic.missing-provider-fact.",
  }),
  "type.utility": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/utility-types.test.ts",
      "packages/targets/csharp/emitter/testcases/common/types/constants/ModuleConstants.ts",
      "packages/targets/csharp/emitter/testcases/common/types/utility-types/UtilityTypes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: Partial, Required, Readonly, Pick, Omit, Record, Exclude, Extract, NonNullable, ReturnType, Parameters, ConstructorParameters, InstanceType, and Awaited are accepted or rejected by TSTS before backend emission. Current CLI tests cover object, callable, tuple, provider, and source-core primitive boundaries; generated C# consumes resolved source shapes and never preserves or reimplements utility type syntax.",
  }),
  "type.conditional": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/conditional/ConditionalTypes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: conditional type aliases resolve through TSTS for distributive and non-distributive forms, nested provider aliases, tuple-head extraction, callable inference, and negative assignability. When a conditional transform carries source-core primitive evidence that is erased to a plain TypeScript primitive, C# type emission fails closed with sourcePrimitive evidence instead of collapsing int32-style facts to C# double.",
  }),
  "type.mapped": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/mapped/MappedTypes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: mapped type aliases with readonly/optional modifier changes, keyof iteration, key remapping, template literal keys, and object-literal freshness are resolved by TSTS and consumed through indexed access as ordinary source types in C# emission. Provider/source-core boundary tests prove direct source-core aliases and provider generic receivers coexist with mapped type usage; backend output contains no mapped-type syntax or source-name inference.",
  }),
  "type.indexed-access": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/utility-types.test.ts",
      "packages/targets/csharp/emitter/testcases/common/types/mapped/MappedTypes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: indexed access into object, utility, mapped, key-remapped, array element, provider-derived, optional tuple, and tuple-derived type aliases resolves through TSTS to ordinary source types. Incompatible numeric and boolean/string assignments plus invalid property keys are rejected by TSTS before backend artifacts are produced.",
  }),
  "type.keyof": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/utility-types.test.ts",
      "packages/targets/csharp/emitter/testcases/common/types/mapped/MappedTypes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: keyof drives mapped copies, Pick-derived key unions, key-remapped template literal properties, tuple/indexed access projections, and provider-compatible type aliases entirely inside TSTS. C# emission consumes the resolved value type and does not inspect source property names as type evidence.",
  }),
  "type.infer": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/conditional/ConditionalTypes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: infer in conditional tuple positions, rest tuple positions, callable parameter/return positions, and provider generic element extraction resolves through TSTS to selected source results; backend emission consumes the resolved source/provider shape without implementing infer semantics. Source-core primitive facts through arbitrary infer transformations are not treated as complete target evidence: if explicit primitive evidence is lost during TSTS-only type computation, C# emission reports a deterministic primitive-preservation diagnostic instead of guessing a fallback carrier.",
  }),
  "type.template-literal": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/utility-types.test.ts",
      "packages/targets/csharp/emitter/testcases/common/types/mapped/MappedTypes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: template literal type aliases with generic substitution, unions, intrinsic string manipulation, conditional branches, and mapped property-key remapping are accepted by TSTS, emitted as ordinary target string source after TSTS resolves them, and incompatible literals are rejected by TSTS before backend artifacts are produced. The backend does not reimplement template literal type compatibility or preserve template type syntax in C# emission.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: variadic tuple type aliases are resolved by TSTS into concrete tuples consumed by the C# backend as value tuples, including readonly tuples, labels, optional/rest elements, generic tuple inference, and tuple element access from finalized facts. Incompatible tuple arity is rejected by TSTS before backend artifacts are produced. Variadic tuple transforms containing source-core primitive evidence fail closed when no target primitive fact survives the transformation, so the backend cannot overclaim int32-style evidence as plain C# double.",
  }),
  "type.satisfies": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/utility-types.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: satisfies is checked by TSTS as a source-only validation construct. Valid primitive, object-literal, generic contextual, source-core, and provider-generic satisfies expressions erase to the underlying expression in target emission; invalid primitive constraints, provider generic mismatches, and object-literal freshness violations stop before backend artifacts are produced. Tsonic does not attach target semantics to satisfies.",
  }),
  "type.as-const": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/utility-types.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: as const is consumed as a TSTS literal/readonly decision. Valid readonly tuple literals, nested readonly object/array expressions, provider constructor arguments, and source-primitive-adjacent uses emit from resolved tuple/provider facts without target-specific as-const syntax; readonly tuple and nested object mutations are rejected by TSTS before backend artifacts are produced.",
  }),
  "type.non-null-assertion": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/tsts-type-forms.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nullable-narrowing/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: non-null assertion is checked by TSTS for direct expression, property access, call, provider-owned nullable, generic, and optional-chain-adjacent forms. Valid source emits the underlying expression without backend nullability inference, and invalid member access after the assertion is rejected by TSTS before backend artifacts are produced.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: .NET provider imports such as @tsonic/dotnet/System.js and @tsonic/dotnet/System.Reflection.js become TSTS compiler virtual modules, including cross-module inherited member refs whose provider-ref module ownership is preserved instead of rewritten to the inheriting base module. Sliced imports and encoded dependency modules now preserve requested export slices through declaration-model loading instead of upgrading dependencies to broad namespace imports.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: C# target and selected surface providers explicitly own their virtual module specifiers, unselected providers do not rescue imports, and target packs without providers fail before backend emission instead of falling back to package files.",
  }),
  "provider.virtual-module.no-fallback": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-performance.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-performance.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
      "packages/cli/src/commands/restore.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: provider-owned virtual modules have no generated declaration, metadata JSON, package-root shim, or file-backed compatibility lane; selected .NET modules win over shadow package files, missing provider facts remain diagnostics/blockers, unsliced .NET provider module/declaration requests fail before provider loading instead of silently widening to a broad import, sliced requests fail closed when a requested export is not provider-proven, and requested unsupported exports now produce provider-evidence diagnostics rather than generic missing-export diagnostics.",
  }),
  "provider.virtual-module.source-shape": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-performance.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-performance.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: reflected .NET declarations produce source-visible provider shapes for classes, delegates, properties, methods, constructors, overloads, inherited members, native CLR arrays, attributes, and explicit unsupported omissions; dependency declarations are resolved through exact requested export slices; sliced System imports expose only requested declarations such as Convert instead of broad unrelated namespaces such as System.Xml or System.ComponentModel; canonical raw provider refs must carry moduleSpecifier/exportName before TSTS virtual declaration conversion; unsupported by-ref delegate returns remain target-only instead of leaking fake source declarations.",
  }),
  "provider.virtual-module.target-identity": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/cli/src/package-manifests/bindings.test.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: provider virtual declarations carry assembly-qualified target identities into TSTS facts and C# emission, including inherited .NET members, reflected overloads, static/instance method identity, constructor identity, native CLR array identity, and fully qualified provider refs; selected operations emit from these identities rather than source spelling.",
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
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/SingleConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/MultipleConstraints.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/ObjectConstraint.ts",
      "test/fixtures/generic-constraints-single/",
      "test/fixtures/generic-multiple-constraints/",
      "test/fixtures/generic-constraints-object-struct/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: provider virtual declarations keep target-only generic constraints out of source-visible TypeScript shapes while retaining full reflected target binding facts for backend/provider consumers, including C# notnull as a target-specific constraint and unsupported target-only constraints as deterministic rejected target facts. The C# semantic provider validates those constraints only from finalized target facts after TSTS has accepted source syntax, and source primitive constraints are accepted only when reflected primitive target bindings prove the exact implemented contract and type arguments. CLI/toolchain proof uses a real reflected .NET assembly to validate class/new/interface, generic-method, struct, unmanaged, and notnull constraints, and invalid provider constraint violations fail closed before C# artifacts are emitted. Old generic constraint fixtures are mapped as replacement evidence for the provider-backed constraint contract.",
  }),
  "source.primitive.numeric": Object.freeze({
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
      "packages/frontend/src/tsonic-extension/numeric-primitives.test.ts",
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: @tsonic/core/types.js exposes every neutral numeric primitive without C# alias names: int8/uint8, int16/uint16, int32/uint32, int64/uint64, int128/uint128, nativeInt/nativeUint, float16/float32/float64, and decimal. Source-core package tests prove every export carries exact width, sign, runtimeBase, and module identity through direct, aliased, and namespace imports, while same-spelling local imports and aliases do not create source-primitive facts. C# source-semantics tests prove neutral numeric aliases remain source-core facts and source primitive assertions use explicit C# conversion facts. CLI/toolchain proof emits every neutral numeric primitive to its C# carrier and dotnet-builds the result, with local TypeScript aliases proving no name-based primitive guessing.",
  }),
  "source.primitive.char-bool": Object.freeze({
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
      "test/fixtures/char-primitive/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: neutral bool and char imports attach source-primitive facts with boolean and string runtime bases, char width/sign data is preserved, bool field facts flow through struct field collection, and source-core package tests prove direct/alias/namespace imports plus local same-spelling no-guessing behavior. CLI/toolchain proof emits bool and char carriers, ternary bool flow, char literals/defaults/escapes, and rejects invalid multi-code-unit char literals before artifact emission.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: configured @tsonic/csharp primitive aliases are source-visible only through the selected C# provider module and map to canonical source-core facts for every current C# alias: bool, byte, char, decimal, double, float, int, long, nint, nuint, sbyte, short, uint, ulong, and ushort. Unit proof covers direct and namespace imports plus local no-guessing; source-core proof shows neutral @tsonic/core exports intentionally omit C# alias spellings. CLI/toolchain proof emits every configured C# alias to its target carrier, rejects C# alias spellings imported from neutral core modules, and proves local TypeScript aliases to number emit as number/double instead of guessed configured primitive facts. Local barrel re-exports remain unsupported by design and attach no facts; they do not define the configured alias consumption contract.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: imported, aliased, and namespace out/ref/inref markers attach byref-writeonly-must-init, byref-readwrite, and byref-readonly argument-passing facts only from @tsonic/core/lang.js identity and proven identifier/property/element storage. Source-core tests prove local and shadowed same-spelling functions do not create marker facts. C# provider tests prove selected method, constructor, indexer, extension receiver, optional/default, params-array, and mutated-fact paths consume those facts rather than source spelling. CLI evidence proves unproven storage like out(value + 1), ref(value + 1), and inref(value + 1) produces TSTS_SOURCE_SEMANTICS_0001 diagnostics before C# artifacts are emitted.",
  }),
  "source.marker.field": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "test/fixtures/struct-basic/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: field<T>() attaches finalized field facts only from @tsonic/core/lang.js identity, explicit type evidence, and a proven static field-containing context. Source-core unit proof covers struct fields, class-property field contexts, identifier/string/numeric static names, member ordering, nested struct type evidence, local/shadowed no-guessing, missing type evidence, orphan field rejection, TSTS duplicate-name rejection, and non-field struct-shape diagnostics. CLI/toolchain proof emits C# class and struct fields from finalized facts, builds those artifacts, and rejects invalid duplicate/non-field shapes before target artifacts are created.",
  }),
  "source.marker.struct": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/classes-value-types.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/classes-value-types.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "test/fixtures/struct-basic/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: struct({ ... }) records a valueType struct fact whose fields are exactly finalized field facts from static object-literal field assignments, preserves source member ordering, finalizes the owner variable declaration, supports nested struct type evidence through typeof, and rejects non-field shorthand/raw members while relying on TSTS for duplicate object-literal names. Source-core identity tests prove direct, alias, namespace, local, and shadowed forms do not guess by source spelling. CLI/toolchain proof emits public C# structs from finalized facts, preserves field order including nested struct fields, builds the target project, and rejects invalid shapes before C# artifacts are emitted.",
  }),
  "source.marker.attribute": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/attributes.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/attributes.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/comprehensive/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/targets/Attributes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: provider-backed attribute<User>() selectors attach finalized attribute facts for type, constructor, constructor parameter, method, return, method parameter, property, field target, and property target placements with exact source declaration targets and argument nodes. Missing explicit attribute target evidence, unproven selector bodies, non-literal parameter names, non-literal target specifiers, unsupported explicit target specifiers, missing provider target facts, and unsupported provider attribute values fail closed with source-semantics/provider diagnostics. C# planner and CLI/toolchain tests render declaration attribute AST from finalized facts only, build provider-backed attribute output, and prove source marker calls are erased instead of emitted as runtime code.",
  }),
  "source.marker.defaultof": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/defaultof-intrinsic/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: defaultof<T>() attaches default-value facts whose type is the finalized source type node, including finalized owner facts on variable declarations. Source-core tests cover primitives, direct/alias/namespace imports, local/shadowed no-guessing, and missing explicit default type evidence through direct, alias, and namespace imports. CLI/toolchain proof emits target default expressions for primitive, source struct, reference class, nullable reference, and provider generic types, and rejects defaultof() before C# artifacts with SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: neutral ptr<int32>, nested ptr<ptr<int32>>, fnptr<[int32, bool], char>, fnptr<[], bool>, and scalar-argument fnptr<int32, bool> aliases plus core namespace marker imports attach pointer and function-pointer facts with target-defined mutability, unsafe requirements, parameter/result type nodes, and target-default ABI. Local same-spelling markers and function-generic shadowed type names do not attach facts, invalid arity is rejected by TSTS checking, C# CLI emits unsafe pointer/function-pointer output from finalized neutral facts with unsafe project settings, and .NET provider tests prove unsupported pointer signatures are target diagnostics instead of source declarations.",
  }),
  "source.marker.borrow-move": Object.freeze({
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
      "test/fixtures/core-intrinsics-provenance/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: neutral @tsonic/core/lang.js borrow, borrowMut, and move calls attach finalized TSTS flow facts from direct, alias, and namespace imports; local/shadowed same-spelling calls do not attach facts; invalid no-argument and extra-argument calls are rejected by TSTS checking without source-core facts. Source-core keeps flow facts on the exact marker call plus argument subjects rather than marking later use-sites as validated. The C# target explicitly rejects finalized borrow/move flow facts with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED and rejects missing marker facts with capability-scoped diagnostics instead of silently erasing the marker calls. Rust ownership validation remains a future target implementation and does not keep the C# target rejection contract partial.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: out(value), aliased out(value), namespace out(box.field), and element/property storage record write-only byref facts only when TSTS/source-core proves the target expression is storage. Provider selection tests prove methods, constructors, indexers, extension overloads, and mutated selected-operation facts require the finalized byref-writeonly-must-init fact before C# operation facts are emitted. CLI evidence proves out(value + 1) records no usable storage fact and emits TSTS_SOURCE_SEMANTICS_0001 before C# artifacts are emitted.",
  }),
  "source-core.ref.parameter-mode": Object.freeze({
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
      "test/fixtures/param-modifiers/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: ref(value), inref(value), aliases, namespace markers, and element/property storage attach readwrite and readonly parameter-mode facts to proven storage only. Provider selection tests prove methods, constructors, indexers, extension overloads, default/optional/params paths, and mutated selected-operation facts consume finalized parameter-mode facts and reject missing/mismatched facts. CLI evidence proves ref(value + 1) and inref(value + 1) fail closed with TSTS_SOURCE_SEMANTICS_0001 before C# artifacts are emitted; local and shadowed functions named like markers do not receive source-core parameter facts.",
  }),
  "source-core.struct.field-facts": Object.freeze({
    positiveTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "test/fixtures/struct-basic/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: source-core combines struct and field markers into value-shape facts only when each field has explicit type evidence and a static field-containing context. Unit proof covers non-field expressions, member ordering, nested struct type evidence, orphan field rejection, class-vs-struct field context, and local/shadowed no-guessing. C# CLI/toolchain proof emits class fields and value-type struct fields from those facts, preserves member order, renders nested struct field types, builds the result, and fails closed for duplicate or non-field shapes before target artifacts are produced.",
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
    oldEvidence: Object.freeze([
      "test/fixtures/core-intrinsics-provenance/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: TSTS/source-core records borrowed-shared, borrowed-mut, and moved flow facts for direct, aliased, and namespaced neutral markers; rejects invalid no-argument and extra-argument forms during TypeScript checking without source-core facts; avoids facts for local/shadowed same-spelling calls; and records neutral facts only on the exact call and argument subjects, not later post-flow use-sites. C# consumes those finalized facts only to emit explicit unsupported-target diagnostics and never erases them as identity calls.",
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
    blockers: Object.freeze([]),
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
      "Reviewed proof: @tsonic/core/lang.js exports out/ref/inref/borrow/borrowMut/move/struct/field/attribute/defaultof call markers and ptr/fnptr type markers from one source-core-owned module, with each export tracked by a source-core.lang.portable-intrinsics.* child capability. Source-core package tests prove direct provider-owned facts for every current intrinsic, alias and namespace import facts for storage, flow, struct, field, attribute, defaultof, ptr, and fnptr markers, invalid arity rejection through TSTS checking, fail-closed missing storage/type evidence through direct/alias/namespace imports, finalized owner facts for struct/defaultof, no-name-guessing for local/shadowed markers including type-marker generic shadowing, and deterministic SOURCE_SEMANTICS_CORE_LANG_REEXPORT_UNSUPPORTED diagnostics for unsupported local barrel and export-star forms while attaching no portable facts. CLI and C# tests prove the selected C# target either implements the intrinsic by finalized facts or rejects it with deterministic diagnostics; future Rust ownership semantics are separate target rows.",
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
      "test/cli-build/source-semantics.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/param-modifiers/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: TSTS/source-core records byref-writeonly-must-init only for direct, aliased, or namespaced imported core out markers over proven identifier/property/element storage. Invalid arity is rejected by TSTS checking, local/shadowed out calls do not attach facts, and CLI evidence proves out(value + 1) reports TSTS_SOURCE_SEMANTICS_0001 before C# artifacts are emitted. C# provider method, constructor, indexer, extension overload, optional/default, params-array, and mutated-fact tests consume the finalized fact as out storage rather than by source name.",
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
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/param-modifiers/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: TSTS/source-core records byref-readwrite for direct, aliased, and namespaced imported ref markers only over proven storage, while same-spelling local and shadowed functions do not receive marker facts. CLI evidence proves non-storage ref(value + 1) diagnostics block C# artifacts and invalid arity is rejected by TSTS checking. C# provider tests prove selected byref methods, constructors, indexers, extension overloads, default/optional/params paths, and mutated-fact cases require finalized readwrite parameter facts before target emission.",
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
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "test/fixtures/param-modifiers/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: imported, aliased, and namespace inref records byref-readonly on the call marker only when the argument is proven storage; it does not place argument-passing facts on unrelated expressions. CLI evidence proves non-storage inref(value + 1) diagnostics block C# artifacts and invalid arity is rejected through TSTS checking. C# provider tests prove immutable byref emission for selected provider paths consumes finalized inref facts and rejects missing or mismatched parameter-mode evidence.",
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
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [
      "test/fixtures/core-intrinsics-provenance/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: TSTS/source-core records borrowed-shared flow for direct, aliased, and namespace borrow calls on the exact call and argument subjects, rejects invalid no-argument and extra-argument forms through TSTS checking without source-core facts, avoids facts for local/shadowed same-spelling calls, and does not mark later use-sites as source-validated borrow flow. C# is target-owned and rejects finalized borrow facts with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED instead of erasing the call; C# call mapping also rejects source-flow marker erasure when the finalized FlowStateFact is absent.",
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
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [
      "test/fixtures/core-intrinsics-provenance/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: TSTS/source-core records borrowed-mut flow for direct, aliased, and namespace borrowMut calls on the exact call and argument subjects, rejects invalid no-argument and extra-argument forms through TSTS checking without source-core facts, avoids facts for local/shadowed same-spelling calls, and does not mark later use-sites as source-validated mutable-borrow flow. Selected targets own exclusivity; C# explicitly rejects finalized borrowMut facts with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED and rejects missing FlowStateFact with CSHARP_FLOW_MARKER_FACT_NOT_PROVEN rather than lowering the marker away.",
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
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [
      "test/fixtures/core-intrinsics-provenance/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: source-core records moved flow on direct, aliased, and namespace move calls plus the exact moved argument subject, rejects invalid no-argument and extra-argument forms through TSTS checking without source-core facts, and avoids facts for local/shadowed same-spelling calls. C# has explicit target-owned behavior for the current product scope: finalized move facts are rejected with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED instead of being erased as identity calls, while missing FlowStateFact still rejects with CSHARP_FLOW_MARKER_FACT_NOT_PROVEN. Future Rust ownership validation is tracked separately and does not redefine the current C# rejection contract.",
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
      "test/cli-build/source-semantics.test.mjs",
      "test/cli-build/classes-value-types.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/classes-value-types.test.mjs",
    ],
    oldEvidence: [
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "test/fixtures/struct-basic/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: struct({ x: field<int32>() }) and namespace lang.struct({ x: lang.field<int32>() }) record valueType struct facts only from finalized field facts; source-core package tests prove finalized owner facts on the struct variable, string/numeric static field names, non-field member diagnostics, member ordering, nested struct type evidence, and local/shadowed no-guessing. C# CLI tests emit public structs only from those facts, preserve field order, build nested struct fields, and fail closed for duplicate or unproven value-type members before target artifacts are produced.",
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
      "test/cli-build/source-semantics.test.mjs",
      "test/cli-build/classes-value-types.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/classes-value-types.test.mjs",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/targets/csharp/emitter/testcases/common/structs/basic/Point.ts",
      "test/fixtures/struct-basic/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: field<int32>() and namespace lang.field<int32>() attach field facts only from explicit type evidence and proven static field-containing contexts, including struct property assignments, class property initializers, identifier/string/numeric static names, and nested struct type queries. Local/shadowed same-spelling field functions do not attach facts. field() without type evidence, orphan field<int32>(), TSTS duplicate object-literal names, and non-field struct members produce deterministic diagnostics instead of inferred target fields; C# CLI tests emit class and struct fields from finalized facts and build them.",
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
      "test/cli-build/provider-dotnet.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/provider-dotnet.test.mjs",
    ],
    oldEvidence: [
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/comprehensive/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/targets/Attributes.ts",
    ],
    blockers: [],
    notes:
      "Reviewed proof: attribute<T>() and namespace lang.attribute<T>() record class, constructor, constructor-parameter, property/field, method, return, and parameter facts only when selectors and strings prove exact source declarations; local same-spelling builders do not attach facts. Provider-backed C# attributes emit from target identity facts, unsupported attribute values are represented as provider diagnostics instead of dropped metadata, and unproven builder chains plus unsupported target specifiers fail closed before artifacts.",
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
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ],
    oldEvidence: [
      "test/fixtures/defaultof-intrinsic/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: defaultof<char>(), defaultof<int32>(), namespace lang.defaultof<bool>(), and aliased defaultof imports attach neutral default-value facts only from explicit source type evidence and finalize owner facts on variable declarations, while local/shadowed same-spelling defaultof functions do not attach facts. defaultof() fails closed with SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE through direct, alias, namespace, and CLI paths. C# emits Roslyn target default expressions only after consuming finalized facts, with CLI/toolchain proof for primitive, source struct, reference class, nullable reference, and provider generic target types.",
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
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ],
    oldEvidence: [
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "test/fixtures/pointer-types/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: aliased ptr<int32>, namespace lang.ptr<int32>, and nested ptr facts attach target-defined mutability plus unsafe-required evidence; local same-spelling ptr aliases and function-generic shadowed pointer names do not attach pointer facts; invalid arity is rejected by TSTS checking; C# CLI emits int* with AllowUnsafeBlocks only from finalized facts; and unsupported provider pointer shapes remain deterministic target diagnostics.",
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
      "test/cli-build/source-semantics.test.mjs",
    ],
    negativeTests: [
      "packages/source-core/src/source-extension.test.ts",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ],
    oldEvidence: [
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "test/fixtures/pointer-types/",
    ],
    blockers: [],
    notes:
      "Reviewed proof: source-semantics records fnptr parameter/result type facts from aliased and namespace core type marker imports, including empty tuple, tuple, scalar, pointer-parameter, and pointer-result forms; it rejects local same-spelling aliases and function-generic shadowed callback names, relies on TSTS checking for invalid arity, emits target-default ABI facts, and C# CLI emits delegate* output with AllowUnsafeBlocks only from finalized neutral facts. Unsupported provider function-pointer shapes remain deterministic target diagnostics.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: .NET provider target identity is assembly-qualified targetId while CLR metadataName remains display/provenance only; duplicate Shared.Widget across assemblies cannot resolve by metadata-name-only lookup and produces explicit unsupported collision evidence with both assembly identities. Provider modules carry assembly reference facts with version/path evidence, explicit target assembly references select referenced assemblies without file-backed fallback, target project references are represented as C# target options, and invalid assembly/target identity drift is rejected by the provider contract before declaration conversion.",
  }),
  "native.dotnet.type-model": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/InheritanceChain.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-interface-inheritance/InterfaceInheritance.ts",
      "test/fixtures/generic-nested-substitution/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: .NET reflection exposes source-visible and target-only type models for classes, structs, interfaces, enums, delegates, generic type parameters, cross-namespace provider refs, unique nested CLR types, type families, base types, implemented contracts, explicit native CLR arrays, and assembly-qualified target identities. Provider model contract tests reject legacy/incomplete provider refs and malformed primitive/type-parameter refs before virtual declaration conversion. Ambiguous same-source-name type families stay out of source declarations and produce unsupported-export diagnostics with target ids, while target-only bindings retain deterministic provider evidence for backend consumers.",
  }),
  "native.dotnet.member-methods": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: .NET provider records reflected methods, overload groups, generic method arity, extension receiver passing, receiver/out parameter metadata, static/instance identity, inherited members, selected-signature identity, and operator signature ids that include return type when CLR overloads require it. Provider selection maps calls from exact selected provider declaration/signature identity, rejects missing identity, rejects ambiguous same-spelling selections, does not search target members outside the selected overload group, and records unsupported method families as provider diagnostics rather than silently omitting them. CLI/toolchain evidence covers SDK methods, custom assembly methods, generic methods, extension methods, optional/default/params signatures, byref signatures, and unsupported selected signatures.",
  }),
  "native.dotnet.member-fields-properties-events": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/basic/Person.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/field-inference/Counter.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: .NET provider records reflected properties, fields, numeric indexers, generic Dictionary indexers, enum fields, static/instance target facts, inherited member projections, setter/read-only mutability, and event target facts. Provider contract tests prove SDK Dictionary indexer metadata is present without Dictionary-specific analysis branches. Selected property, field, and indexer access maps only from selected provider member identity; writable member validation uses finalized provider facts; selected events deterministically reject until source event semantics exist; source declaration conversion omits events and unsupported/non-source-shaped members while target bindings retain deterministic unsupported evidence.",
  }),
  "native.dotnet.constructors": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
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
      "Reviewed proof: .NET provider records public reflected constructors as constructor members with exact signature ids, excludes non-public constructors from raw/source/target models, preserves constructor overload groups, array-literal element metadata, cross-namespace parameter provider refs, optional/default/params/byref facts, CLSCompliantAttribute constructor metadata, and selected constructor identity; source conversion omits constructor-named non-constructor members, records unsupported constructor signatures instead of dropping them, and CLI/provider-selection tests prove provider-owned new expressions and selected unsupported constructor diagnostics end to end.",
  }),
  "native.dotnet.constraints": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/SingleConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/MultipleConstraints.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/ObjectConstraint.ts",
      "test/fixtures/generic-constraints-single/",
      "test/fixtures/generic-multiple-constraints/",
      "test/fixtures/generic-constraints-object-struct/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: .NET reflection records class, struct, new, unmanaged, notnull, interface, base-class, generic-method, variance, and unsupported constraints as target facts with assembly-qualified target identities, keeps those target-only constraints out of source declarations, maps notnull to C# target-specific constraint facts, and maps unsupported constraints to fail-closed target diagnostics. The C# semantic provider accepts or rejects generic constraints from finalized target binding facts instead of changing TSTS source assignability, including exact reflected primitive contract facts for source primitives such as int32. CLI/toolchain proof with a real reflected assembly exercises valid class/new/interface, generic-method, struct, unmanaged, and notnull target constraints plus invalid fail-closed diagnostics before C# artifact emission. Old generic constraint fixtures are mapped as replacement evidence for the native .NET reflected constraint model.",
  }),
  "native.dotnet.conversions": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-conversion-operators.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/implicit-int-to-double/",
      "test/fixtures/default-param-int-to-double/",
      "packages/targets/csharp/emitter/testcases/common/types/type-assertions/TypeAssertions.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: .NET reflection records op_Implicit and op_Explicit as target-only conversion operator facts, keeps them out of source-visible provider members, selects conversion operators only by exact reflected operator identity, substitutes generic conversion operator type arguments, reports ambiguity rather than choosing by order, and records unsupported pointer/lifted/unrepresentable operators as unsupported provider evidence instead of exposing them. Current planner and CLI proof covers source assertions, assignment/return conversion facts, generic operator substitution, missing selected conversion identities, malformed conversion metadata, ambiguous conversion evidence, and unsupported conversion diagnostics without source-name guessing or runtime reflection.",
  }),
  "native.dotnet.parameter-modes": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/lang/stackalloc/StackAlloc.ts",
      "test/fixtures/param-modifiers/",
    ]),
    notes:
      "Reviewed proof: .NET provider modeling preserves by-value, out, ref, in, optional, supported default-value, unsupported default-value, and params-array parameter facts across raw reflection models, provider declaration models, target bindings, extension receivers, constructors, and reflected signature identities. Provider contract tests reject invalid passing modes, malformed params-array placement/type/passing, default values on non-optional parameters, and mixed supported/unsupported defaults before declaration conversion. CLI provider tests prove omitted optional target arguments emit only when a deterministic reflected default exists, reject omitted optional arguments without reflected defaults, emit reflected params-array extra arguments from selected target facts, and run Dictionary.TryGetValue out-parameter behavior through generated C# output. Unsupported default values carry deterministic parameter identity and evidence without becoming source-visible defaults. This closes the .NET provider-model parameter-mode contract; provider-owned call emission breadth remains tracked separately by operation.call.provider-parameter-mode.",
  }),
  "native.dotnet.array.explicit": Object.freeze({
    sourceExamples: Object.freeze([
      "import { Array as DotNetArray } from \"@tsonic/dotnet/System.js\";",
      "const values: DotNetArray<int32> = DotNetArray.create<int32>(size); values[0] = 7; return values.length;",
      "function invalid(values: DotNetArray<int32>): void { values.length = 3; }",
      "function invalid(values: DotNetArray<int32>): int32 { const [first] = values; return first; }",
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
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-index-dotnet/",
      "test/fixtures/native-array-push-mutation/",
      "test/fixtures/readonly-array-property-mutation/",
    ]),
    blockers: Object.freeze([]),
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
          "native-array-destructuring-without-iterable-source-contract",
        ]),
      },
    }),
    notes:
      "Reviewed proof: current C# provider tests prove CLR SZArray type refs, explicit provider-owned @tsonic/dotnet Array<T> virtual declarations, collection literal metadata, unsupported ranked arrays, target-id lookup through the synthetic provider module index, and selected member/indexer facts. CLI proof emits int[] from DotNetArray.create<int32>(size), maps values.length to values.Length, maps values[index] to CLR array indexing, dotnet-builds the generated project, rejects JS mutators, length assignment, and native-array destructuring without a provider iterable source contract, and keeps ordinary source T[] as TypeScript Array<T> semantics. Ranked-array and unsupported array-family shapes are recorded as provider diagnostics rather than source-visible fallback declarations.",
  }),
  "native.dotnet.attributes": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/comprehensive/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/targets/Attributes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: .NET reflection records target/provider attributes on types, constructors, methods, properties, fields, parameters, and returns; provider contract proof covers CLSCompliantAttribute base refs and constructor metadata through SDK virtual declarations; target binding facts preserve constructor identity, constructor/named arguments, enum/type/array/source-primitive values, placement, and evidence; unsupported attribute values are recorded as unsupported attribute facts instead of being dropped. Source-authored attribute markers are wired end to end through source-core attribute facts, provider target identity, C# declaration emission, deterministic diagnostics for missing provider facts and unsupported explicit target specifiers, and dotnet build proof for generated class, constructor, parameter, field, property, method, return, and method-parameter attributes.",
  }),
  "declaration.class.abstract": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/target-config.test.mjs",
      "test/cli-build/whole-program-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/target-config.test.mjs",
      "test/cli-build/whole-program-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    oldEvidenceAbsence: Object.freeze({
      status: "reviewed-none-found",
      reviewedInventories: Object.freeze([
        "old fixture inventory",
        "old C# emitter inventory",
        "old product unit inventory",
      ]),
      searchEvidence: Object.freeze([
        "old class fixture inventory contains basic, constructor, inheritance, and static-member classes, but no abstract class/source modifier behavior fixture",
        "old product unit inventory references class traversal/rendering helpers, not approved source abstract-shape behavior",
      ]),
      reviewerNotes:
        "No historical old-suite source abstract-declaration behavior entry exists to map bidirectionally. Current source-syntax discipline treats TypeScript abstract modifiers as unsupported runtime-shape syntax until a future provider fact model explicitly owns abstract target shape.",
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: abstract class/member modifier spelling is a deterministic hard reject under source-syntax discipline, because abstract target shape is not owned by a provider fact model. Unit tests prove the C# backend does not synthesize abstract C# modifiers from TypeScript-only runtime-shape syntax, and CLI tests prove abstract declarations stop before C# artifacts while clean rebuild removes stale outputs.",
  }),
  "declaration.type-alias": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/whole-program-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/whole-program-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/function-type-aliases/GenericAliases.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: TypeScript type aliases are erased as source declarations and influence C# only through TSTS-selected type/signature facts plus finalized target carriers. Current CLI proof covers type-only aliases, callable generic aliases, higher-order function aliases, and whole-program erasure; target-type tests reject semantic-only alias results and missing carrier facts with deterministic diagnostics instead of rendering aliases from TypeScript spelling.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: provider-owned overload identity is selected from exact declaration/signature facts for .NET provider paths and direct surface cases, including same-spelling overload groups, static/instance identity, assembly-qualified duplicate source names, generic method arity, byref parameter modes, optional/params arity, constructors, indexers, extension receivers, return-type-distinguished CLR operator signatures, and selected signatures whose source argument facts would otherwise match sibling overloads. TSTS-selected provider identity is the proof boundary: exact selected signatures map only to the matching target member id and may not search sibling overloads; provider refinement is allowed only inside a proven overload group without source spelling lookup.",
  }),
  "type.generic.provider-target-arguments": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-lifecycle.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/tsts-type-forms.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-lifecycle.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/generic-methods/MethodInGenericClass.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-methods/MethodInNonGenericClass.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/SingleConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/VariableInit.ts",
      "test/fixtures/generic-function-value-default-export/",
      "test/fixtures/generic-method-standalone/",
      "test/fixtures/generic-nested-substitution/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: C# provider call/type facts close selected generic target members from TSTS-selected source signatures and proven target argument facts, reject unresolved or contradictory selected generic facts, and CLI module/type-form/provider tests prove imported/re-exported generic source calls, utility/alias-projected provider generic types, provider constructors, provider indexers, delegates, extension calls, inherited generic members, generic methods, and nested generic substitutions emit explicit C# generic arguments from finalized provider facts. Receiver node carrier facts are preferred over erased semantic TypeScript number shapes when source-core primitive aliases carry more target evidence; backend type rendering still requires finalized target argument facts and fails closed without fallback.",
  }),
  "type.generic.provider-target-constraints": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/declaration-generics.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
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
      "Reviewed proof: source and provider generic constraints render only from finalized target constraint facts, primitive constraint failures produce diagnostics, C# provider target constraints are accepted only when finalized value/reference/constructible/unmanaged/notnull/implemented-contract facts prove them, source primitive implemented-contract constraints require reflected primitive binding evidence with exact type-argument equality, unsupported provider constraints reject from explicit target facts, reflected notnull type references produce source-level C# target diagnostics after TSTS accepts the source syntax, and old generic-constraint emitter/fixture coverage is mapped as evidence. Real .NET CLI/toolchain proof covers class/new/interface, generic-method, struct, unmanaged, and notnull constraints, including invalid target arguments that fail closed without C# artifacts.",
  }),
  "carrier.array": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/array-spread-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof for the old array inventory slice: old emitter and fixture array cases are mapped to finalized array carrier facts rather than old frontend inference. Current CLI proof covers typed, empty, nested, double, multidimensional, spread, JS-surface, readonly source syntax, generic readonly source syntax, nested readonly source syntax, inferred source-owned array returns, explicit provider-owned native CLR arrays, and sparse JSArray carriers, including non-Node executables that coalesce nullable source arrays, spread into typed carriers, destructure fixed/default/rest elements, and verify exact stdout. Backend fact tests distinguish array-literal construction metadata from enumerable/read-only-indexable metadata: spread accepts finalized provider enumerable carriers, destructuring accepts finalized provider read-only indexable carriers, and literal-only carriers diagnose instead of being treated as indexable/enumerable. Fail-closed diagnostics cover untyped empty returns, native length access without selected facts, explicit DotNetArray spread/destructuring without a provider iterable source contract, compat any spread without closed array carrier facts, dense-carrier sparse-literal rejection, tuple default/rest without optional/slice facts, and incompatible closed element carriers. csharp-js runtime proof covers closed TsValue access to sparse JSArray carriers, length mutation, undefined holes, sparse literal construction, Array.at numeric coercion, and deterministic rejection for incompatible closed element carriers.",
  }),
  "operation.array.literal": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "../tsonic-csharp/test/array-spread-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "../tsonic-csharp/test/array-spread-boundary.test.mjs",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: array literals choose dense arrays, native collection construction, tuple values, or closed JSArray hole construction only from finalized target carrier facts. Current CLI tests build typed, empty-contextual, nested, spread-adjacent, provider-constructor, readonly tuple/as-const, sparse JSArray, double-array, and primitive element literal cases through dotnet build/run where observable. Backend fact tests prove sparse holes emit only for finalized JSArray carriers, dense carriers fail closed instead of compacting holes, and native collection literals require explicit provider construction metadata. Old array-literal emitter and fixture evidence is mapped to the current fact-backed path. Remaining array ABI, spread, binding/destructuring, provider-native indexer, tuple-widening, and full JS copy-in/copy-out coverage stays on the adjacent partial rows instead of being counted here.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: array literal expression coverage is tied to finalized array carrier and operation facts without treating syntax as carrier evidence. Current CLI/toolchain tests cover typed, empty, nested, double, multidimensional, spread-adjacent, module-scope, return, local, field, and bare-expression array literals, and negative proof rejects untyped empty literal emission when element evidence is absent instead of synthesizing an array carrier from syntax. Sparse/full-JS array runtime breadth stays in carrier.array and operation.array.literal.",
  }),
  "operation.spread.array": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/array-spread-boundary.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/array-spread-boundary.test.mjs",
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/spread/ArraySpread.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/ArraySpread.ts",
      "test/fixtures/array-spread/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: old spread emitter and fixture cases are mapped to current array spread evidence. Current backend and CLI proof renders spread only from finalized expected array/carrier facts through structured array-helper AST, validates module-scope spread constants, builds generated C# projects, executes tuple spread from finalized tuple carrier facts, executes fixed/default/rest/nested array destructuring fixtures, executes readonly array spread from finalized IReadOnlyList<T> collection metadata, executes a Slice 8 non-Node spread over a nullish-coalesced typed array, and fails closed before partial array creation when spread operand carrier facts are missing, when finalized carrier element facts mismatch, when compat any lacks closed array carrier facts, when explicit DotNetArray<T> lacks a provider iterable source contract, or when tuple spread would require non-identifier single-evaluation lowering that is not provider-proven. Missing-carrier, compat-any, provider-native, and non-identifier tuple-spread diagnostics preserve source spans and create no C# artifacts. Native collection spread requires finalized enumerable or tuple element metadata rather than array-literal metadata: provider enumerable carriers, readonly collection carriers, and tuple carriers are accepted, while provider literal-only carriers are rejected without falling back to source syntax. It does not revive old expected-type-threading logic inside Tsonic.",
  }),
  "operation.spread.object": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    oldEvidenceAbsence: Object.freeze({
      status: "reviewed-none-found",
      reviewedInventories: Object.freeze([
        "old fixture inventory",
        "old C# emitter inventory",
        "old product unit inventory",
      ]),
      searchEvidence: Object.freeze([
        "old object-literal and nested-object-rest fixtures cover object-shape carriers and rest materialization, but no direct source object-spread fixture is bidirectionally mapped to operation.spread.object",
        "current object-spread coverage is stronger than old coverage because it proves positive spread, subset spread, nested spread, readonly spread, dictionary hard-reject, compat-any hard-reject, and single-evaluation hard-reject through finalized facts",
      ]),
      reviewerNotes:
        "No direct old-suite object-spread capability exists to map bidirectionally. Current CLI and backend tests are the source of proof for object spread under the finalized object-shape fact model.",
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: object spread emits only from finalized source and target object-shape facts. Unit tests prove spread assignments read source target members and write target object-shape members by finalized fact identity, while missing source object-shape facts, missing spread facts inside object literals, and non-identifier spread expressions fail closed with exact spread-node source spans before partial object creation. CLI tests prove full object-shape spread, subset spread, readonly utility-projected spread, nested object spread inside rest/default object binding, and a non-Node object-rest-to-spread executable through generated C# projects. Computed/accessor object members, explicit any compat spread without closed extraction facts, dictionary/Record spread without provider dictionary-copy facts, any source member lacking a finalized target carrier, and single-evaluation lowering gaps diagnose before artifact emission instead of falling back to source spelling.",
  }),
  "operation.spread.provider-target-copy": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    oldEvidenceAbsence: Object.freeze({
      status: "reviewed-none-found",
      reviewedInventories: Object.freeze([
        "old fixture inventory",
        "old C# emitter inventory",
        "old product unit inventory",
      ]),
      searchEvidence: Object.freeze([
        "old object-literal and nested-object-rest fixture evidence maps to source object spread/rest behavior, not provider-target copy as an explicit capability",
        "old emitter/product inventories contain object literal and rest/spread-like shape materialization cases, but no provider-owned copy-fact contract or dictionary-copy operation lane",
      ]),
      reviewerNotes:
        "Provider-target copy facts are a new finalized-fact capability in the current architecture. Current tests prove structural object-shape member copy as the supported provider copy lane and deterministic diagnostics for unsupported dictionary, compat-any, missing-fact, and single-evaluation copy lanes.",
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: provider-target copy evidence is restricted to structural object-shape member copy. The backend copies only between provider-proven source and target object-shape members with finalized target names and carriers; executables prove copied rest members, readonly utility-projected members, and nested spread members feed generated C# behavior. Missing source facts, missing member carriers, computed/accessor members, non-identifier source expressions, explicit any compat spread, and dictionary/Record spread without finalized dictionary-copy semantics diagnose instead of falling back to dictionary/object projection or source-name matching.",
  }),
  "binding.array.fixed-rest-default": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/destructuring/ArrayDestructure.ts",
      "test/fixtures/array-destructuring/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: old array destructuring inventory maps to current binding-pattern tests for fixed positions, rest, defaults, nested array extraction, synthetic destructured parameter prelude, and sparse JSArray hole/default/rest extraction using finalized carrier facts. Current CLI runtime evidence includes non-Node fixed/default/rest destructuring after array spread from a finalized nullable carrier, JS-surface sparse literal destructuring where defaults test hasIndex instead of length, required tuple defaults that erase to the finalized Item projection, two-or-more tuple rest binding that emits a closed tuple from finalized element carriers, one-element tuple rest binding that emits System.ValueTuple<T>, empty tuple rest binding that emits System.ValueTuple, and explicit DotNetArray<T> destructuring rejected by TSTS because no provider iterable source contract exists. Backend fact tests prove tuple fixed/rest extraction emits Item projections, one-element tuple rest emits System.ValueTuple<T>, optional/nullish tuple defaults fail closed until explicit carrier facts exist, provider read-only indexable carriers destructure without array-literal metadata, JSArray carriers use hole-presence checks for defaults, and provider literal-only carriers are rejected as missing index evidence. Missing carrier facts diagnose instead of falling back to stale array destructuring lowering.",
  }),
  "carrier.array.public-abi-policy": Object.freeze({
    sourceExamples: Object.freeze([
      "export function sequence(values: int32[]): int32 { let total: int32 = 0; for (const value of values) { total += value; } return total; }",
      "export function indexed(values: int32[]): int32 { return values[0] + values.length; }",
      "export function dense(values: int32[], index: int32, value: int32): int32 { values[index] = value; return values.length; }",
      "export function sparse(values: int32[], index: int32): int32 { delete values[index]; return values.length; }",
      "export function readonlyIndexed(values: readonly int32[]): int32 { return values[0] + values.length; }",
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
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-literal/",
      "test/fixtures/array-index-dotnet/",
      "test/fixtures/array-spread/",
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: CLI evidence compiles ordinary source int32[] and readonly int32[] parameters unchanged through the JS surface while finalized facts select int[] for unused native-array lanes, IEnumerable<int> for for-of sequential reads, IReadOnlyList<int> for length/index reads including readonly/generic/nested readonly source syntax, List<int> for dense mutation and explicit/inferred source-owned array returns, and a JSArray<int> local only for delete/hole semantics. Explicit provider-owned DotNetArray<T> uses CLR T[] only from @tsonic/dotnet provider facts, supports Length and indexer operations from selected native-array facts, and rejects JS mutators, length assignment, spread, and destructuring without provider-declared JS/iterable contracts. This proves the public ABI policy is fact-backed and does not infer CLR arrays or JSArray carriers from TypeScript T[] spelling alone.",
  }),
  "surface.js.array-methods": Object.freeze({
    sourceExamples: Object.freeze([
      "values.includes(value)",
      "values.indexOf(value, start)",
      "values.at(index) ?? fallback",
      "values.map((value, index, source) => value + index)",
      "Array.from(values)",
      "Array.of(left, right)",
    ]),
    tstsDecision:
      "TSTS validates the JavaScript Array declarations, selected member/signature, callback contextual types, overload, generic substitution, and result source type. The JS surface maps only from that selected declaration/signature identity plus finalized receiver/argument carrier facts.",
    providerFacts: Object.freeze([
      "selectedJsArrayMemberDeclaration",
      "selectedJsArrayMemberSignature",
      "arrayReceiverCarrierFact",
      "arrayArgumentCarrierFact",
      "arrayCallbackSignatureFact",
      "arrayResultCarrierFact",
      "selectedTargetSignatureFact",
    ]),
    backendContract:
      "C# emits Array helpers only from finalized selected target operation facts. It must not rediscover Array members from source names, infer callback arity in the backend, choose List/JSArray/native-array carriers from TS spelling, or emit unsupported/fallback calls when facts are missing.",
    positiveTests: Object.freeze([
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
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
    blockers: Object.freeze([]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/arrays.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
        "test/cli-build/js-surface.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/arrays.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/arrays.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: selected JS surface facts keep source TypeScript Array<T>/T[] as normal TS array semantics while selecting fact-backed C# ABI/carrier lanes: IEnumerable<T> for read-only iteration, IReadOnlyList<T> for index/length reads, List<T> for dense caller-visible mutation/array-return values, and closed JSArray<T> carriers only when sparse/full-JS facts require that lane. Current provider tests prove selected declaration/signature identity for concat, Array.from/of/isArray, at, map, push, iterator/copy methods, full-JS JSArray members, callback arities, and fail-closed missing receiver/argument facts. CLI tests dotnet-build length/index, concat/includes/index/search/slice/join helpers, nullish-producing at/pop/shift/find/findLast value/reference helpers, callback methods, destructuring/rest, spread, Array.from, Array.of, Array.isArray, sparse delete, and length mutation. Runtime tests prove SameValueZero includes, strict indexOf/lastIndexOf, nullish at/pop/shift/find/findLast, immutable-copy methods, callbacks, iterators, and hole preservation for JSArray carriers. Array for-in remains tracked separately by operation.iteration.for-in.keys. No-surface array mutators and sparse operations fail closed before artifact emission. Explicit CLR arrays remain tracked separately under native.dotnet.array.explicit.",
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
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-constructor/",
    ]),
    blockers: Object.freeze([]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
        "test/cli-build/js-surface.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: selected JS surface Array constructor declarations map new Array<T>(size) only from finalized selected-constructor facts plus closed JSArray<T> carrier facts. Explicit source-core primitive type arguments are preserved through constructor runtime carrier evidence, so new Array<int32>(size) emits JSArray<int>, not JSArray<double>. Missing result carrier facts reject in the provider, and no-surface/type-only Array constructor usage fails before artifact creation instead of allocating CLR arrays or dense List<T> from spelling. CLI evidence dotnet-builds the generated C# project and asserts no CLR-array/List fallback output.",
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
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
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
    blockers: Object.freeze([]),
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
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/arrays.test.mjs",
        "test/cli-build/js-surface.test.mjs",
        "test/cli-build/e2e-runtime-language.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
        "test/cli-build/e2e-runtime-language.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/arrays.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/arrays.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: selected JS surface Array.length and element access map only from the standard-library declaration plus finalized array receiver carrier facts. Provider tests defer when the declaration or carrier is absent, reject non-integral indexes, finalize source-level element operation facts from carrier evidence, and prove value-producing length assignment as JSArray.setLength when full-JS carrier facts are present. CLI tests emit IReadOnlyList<T>.Count, List<T> indexers, JSArray<T>.length/setLength, native byte[].Length only when explicit native-array facts exist, and reject native or no-surface length/index access without selected facts. Runtime tests prove JSArray length truncation, growth with holes, negative at indexes, out-of-range undefined/nullish carriers, delete-created holes, and dense helper behavior.",
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
    blockers: Object.freeze([]),
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
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/provider-dotnet.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: selected JS surface delete and Array.length mutation on TypeScript arrays require a closed JSArray carrier and emit JSArray.deleteAt/setLength only through finalized operation facts. No-surface sparse operations reject before artifact emission. Surface-boundary tests classify `index in values` as requiring the full-JS carrier before unsupported operator diagnostics, prove assignment-value-position length mutation facts, and reject missing carriers. CLI tests dotnet-build sparse delete plus length mutation through JSArray and reject delete/length mutation without selected JS facts. Runtime JSArray tests prove hole creation, length truncation/growth, hole-vs-default distinction, callbacks skipping holes, search semantics over holes, copying, concat, flat, flatMap, at returning JSUndefined for holes/out-of-range, and includes treating holes as undefined while indexOf skips them. Dense List<T>, IReadOnlyList<T>, and CLR T[] carriers do not approximate sparse/delete/hole semantics; missing facts are hard rejects.",
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
      "../tsonic-csharp/test/nodejs-stats-date-surface.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/lazy-analysis.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/analysis-abstraction-policy.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../tsonic-csharp/test/nodejs-stats-date-surface.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/lazy-analysis.test.mjs",
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
      "Complete proof: the C# architecture validator now reports zero findings across product code after JS/Node surface member routing and object-shape member lookup were moved behind selected identity, finalized facts, declarative metadata, generic selectors, or structured missing diagnostics. Lazy generic analysis tests prove checked-source structural queries without policy conclusions, and surface/object-shape tests prove selected declarations/facts are required for JS, Node, and object-shape operations.",
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
    sourceExamples: Object.freeze([
      "const upper = value.trim().toUpperCase();",
      "const parts = value.split(\",\");",
      "const converted = String(value);",
      "const wrapper = new String(value);",
    ]),
    tstsDecision:
      "TSTS validates string primitive member access, StringConstructor call/construct signatures, and selected JS surface declarations. The JS surface provider may only map those selected declarations/signatures after closed receiver or argument facts exist.",
    providerFacts: Object.freeze([
      "selectedJsStringDeclaration",
      "selectedJsStringConstructorDeclaration",
      "closedStringReceiverFact",
      "closedStringConversionArgumentFact",
      "selectedStringTargetSignature",
      "stringArrayReturnCarrierFact",
      "unsupportedStringExactnessDiagnosticFact",
      "unsupportedStringWrapperDiagnosticFact",
    ]),
    backendContract:
      "C# emits selected System.String/runtime-helper/Globals.String calls only from finalized JS string operation facts. String.raw, match, matchAll, wrapper construction, source-spelling selection, and native string fallbacks without selected facts are diagnostics.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/StringTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
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
    blockers: Object.freeze([]),
    laneClassification: freezeLaneClassification({
      patternKind: "js-string-method-or-conversion",
      possibleLanes: Object.freeze(["static-native", "compat-runtime", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-string-prototype-declaration",
          "selected-js-string-constructor-declaration",
          "closed-string-receiver-target-type",
          "closed-string-conversion-argument-target-type",
          "selected-string-target-signature",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-selected-js-surface",
          "missing-string-prototype-declaration",
          "missing-string-constructor-declaration",
          "missing-closed-string-receiver",
          "missing-closed-string-conversion-argument",
          "missing-selected-target-signature",
          "unsupported-string-exactness-lane",
          "unsupported-string-wrapper-carrier",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-string-prototype-declaration",
          "selected-js-string-constructor-declaration",
          "closed-string-receiver-target-type",
          "closed-string-conversion-argument-target-type",
          "selected-string-target-signature",
        ]),
        operation: "emit-selected-js-string-method-or-conversion",
      },
      compat: {
        lane: "compat-runtime",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-surface-runtime",
          "closed-js-string-helper-fact",
          "string-array-return-carrier-fact",
        ]),
        runtimeCarrier: "SelectedSurfaceRuntime",
        operation: "emit-selected-js-string-runtime-helper",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "receiver-not-closed-string",
          "conversion-argument-not-closed",
          "unsupported-string-exactness-lane",
          "string-wrapper-carrier-not-exposed",
          "source-spelling-only",
        ]),
      },
    }),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/StringTests.cs",
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
        "test/cli-build/js-surface.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: selected JS surface facts cover string element access, code-point for-of, selected string instance/helper calls including trim/toUpperCase chaining, normalize/locale case/localeCompare/search/well-formed helpers, split returning the selected JS surface List<string> array-return ABI, Object.toString delegation for closed string primitive receivers, and fail-closed rejection without closed string receiver facts. String(value) and zero-argument String() now map only from selected StringConstructor call identity plus closed conversion argument facts to Tsonic.CSharp.Js.Globals.String, with runtime tests proving explicit undefined/null conversion remains distinct from the zero-argument empty string result. new String(value) is deliberately hard-rejected until an explicit wrapper-object carrier exists, so wrapper construction never falls back to object/dynamic/native string semantics. String.raw, match, and matchAll are explicitly hard-rejected through selected source identities until template-object, RegExp coercion, RegExpMatchArray, iterator, group, and lastIndex semantics have closed runtime facts. CLI evidence dotnet-builds selected string calls and conversions through finalized facts and asserts no InvalidExpression, __unsupported, dynamic/reflection, or source-spelling fallback appears in generated output.",
  }),
  "surface.js.boolean-methods": Object.freeze({
    sourceExamples: Object.freeze([
      "const text = false.toString();",
      "const value = maybe.valueOf();",
      "const converted = Boolean(value);",
      "const wrapper = new Boolean(value);",
    ]),
    tstsDecision:
      "TSTS validates Boolean primitive member calls and BooleanConstructor call/construct signatures against selected JS surface declarations; the surface provider must prove closed boolean receiver facts for prototype methods and closed conversion argument facts for Boolean(value).",
    providerFacts: Object.freeze([
      "selectedJsBooleanDeclaration",
      "selectedJsBooleanConstructorDeclaration",
      "booleanPrimitiveReceiverFact",
      "booleanConversionArgumentFact",
      "booleanToStringOperationFact",
      "booleanValueOfOperationFact",
      "booleanConversionOperationFact",
      "booleanWrapperUnsupportedDiagnosticFact",
    ]),
    backendContract:
      "C# emits BooleanOps.toString/valueOf and Globals.Boolean conversion calls only from finalized selected Boolean operation facts; bool.ToString() casing, native object fallback, and implicit Boolean wrapper construction must not be used as JavaScript semantics.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/BooleanTests.cs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-boolean-tostring/",
      "test/fixtures/js-surface-node-boolean-tostring/",
    ]),
    blockers: Object.freeze([]),
    laneClassification: freezeLaneClassification({
      patternKind: "js-boolean-method-operation",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-boolean-prototype-declaration",
          "selected-js-boolean-constructor-declaration",
          "closed-boolean-receiver-target-type",
          "closed-boolean-conversion-argument-target-type",
          "selected-boolean-target-signature",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-selected-js-surface",
          "missing-boolean-prototype-declaration",
          "missing-boolean-constructor-declaration",
          "missing-closed-boolean-receiver",
          "missing-closed-boolean-conversion-argument",
          "missing-selected-target-signature",
          "unsupported-boolean-wrapper-carrier",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-boolean-prototype-declaration",
          "selected-js-boolean-constructor-declaration",
          "closed-boolean-receiver-target-type",
          "closed-boolean-conversion-argument-target-type",
          "selected-boolean-target-signature",
        ]),
        operation: "emit-selected-js-boolean-method-or-conversion",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "unsupported-boolean-method",
          "receiver-not-closed-boolean",
          "conversion-argument-not-closed",
          "boolean-wrapper-carrier-not-exposed",
          "source-spelling-only",
        ]),
      },
    }),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/BooleanTests.cs",
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
        "test/cli-build/js-surface.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: selected JS surface facts cover Boolean.toString and Boolean.valueOf only from selected Boolean declaration identity plus closed bool receiver facts, including Object.toString delegation for closed bool primitive receivers. Boolean(value) maps only from selected BooleanConstructor call signature identity, call-vs-construct expression shape, and closed conversion argument facts to Tsonic.CSharp.Js.Globals.Boolean; zero-argument Boolean() uses the runtime default false value. new Boolean(value) is deliberately hard-rejected until an explicit wrapper-object carrier exists, so wrapper construction never falls back to object/dynamic/native bool semantics. C# JS runtime tests prove lowercase JavaScript boolean toString(), valueOf(), and Boolean conversion behavior; CLI evidence emits BooleanOps/Globals.Boolean calls, dotnet-builds the generated project, and proves unsupported wrapper construction fails before artifacts. Node surface evidence proves a provider-returned boolean from Buffer.isEncoding chains through the JS BooleanOps.toString fact instead of native bool.ToString().",
  }),
  "surface.js.number-methods": Object.freeze({
    sourceExamples: Object.freeze([
      "export function fromNumber(value: number): string { return value.toString(); }",
      "const root: { count: number } = { count: 2 }; return root.count.toString();",
      "export function fromPrimitive(value: int32): string { return value.toString(); }",
      "export function fromPrimitiveRadix(value: int32, radix: int32): string { return value.toString(radix); }",
      "export function fromStatic(value: number): boolean { return Number.isFinite(value) && Number.isInteger(value); }",
      "export function fromParsed(value: string): number { return Number.parseFloat(value) + Number.MAX_SAFE_INTEGER; }",
      "export function converted(value: string): number { return Number(value) + Number(); }",
      "export function locale(value: number, locale: string): string { return value.toLocaleString(locale); }",
      "export function wrapper(value: number): Number { return new Number(value); }",
    ]),
    tstsDecision:
      "TSTS validates Number primitive member calls, Number static calls, and Number static properties against selected JS surface declarations; the surface provider must prove selected Number declarations plus closed receiver or argument facts before target facts are finalized.",
    providerFacts: Object.freeze([
      "selectedJsNumberDeclaration",
      "numberPrimitiveReceiverFact",
      "numberToStringOperationFact",
      "numberIntegralRadixToStringOperationFact",
      "numberStaticOperationFact",
      "numberStaticPropertyFact",
      "numberLocaleFormattingUnsupportedDiagnosticFact",
      "numberWrapperUnsupportedDiagnosticFact",
      "selectedTargetSignatureFact",
    ]),
    backendContract:
      "C# emits Tsonic.CSharp.Js.Number operations only from finalized selected Number operation/signature/property facts; CLR ToString(), culture-sensitive formatting, boxing, dynamic, source-spelling lookup, or static property name guessing must not provide JavaScript number semantics.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/NumberTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([]),
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
          "unsupported-number-locale-formatting-lane",
          "unsupported-number-wrapper-carrier",
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
          "unsupported-number-locale-formatting-lane",
          "number-wrapper-carrier-not-exposed",
          "receiver-or-argument-not-closed-number",
          "source-spelling-only",
        ]),
      },
    }),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/NumberTests.cs",
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
        "test/cli-build/js-surface.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: tsonic-csharp surface-boundary evidence maps Number.toString/valueOf only from selected Number declaration identity plus closed number receiver facts, maps integral Number.toString(radix) only from selected Number declaration identity plus closed int32 receiver/radix facts, rejects radix formatting for non-integral number receiver facts, maps Object.toString delegation for closed number primitive receivers, rejects missing and non-number receiver facts, maps Number(value)/Number() primitive conversion from selected NumberConstructor declaration identity while rejecting new Number(value) wrapper construction without a closed wrapper carrier, maps Number.toFixed/toExponential/toPrecision from selected Number declaration identity plus closed receiver/argument facts, hard-rejects Number.toLocaleString until closed Intl.NumberFormat-compatible locale/options facts and runtime metadata exist, and maps Number.isFinite/isInteger/isSafeInteger/isNaN, Number.parseFloat, radix Number.parseInt, and Number constants only from selected NumberConstructor declarations. csharp-js runtime tests prove invariant toString/valueOf behavior, exact -0 toString output, integral radix toString behavior and invalid radix diagnostics, Number conversion no-argument/null/string/integral behavior, Number constants, static predicate helpers for double/int/long and nullable integral receivers, formatting helpers, and invalid precision diagnostics. The tsonic CLI test emits primitive number toString/valueOf, integral int32 toString(radix), object-shape number property toString, int32 toString, Number(value)/Number(), Number.isFinite/isInteger/isSafeInteger/isNaN, Number.parseFloat, radix Number.parseInt, Number.toFixed/toExponential/toPrecision, and all current Number constants through selected C# JS runtime facts and dotnet-builds the generated project. Negative evidence rejects Number methods without the JS surface, without closed number receiver facts, with non-number closed receivers, rejects Number.toString(radix) for non-integral number receiver facts, rejects Number.toLocaleString without exact Intl facts, and rejects new Number(value) wrapper construction. Generated output is asserted free of InvalidExpression, __unsupported, dynamic/reflection, CLR ToString fallback, and source-spelling selection.",
  }),
  "surface.js.console": Object.freeze({
    sourceExamples: Object.freeze([
      "console.log(label, count, ok);",
      "console.assert(ok, label, count);",
      "console.dir(label, \"depth=1\");",
      "console.table(label, [\"length\"]);",
      "console.timeStamp(label);",
    ]),
    tstsDecision:
      "TSTS validates Console operations only from selected bundled Console declarations; foreign same-spelling declarations and unselected console globals do not provide target facts.",
    providerFacts: Object.freeze([
      "selectedJsConsoleDeclaration",
      "closedConsoleArgumentFacts",
      "consoleTargetSignatureFacts",
      "consoleRuntimeMetadataRows",
    ]),
    backendContract:
      "C# emits Tsonic.CSharp.Js.console operations only from finalized selected Console operation facts and closed argument carriers; it must not route to System.Console directly, box unknown values, infer from source spelling, or emit placeholder calls.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ConsoleTests.cs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([]),
    laneClassification: freezeLaneClassification({
      patternKind: "js-console-operation",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-console-declaration",
          "closed-console-argument-target-facts",
          "selected-console-target-signature",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-selected-js-surface",
          "missing-console-declaration",
          "missing-closed-console-argument",
          "missing-selected-target-signature",
          "unsupported-console-member",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-console-declaration",
          "closed-console-argument-target-facts",
          "selected-console-target-signature",
        ]),
        operation: "emit-selected-js-console-operation",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "unsupported-console-member",
          "unsupported-console-argument",
          "source-spelling-only",
        ]),
      },
    }),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ConsoleTests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: selected JS Console declarations map only through checked standard-library declaration identity; console property access defers to the selected call, foreign same-spelling declarations do not map, and console calls reject without finalized closed target facts or runtime-member-compatible argument shapes. Provider/runtime metadata covers the current TSTS Console interface: assert(condition?, ...data), clear, count, countReset, debug, dir(item?, options?), dirxml(...data), error, group, groupCollapsed, groupEnd, info, log, table(tabularData?, properties?), time, timeEnd, timeLog, timeStamp, trace, and warn. CLI evidence emits the full selected Console member set through Tsonic.CSharp.Js.console, dotnet-builds the generated project, rejects console.log without the selected JS surface before artifacts, and asserts no unsupported/invalid fallback output. Runtime evidence proves the corresponding Tsonic.CSharp.Js.console entrypoints accept supported argument shapes without throwing.",
  }),
  "surface.js.console-log": Object.freeze({
    sourceExamples: Object.freeze([
      "console.log(label, count, ok);",
      "console.log(value);",
    ]),
    tstsDecision:
      "TSTS validates console.log only when the selected JS surface supplies the bundled Console.log declaration; unselected or foreign same-spelling calls do not provide target facts.",
    providerFacts: Object.freeze([
      "selectedJsConsoleLogDeclaration",
      "closedConsoleLogArgumentFacts",
      "consoleLogTargetSignatureFact",
      "consoleLogRuntimeMetadataRow",
    ]),
    backendContract:
      "C# emits Tsonic.CSharp.Js.console.log only from finalized selected Console.log operation facts with closed argument carriers; it must not box unknown values, call System.Console directly, or recover from source spelling.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ConsoleTests.cs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([]),
    laneClassification: freezeLaneClassification({
      patternKind: "js-console-log-operation",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-console-log-declaration",
          "closed-console-log-argument-target-facts",
          "selected-console-log-target-signature",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-selected-js-surface",
          "missing-console-log-declaration",
          "missing-closed-console-log-argument",
          "missing-selected-target-signature",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "selected-js-surface",
          "selected-js-console-log-declaration",
          "closed-console-log-argument-target-facts",
          "selected-console-log-target-signature",
        ]),
        operation: "emit-selected-js-console-log-operation",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-required-facts",
          "unsupported-console-log-argument",
          "source-spelling-only",
        ]),
      },
    }),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ConsoleTests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: console.log maps to Tsonic.CSharp.Js.console.log only from the selected bundled Console.log declaration and only when every argument has finalized closed target facts. Missing argument facts reject in the surface provider instead of boxing unknown values. Without the selected JS surface, CLI evidence fails before artifact creation with a missing selected target signature diagnostic. Runtime evidence proves the Tsonic.CSharp.Js.console.log entrypoint accepts multiple closed argument carriers without throwing. CLI evidence emits multi-argument console.log with closed string/number/bool facts, dotnet-builds the generated project, and asserts no unsupported/invalid fallback output.",
  }),
  "surface.js.math-json-regexp": Object.freeze({
    sourceExamples: Object.freeze([
      "const encoded = JSON.stringify(JSON.parse(text));",
      "const matched = /user:/i.test(input);",
      "return Math.max(values.length, 1);",
    ]),
    tstsDecision:
      "TSTS validates Math, JSON, and RegExp source operations only through selected JS standard-library declarations; unselected, foreign, or unsupported same-spelling declarations do not provide target facts.",
    providerFacts: Object.freeze([
      "selectedJsMathDeclarationFact",
      "selectedJsJsonDeclarationFact",
      "selectedJsRegExpDeclarationFact",
      "closedJsonCarrierFact",
      "closedRegExpReceiverCarrierFact",
      "surfaceTargetOperationFact",
    ]),
    backendContract:
      "C# emits Tsonic.CSharp.Js.Math, JSON, and RegExp runtime operations only from finalized selected-surface operation facts with closed numeric, string, JSON-value, or RegExp carrier evidence; missing facts must diagnose before artifact creation.",
    runtimeContract:
      "The C# JS runtime implements closed Math functions/constants, JSON parse/stringify carriers, RegExp construction/literals/test/exec/properties, and rejects open CLR object serialization instead of using reflection or dynamic fallback.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../tsonic-csharp/test/js-surface-completion.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/MathTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/JSONTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/RegExpTests.cs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../tsonic-csharp/test/js-surface-completion.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/JSONTests.cs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-maximus-cases/json-static-safety.test.ts",
      "test/fixtures/js-surface-json-typed-parse/",
      "test/fixtures/js-surface-runtime-builtins/",
      "test/fixtures/json-native-inline-stringify/",
      "test/fixtures/json-native-typed-stringify/",
    ]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "../tsonic-csharp/test/js-surface-completion.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "../tsonic-csharp/test/js-surface-completion.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/MathTests.cs",
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/JSONTests.cs",
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/RegExpTests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "../tsonic-csharp/test/js-surface-completion.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: Math maps selected standard-library methods/constants through provider metadata to Tsonic.CSharp.Js.Math, including zero-argument max/min semantics, current-library rejection for f16round, closed numeric-argument validation, CLI emission, dotnet build, and runtime tests. JSON maps selected JSON.parse and JSON.stringify through closed carrier facts only: primitive stringify, JSObject/JSArray/TsValue stringify, nested JSON.stringify(JSON.parse(value)) carrier propagation before finalization, rejection when JSON carriers are missing or mutated away, runtime round-trip tests, and rejection of open CLR object serialization. RegExp maps selected constructor/literal/test/exec/toString/source/flags/global/hasIndices/ignoreCase/multiline/dotAll/unicode/unicodeSets/sticky/lastIndex operations through closed RegExp carriers with provider and runtime tests; missing receiver facts reject without source-spelling fallback. CLI evidence emits and builds Math, JSON, and RegExp runtime operations and asserts no unsupported/invalid/dynamic/reflection fallback output. Map and Set are tracked separately by surface.js.map-set; Date is tracked separately by surface.js.date.",
  }),
  "surface.js.map-set": Object.freeze({
    sourceExamples: Object.freeze([
      "const counts = new Map<string, number>(); counts.set(\"alpha\", 1);",
      "counts.get(key) ?? fallback;",
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
    laneClassification: freezeLaneClassification({
      patternKind: "js-map-set-lane-selection",
      possibleLanes: ["static-native", "compat-runtime", "hard-reject"],
      strictNative: {
        lane: "hard-reject",
        reason:
          "Map/Set full JS compatibility requires an explicit selected lane plus equality/runtime facts before any static-native carrier can be emitted.",
        hardRejectIfMissing: [
          "selected Map/Set lane fact",
          "provider equality semantics evidence",
          "selected operation support fact",
        ],
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: [
          "selected Map/Set source declaration identity",
          "selected static-native Map/Set lane",
          "closed Map/Set key/value carrier facts",
          "provider equality semantics evidence",
        ],
        operation: "emit-static-native-map-set-operation-with-declared-equality-lane",
      },
      compat: {
        lane: "compat-runtime",
        requiredFacts: [
          "selected compat-runtime Map/Set lane",
          "selected Map/Set source declaration identity",
          "closed JS Map/Set runtime carrier",
          "JS SameValueZero equality metadata",
          "SelectedSurfaceRuntime carrier fact",
        ],
        runtimeCarrier: "SelectedSurfaceRuntime",
        operation: "emit-closed-js-map-set-runtime-operation",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: [
          "missing-selected-map-set-lane",
          "clr-equality-not-full-js-compat",
          "map-set-key-not-proven-for-selected-lane",
          "unsupported-selected-map-set-operation",
          "missing-finalized-map-set-lane-fact",
        ],
      },
    }),
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
    blockers: Object.freeze([]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/MapTests.cs",
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/SetTests.cs",
        "test/cli-build/js-surface.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: current provider evidence maps selected Map/Set declarations, empty and iterable constructors, set/get/has/delete/clear/keys/values/entries/add/forEach calls, size properties, and collection iterator carriers through compat-runtime policy metadata with js-same-value-zero equality semantics; no static-native Dictionary/HashSet carrier is selected by the normal JS surface. Current csharp-js runtime evidence proves constructor overloads, size, set/add chaining, get/has/delete/clear, keys/values/entries, forEach callback shapes, insertion order, overwrite keeps order, delete/re-add order, NaN key/value equality, +0/-0 equality, null and JSUndefined keys/values when represented, object keys/values by reference identity rather than structural Equals, and typed Map.get helper behavior that preserves zero while distinguishing missing keys for value-type nullish paths. Current CLI/toolchain evidence compiles TypeScript new Map<string, int32>(), set/get/has/delete/clear/forEach/entries/values/size, new Map(source.entries()), new Set(source.values()), new Set<string>(), add/has/delete/clear/forEach/keys/values/entries/size, and Array.from(counts.keys()) to Tsonic.CSharp.Js.Map, Tsonic.CSharp.Js.Set, and Tsonic.CSharp.Js.Array.from, then dotnet-builds the generated C# projects. Negative evidence rejects no-surface Map/Set declarations before artifact emission, rejects missing closed collection carrier facts in provider tests, and asserts generated CLI output contains no InvalidExpression, __unsupported, dynamic/reflection, Dictionary/HashSet substitution, unqualified Map/Set constructor spelling, or source-name fallback. The lane ledger distinguishes static-native Map/Set from compat-runtime Map/Set, requires SameValueZero/equality metadata for full JS compatibility, and forces missing lane facts or unsupported selected operations into hard-reject diagnostics rather than CLR Dictionary/HashSet fallback. Old Map/Set fixtures remain regression evidence, not completion proof.",
  }),
  "surface.js.math": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/MathTests.cs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-runtime-builtins/",
    ]),
    blockers: Object.freeze([]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/MathTests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: selected JS surface facts map current source-selectable Math calls and constants to Tsonic.CSharp.Js.Math runtime operations, preserve JavaScript zero-argument max/min behavior through the selected JS surface runtime, and reject unselected/unsupported forms without spelling-based fallback. CLI evidence emits abs, acos, acosh, asin, asinh, atan, atan2, atanh, cbrt, ceil, clz32, cos, cosh, exp, expm1, floor, fround, hypot, imul, log, log10, log1p, log2, max, min, pow, random, round, sign, sin, sinh, sqrt, tan, tanh, trunc, and E/PI/LN2/LN10/LOG2E/LOG10E/SQRT1_2/SQRT2 to Tsonic.CSharp.Js.Math, then dotnet-builds the generated C# project. Runtime evidence covers all Tsonic.CSharp.Js.Math runtime members including f16round. Math.f16round is deliberately excluded from source-surface completion for the current default TSTS library because TSTS rejects it before provider mapping; the CLI exclusion test proves that no C# fallback, spelling-based mapping, or runtime-only path makes it source-selectable. Negative evidence rejects Math without selected JS surface facts, selected Math calls without closed numeric argument facts, selected Math calls without provider metadata rows, and current-lib-unavailable Math.f16round before artifacts; backend no-fallback evidence asserts no raw Math.*, InvalidExpression, __unsupported, reflection, GetProperty/GetMethod, or dynamic output.",
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
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/DateTests.cs",
      ],
      failClosedDiagnostics: [
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    notes:
      "Reviewed proof: selected JS surface Date declarations map Date.UTC, Date(), new Date(...), toISOString(), and getTime() to the closed Tsonic.CSharp.Js.Date runtime carrier; CLI output includes JS runtime artifacts, generated C# build succeeds, no unqualified Date target spelling leaks, and no-surface Date construction fails closed with a selected-target-signature diagnostic.",
  }),
  "surface.js.object-runtime": Object.freeze({
    sourceExamples: Object.freeze([
      "return Object.keys(values).join(\",\");",
      "return Object.hasOwn(values, \"answer\");",
      "return Object.assign(target, source);",
      "return Object.is(left, right);",
    ]),
    tstsDecision:
      "TSTS validates Object operations only through selected JS standard-library declarations; foreign same-spelling declarations and unsupported descriptor/prototype APIs do not provide target facts.",
    providerFacts: Object.freeze([
      "selectedJsObjectDeclarationFact",
      "closedObjectHelperCarrierFact",
      "closedRecordDictionaryCarrierFact",
      "objectRuntimeTargetMemberFact",
      "unsupportedObjectShapeMutationFact",
    ]),
    backendContract:
      "C# emits Tsonic.CSharp.Js.Object and JSObject operations only from finalized selected-surface facts and closed object-helper carrier evidence; missing or ambiguous object facts diagnose before artifact creation.",
    runtimeContract:
      "The C# JS runtime implements Object.keys/values/entries/is/hasOwn/assign over closed JSObject, JSArray, string, scalar, and typed Record dictionary carriers, and rejects unsupported open CLR objects or descriptor/prototype operations without reflection.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../tsonic-csharp/test/js-surface-completion.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ObjectTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/JSONTests.cs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "../tsonic-csharp/test/js-surface-completion.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ObjectTests.cs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-json-typed-parse/",
      "test/fixtures/json-native-inline-stringify/",
      "test/fixtures/json-native-typed-stringify/",
    ]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "../tsonic-csharp/test/js-surface-completion.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "../tsonic-csharp/test/js-surface-completion.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/js-surface.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ObjectTests.cs",
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/JSONTests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "../tsonic-csharp/test/js-surface-completion.test.mjs",
        "test/cli-build/js-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/js-surface.test.mjs",
      ],
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: Object.keys, Object.values, and Object.entries map from selected standard-library Object declarations only when finalized argument facts prove a closed JSObject, JSArray, string, scalar-boxing, or Record<string, T>/Dictionary<string, T> carrier; unchanged TypeScript Object.keys(values).join('|') chains finalize from selected Object and Array facts. Object.is maps selected source facts to Tsonic.CSharp.Js.Object.@is with JavaScript SameValue semantics. Object.hasOwn maps selected JSObject, JSArray, string, and typed Record dictionary facts to closed runtime overloads; missing object-helper or key facts reject. Object.assign maps selected JSObject and typed Record dictionary facts to closed runtime overloads that mutate the proven target carrier and reject unsupported sources. JSON.parse/Object helper chains prove nested JSON value flow through closed JSObject/JSArray/TsValue carriers. Descriptor, prototype, extensibility, and fromEntries operations hard-reject with explicit unsupported-operation diagnostics until closed object-shape/prototype metadata exists. CLI evidence emits and dotnet-builds Object.keys/values/entries/hasOwn/assign/is over Record dictionaries, hard-rejects Object.create/Object.defineProperty before artifacts, and asserts no object/dynamic/reflection/source-spelling fallback output. Runtime evidence covers JSObject, JSArray, string, scalar, typed dictionary, assign mutation, null handling, unsupported CLR object rejection, and JSON parsed-object helper behavior.",
  }),
  "surface.node.fs-path-process": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-path-posix-join/",
      "test/fixtures/nodejs-surface-imports-negative/",
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      runtimeBehavior: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: selected NodeJS provider package facts cover unchanged ESM Node imports for bare fs/assert/buffer/url/util and canonical node:path/node:process modules, canonical node:path imports, bare path imports, provider-backed default imports for node:fs/node:path/node:process module objects, namespace imports for bare fs/crypto/os/process and canonical node:* modules, process property and environment indexer access, process availableMemory/constrainedMemory/hrtime call facts, path.posix/path.win32 PathModule member facts, expanded node:fs/promises chmod/cp/readlink/realpath/rmdir/symlink target facts, and rejection of node:path/fs without the NodeJS provider package. Current executable proof runs selected fs/path/process with Buffer, crypto, os, url, and util through the generated C# Node runtime. Recovered old Node fixture evidence now has current runtime/toolchain proof for path.posix joins, provider-backed default fs imports, no-package import diagnostics, and the multi-file fs/path/process/os/crypto module graph through the generic provider-package path without source-name fallback.",
  }),
  "surface.node.fs": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/accessSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/chmod.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/closeSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/cp.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/openSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/readlink.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/realpath.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/rmdir.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/symlink.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/truncateSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/writeSync.tests.cs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      runtimeBehavior: [
        "test/cli-build/nodejs-surface.test.mjs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/accessSync.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/chmod.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/closeSync.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/cp.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/openSync.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/readlink.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/realpath.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/rmdir.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/symlink.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/truncateSync.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/writeSync.tests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: selected NodeJS provider package facts cover unchanged bare fs imports, bare fs and node:fs namespace imports, provider-backed default node:fs module object calls such as fs.existsSync, every currently declared node:fs and node:fs/promises supported provider row from the provider metadata tables, existsSync/readFileSync string and Buffer returns, readdirSync string-array returns, statSync/fstatSync, readSync/writeSync Buffer descriptors plus writeSync string overload, access/chmod/close/open/truncate/rmdir/symlink/readlink/realpath/cp variants, writeFileSync/appendFileSync/copyFileSync/renameSync/rmSync/unlinkSync writes and cleanup, node:fs/promises access/readFile/readdir/writeFile/copyFile/truncate/stat/unlink/mkdir/rename/rm/chmod/cp/readlink/realpath/rmdir/symlink Promise-returning target facts, no-surface negative paths block Node-owned modules before artifact emission, unsupported node:vm provider-package imports fail closed, and unsupported selected fs.readFile/writeFile/watch/watchFile/createReadStream fail closed without runtime fallback. Current provider tests prove fs/promises readFile(path, \"utf8\") selects Task<string> while readFile(path) selects Task<Buffer>, including default fsPromises imports; runtime tests prove both fs.promises and fs_promises module helpers preserve string-vs-Buffer overload behavior. Current executable proof writes, stats, reads, directory listing, rename/copy cleanup, unlinks, expanded sync filesystem operations, and fs/promises async roundtrip operations through generated C# Node runtime calls. Stats Date-valued members are tracked under surface.node.fs-stats-date. Broader Node module families outside the declared fs provider-package surface are classified by explicit unsupported provider-package diagnostics instead of fallback emission.",
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
      "../tsonic-csharp/test/nodejs-stats-date-surface.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/statSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/fstatSync.tests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/DateTests.cs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/nodejs-stats-date-surface.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/js-surface-node-date-union/",
    ]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/nodejs-stats-date-surface.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/nodejs-stats-date-surface.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/statSync.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/fstatSync.tests.cs",
        "../csharp-js/tests/Tsonic.CSharp.Js.Tests/DateTests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/nodejs-stats-date-surface.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed complete proof: selected NodeJS provider declarations expose Stats.mtime as the JS Date source shape, property mapping requires the selected provider member identity, JS Date instance calls require selected JS declarations, Date | undefined nullish coalescing preserves the closed JS Date carrier across surfaces, CLI/toolchain emission produces Tsonic.CSharp.Js.Date rather than DateTime/string/dynamic carriers, no-surface Node imports fail before artifact emission, and runtime tests cover Stats Date values plus JS Date behavior.",
  }),
  "surface.node.process": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/arch.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/argv.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/chdir.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/cwd.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/env.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/execPath.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/exit.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/exitCode.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/kill.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/metrics.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/pid.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/platform.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/ppid.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/version.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/versions.tests.cs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/chdir.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/kill.tests.cs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/arch.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/argv.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/cwd.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/env.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/metrics.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/platform.tests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/chdir.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/kill.tests.cs",
      ],
      backendNoFallback: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: selected NodeJS provider package facts cover process module imports, provider-backed default node:process module object calls/properties such as cwd and platform, scalar metadata properties, env closed ProcessEnv indexer facts, versions closed ProcessVersions facts, memoryUsage closed MemoryUsage object facts, process function calls including uptime/availableMemory/constrainedMemory/hrtime, runtime behavior tests, and no-package fail-closed diagnostics. The recovered old module-graph fixture proves node:process through the generic provider-package path, and selected unsupported process.stdin/stdout/stderr/nextTick provider identities fail closed with precise CSHARP_NODEJS_PROVIDER_PACKAGE_OPERATION_UNSUPPORTED diagnostics before artifacts. Tsonic consumes finalized provider-package facts only and does not add process source-name fallback.",
  }),
  "surface.node.buffer-crypto-os": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/buffer/buffer.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/buffer/buffer.module.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/createHash.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/createHmac.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/getCiphers.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/getCurves.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/getHashes.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/randomBytes.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/randomFillSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/randomInt.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/randomUUID.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/timingSafeEqual.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/os/os.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/os/machine-version.tests.cs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      runtimeBehavior: [
        "test/cli-build/nodejs-surface.test.mjs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/buffer/buffer.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/buffer/buffer.module.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/createHash.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/createHmac.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/getCiphers.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/getCurves.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/getHashes.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/randomBytes.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/randomFillSync.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/randomInt.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/randomUUID.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/crypto/timingSafeEqual.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/os/os.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/os/machine-version.tests.cs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: selected NodeJS provider package facts cover Buffer provider virtual declarations, Buffer static calls including from(string), from(number[]), from(Buffer), static Buffer.compare, Buffer.isBuffer, Buffer.poolSize, buffer.transcode, Buffer instance length/toString/copy/write/compare/includes/indexOf/lastIndexOf/readUInt8/writeUInt8 plus descriptor-backed numeric read/write members such as readUInt16LE, readInt16BE, readUInt32BE, readFloatLE, readDoubleBE, writeUInt16LE, writeInt16BE, writeUInt32BE, writeFloatLE, and writeDoubleBE; every currently declared supported node:crypto and node:os provider metadata row by provider declaration/member/signature identity; bare crypto/os and canonical node:crypto/node:os imports, provider-backed default node:crypto/node:os module object calls/properties such as randomUUID and EOL, crypto.randomUUID/randomInt/randomBytes/randomFillSync/timingSafeEqual, createHash/createHmac Hash/Hmac update/digest closed Buffer/string paths, getCiphers/getCurves/getHashes array returns, and os arch/availableParallelism/endianness/freemem/homedir/hostname/loadavg/machine/platform/release/tmpdir/totalmem/type/uptime/version/EOL/devNull by selected provider declaration identity. Current executable proof runs Buffer.from/toString, representative Buffer numeric read/write roundtrips, createHash(...).update(...).digest(\"hex\"), randomUUID, and os.platform through generated C# Node runtime calls. Unsupported crypto createCipheriv/createDecipheriv/scryptSync/pbkdf2Sync/createSign/createVerify and os constants/cpus/networkInterfaces/userInfo/getPriority/setPriority fail closed from selected provider identities before artifacts, without runtime fallback. Broader Node module families outside the declared Buffer/crypto/os provider-package surface are classified by explicit unsupported provider-package diagnostics instead of fallback emission.",
  }),
  "surface.node.util": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/util/util.extras.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/util/util.more.tests.cs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/util/util.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/util/util.extras.tests.cs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-surface-alias-coverage/",
    ]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/util/util.extras.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/util/util.more.tests.cs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/util/util.tests.cs",
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/util/util.extras.tests.cs",
      ],
      backendNoFallback: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: selected node:util and bare util provider modules expose source-visible declarations, provider-backed default node:util module object facts expose closed toUSVString and unsupported format, closed stripVTControlCharacters/toUSVString/styleText/getSystemErrorName/getSystemErrorMessage/convertProcessSignalToExitCode operations map by selected provider signature identity to Tsonic.CSharp.Node.util calls, executable proof runs toUSVString and closed scalar helpers through generated C# Node runtime calls, the recovered historical alias fixture imports util through the selected provider package, open-carrier format/formatWithOptions/inspect/debuglog/deprecate/isDeepStrictEqual declarations fail closed through provider diagnostics without backend artifacts, and direct csharp-nodejs runtime tests reject format/formatWithOptions/inspect/debuglog/deprecate/isArray/isDeepStrictEqual instead of routing to reflection, dynamic dispatch, JsonSerializer object inspection, GetType-based probing, or generic runtime fallback.",
  }),
  "surface.node.url": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/url/url.tests.cs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-surface-alias-coverage/",
    ]),
    surfaceEvidence: freezeSurfaceEvidence({
      selectedOperationFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      providerFacts: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
      ],
      backendEmission: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      runtimeBehavior: [
        "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/url/url.tests.cs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      failClosedDiagnostics: [
        "../tsonic-csharp/test/node-surface-completion.test.mjs",
        "../tsonic-csharp/test/surface-boundary.test.mjs",
        "test/cli-build/nodejs-surface.test.mjs",
      ],
      backendNoFallback: [
        "test/cli-build/nodejs-surface.test.mjs",
      ],
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: selected node:url and bare url provider modules expose URL, URLSearchParams, and module function declarations; provider-backed default node:url module object facts expose closed file-path helpers such as pathToFileURL; closed URL constructor/properties/static methods, URL.searchParams property access, URL-as-base constructor/canParse/parse overloads, URL-only url.format, URLSearchParams constructor/append/set/get/getAll/has/delete/sort/toString/size, and domain/file-path helpers map by selected provider declaration/signature identity to Tsonic.CSharp.Node.URL/url calls; executable CLI proof builds and runs href/host/canParse/relative URL construction/url.format(URL)/domainToASCII/resolve/fileURL roundtrip/URLSearchParams/live searchParams mutation through generated C# Node runtime calls; the recovered historical alias fixture imports url through the selected provider package; csharp-nodejs runtime tests prove URLSearchParams set preserves first-pair order while removing duplicates. Open-object url.format, urlToHttpOptions, and URLPattern are explicit provider metadata diagnostics with CLI no-artifact proof and no reflection, dynamic dispatch, object dictionary projection, or generic runtime fallback.",
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
      "Reviewed partial proof: host composition includes provider, selected-surface, and selected provider-package runtime contributions before backend/toolchain handoff, omits unselected surface/package runtime contributions, emits no target artifacts when TSTS rejects the source program, and selected C# JS surface plus NodeJS provider package now add real runtime project references without test-local reference configuration. Remains partial until runtime contribution coverage spans every selected first-party surface/package and unsupported target/toolchain combinations fail with focused diagnostics.",
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
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
      "test/cli-build/runtime-toolchain-proof.test.mjs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/buffer/buffer.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/buffer/buffer.module.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/accessSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/chmod.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/closeSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/cp.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/openSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/readlink.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/realpath.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/rmdir.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/symlink.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/truncateSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/fs/writeSync.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/process/metrics.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/url/url.tests.cs",
      "../csharp-nodejs/tests/Tsonic.CSharp.Node.Tests/util/util.more.tests.cs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
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
      "Reviewed proof: selected NodeJS provider package runtime contributions are represented in host composition, generated C# library projects include the real csharp-nodejs project reference together with the required csharp-runtime/csharp-js references, current NodeJS provider package tests build node:path/fs/crypto/os/process/url mappings and provider-backed default node:fs/node:fs/promises/node:path/node:process/node:crypto/node:os/node:util/node:url module object mappings through that reference, closed fs Buffer descriptor/file helpers plus fs/promises readFile string-vs-Buffer overloads, access/chmod/close/open/cp/readlink/realpath/rmdir/symlink/truncate/writeSync runtime helpers, mkdir/readdir/rename/rm/chmod/cp/readlink/realpath/rmdir/symlink, Buffer includes/indexOf/lastIndexOf/readUInt8/writeUInt8/isBuffer/poolSize/transcode helpers, crypto Buffer/Hash/Hmac helpers, process environment and memory metrics/hrtime helpers, URL base-overload and URLSearchParams helpers, and scalar util helpers are available as runtime-owned APIs. Generated executables run both node:path.join and composite provider-package scenarios covering fs write/read/stat/unlink/access/chmod/truncate/rmdir/symlink/readlink/realpath/cp, fs/promises async file roundtrip with access/copyFile/truncate, path/process, Buffer, crypto hash/randomUUID, os.platform, url file conversion, live URL.searchParams mutation coupling, and util.toUSVString through the C# Node runtime. Unsupported selected Node provider-package APIs and unsupported Node modules fail closed before target artifacts, while runtime source scans prove no reflection/dynamic/open-dispatch semantics in csharp-nodejs runtime paths.",
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
      "Reviewed proof: source-core package tests prove the source-core virtual module provider owns only @tsonic/core/types.js and @tsonic/core/lang.js, rejects unowned @tsonic/csharp/* resolution, exposes portable lang.js marker exports without primitive/target alias names, and exposes types.js primitive exports without lang marker names. External C# tests prove the current C# target alias provider explicitly returns unowned for both portable core modules and owns only @tsonic/csharp/types.js and @tsonic/csharp/lang.js. CLI proof builds unchanged source importing both neutral core and C# alias modules without redefining either provider's ownership boundary. Future target packs must add their own alias-consumption evidence before being registered; they do not keep the current source-core single-owner contract partial.",
  }),
  "source-core.target-alias-consumption": Object.freeze({
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
    notes:
      "Reviewed proof: C# target aliases live under @tsonic/csharp/* and map to canonical source-core primitive and marker facts without redefining @tsonic/core/* modules. C# unit tests prove bool, char, int32, int64, uint8, out, ref, inref, field, attribute, defaultof, ptr, and fnptr aliases resolve to canonical source-core facts while same-spelling local and wrong-module imports do not. CLI proof now covers every current C# primitive alias (bool, byte, char, decimal, double, float, int, long, nint, nuint, sbyte, short, uint, ulong, ushort), plus C# marker aliases for struct, field, defaultof, out, ref, inref, ptr, and fnptr, with wrong-module negative coverage. Future target packs must prove their alias modules consume source-core facts before registration; they do not keep the current C# alias-consumption contract partial.",
  }),
  "declaration.attributes": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/attributes.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/provider-dotnet.test.mjs",
      "../tsonic-csharp/test/attributes.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/attributes/basic/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/comprehensive/Attributes.ts",
      "packages/targets/csharp/emitter/testcases/common/attributes/targets/Attributes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: declaration attribute emission consumes finalized source/provider attribute facts for class, constructor, constructor parameter, field, property, method, return, and method parameter locations. C# planner tests prove Roslyn-compatible attribute AST output and reject impossible finalized placements such as constructor attributes without a source constructor, invalid explicit target specifiers, and target specifiers outside the finalized C# placement surface. CLI/toolchain tests prove provider-backed System.CLSCompliantAttribute declarations emit and dotnet-build successfully, while source-authored attributes without provider target identity fail before target artifacts are produced.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: C# expression planning emits source null directly as Roslyn literal null and emits TSTS-proven global undefined as the current C# nullish carrier instead of leaking an unbound C# identifier. Current CLI/toolchain evidence covers null and undefined literal returns, nullable/nullish union storage, nullish coalescing, optional access, generated C# build success, and no emitted undefined token; C# JS runtime tests prove the selected JS surface exposes undefined through its closed nullish carrier. Dynamic/compat nullish breadth stays in carrier.null-undefined and runtime.undefined.carrier.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: nullish coalescing and optional property/call/element emission consume TSTS flow plus provider nullable carrier facts, including int32/char expected-target threading, optional property access, optional method calls, optional element access, provider-owned nullable members, invalid char fallback diagnostics, and fail-closed missing/nullish carrier facts before C# emission. Dynamic compat nullish behavior remains tracked separately under carrier.null-undefined and runtime.undefined.carrier.",
  }),
  "carrier.null-undefined": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/ArrayTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/StringTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/GlobalsTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
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
      "runtime.undefined.carrier remains partial until strict-native, JS surface, Node provider-package APIs, optional APIs, and typed/native provider boundaries all use explicit undefined/nullish carriers or deterministic diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: the C# backend now treats only TSTS-proven global undefined as a nullish carrier and preserves the fail-closed distinction from ordinary identifiers; JS surface runtime tests prove undefined and nullish-returning helpers use closed runtime-owned carriers. csharp-js compat runtime tests prove TsValue reads sparse JSArray holes as the closed undefined carrier and preserves that behavior through length mutation. Remains partial until every nullish provider/API lane is classified and tested.",
  }),
  "native.dotnet.unsupported-diagnostics": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-attributes.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/pointers/PointerTypes.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    notes:
      "Reviewed proof: reflection provider records unsupported constructor/property/indexer/field/method/operator/event members instead of silently dropping static interface members, generic static members, multi-parameter indexers, pointer signatures, ranked CLR arrays, by-reference returns, generic operators, pointer-source conversion operators, unsupported generic constraints, unsupported attributes, and unsupported default parameter values. Unsupported target-only type refs fail closed during source-shape conversion for pointers, function pointers, ranked arrays, nested provider refs, and opaque source shapes. Unsupported attributes and unsupported defaults remain explicit raw/provider/target facts while omitted from source-visible declarations, and selected unsupported member/constraint identities become fail-closed target diagnostics instead of generic not-found errors.",
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
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/VariableInit.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: provider-owned call argument conversion facts are derived from TSTS-selected provider declaration/signature identity plus closed target parameter facts, not from source names. Provider-selection tests cover by-value calls, constructor signatures, indexers, first-argument extension calls, generic methods, optional/default parameters, params arrays, byref parameters, and exact-signature overload groups; selected signatures record argumentConversions and fail closed when conversions are missing, mutated, or tied to a sibling signature. Backend argument tests prove finalized conversion facts override render expected-type threading, must match the selected parameter target type, preserve separate render and semantic target types, support selected collection render carriers, include source-span evidence on missing required byref facts, and reject unsupported passing modes. CLI provider tests prove reflected constructors, generic collection calls, Dictionary indexers, extension-style calls, optional/default parameters, params arrays, and byref arguments emit/build/run only from selected provider facts.",
  }),
  "operation.call.provider-parameter-mode": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: provider-owned call facts carry selected parameter modes from reflected signatures, including by-value, out, ref, in, optional, supported default values, unsupported default values, constructors, indexers, first-argument extension receivers, delegate/callable Invoke facts, and params arrays. Target member selection rejects malformed provider parameter facts such as missing or noncanonical passingMode, paramsArray on non-array types, paramsArray byref parameters, defaults on non-optional parameters, and argument-passing marker facts tied to a different selected provider signature. Exact selected call, constructor, indexer, and extension-call signatures fail closed when required byref marker facts are missing or parameter-mode facts contradict the TSTS-selected signature, instead of refining to by-value overload siblings. Backend emission rejects mutated receiver, parameter-passing, parameter-default, parameter-optional, parameter-params, and unsupported finalized passing-mode facts, and missing selected byref facts include deterministic source module/file/span evidence. CLI provider tests prove reflected constructors, executable Dictionary.TryGetValue out-parameter behavior, extension-style Span/Enumerable calls, optional/default parameters, params arrays, and byref arguments emit/build/run only from selected provider parameter facts.",
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
  "operation.operator.checked-target-operation": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/operators/nullish-coalescing/NullishCoalescing.ts",
      "packages/targets/csharp/emitter/testcases/common/operators/optional-chaining/OptionalChaining.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/NullishCoalescing.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/TernaryTyping.ts",
      "packages/targets/csharp/emitter/testcases/common/expected/operators/in-operator/InOperator.cs",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: binary, unary, assignment, compound, comparison, logical, nullish, typeof, instanceof, and compat any operators emit only from finalized TSTS/provider targetOperation facts plus matching C# target-operation facts; unsupported in-operator, structural, generic type-parameter, unproven bitwise, and unsupported compat operators fail closed with deterministic diagnostics; backend emission uses Roslyn operator-token AST nodes and rejects semantic-string/operator-token drift.",
  }),
  "operation.iteration.for-of.sync": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/iteration-facts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: for-of maps through the generic iteration selector and emits Roslyn foreach or string code-point loops only from finalized targetIteration facts. Missing facts, wrong iteration kinds, wrong lowerings, and ambiguous selector rows fail closed before backend emission. Current CLI/toolchain evidence covers array and JS-surface for-of execution; async iteration remains outside this sync capability.",
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
  "operation.await.promise-task": Object.freeze({
    sourceExamples: Object.freeze([
      "async function fetchData(): Promise<string> { return await getData(); }",
      "const value = await taskLikeValue;",
    ]),
    tstsDecision:
      "TSTS owns async function validity, await expression validity, contextual Promise result typing, flow typing, overload selection, and generic inference before Tsonic observes the checked source operation.",
    providerFacts: Object.freeze([
      "runtimeCarrierFact",
      "selected source async return type",
      "renderable target Task carrier",
    ]),
    backendContract:
      "Backend emits AwaitExpression and async target AST only from finalized Promise/Task runtime-carrier facts; missing or mismatched awaited/result carriers produce diagnostics.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/async-cli-build.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "test/async-cli-build.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/async/basic/AsyncFunction.ts",
      "test/fixtures/async-basic/",
      "test/fixtures/async-higher-order/",
      "test/fixtures/async-ops-uses-map/",
      "test/fixtures/promise-chain-reject-stable/",
      "test/fixtures/promise-constructor-task/",
      "test/fixtures/promise-void-resolve/",
      "test/fixtures/task-then-disallowed/",
    ]),
    blockers: Object.freeze([]),
    laneClassification: freezeLaneClassification({
      patternKind: "async-await",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "tsts-checked-await-expression",
          "awaited-expression-promise-task-carrier",
          "await-result-carrier",
          "renderable-target-ast",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-awaited-expression-carrier",
          "missing-await-result-carrier",
          "mismatched-await-result-carrier",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "tsts-checked-await-expression",
          "awaited-expression-promise-task-carrier",
          "await-result-carrier",
          "renderable-target-ast",
        ]),
        operation: "emit-await-target-ast",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-awaited-expression-carrier",
          "missing-await-result-carrier",
          "mismatched-await-result-carrier",
        ]),
      },
    }),
    notes:
      "Reviewed proof: await emission requires finalized Promise/Task carrier facts for both the awaited expression and the await result, including non-generic Task/void awaits; mismatched or missing facts fail closed; source-semantics records await-result carriers from TSTS-checked Promise/Task facts; async function declarations and class methods consume finalized Task return and await-result facts through Roslyn AST; current CLI E2E proves basic awaited async calls, Promise<void> await statements, Promise<T>/Promise<void> parameters accepting C# Task<T>/Task callers, higher-order async delegate carriers, async structural object returns, and async composition with selected JS Map carrier facts through dotnet build/run. Unsupported Promise.resolve, Promise chains, Promise constructors, task .then-style chaining, and async generators fail before target artifacts with selected-fact or finalized-carrier diagnostics. .NET/EF/LINQ task fixtures remain downstream provider-package work and are not required proof for the source async/await carrier contract.",
  }),
  "function.this-binding": Object.freeze({
    sourceExamples: Object.freeze([
      "class Counter { value = 7; read(): number { const read = (): number => this.value; return read(); } }",
      "class Counter { static value = 7; static read(): number { return this.value; } }",
    ]),
    tstsDecision:
      "TSTS owns source validity and lexical this binding for checked TypeScript; the C# backend may emit this only after the selected source context is an instance class receiver and the receiver expression has finalized runtime carrier facts.",
    providerFacts: Object.freeze([
      "tsts-selected-this-expression",
      "instance-class-receiver-context",
      "runtimeCarrierFact for receiver",
    ]),
    backendContract:
      "C# emits a ThisExpression/this identifier only from a finalized instance receiver carrier. Static members, object-literal methods, dynamic functions, class field initializers, and top-level module receivers fail closed before artifact emission instead of falling back to JavaScript this semantics.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/object-literal-method-this/",
    ]),
    blockers: Object.freeze([]),
    laneClassification: freezeLaneClassification({
      patternKind: "this-binding",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "tsts-checked-this-expression",
          "instance-class-receiver-context",
          "receiver-runtime-carrier",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-receiver-carrier",
          "non-instance-class-this-context",
          "unsupported-javascript-this-binding",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "tsts-checked-this-expression",
          "instance-class-receiver-context",
          "receiver-runtime-carrier",
        ]),
        operation: "emit-this-target-ast",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-receiver-carrier",
          "static-member-this",
          "object-literal-method-this",
          "dynamic-function-this",
          "class-field-initializer-this",
          "top-level-this",
        ]),
      },
    }),
    notes:
      "Reviewed proof: backend unit tests require finalized receiver carrier facts before emitting this, accept lexical arrows only when they close over an instance class receiver, and reject static, object-literal, runtime-bound function, class-field initializer, and top-level this contexts with deterministic diagnostics. CLI/toolchain tests prove instance plus lexical this emits C# this through target AST and dotnet-builds, while static, object-literal method, and class-field initializer this reject before generated artifacts. The old object-literal-method-this fixture is mapped to the current fail-closed object-literal receiver diagnostic instead of old JavaScript this fallback.",
  }),
  "function.async": Object.freeze({
    sourceExamples: Object.freeze([
      "export async function load(): Promise<string> { return \"ready\"; }",
      "export async function createAsyncAdder(start: int32): Promise<(x: int32) => Promise<int32>> { return async (x: int32) => start + x; }",
    ]),
    tstsDecision:
      "TSTS owns async declaration validity, source return type checking, contextual function types, generic inference, and nested async lambda typing before Tsonic maps Promise carriers to target Task carriers.",
    providerFacts: Object.freeze([
      "runtimeCarrierFact",
      "selected async declaration return type",
      "renderable target Task carrier",
      "delegate carrier facts for returned async/sync functions",
    ]),
    backendContract:
      "Backend emits async methods/lambdas and Task-returning signatures only from finalized Promise/Task and delegate carrier facts; missing facts are diagnostics.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/async-cli-build.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "test/async-cli-build.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/async/basic/AsyncFunction.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/async-hof/AsyncReturningFunctions.ts",
      "test/fixtures/async-basic/",
      "test/fixtures/async-higher-order/",
      "test/fixtures/async-ops-uses-map/",
      "test/fixtures/promise-chain-reject-stable/",
      "test/fixtures/promise-constructor-task/",
      "test/fixtures/promise-void-resolve/",
      "test/fixtures/task-then-disallowed/",
    ]),
    blockers: Object.freeze([]),
    laneClassification: freezeLaneClassification({
      patternKind: "async-await",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "tsts-checked-async-declaration",
          "promise-task-return-carrier",
          "delegate-carrier-facts",
          "renderable-target-ast",
        ]),
        hardRejectIfMissing: Object.freeze([
          "missing-promise-task-return-carrier",
          "missing-delegate-carrier",
          "unrenderable-target-async-shape",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "tsts-checked-async-declaration",
          "promise-task-return-carrier",
          "delegate-carrier-facts",
          "renderable-target-ast",
        ]),
        operation: "emit-async-target-declaration",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-promise-task-return-carrier",
          "missing-delegate-carrier",
          "unrenderable-target-async-shape",
        ]),
      },
    }),
    notes:
      "Reviewed proof: async functions, class methods, and async lambdas emit Roslyn async AST only after Promise/Task and delegate carriers are finalized; async return expression expectations unwrap finalized Task<T> result carriers before backend planning; missing Promise/Task return or delegate facts diagnose before backend fallback/artifact emission; current executable tests cover Promise<string>, Promise<void>/Task, C# Task<T>/Task caller interop through Promise parameters, nested Promise-returning delegates, async callbacks, async structural object returns, async Map carrier composition, and exact runtime output. Unsupported Promise.resolve, Promise chains, Promise constructors, task .then-style chaining, and async generators fail before target artifacts instead of lowering through Promise/source-name fallback. .NET/EF/LINQ task fixtures remain downstream provider-package work and are not required proof for the source async function carrier contract.",
  }),
  "operation.throw.catch": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/statements.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: throw/catch/finally emission requires finalized throwable and catch carrier facts. Provider-backed exceptions emit and execute as native C# exceptions in both dedicated provider tests and the Slice 8 non-Node carrier/binding executable, compat-mode non-Exception thrown values wrap through the closed TsThrownValueException/TsValue carrier, invalid destructured catch variables fail closed until extraction facts exist, strict-native non-throwable throws diagnose, and the backend never falls back to source spelling or runtime reflection.",
  }),
  "operation.iteration.for-in.keys": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/iteration-facts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: for-in key enumeration is selected by generic iteration metadata rows after TSTS accepts the source operation. JS surface indexable/string keys use index-key facts, object-shape keys use object-shape facts, and provider collections use key-collection facts. Current CLI/toolchain evidence includes generated runtime execution for object-shape for-in. Missing facts, wrong iteration kinds/lowerings, non-string index keys, non-string dictionary keys, and ambiguous selector rows fail closed instead of falling back to syntax or source-name inference.",
  }),
  "operation.iteration.provider-target": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/iteration-facts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: provider-target iteration now flows through one generic iteration selector, finalized targetIteration facts, and a backend required-fact gateway. Current evidence covers provider foreach, JS string code-point iteration, index-key iteration, object-shape keys, provider Dictionary.Keys key collection emission, and generated runtime execution for one for-of and one for-in case. Missing, wrong-kind, wrong-lowering, unsupported key shape, and ambiguous row cases produce deterministic diagnostics instead of backend inference.",
  }),
  "operation.destructure.array-object": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/destructuring/ArrayDestructure.ts",
      "test/fixtures/array-destructuring/",
      "test/fixtures/nested-object-rest-destructuring/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: old array destructuring emitter and fixture evidence is mapped to current binding-pattern and CLI proof. Parameter, variable, statement assignment, and expression-position assignment binding patterns consume finalized array, tuple, IReadOnlyList, JSArray, read-only-indexable provider, and object-shape extraction facts; missing and mismatched facts produce diagnostics; object rest facts are recorded from TSTS-checked rest binding types; explicit DotNetArray<T> destructuring is hard-rejected by TSTS until the provider declares an iterable source contract. CLI/runtime proof executes fixed/default/rest/nested array destructuring, object parameter rest/nested destructuring, nested object rest, object-shape destructuring assignment including object rest assignment, expression-position destructuring assignment return values, utility-projected tuple destructuring, required tuple defaults and tuple rest, and Slice 8 rest/spread/nullish interleaving.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: object literals receive expression-local generated adapter carriers such as __TsonicShape_Marker_* from finalized object-shape facts, including inline parameters, generic type-parameter object literals, nested structural literals, method-valued object literals, Record dictionary literals, rest/spread object-shape facts, and fail-closed computed/accessor/generic-method shapes. Imported interface annotations remain storage/type facts on the declared variable and TypeReferenceNode, so the object literal does not overwrite the interface carrier or create a dual runtimeCarrier path.",
  }),
  "expression.call": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/call-operation-lifecycle.test.mjs",
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/source-owned-call-closure.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/call-operation-lifecycle.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/basic/Greet.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/higher-order/ReturningFunctions.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/optional-callbacks/OptionalParams.ts",
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: call expressions emit only from TSTS-selected signatures plus finalized source/provider/surface operation facts. Coverage includes source-owned functions, destructured callables, returned function values, provider-owned methods and overload groups, surface boundary fact gates, compat closed-carrier calls, optional/default/params/byref parameter modes, delegate Invoke facts, selected receiver facts, generic type arguments, and fail-closed missing/mutated selected operation facts. Backend emission never selects overloads or helpers from callee spelling.",
  }),
  "expression.new": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-lifecycle.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
      "packages/targets/csharp/emitter/testcases/common/collections/list-initializer/ListInitializer.ts",
      "test/fixtures/generic-nested-substitution/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: new expressions require TSTS-selected constructor facts and matching finalized source/provider/surface C# operation/result-type facts. Current evidence covers source classes, provider constructors, generic collection constructors, constructor overload groups, byref/optional/params constructor parameters, surface constructor fact gates, unsupported selected constructors, and missing/wrong selected constructor facts. Backend object creation emits only from finalized constructor facts and blocks before artifacts when facts are absent.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: property access uses finalized structural member facts for source object shapes, selected TSTS/provider facts plus finalized C# operation facts for provider properties/fields/events, and selected surface operation facts for surface members. Current evidence covers project-source properties, static/instance provider properties and fields, unsupported selected events, object-shape members, optional access, CLI/runtime execution, and same-spelling rejection. A C# helper fact alone is rejected; backend emission does not choose target members from source property spelling.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: element access emits only when selected provider/surface indexer facts and finalized C# operation facts exist. Current evidence covers arrays, tuples, strings, dictionaries/Record carriers, explicit native CLR arrays, provider indexers, optional element access, element writes, CLI/runtime execution, and wrong/missing indexer facts. Generic selected target facts alone block emission with diagnostics.",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: assignment emits canonical Roslyn AssignmentExpression only when the operator/storage fact is finalized and both operands plan successfully. Current evidence covers local writes, property writes, indexer writes, compound assignments, destructuring storage facts, readonly property/indexer diagnostics, CLI/runtime execution, provider-owned storage without selected target facts failing closed, and post-check target assignability diagnostics that do not redefine TypeScript assignability.",
  }),
  "expression.literal.bigint-regex-template": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/regexp-literals.test.mjs",
      "../tsonic-csharp/test/source-literal-values.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/regexp-literals.test.mjs",
      "../tsonic-csharp/test/source-literal-values.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-maximus-cases/array-and-literal-inference.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: bigint literals require BigInteger carrier facts, RegExp literals require literal pattern/flags plus matching runtime carrier and constructor operation facts, and template literals require finalized System.String carrier facts before Roslyn AST emission. Current unit and CLI tests cover bigint parsing, carrier diagnostics, Roslyn BigInteger emission, provider-backed RegExp literal emission, string/template interpolation, no-substitution template literals, missing carrier facts, and missing provider constructor facts.",
  }),
  "expression.operator": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/ReturnInControlFlow.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/TernaryTyping.ts",
      "packages/targets/csharp/emitter/testcases/common/operators/nullish-coalescing/NullishCoalescing.ts",
      "packages/targets/csharp/emitter/testcases/common/expected/operators/in-operator/InOperator.cs",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: operator expression emission requires TSTS-selected targetOperation facts and finalized C# operator-token/intrinsic facts across binary, unary, assignment, logical, nullish, structural/provider, and unsupported operator families. Current CLI and unit tests prove selected provider operators, primitive operators, nullish equality, bitwise/compound operators, instanceof, in-operator rejection, generic type-parameter operator rejection, unsupported structural operators, missing operator facts, unsupported token facts, and fact drift diagnostics. Source operator spelling is never used as a target helper.",
  }),
  "expression.conditional": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/ReturnInControlFlow.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/TernaryTyping.ts",
      "test/fixtures/nullish-coalescing-threading/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: conditional expressions thread the enclosing expected target type into both branches and CLI/toolchain tests prove ternary primitives, nullable/nullish branches, nested ternaries, provider-owned branch conversions, object-shape branches, and unsupported branch-carrier diagnostics. C# planner unit tests prove conditional emission requires a finalized bool condition carrier and consumes that carrier without falling back to TypeScript truthiness.",
  }),
  "statement.switch": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "test/cli-build/slice6-control-flow-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "test/cli-build/slice6-control-flow-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/control-flow/switch/SwitchStatement.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/nested-scopes/NestedScopes.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/shadowing/Shadowing.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: switch planning emits Roslyn SwitchStatement sections from checked source AST and finalized expression carriers, preserves grouped cases/defaults, lowers fallthrough through explicit goto sections, respects explicit terminators, executes through CLI/toolchain proof, and rejects missing governing expressions or non-constant case labels before C# artifacts. Old switch/nested-scope/shadowing fixtures are mapped as regression evidence for switch sections, lexical scope, and control-transfer behavior.",
  }),
  "statement.loop": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/iteration-facts.test.mjs",
      "test/cli-build/slice6-control-flow-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/iteration-facts.test.mjs",
      "test/cli-build/slice6-control-flow-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/nested-scopes/NestedScopes.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: for, while, and do conditions require finalized bool carriers; for-of and for-in require finalized provider/surface iteration facts through the generic iteration selector and backend required-fact gateway; destructuring iteration, top-level loop initialization order, labeled break/continue, object-shape for-in, provider collections, wrong-kind facts, ambiguous facts, and missing facts all have focused unit/CLI/toolchain coverage. Old array and nested-scope fixtures are mapped as regression evidence for loop storage, scope, and iteration behavior.",
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
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/src/rendering/statements.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: throw emission requires finalized throwable target carriers, try/catch/finally planning consumes finalized catch variable carriers, provider exception mappings execute through the generated C# toolchain, compat-mode catch variables materialize closed TsValue carriers from System.Exception, finally execution is covered by provider and compat CLI runtime tests, the Slice 8 executable covers provider throw/catch interleaved with carrier/binding work, and missing/non-extractable catch facts produce diagnostics before artifacts.",
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
      "test/cli-build/arrays.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-destructuring/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: parameter destructuring queries facts on the owning parameter declaration, allocates deterministic synthetic parameters for destructured parameters, and emits array fixed/rest/default, IReadOnlyList, JSArray, object, nested object, object rename, object rest, object defaults, and callable extraction prelude only from finalized carrier/object-shape facts. Current unit tests prove missing carrier/object-shape facts and missing nested shape facts fail closed with evidence. CLI/toolchain proof covers array fixed/default/rest/nested parameter binding, object parameter rest, object parameter callable extraction, and a non-Node executable whose parameter object rest feeds object spread with exact runtime output. Old array-destructuring evidence is mapped to this finalized-fact parameter binding path.",
  }),
  "binding.assignment": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/array-destructuring/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: statement-level and expression-position array/object-shape destructuring assignment emit deterministic storage writes only after TSTS accepts assignment and finalized assignment/operator plus extraction carrier facts exist. Current unit tests prove array and object-shape storage writes, read-only-indexable provider extraction, expression-position result values, object-shape assignment defaults, string-literal object-shape assignment keys, fail-closed missing facts, JSArray hole-aware assignment defaults, and no ordinary assignment fallback; CLI/runtime proof executes array and object-shape destructuring assignment plus sparse JSArray declaration destructuring through generated C# output.",
  }),
  "binding.object.rename-rest-default": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nested-object-rest-destructuring/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: object rename, rest, nested extraction, and defaults emit only from finalized TSTS-checked rest binding types and source/rest object-shape facts, then execute through CLI/runtime proof. Executables preserve nullable optional members, apply nullish defaults, copy retained rest members, and feed nested spread shape construction; rest facts that retain extracted members or disagree on retained member carriers are rejected; optional value members without nullable carrier facts fail closed. Compat-mode explicit any object destructuring is classified as hard-reject until closed extraction facts exist, and the old nested-object-rest destructuring fixture is ported as current executable proof.",
  }),
  "binding.object-shape": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/binding-patterns.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nested-object-rest-destructuring/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: object-shape destructuring and object-literal spread consume generated object-shape facts for member extraction/copy and have CLI/runtime proof for object rest destructuring, nested extraction, nullable optional defaults, object assignment defaults, string-literal assignment keys, readonly utility-projected spread, nested object spread, and rest-to-spread execution. Explicit any object destructuring and object spread in compat mode remain hard-rejects until closed extraction/copy facts exist, so compat carriers do not fall through to object-shape inference. Missing source/target shape facts, mismatched rest shape members, malformed optional value carriers, computed names, accessors, generic methods, dictionary spread without copy facts, and non-identifier spread sources fail closed before partial C# object creation.",
  }),
  "carrier.object-shape": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
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
      "test/fixtures/nested-object-rest-destructuring/",
      "test/fixtures/object-literal-method-shorthand/",
      "test/fixtures/object-literal-object/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: generated object-shape adapters are expression-local carriers, while shared semantic Type and Symbol subjects retain declared interface/class/struct carriers. CLI proof includes interface-backed object literal adapters, generic interface object literal adapters, inline structural parameters, nested object extraction, rest object carriers, object spread carriers, readonly utility-projected shape copies, nested spread carriers, nullable optional members, Record dictionary separation, and non-Node executables that apply object-shape default extraction through generated C# behavior. This prevents imported interface object literals from conflicting with declaration carriers and keeps unknown, any compat spread/destructuring, computed/accessor members, dictionary spread without copy facts, and missing shape/provider facts fail-closed instead of falling back to source spelling.",
  }),
  "carrier.any-tsvalue": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: TypeScript any receives an opaque source/runtime carrier fact, strict-native rejects it, compat mode lowers only through closed TsValue/TsObject/TsArray/TsUnion/TsFunction/JSArray operation facts, csharp-js runtime tests prove closed carrier property/element/call/construct and union forwarding behavior without reflection or dynamic dispatch, and CLI/toolchain proof emits TsValue public boundaries plus closed runtime calls without selecting the JS surface. object and unknown remain non-dynamic.",
  }),
  "carrier.union": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/runtime-union.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
      "test/cli-build/runtime-union.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/runtime-union.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "carrier.union remains partial until provider-owned union constituents, serialization boundaries, every supported narrowing pattern, and end-to-end old fixture parity are covered.",
    ]),
    notes:
      "Reviewed partial proof: heterogeneous unions create explicit Tsonic.CSharp.Runtime.Union<T...> carrier facts only after constituent carrier facts exist; narrowed branch conditions and values now emit IsN/AsN only by matching finalized storage union arms to TSTS-narrowed use-site carrier facts, not by source spelling. CLI proof executes generated C# programs that construct primitive/nullish union arms and discriminated object-shape union arms, read them through finalized branch projections, and print exact output. csharp-js adds a closed TsUnion compatibility wrapper for arities 2 through 8, including nullish arms and deterministic open-CLR-object rejection. Provider-owned union constituents, serialization boundaries, every supported narrowing pattern, and broader old fixture parity remain open.",
  }),
  "runtime.union.carrier": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/runtime-union.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
      "test/cli-build/runtime-union.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/runtime-union.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "runtime.union.carrier remains partial until provider-owned union constituents, serialization boundaries, and target toolchain tests cover every supported narrowing pattern.",
    ]),
    notes:
      "Reviewed partial proof: the C# target records runtime union target identities for arities 2 through 8, rejects union type annotation emission without finalized carrier facts, preserves object-shape union-arm declarations, and emits generated Runtime.Union<T...> construction plus narrowed IsN/AsN arm tests/projections only from finalized storage/use-site carrier evidence. CLI proof runs generated primitive, nullish, and discriminated object-shape union projection code through dotnet run with exact output, not only dotnet build. csharp-js proves closed TsUnion boxing, nullish-arm propagation, typed-boundary casts back to Runtime.Union<T...>, and open CLR object rejection without reflection or dynamic dispatch. Provider-owned union constituents, serialization boundaries, and every supported narrowing pattern remain open.",
  }),
  "compat.prototype-mutation": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: object-literal __proto__ prototype mutation and resolved standard-library Object.create, Object.setPrototypeOf, Object.getPrototypeOf, and descriptor-style prototype operations are hard-rejected with selected-source evidence before C# artifacts are emitted. Shadowable local Object/property names are not classified by spelling, and future prototype support requires explicit closed compat-runtime facts rather than CLR object/dynamic fallback.",
  }),
  "compat.proxy-eval-function-with": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: resolved standard-library eval, Function call/constructor, Proxy construction/revocable APIs, and with statements are hard-rejected because dynamic code, dynamic scope, and proxy traps cannot be represented by closed target facts. CLI proof rejects selected JS surface eval/Function/Proxy APIs before artifacts, source-semantics tests prove shadowable local Function, Proxy, and Object names produce no diagnostics, and no QuickJS, C# dynamic, reflection dispatch, or source-name guessing path is present.",
  }),
  "compat.mode.strict-native": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: C# target options default to strict-native, strict-native hard-rejects opaque TypeScript any property read/write, element get/set, call, construction, operators, and typed-boundary programs before artifact emission, and test-injected closed compat operation facts cannot rescue strict-native dynamic any behavior. CLI proof covers strict-native dynamic diagnostics and selected JS dynamic/prototype hard rejects without runtime reflection, C# dynamic, or backend fallback.",
  }),
  "compat.mode.compat": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/project-artifacts.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: explicit typescriptCompatibility=compat is parsed, contributes the closed csharp-js compat-carrier runtime without requiring the JS surface, records finalized operation facts for explicit TypeScript any property read/write, element read/write, direct calls, member calls, and construction, rejects missing/unclosed facts, rejects closed compat facts on non-any object operations, and CLI/toolchain proof emits closed TsValue operations plus a buildable C# project.",
  }),
  "compat.any.property": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: opaque any property and element operations are not source-owned fallbacks; strict-native rejects them, compat rejects missing operation facts, source semantics records closed get/set facts only for explicit any subjects, backend property reads and property/element writes emit only from explicit closed operation facts with argument projections, csharp-js runtime tests prove closed object/array slot behavior including undefined for missing properties, and CLI/toolchain proof builds the emitted closed operations.",
  }),
  "compat.any.call-construct": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: calls and new expressions through explicit any are diagnosed in strict-native and in compat mode without closed target operation facts; compat source semantics records closed InvokeCompat/ConstructCompat facts, backend AST emission requires finalized closed facts plus explicit argument projection, runtime tests prove closed TsFunction invocation/construction and missing-method TypeError behavior, and CLI/toolchain proof covers direct any calls, member calls through closed property-read carriers, and construction.",
  }),
  "compat.any.dynamic-get": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: any property/element reads require closed compat-runtime get facts; strict-native fails even if a fact is present, compat mode requires finalized operation facts before backend AST output, backend C# AST planning renders property and element reads only from closed carrier facts with explicit key projections, runtime tests prove missing property undefined and closed key conversion, and CLI/toolchain proof builds generated ReadCompatSlot/ReadCompatElement calls.",
  }),
  "compat.any.dynamic-set": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: property and element writes through any are caught at the explicit any operation node and require closed compat-runtime method operation facts with explicit source-argument projection rather than backend assignment guessing. Backend C# AST planning rejects direct property-assignment operation facts, renders property/element writes only from closed carrier facts with explicit value or key/value projection, runtime tests prove closed writes through TsObject/TsArray, and CLI/toolchain proof builds generated WriteCompatSlot/WriteCompatElement calls.",
  }),
  "compat.any.dynamic-call": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: calls through explicit any emit deterministic missing-operation diagnostics in strict-native and compat-without-facts; compat mode emits a call only when a finalized closed carrier operation fact exists. Direct calls and member-style calls through prior property-read carriers both lower through InvokeCompat, runtime tests prove closed TsFunction invocation and missing-method TypeError behavior, and CLI/toolchain proof builds the generated calls without source-name fallback.",
  }),
  "compat.any.operators": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
      "packages/targets/csharp/emitter/testcases/common/expected/operators/in-operator/InOperator.cs",
    ]),
    notes:
      "Reviewed proof: supported explicit-any binary, prefix, typeof, and void operators lower only through finalized closed TsValue operation facts; backend planner tests require static runtime-helper facts including ApplyCompatTypeof and ApplyCompatVoid; csharp-js runtime tests prove closed primitive/typeof/void operator semantics without reflection or dynamic dispatch; and source/CLI diagnostics hard-reject unsupported <<, &, **, +=, **=, in, instanceof, comma/sequence, and delete forms before backend fallback.",
  }),
  "compat.any.typed-boundary-cast": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/conversions.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/assignability-boundary.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: typed boundaries between opaque any and typed target carriers are never emitted from backend inference. Strict-native rejects any typed-boundary programs before C# artifacts, while compatibility mode records finalized target conversion facts for assertions, assignments, initializers, and returns. any-to-typed boundaries lower through closed TsValue.CastCompat<T> or TsUnion.CastCompat<T...> facts, typed-to-any boundaries lower through closed TsValue.from facts, backend conversion tests require the finalized generic method fact, runtime tests prove successful scalar/union casts and deterministic mismatch/nullish failures, and CLI/toolchain proof builds the generated conversions without reflection, dynamic dispatch, or source-name fallback.",
  }),
  "compat.object.no-dynamic-access": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: TypeScript object is not promoted to opaque any, receives no dynamic runtime carrier, and property access remains a TSTS source diagnostic rather than target/provider recovery. Public CLI proof blocks object.foo before C# planning artifacts are emitted, JS Object operations are separately classified under selected surface/provider rows, and unsupported descriptor/prototype object operations fail closed through explicit selected-provider-package diagnostics instead of object/dynamic fallback.",
  }),
  "compat.unknown.no-dynamic-access": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/js-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/expected/edge-cases/object-literal-unknown/ObjectLiteralUnknown.cs",
    ]),
    notes:
      "Reviewed proof: unknown is not promoted to opaque any, receives no dynamic runtime carrier, and public CLI proof shows unknown.foo remains a TSTS source diagnostic before backend emission. Compatibility facts are rejected for non-any unknown/object carriers, and old object-literal-unknown coverage is mapped as fail-closed evidence, not as a legacy lowering pattern.",
  }),
  "runtime.dynamic.carrier": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "../tsonic-csharp/test/project-artifacts.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime-planner.test.mjs",
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "../tsonic-csharp/test/semantic-guards.test.mjs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsValueTests.cs",
      "../csharp-js/tests/Tsonic.CSharp.Js.Tests/TsUnionTests.cs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: the runtime carrier fact for TypeScript any remains opaque and non-renderable by itself, compat-runtime behavior requires separate closed operation facts and mode checks, closed TsValue/TsObject/TsArray/TsUnion/TsFunction/JSArray runtime artifacts implement deterministic carrier behavior without reflection or dynamic dispatch, backend AST paths consume finalized property/element/call/construct facts, and CLI/toolchain proof builds emitted code with the runtime reference contributed only by compat mode.",
  }),
  "diagnostic.dynamic-strict-mode": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    notes:
      "Reviewed proof: strict-native dynamic any diagnostics explicitly say strict-native, continue to fire even when compatibility facts exist, and are surfaced through CLI builds before C# artifacts are emitted. Current tests cover property, element, call, construct, operator, and typed-boundary dynamic families with evidence that requires selected compat mode plus closed target facts instead of backend fallback.",
  }),
  "function.default-rest-optional-params": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-optional-params.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/default-params/DefaultParams.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/optional-callbacks/OptionalParams.ts",
      "test/fixtures/optional-function-params/",
    ]),
    notes:
      "Reviewed proof: current CLI emits TypeScript rest parameters as C# params arrays and literal TypeScript default parameters as C# optional parameters from finalized C# parameter carriers, while rejecting non-literal source defaults without emitting a target project. External-current C# provider tests enforce optional/params arity, preserve reflected default and unsupported-default evidence as target metadata, reject omitted provider optional arguments when the reflected target default is missing or unsupported, and prevent provider defaults from becoming source syntax fallbacks. Old default/optional/rest fixture evidence is mapped to the current parameter-fact contract rather than legacy lowering.",
  }),
  "function.delegate-carrier": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/delegates/ActionFunc.ts",
    ]),
    notes:
      "Reviewed proof: .NET provider delegate declarations keep real provider target identity while carrying csharpDelegateSignature metadata only when reflected sourceShape.kind is function; unsupported target-only delegates do not fabricate signatures. Lambda and object-shape method planning consume finalized delegate signature facts from selected provider/runtime carriers, including selected call parameter target refs, and fail closed when a renderable target type lacks delegate signature metadata. This closes the delegate-carrier selection contract only; broader callable behavior such as closures, async, optional callback source semantics, and function arrays remain tracked by their own rows.",
  }),
  "expression.literal.string-number-boolean": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/implicit-int-to-double/",
      "test/fixtures/default-param-int-to-double/",
    ]),
    notes:
      "Reviewed proof: string, number, and boolean literals emit as target literals through C# AST in function bodies, defaults, branches, lambdas, and class initializers. Numeric literals do not become truthiness fallbacks: if/condition positions still require finalized bool-compatible carriers and reject plain numeric truthiness before C# output.",
  }),
  "function.declaration": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/basic/Greet.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/default-params/DefaultParams.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/optional-callbacks/OptionalParams.ts",
    ]),
    notes:
      "Reviewed proof: source function declarations render from TSTS AST/signature facts into C# methods with explicit parameter and return carriers, deterministic static/module placement, generic type parameters, and fail-closed unsupported callable contexts. The current proof dotnet-builds generated C# and rejects unsupported function forms before target artifact generation instead of falling back to semantic strings.",
  }),
  "declaration.function": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/basic/Greet.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/default-params/DefaultParams.ts",
    ]),
    notes:
      "Reviewed proof: function declarations are declaration-planned from source AST plus TSTS callable facts, not reconstructed from source text. Current CLI proof covers named exports, explicit return types, generic declarations, C# AST emission, dotnet build, and unsupported callable diagnostics before C# project output.",
  }),
  "function.arrow": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/arrow/ArrowFunction.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/arrow-inference/ArrowInference.ts",
    ]),
    notes:
      "Reviewed proof: arrow functions lower only when TSTS/contextual callable facts provide parameter and return carriers, including local function values and returned lambdas that capture source bindings. Missing contextual delegate facts and object-shape method delegate facts fail closed before emission.",
  }),
  "expression.lambda": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/arrow/ArrowFunction.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/arrow-inference/ArrowInference.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/delegates/ActionFunc.ts",
    ]),
    notes:
      "Reviewed proof: lambda expressions emit from TSTS-selected/contextual callable signatures and finalized delegate carrier facts. The backend rejects bare lambdas and object-shape methods lacking delegate signature facts, so lambda expression planning cannot infer C# delegate shape from source spelling.",
  }),
  "function.closure": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/closures/Closures.ts",
    ]),
    notes:
      "Reviewed proof: returned lambdas capture source parameters through TSTS scope/binding facts and emit as C# closure-compatible lambdas with dotnet-build proof. Broader callable families remain separately tracked by function.higher-order, carrier.function-delegate, object-shape, and async rows; unsupported callable contexts still require finalized delegate facts and fail closed.",
  }),
  "function.higher-order": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/higher-order/ReturningFunctions.ts",
      "packages/targets/csharp/emitter/testcases/common/types/function-type-aliases/GenericAliases.ts",
    ]),
    notes:
      "Reviewed proof: higher-order function declarations use finalized Func delegate carriers for callable parameters and returned callables, and current CLI proof dotnet-builds generated C# for both shapes. Negative tests prevent missing delegate facts from becoming backend guesses.",
  }),
  "carrier.function-delegate": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/delegates/ActionFunc.ts",
      "packages/targets/csharp/emitter/testcases/common/types/function-collections/FunctionArrays.ts",
      "packages/targets/csharp/emitter/testcases/common/types/function-type-aliases/GenericAliases.ts",
      "test/fixtures/async-basic/",
      "test/fixtures/async-higher-order/",
    ]),
    notes:
      "Reviewed proof: source callable values, callbacks, function arrays, callable interface members, nullable callbacks, and provider-owned delegates all use finalized function/delegate carrier facts. Backend planning rejects missing or non-renderable delegate signature facts and does not synthesize Func/Action carriers from a lambda or method name.",
  }),
  "declaration.generic-parameters": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/SingleConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/MultipleConstraints.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/ObjectConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-interface-inheritance/InterfaceInheritance.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-substitution/NestedSubstitution.ts",
      "test/fixtures/generic-constraints-single/",
      "test/fixtures/generic-multiple-constraints/",
      "test/fixtures/generic-constraints-object-struct/",
      "test/fixtures/generic-interface-inheritance/",
      "test/fixtures/generic-nested-substitution/",
    ]),
    notes:
      "Reviewed proof: generic type parameters render from TSTS AST plus finalized source/provider target facts for functions and classes, while provider constraint legality is proven by .NET provider constraint tests. Heritage-dependent generic forms remain tracked by declaration.heritage and are not counted here. Invalid reflected target constraints produce diagnostics before C# artifacts instead of backend generic inference.",
  }),
  "declaration.class": Object.freeze({
    sourceExamples: Object.freeze([
      "export class Entity { static suffix = \"score\"; constructor(label: string) { this.label = label; } get title(): string { return this.label + \"-\" + Entity.suffix; } }",
      "export class ScoreCard extends Entity { static create(label: string, points: number): ScoreCard { return new ScoreCard(label, points); } finalScore(): number { return super.baseScore() + this.points + ScoreCard.bonus; } }",
    ]),
    tstsDecision:
      "TSTS owns class declaration identity, constructor signatures, field/accessor members, static members, super calls, and heritage clauses; the C# backend consumes those checked facts without source-name rediscovery.",
    providerFacts: Object.freeze([
      "tstsClassDeclarationFact",
      "constructorSignatureFact",
      "classMemberCarrierFact",
      "staticMemberFact",
      "heritageTypeFact",
    ]),
    backendContract:
      "C# class emission renders constructors, fields, accessors, static members, and extends clauses only from finalized declaration/member facts and rejects unsupported class syntax before artifact output.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/classes-value-types.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/basic/Person.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/inheritance/Inheritance.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
      "test/fixtures/property-override-virtual/",
    ]),
    notes:
      "Reviewed proof: class declaration output is complete for the supported C# target class surface. Current CLI evidence includes executable source graphs where TSTS-selected class facts emit constructors, instance fields, static fields, methods, generic classes, inheritance, super constructor and method calls, static members, interface auto-properties, accessor properties, private identifiers, static blocks, and fact-backed virtual/override member dispatch through C# AST output and dotnet build/run. Slice 8 replaces the old property-override-virtual fixture: TSTS/source-analysis member dispatch facts make overriding class field declarations emit C# virtual/override properties, preserving JavaScript this.value dispatch through exact runtime stdout. Unsupported TypeScript-only runtime-shape class forms such as explicit private/public modifiers and abstract classes/members are deterministic diagnostics before artifact output. Broader object-shape, attribute, downstream, and future protected/internal semantics remain owned by their specific capability rows, not by this class declaration row.",
  }),
  "declaration.class.constructor": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
    ]),
    notes:
      "Reviewed proof: source class constructors and generic constructor arguments emit from TSTS class facts into C# constructors with dotnet-build proof. Slice 8 declaration CLI runtime proof adds an executable ScoreCard constructor chain that emits public ScoreCard(string label, double points) : base(label) and runs through dotnet. Heritage constructor chains remain tracked by declaration.class.inheritance and declaration.heritage; unsupported class declaration forms diagnose before output rather than creating fallback constructors.",
  }),
  "declaration.class.fields": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/basic/Person.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/field-inference/Counter.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/field-marker/FieldMarker.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    notes:
      "Reviewed proof: class fields emit from TSTS declarations and finalized target-name/carrier facts for instance, static, inferred, source-primitive, private, and value-type-backed fields. Slice 8 declaration CLI runtime proof covers Entity.label, ScoreCard.points, and static suffix/bonus fields in a generated executable. Explicit TypeScript-only modifiers and missing private target-name facts fail closed before backend name inference.",
  }),
  "declaration.class.methods": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/basic/Person.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-methods/MethodInGenericClass.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-methods/MethodInNonGenericClass.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    notes:
      "Reviewed proof: class methods and generic class methods emit from TSTS declaration/signature facts and generated C# AST. Slice 8 declaration CLI runtime proof executes static ScoreCard.create, instance finalScore, and super.baseScore() calls from generated C#. Inherited/overridden methods remain tracked by heritage rows; TypeScript-only method modifiers and unsupported generic method operations diagnose instead of backend semantic inference.",
  }),
  "declaration.class.properties": Object.freeze({
    sourceExamples: Object.freeze([
      "export class Entity { get title(): string { return this.label + \"-\" + Entity.suffix; } }",
      "const receipt: Receipt = { label: card.title, points, rank: classify(points) };",
    ]),
    tstsDecision:
      "TSTS owns accessor declarations and object/interface property typing; target property emission consumes finalized member carriers rather than treating property names as reflective lookup keys.",
    providerFacts: Object.freeze([
      "accessorMemberFact",
      "interfacePropertyFact",
      "generatedShapePropertyCarrierFact",
    ]),
    backendContract:
      "C# property emission uses generated accessors and shape adapter properties from finalized facts, with unsupported property forms diagnosed before artifact output.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/property-override-virtual/",
    ]),
    notes:
      "Reviewed proof: declaration property emission is closed for supported C# target property forms. The declaration runtime CLI test emits Entity.title as a C# virtual property getter and ScoreCard.title as a C# override property getter from generic project-source member dispatch facts, then consumes card.title through a Receipt object-shape adapter whose generated C# properties are scanned for dynamic/reflection-free output and executed by dotnet run. Backend unit tests prove accessor modifiers and class property declarations consume finalized member dispatch facts. Slice 8 executable proof replaces the old property-override-virtual fixture by emitting overriding TypeScript class field declarations as C# virtual/override auto-properties, then running the generated project to prove base-typed this.value dispatch prints the derived value. Interface/object-shape generated properties are covered by object-shape tests; explicit field<T>() markers remain target fields under source-core field/class-field capabilities rather than this property row.",
  }),
  "declaration.class.visibility": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/basic/Person.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    notes:
      "Reviewed proof: omitted JavaScript class member accessibility canonicalizes to target-public where C# requires it, generated private identifiers consume explicit target-name facts, and TypeScript-only public/private/readonly modifiers are diagnostics rather than compiler signals.",
  }),
  "declaration.class.private-fields": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/constructor/User.ts",
    ]),
    notes:
      "Reviewed proof: #private fields are normalized to finalized C# target-name facts and emitted as private fields; missing target-name facts remain deterministic CSHARP_UNSUPPORTED_NAME diagnostics. Current CLI proof covers private field reads/writes through methods and dotnet-builds the generated target project.",
  }),
  "declaration.class.static-blocks": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/static-members/MathHelper.ts",
    ]),
    notes:
      "Reviewed proof: standard JavaScript static blocks plan to Roslyn-compatible static C# constructors with deterministic statement order and dotnet-build proof; unsupported TypeScript-only class modifier paths remain diagnostics.",
  }),
  "declaration.class.inheritance": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/whole-program-csharp-closure.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/classes-value-types.test.mjs",
      "test/cli-build/e2e-runtime-language.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/whole-program-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/ConcreteExtends.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/GenericExtends.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/InheritanceChain.ts",
      "packages/targets/csharp/emitter/testcases/common/classes/inheritance/Inheritance.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: class heritage clauses emit from TSTS declaration/heritage facts through generated C# AST, including non-generic, generic, and multi-level inheritance, super constructor calls, super method calls, and source class type-argument substitution. TypeScript-only abstract/visibility modifiers remain deterministic diagnostics under their own rows and do not create fallback inheritance emission.",
  }),
  "declaration.heritage": Object.freeze({
    positiveTests: Object.freeze([]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/declaration-classes.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/classes/generic-inheritance/InheritanceChain.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-interface-inheritance/InterfaceInheritance.ts",
      "test/fixtures/generic-interface-inheritance/",
    ]),
    blockers: Object.freeze([
      "declaration.heritage remains partial until extends/implements clauses are proven through current CLI/toolchain tests without unsupported heritage diagnostics.",
    ]),
    notes:
      "Reviewed partial proof: heritage rows are mapped as explicit old inventory evidence, but current validation shows the implementation is not yet complete for the final fact-backed CLI path. The backend must not infer target heritage from source names or old C#-specific markers.",
  }),
  "declaration.interface": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/generic-interface-inheritance/InterfaceInheritance.ts",
      "packages/targets/csharp/emitter/testcases/common/types/interfaces/Interfaces.ts",
      "test/fixtures/generic-interface-inheritance/",
      "test/fixtures/interface-with-functions/",
    ]),
    notes:
      "Reviewed proof: interfaces render from TSTS declaration/type facts into C# interface declarations, and object-shape adapters consume finalized interface facts. Generic/heritage interface forms remain tracked by declaration.heritage; missing object-shape/provider facts fail closed rather than treating interface property names as target members.",
  }),
  "declaration.enum": Object.freeze({
    sourceExamples: Object.freeze([
      "export enum Rank { Silver = 2, Gold = 3 }",
      "const rank = receipt.rank === Rank.Gold ? \"gold\" : \"silver\";",
    ]),
    tstsDecision:
      "TSTS owns enum declaration identity, enum member constants, enum-typed properties, and enum equality checks; backend emission consumes those facts without synthesizing runtime enum objects.",
    providerFacts: Object.freeze([
      "enumDeclarationFact",
      "enumMemberConstantFact",
      "enumValueCarrierFact",
    ]),
    backendContract:
      "C# enum declarations and enum member references emit only when TSTS evaluated integer enum constants; unsupported enum initializers diagnose before project artifact creation.",
    positiveTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/whole-program-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    oldEvidenceAbsence: Object.freeze({
      status: "reviewed-none-found",
      reviewedInventories: Object.freeze([
        "old fixture inventory",
        "old C# emitter inventory",
        "old product unit inventory",
      ]),
      searchEvidence: Object.freeze([
        "old fixture and old C# emitter inventories contain no source enum declaration fixture",
        "old product unit enum references are implementation traversal helpers, not source enum behavior tests",
      ]),
      reviewerNotes:
        "No historical old-suite source enum behavior entry exists to map bidirectionally. Current CLI/toolchain tests are the source of proof for this capability.",
    }),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: modules-declarations verifies numeric enum declaration/member emission, computed integer member expressions such as Right = Left << 1, and executable C# runtime behavior through dotnet run printing right. Cross-module Rank enum flow is covered by whole-program generated-shape proof. String and fractional enum initializers fail closed with CSHARP_UNSUPPORTED_AST before artifact creation because no finalized target enum-carrier facts exist. Const enums fail closed through the generic TypeScript-only runtime-shape modifier diagnostic. The reviewed old inventory absence record documents that no historical source enum behavior entry exists to map.",
  }),
  "statement.block-scope": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/control-flow/switch/SwitchStatement.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/nested-scopes/NestedScopes.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/shadowing/Shadowing.ts",
    ]),
    notes:
      "Reviewed proof: nested blocks preserve TSTS binding identity and lexical shadowing through generated C# scopes, including nested function blocks, loop bodies, switch sections, and explicit shadowing. Planner diagnostics reject control-flow uses that cannot be resolved to valid block/label context.",
  }),
  "statement.if-else": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/control-flow/switch/SwitchStatement.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/nested-scopes/NestedScopes.ts",
      "packages/targets/csharp/emitter/testcases/common/edge-cases/shadowing/Shadowing.ts",
    ]),
    notes:
      "Reviewed proof: if/else statements emit from TSTS AST and finalized bool carriers, and runtime tests cover true/false branches, nested blocks, shadowing, and callback guards. Truthiness without bool facts is rejected before C# artifact generation rather than lowered through JavaScript-style heuristics.",
  }),
  "statement.return": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli-build/expressions-control-flow.test.mjs",
      "test/cli-build/slice4-csharp-closure.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/functions/basic/Greet.ts",
      "packages/targets/csharp/emitter/testcases/common/functions/closures/Closures.ts",
      "packages/targets/csharp/emitter/testcases/common/types/expected-type-threading/ReturnInControlFlow.ts",
    ]),
    notes:
      "Reviewed proof: return statements consume TSTS return types and finalized target carriers across primitives, generic values, closures, and function declarations. Missing or unsupported target carrier/conversion facts fail closed instead of emitting object/dynamic fallbacks.",
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
  "backend.diagnostics": Object.freeze({
    sourceExamples: Object.freeze([
      "export const result = 1 + 2;",
      "backend requires selected-target-operation at the binary expression before emission",
    ]),
    tstsDecision:
      "TSTS accepts the source expression, but a backend diagnostic is required when finalized target facts needed for emission are absent.",
    providerFacts: Object.freeze([
      "missingTargetFactEvidence",
      "backendDiagnosticSourceSpan",
      "backendDiagnosticEvidence",
    ]),
    backendContract:
      "Backend diagnostics must carry missing fact/capability evidence, preserve source spans when the backend has a source node, and suppress artifacts/toolchain handoff.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/array-spread-boundary.test.mjs",
      "../tsonic-csharp/test/backend-diagnostics.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/array-spread-boundary.test.mjs",
      "../tsonic-csharp/test/backend-diagnostics.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli/surface-composition.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([]),
    blockers: Object.freeze([
      "backend.diagnostics remains partial until every backend operation family proves source-span/evidence diagnostics for missing and malformed facts through current C# backend tests.",
    ]),
    notes:
      "Reviewed partial proof: TargetDiagnostic now has a sourceSpan contract, unsupported C# backend diagnostics derive structured sourceSpan from real TSTS/source nodes, host diagnostics preserve backend-supplied source spans and evidence, backend errors suppress artifacts/toolchain work, CLI formatting prints source-core missing-fact spans/evidence, and diagnostic-only backend failures still clean stale target outputs. Array spread and object spread backend fail-closed paths now assert exact source spans on the offending spread element. This advances the common diagnostic gate without claiming every C# operation-family diagnostic is complete.",
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
  "backend.generated-declarations": Object.freeze({
    sourceExamples: Object.freeze([
      "export interface Receipt { label: string; points: number; rank: Rank; }",
      "return { label: card.title, points, rank: classify(points) };",
    ]),
    tstsDecision:
      "TSTS/provider object-shape facts identify when a source object literal requires a generated declaration carrier; backend output consumes that finalized shape instead of fabricating dynamic/object carriers.",
    providerFacts: Object.freeze([
      "generatedStructuralDeclarationFact",
      "objectShapeMemberCarrierFact",
      "deterministicGeneratedTypeIdentityFact",
    ]),
    backendContract:
      "Generated declarations must have deterministic target names and closed properties/methods from finalized shape facts, with unsupported shape members diagnosed before emission.",
    positiveTests: Object.freeze([
      "test/cli-build/modules-declarations.test.mjs",
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/whole-program-csharp-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/object-shapes.test.mjs",
      "test/cli-build/target-config.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nested-object-rest-destructuring/",
    ]),
    blockers: Object.freeze([
      "backend.generated-declarations remains partial until generated declaration naming/member coverage is proven across the full object-shape, utility-type, nested, method, spread/rest, and old fixture matrix.",
    ]),
    notes:
      "Reviewed partial proof: object-shape tests cover broad generated declaration families, while the declaration runtime CLI test proves a generated __TsonicShape_Receipt_* declaration can coexist with source class, interface, and enum declarations, scan free of dynamic/reflection, build, and run. Slice 8 proof adds a compilation-wide object-shape registry invariant: the same finalized shared object-shape identity used from multiple source files emits exactly one generated declaration, validates later uses against that declaration, and builds through the SDK project. This strengthens generated-declaration evidence without claiming full generated shape closure.",
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
      "test/cli-build/runtime-toolchain-proof.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/project-artifacts.test.mjs",
      "test/cli-build/runtime-toolchain-proof.test.mjs",
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
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: NativeAOT is an explicit C# target project property, not generic compiler architecture. C# project-artifact tests prove PublishAot is emitted only from the target-owned publishAot option and rejects invalid/legacy custom property shapes. CLI toolchain proof builds a provider-backed executable, verifies <PublishAot>true</PublishAot>, publishes it with the current .NET runtime identifier through dotnet publish, runs the produced native executable, and scans generated output for banned dynamic/reflection mechanisms.",
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
  "diagnostic.missing-iteration-fact": Object.freeze({
    sourceExamples: Object.freeze([
      "for (const value of values) { consume(value); }",
      "for (const key in value) { consume(key); }",
    ]),
    tstsDecision:
      "TSTS owns source iteration validity. C# emission requires a finalized targetIteration fact proving the target iteration kind, element/key carrier, and renderable target lowering.",
    providerFacts: Object.freeze([
      "csharpTargetIterationFact",
      "selected source iteration operation",
      "renderable target lowering",
      "closed element or key carrier",
    ]),
    backendContract:
      "Backend for-of and for-in emission calls the required iteration-fact gateway. Missing facts, wrong source iteration kind, wrong lowering, or ambiguous selector rows produce deterministic diagnostics and no fallback syntax lowering.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/iteration-selection.test.mjs",
      "../tsonic-csharp/test/statement-planner.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/arrays/basic/ArrayLiteral.ts",
      "packages/targets/csharp/emitter/testcases/common/arrays/double-array/DoubleArray.ts",
    ]),
    blockers: Object.freeze([]),
    laneClassification: freezeLaneClassification({
      patternKind: "fail-closed-missing-iteration-fact",
      possibleLanes: Object.freeze(["static-native", "hard-reject"]),
      strictNative: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-target-iteration-fact",
          "wrong-iteration-kind",
          "unrenderable-target-iteration-lowering",
          "ambiguous-iteration-metadata",
        ]),
      },
      staticNative: {
        lane: "static-native",
        requiredFacts: Object.freeze([
          "tsts-checked-iteration",
          "target-iteration-fact",
          "closed element/key carrier",
          "renderable target lowering",
        ]),
        operation: "emit-target-iteration-from-facts",
      },
      hardReject: {
        lane: "hard-reject",
        reasons: Object.freeze([
          "missing-target-iteration-fact",
          "wrong-iteration-kind",
          "unrenderable-target-iteration-lowering",
          "ambiguous-iteration-metadata",
        ]),
      },
    }),
    notes:
      "Reviewed proof: generic iteration selector tests prove accept/defer/ambiguous behavior; statement planner tests prove missing and wrong-kind facts fail closed; surface tests prove JS/provider iteration facts are recorded only from selected metadata rows. The backend has one required iteration-fact gateway, so for-of and for-in cannot fall through to syntax-based emission.",
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
  "target.shared.operation-contract": Object.freeze({
    sourceExamples: Object.freeze([
      "values[index]",
      "values.sourceSpellingMustNotPickTarget()",
      "maybeChar ?? fallback",
    ]),
    tstsDecision:
      "TSTS checks the source operation and records portable selected operation/signature/carrier facts. Target packs may add target-specific closed facts, but backend emission must require the portable fact first.",
    providerFacts: Object.freeze([
      "targetOperationFact",
      "selectedTargetSignatureFact",
      "runtimeCarrierFact",
      "csharpTargetOperationFact",
    ]),
    backendContract:
      "Backends must not emit provider helpers from target-specific facts alone, source member spelling, or semantic strings; missing portable operation/carrier facts must produce deterministic diagnostics.",
    positiveTests: Object.freeze([
      "../tsonic/test/cli/surface-composition.test.mjs",
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
      "../tsonic-csharp/test/source-owned-call-closure.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic/test/cli/surface-composition.test.mjs",
      "../tsonic-csharp/test/call-operation-facts.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "../tsonic-csharp/test/operator-facts.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/extensions/system/Overlaps.ts",
      "packages/targets/csharp/emitter/testcases/common/types/dictionaries/Dictionaries.ts",
      "packages/targets/csharp/emitter/testcases/common/operators/nullish-coalescing/NullishCoalescing.ts",
      "packages/targets/csharp/emitter/testcases/common/expected/operators/in-operator/InOperator.cs",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed complete proof for the current shared target contract: neutral host tests prove non-C# target packs consume portable targetOperation/runtimeCarrier facts and fail closed when those facts are missing; C# call/property/element/operator tests prove C# helper facts cannot drive emission without selected operation, carrier, and selected-signature facts; old extension, dictionary, nullish, and unsupported operator evidence map the stale emitter cases to finalized fact gates rather than target-name shortcuts.",
  }),
  "diagnostic.unsupported-surface": Object.freeze({
    sourceExamples: Object.freeze([
      "targets: [{ id: \"demo\", surfaces: [\"unknown-surface\"] }]",
      "targets: [{ id: \"demo\", surfaces: [\"stale-surface\"] }]",
      "targets: [{ id: \"demo\", surfaces: [\"surface-without-required-dependency\"] }]",
    ]),
    tstsDecision:
      "TSTS source acceptance does not select target surfaces; the host and surface provider own selected-surface validation.",
    providerFacts: Object.freeze([
      "selectedSurfaceFact",
      "surfaceDependencyFact",
      "surfaceOwnershipFact",
      "surfaceTargetCompatibilityFact",
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
      "Reviewed partial proof: host composition rejects stale/unowned selected surfaces, unknown surfaces, and missing surface dependencies before backend artifacts. Unselected provider-package module ownership is tracked by provider-package/module rows; operation-level selected-surface rejection is tracked separately by diagnostic.unsupported-selected-surface-operation.",
  }),
  "diagnostic.unsupported-selected-surface-operation": Object.freeze({
    sourceExamples: Object.freeze([
      "Promise.resolve(1).then(value => value + 1);",
      "import { format } from \"node:util\"; format({ value: 1 });",
      "const value = values.join(\"|\"); // when finalized receiver carrier facts are missing",
    ]),
    tstsDecision:
      "TSTS checks the selected JS declaration; the selected surface provider decides whether that declaration has target/runtime facts.",
    providerFacts: Object.freeze([
      "selectedSourceDeclarationFact",
      "selectedSurfaceOperationFact",
      "unsupportedSurfaceOperationFact",
      "surfaceDiagnosticEvidenceFact",
      "missingCarrierReasonEvidenceFact",
    ]),
    backendContract:
      "Selected but unsupported surface operations must reject with the owning surface diagnostic and must not defer to backend name lookup or emit placeholder calls.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/node-surface-completion.test.mjs",
      "../tsonic-csharp/test/surface-boundary.test.mjs",
      "test/cli-build/js-surface.test.mjs",
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/dotnet-disallowed-js-builtins/",
    ]),
    blockers: Object.freeze([
      "diagnostic.unsupported-selected-surface-operation remains partial until every selected JS/Node surface member without implementation has exact source spans and no-placeholder/runtime-fallback proof across the full surface matrix.",
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
      "Reviewed partial proof: C# JS and NodeJS provider package tests hard-reject declared unsupported selected operations with CSHARP_JS_SURFACE_OPERATION_UNSUPPORTED or CSHARP_NODEJS_PROVIDER_PACKAGE_OPERATION_UNSUPPORTED and diagnostic evidence naming selected source/provider identity, required facts, reason, and capability id. Selected JS and Node unsupported-operation diagnostics now carry the checked operation node through ExtensionDiagnostic.nodeOrSpan, so downstream source-span rendering can use real source nodes instead of parsing evidence text. Current CLI evidence hard-rejects selected JS Object descriptor/prototype operations and String.match/String.raw/String.matchAll with exact index.ts line/column output, JSON.stringify carrier gaps, plus Node node:util/node:url/node:fs unsupported selected operations without project artifacts or reflection/dynamic fallback; Buffer.isBuffer, Buffer.poolSize, buffer.transcode, process.hrtime, scalar util helpers, and URLSearchParams rows are no longer treated as unsupported because selected provider/runtime facts now exist. Completion still requires the same fail-closed lane and source-span proof for every unsupported selected JS and Node surface member.",
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
  "diagnostic.target-constraint": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-generic-constraints.test.mjs",
      "../tsonic-csharp/test/provider-selection.test.mjs",
      "test/cli-build/provider-dotnet.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/SingleConstraint.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/MultipleConstraints.ts",
      "packages/targets/csharp/emitter/testcases/common/types/generic-constraints/ObjectConstraint.ts",
      "test/fixtures/generic-constraints-single/",
      "test/fixtures/generic-multiple-constraints/",
      "test/fixtures/generic-constraints-object-struct/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: target generic constraint failures are produced from finalized provider target facts after TSTS has accepted the source program. Provider-selection tests prove missing target proof, unsupported constraints, nullable value/reference mismatches, and source primitive implemented-contract mismatches produce CSHARP_TARGET_CONSTRAINT_INVALID diagnostics instead of changing TypeScript assignability or falling back to source-name checks. CLI/toolchain proof with a real reflected assembly rejects invalid class/new/interface, generic-method, struct, unmanaged, and notnull target arguments before C# artifacts are emitted.",
  }),
  "diagnostic.strict-mode-slow-op": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/compat-runtime.test.mjs",
      "test/cli-build/compat-runtime.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: strict-native diagnostics cover dynamic any property/element/call/construct/operator and typed-boundary operations before C# artifacts, while compat mode only emits closed TsValue/TsObject/TsArray/TsFunction operation facts. CLI proof rejects strict-native dynamic programs and unsupported dynamic operators before project output, and compat CLI/runtime proof builds only closed runtime-carrier calls without QuickJS, reflection dispatch, C# dynamic, source-name guessing, or fallback artifact emission.",
  }),
  "diagnostic.ts-invalid-not-rescued": Object.freeze({
    positiveTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/target-config.test.mjs",
      "packages/source-core/src/source-extension.test.ts",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/validator.test.ts",
      "packages/frontend/src/validator-cases/generic-validation.test.ts",
    ]),
    notes:
      "Reviewed proof: invalid TypeScript remains invalid even when extensions/providers are present through the public @tsonic/tsts package root; source-core invalid arity stays a TSTS diagnostic instead of being rescued by extension facts, and CLI TSTS diagnostics stop target artifact creation.",
  }),
  "diagnostic.source-spans": Object.freeze({
    sourceExamples: Object.freeze([
      "return defaultof();",
      "backend diagnostic at src/index.ts:1:14 for missing selected-target-operation",
    ]),
    tstsDecision:
      "TSTS and extensions own source nodes/spans; host diagnostics must preserve those positions rather than reconstructing them from diagnostic text.",
    providerFacts: Object.freeze([
      "extensionDiagnosticNodeOrSpan",
      "targetDiagnosticSourceSpan",
      "backendDiagnosticSourceSpan",
    ]),
    backendContract:
      "Diagnostics render source spans only when a TSTS extension or backend supplies a concrete source node/span; missing spans remain absent rather than guessed from message text.",
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/array-spread-boundary.test.mjs",
      "../tsonic-csharp/test/backend-diagnostics.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/array-spread-boundary.test.mjs",
      "../tsonic-csharp/test/backend-diagnostics.test.mjs",
      "../tsonic-csharp/test/object-shape-boundary.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/types/diagnostic.test.ts",
      "packages/frontend/src/types/result.test.ts",
    ]),
    blockers: Object.freeze([
      "diagnostic.source-spans remains partial until every target/provider/backend diagnostic family has exact source-span assertions, including TSTS aggregate diagnostics and all selected-surface failures.",
    ]),
    notes:
      "Reviewed partial proof: TSTS source diagnostics are preserved as individual TargetDiagnostics with structured sourceSpan and TS code evidence instead of a spanless aggregate; source-core extension diagnostics carry nodeOrSpan through collectTstsDiagnostics into TargetDiagnostic.sourceSpan; selected JS unsupported-operation diagnostics print exact index.ts line/column output from checked operation nodes; backend missing-carrier diagnostics preserve structured sourceSpan from the offending source node; generic-selected-operation diagnostics carry structured sourceSpan without parsing evidence strings; array/object spread fail-closed diagnostics assert exact spread-node spans. The row stays partial because this does not prove exact spans for every diagnostic family.",
  }),
  "diagnostic.evidence": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli/surface-composition.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/dotnet-provider-contract.test.mjs",
      "../tsonic-csharp/test/target-type-facts.test.mjs",
      "test/cli/surface-composition.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/types/diagnostic.test.ts",
      "packages/frontend/src/types/result.test.ts",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: target/provider/backend diagnostics preserve capability and fact evidence through host aggregation and CLI formatting. Current tests prove backend missing-fact evidence suppresses artifacts/toolchain, carrier-resolution diagnostics preserve missing(reason,evidence), and .NET provider contract diagnostics report exact malformed model evidence paths. Precise source-span rendering remains separately tracked by diagnostic.source-spans.",
  }),
  "downstream.smoke.simple-apps": Object.freeze({
    sourceExamples: Object.freeze([
      "Console.writeLine(greeting(\"Ada\"));",
      "console.log(Math.trunc(Math.abs(-7.8)));",
      "external SDK project references generated SmokeGeneratedDownstreamLibrary.csproj",
      "import path from \"node:path\";",
    ]),
    tstsDecision:
      "Representative downstream-style projects are ordinary TSTS source programs; they do not redefine language semantics or bypass provider/surface fact requirements.",
    providerFacts: Object.freeze([
      "providerConsoleCallFact",
      "selectedJsSurfaceFact",
      "selectedNodeProviderPackageFact",
      "targetToolchainExecutableFact",
      "targetToolchainLibraryReferenceFact",
    ]),
    backendContract:
      "The CLI emits target source projects from finalized facts, then the target toolchain builds/runs generated executables and generated libraries consumed by external SDK projects without fallback reflection/dynamic paths.",
    positiveTests: Object.freeze([
      "test/cli-build/downstream-smoke.test.mjs",
      "test/cli-build/e2e-runtime.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/downstream-smoke.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/hello-world/",
      "test/fixtures/namespace-imports/",
      "test/fixtures/file-io/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: downstream smoke builds and runs provider-backed Console, JS-surface, and Node provider-package executables through current CLI output, then builds a generated C# library and consumes it from a separate SDK project through ProjectReference. Negative proof rejects an unselected Node provider-package import before C# artifacts. Generated output and selected runtime packages are scanned for dynamic, System.Reflection, GetProperty/GetMethod, MethodInfo.Invoke, MakeGenericMethod, Activator.CreateInstance, and Assembly.Load before execution.",
  }),
  "downstream.nodejs-source": Object.freeze({
    sourceExamples: Object.freeze([
      "import { existsSync, statSync } from \"node:fs\";",
      "import * as nodeProcess from \"node:process\";",
      "import { Buffer } from \"node:buffer\";",
    ]),
    tstsDecision:
      "Existing Node-style source remains ordinary checked TypeScript; selected provider-package modules own the virtual declarations for node:* imports, and unselected packages remain TSTS/module diagnostics rather than compiler fallbacks.",
    providerFacts: Object.freeze([
      "selectedProviderPackage",
      "providerVirtualDeclarationFact",
      "selectedTargetSignatureFact",
      "selectedRuntimeArtifactFact",
    ]),
    backendContract:
      "Generated C# for Node-style source must consume selected NodeJS provider-package facts and runtime artifacts, then fail closed when the package is unselected or a selected operation is unsupported.",
    positiveTests: Object.freeze([
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/nodejs-surface.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/nodejs-path-posix-join/",
      "test/fixtures/nodejs-surface-alias-coverage/",
      "test/fixtures/nodejs-surface-imports-negative/",
      "test/fixtures/nodejs-surface-module-graph/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: nodejs-surface builds and runs existing Node-style source with selected js surface plus nodejs provider package, including node:fs, node:path, node:process namespace imports, node:os namespace imports, node:buffer, and node:crypto through selected provider declarations, generated C# runtime project references, dotnet build, dotnet run, and exact stdout. Adjacent negatives prove node:* imports fail when the NodeJS provider package is unselected. The recovered historical alias-coverage fixture is represented by deterministic provider-package diagnostics for unsupported child_process, dgram, dns, events, http, net, querystring, readline, stream, timers, tls, zlib, and type-only node:http declarations, with no C# artifacts or reflection/dynamic fallback.",
  }),
  "downstream.no-old-runtime-reflection": Object.freeze({
    sourceExamples: Object.freeze([
      "generated out/csharp/src/Index.cs from provider Console app",
      "generated out/csharp/src/Index.cs from selected JS-surface app",
      "generated out/csharp/src/Index.cs from selected Node provider-package app",
      "runtime source packages csharp-runtime, csharp-js, and csharp-nodejs",
    ]),
    tstsDecision:
      "Downstream smoke source reaches runtime behavior only through selected providers/surfaces and generated target source, not through old frontend/runtime reflection carriers.",
    providerFacts: Object.freeze([
      "selectedProviderRuntimeReference",
      "selectedSurfaceRuntimeReference",
      "selectedProviderPackageRuntimeReference",
      "closedGeneratedOutputScan",
      "closedRuntimePackageScan",
    ]),
    backendContract:
      "Generated downstream smoke output and selected runtime package source must not contain C# dynamic or runtime reflection mechanisms.",
    positiveTests: Object.freeze([
      "test/cli-build/downstream-smoke.test.mjs",
      "test/cli-build/whole-program-csharp-closure.test.mjs",
      "test/cli-build/runtime-toolchain-proof.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "test/cli-build/downstream-smoke.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "test/fixtures/hello-world/",
      "test/fixtures/namespace-imports/",
      "test/fixtures/file-io/",
      "test/fixtures/json-native-inline-stringify/",
      "test/fixtures/json-native-typed-stringify/",
    ]),
    blockers: Object.freeze([]),
    notes:
      "Reviewed proof: the downstream smoke gate scans generated C# for provider, JS, Node provider-package, and generated-library consumer scenarios before dotnet run or external SDK project consumption; the same gate scans csharp-runtime, csharp-js, and csharp-nodejs source for banned dynamic/reflection mechanisms. Whole-program and runtime-toolchain proof provide additional generated-output and runtime-package coverage.",
  }),
  "target.csharp.source-flow-marker-contract": Object.freeze({
    positiveTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    negativeTests: Object.freeze([
      "../tsonic-csharp/test/source-semantics.test.mjs",
      "test/cli-build/source-semantics.test.mjs",
    ]),
    oldEvidence: Object.freeze([
      "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
    ]),
    notes:
      "Reviewed proof: C# explicitly rejects borrow, borrowMut, and move with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED from finalized TSTS flow facts in unit and CLI paths. The markers are not erased, guessed, or lowered through fallback behavior.",
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
    blockers: Object.freeze([]),
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
      "Reviewed proof: C# implements out/ref/inref only when selected target parameter modes match finalized source marker/storage facts, and rejects source-owned by-value calls carrying byref markers. C# emits struct/field/defaultof/ptr/fnptr and source/provider attributes from finalized facts, rejects missing marker facts and unproven local re-export/barrel aliases, and explicitly rejects borrow/borrowMut/move with CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED. CLI/toolchain tests cover emitted C# for defaults, value structs, pointers/function pointers, provider out calls, provider attributes, and fail-closed unsupported flow markers without erasing or guessing intrinsic semantics.",
  }),
  ...slice6WholeProgramClosureEvidence(),
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

function slice4DotnetProviderContractEvidence() {
  return Object.fromEntries(
    slice4DotnetProviderContractRows.map((row) => [
      row.capabilityId,
      Object.freeze({
        positiveTests: slice4DotnetProviderContractPositiveTests,
        negativeTests: slice4DotnetProviderContractNegativeTests,
        oldEvidence: slice4DotnetProviderContractOldEvidence,
        notes: row.notes,
      }),
    ]),
  );
}

function slice4SourceCoreContractEvidence() {
  return Object.fromEntries(
    slice4SourceCoreContractRows.map((row) => [
      row.capabilityId,
      Object.freeze({
        positiveTests: slice4SourceCoreContractPositiveTests,
        negativeTests: slice4SourceCoreContractNegativeTests,
        oldEvidence: row.oldEvidence ?? slice4SourceCoreCommonOldEvidence,
        notes: row.notes,
      }),
    ]),
  );
}

function slice4ProviderCallContractEvidence() {
  return Object.fromEntries(
    slice4ProviderCallContractRows.map((row) => [
      row.capabilityId,
      Object.freeze({
        positiveTests: slice4ProviderCallContractPositiveTests,
        negativeTests: slice4ProviderCallContractNegativeTests,
        oldEvidence: slice4ProviderCallContractOldEvidence,
        notes: row.notes,
      }),
    ]),
  );
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

function freezeSurfaceEvidence(surfaceEvidence) {
  return Object.freeze(Object.fromEntries(
    capabilitySurfaceEvidenceGateNames.map((gateName) => [
      gateName,
      Object.freeze([...(surfaceEvidence?.[gateName] ?? [])]),
    ]),
  ));
}

function freezeOldEvidenceAbsence(absence) {
  return Object.freeze({
    status: absence.status,
    reviewedInventories: Object.freeze([...(absence.reviewedInventories ?? [])]),
    searchEvidence: Object.freeze([...(absence.searchEvidence ?? [])]),
    reviewerNotes: absence.reviewerNotes,
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
    ...(reviewedEvidence?.oldEvidenceAbsence === undefined ? {} : {
      oldEvidenceAbsence: freezeOldEvidenceAbsence(reviewedEvidence.oldEvidenceAbsence),
    }),
    laneClassification,
    ...(reviewedEvidence?.coreIntrinsic === undefined ? {} : {
      coreIntrinsic: freezeCoreIntrinsicContract(reviewedEvidence.coreIntrinsic),
    }),
    ...(reviewedEvidence?.surfaceEvidence === undefined ? {} : {
      surfaceEvidence: freezeSurfaceEvidence(reviewedEvidence.surfaceEvidence),
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
  validateOldEvidenceAbsence(errors, entry);
  validateEvidenceArrays(errors, entry);
  validateCompleteCapabilityProof(errors, entry);
  validateSurfaceEvidence(errors, entry);
  validateStringArrayField(errors, entry, "blockers");
  validateBlockerCompleteness(errors, entry);
  validateStringField(errors, entry, "notes");
  validateCoreIntrinsicContract(errors, entry);
  errors.push(...validateCapabilityLaneClassification(entry));
  validateMapSetLaneClassification(errors, entry);
  return errors;
}

function validateOldEvidenceAbsence(errors, entry) {
  if (entry.oldEvidenceAbsence === undefined) {
    return;
  }

  if (Array.isArray(entry.oldEvidence) && entry.oldEvidence.length > 0) {
    errors.push("oldEvidenceAbsence is only valid when oldEvidence is empty");
  }
  if (entry.status !== "complete") {
    errors.push("oldEvidenceAbsence is only valid for complete capabilities");
  }

  const absence = entry.oldEvidenceAbsence;
  if (!isPlainObject(absence)) {
    errors.push("oldEvidenceAbsence must be an object");
    return;
  }

  validateEnumField(errors, absence, "status", capabilityOldEvidenceAbsenceStatusSet, capabilityOldEvidenceAbsenceStatuses, "oldEvidenceAbsence.status");
  validateStringArrayField(errors, absence, "reviewedInventories", { nonEmpty: true, path: "oldEvidenceAbsence.reviewedInventories" });
  validateStringArrayField(errors, absence, "searchEvidence", { nonEmpty: true, path: "oldEvidenceAbsence.searchEvidence" });
  validateNestedStringField(errors, absence, "oldEvidenceAbsence.reviewerNotes");
}

function validateSurfaceEvidence(errors, entry) {
  if (!isSurfaceCapability(entry.capabilityId)) {
    if (entry.surfaceEvidence !== undefined) {
      errors.push("surfaceEvidence is only valid for surface capabilities");
    }
    return;
  }

  if (entry.status !== "complete" && entry.surfaceEvidence === undefined) {
    return;
  }

  const surfaceEvidence = entry.surfaceEvidence;
  if (!isPlainObject(surfaceEvidence)) {
    if (entry.status === "complete") {
      errors.push("complete surface capabilities must have surfaceEvidence");
    } else {
      errors.push("surfaceEvidence must be an object");
    }
    return;
  }

  const positiveTestSet = new Set(Array.isArray(entry.positiveTests) ? entry.positiveTests : []);
  const negativeTestSet = new Set(Array.isArray(entry.negativeTests) ? entry.negativeTests : []);
  const currentTestSet = new Set([...positiveTestSet, ...negativeTestSet]);

  for (const gateName of capabilitySurfaceEvidenceGateNames) {
    const gatePaths = surfaceEvidence[gateName];
    if (!Array.isArray(gatePaths) || gatePaths.length === 0) {
      if (entry.status === "complete") {
        errors.push(`surfaceEvidence.${gateName} must be a non-empty array for complete surface capabilities`);
      } else if (gatePaths !== undefined) {
        errors.push(`surfaceEvidence.${gateName} must be a non-empty array`);
      }
      continue;
    }

    for (const testPath of gatePaths) {
      if (typeof testPath !== "string" || testPath.length === 0) {
        errors.push(`surfaceEvidence.${gateName} must contain only non-empty strings`);
        break;
      }
      if (!currentTestSet.has(testPath)) {
        errors.push(`surfaceEvidence.${gateName} must reference current positiveTests or negativeTests`);
        break;
      }
      if (gateName === "failClosedDiagnostics" || gateName === "backendNoFallback") {
        if (!negativeTestSet.has(testPath)) {
          errors.push(`surfaceEvidence.${gateName} must reference negativeTests`);
          break;
        }
      } else if (!positiveTestSet.has(testPath)) {
        errors.push(`surfaceEvidence.${gateName} must reference positiveTests`);
        break;
      }
    }
  }
}

function isSurfaceCapability(capabilityId) {
  return typeof capabilityId === "string" &&
    (capabilityId.startsWith("surface.js") || capabilityId.startsWith("surface.node"));
}

function validateMapSetLaneClassification(errors, entry) {
  if (entry.capabilityId !== mapSetCapabilityId) {
    return;
  }

  const classification = entry.laneClassification;
  if (!isPlainObject(classification)) {
    return;
  }

  validateIncludes(errors, classification.possibleLanes, mapSetRequiredPossibleLanes, "surface.js.map-set laneClassification.possibleLanes");
  validateIncludes(
    errors,
    isPlainObject(classification.staticNative) ? classification.staticNative.requiredFacts : undefined,
    mapSetRequiredStaticNativeFacts,
    "surface.js.map-set laneClassification.staticNative.requiredFacts",
  );
  validateIncludes(
    errors,
    isPlainObject(classification.compat) ? classification.compat.requiredFacts : undefined,
    mapSetRequiredCompatFacts,
    "surface.js.map-set laneClassification.compat.requiredFacts",
  );
  if (!isPlainObject(classification.compat) || classification.compat.runtimeCarrier !== "SelectedSurfaceRuntime") {
    errors.push("surface.js.map-set laneClassification.compat.runtimeCarrier must be SelectedSurfaceRuntime");
  }
  validateIncludes(
    errors,
    isPlainObject(classification.hardReject) ? classification.hardReject.reasons : undefined,
    mapSetRequiredHardRejectReasons,
    "surface.js.map-set laneClassification.hardReject.reasons",
  );
}

function validateIncludes(errors, values, requiredValues, path) {
  if (!Array.isArray(values)) {
    return;
  }
  for (const requiredValue of requiredValues) {
    if (!values.includes(requiredValue)) {
      errors.push(`${path} must include ${requiredValue}`);
    }
  }
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
  const hasOldEvidence = Array.isArray(entry.oldEvidence) && entry.oldEvidence.length > 0;
  const hasReviewedOldEvidenceAbsence =
    entry.oldEvidenceAbsence !== undefined &&
    isPlainObject(entry.oldEvidenceAbsence) &&
    entry.oldEvidenceAbsence.status === "reviewed-none-found" &&
    Array.isArray(entry.oldEvidenceAbsence.reviewedInventories) &&
    entry.oldEvidenceAbsence.reviewedInventories.length > 0 &&
    Array.isArray(entry.oldEvidenceAbsence.searchEvidence) &&
    entry.oldEvidenceAbsence.searchEvidence.length > 0 &&
    typeof entry.oldEvidenceAbsence.reviewerNotes === "string" &&
    entry.oldEvidenceAbsence.reviewerNotes.length > 0;
  if (!hasOldEvidence && !hasReviewedOldEvidenceAbsence) {
    errors.push("complete capabilities must have oldEvidence or reviewed oldEvidenceAbsence");
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

function validateStringField(errors, entry, field, path = field) {
  if (typeof entry[field] !== "string" || entry[field].length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function validateNestedStringField(errors, entry, path) {
  const field = path.split(".").at(-1);
  if (typeof entry[field] !== "string" || entry[field].length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function validateEnumField(errors, entry, field, values, valueList, path = field) {
  if (!values.has(entry[field])) {
    errors.push(`${path} must be one of ${valueList.join(", ")}`);
  }
}

function validateStringArrayField(errors, entry, field, options = {}) {
  const path = options.path ?? field;
  if (!Array.isArray(entry[field])) {
    errors.push(`${path} must be an array`);
    return;
  }
  if (options.nonEmpty === true && entry[field].length === 0) {
    errors.push(`${path} must be a non-empty array`);
  }
  for (const value of entry[field]) {
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`${path} must contain only non-empty strings`);
      return;
    }
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
