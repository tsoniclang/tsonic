import { keelOwnedRuntimeFamilies } from "./keel-runtime-contracts.mjs";
import { keelOwnedNodeModules } from "./keel-node-contracts.mjs";
import { keelOwnedDeterminismPrograms } from "./keel-determinism-contracts.mjs";
import { keelOwnedCsharpResponsibilities } from "./keel-owned-roles-csharp.mjs";
import { keelOwnedRustResponsibilities } from "./keel-owned-roles-rust.mjs";

export const keelBasePins = Object.freeze({
  tsonic: "401ac1353e927c5509767e3153aad546fd0fa1ab",
  "tsonic-csharp": "5e5459cf66545806e9446d613ff1fc80916c60bf",
  "tsonic-rust": "e0fe04790d6c7a25a1f4384d669996248f7d70b3",
  "tsts-legacy": "1903b6c35698dfc958c32b85765de80466a376d4",
  "csharp-runtime": "0c064bd6056e855745d34b5b892e4432c1012101",
  "csharp-js": "e971eafb2cadb2fae89bb9f15c090145616d1468",
  "csharp-nodejs": "41746c059a1b9a1c24b28f5fa80b7025c8de9db7",
  "rust-runtime": "3daf1b00fe0ca46793682bd48b5e830bd28e2159",
  "rust-js": "3075200ba5b3afb6aeb9c08cf250c5169ed77fb8",
  "rust-nodejs": "8c134dde0cd0f4af3fc86c43bbbaf766f915b15c",
  express: "213c32164c11138395222e490323dc54a4286760",
  "tsumo-rust": "dd8f90884b16ceec3091872819b7969a28799921",
  "csharp-pudding": "ac483e7719b723efdfde029cddaddcff9422a392",
  "rust-pudding": "bc34c2dbafb2d0c19b2a01d057e6dac00d815594",
  "tsumo-csharp": "ef9451d8a13ca2e2249e15cb3dbce545317ac8d8",
});

export const keelOwnedTargets = Object.freeze({
  "tsonic-csharp": Object.freeze({
    providerModelPaths: ["src/providers/model/provider-relations.ts"],
    providerSdkPaths: ["src/public/provider-dotnet.ts"],
    programType: { file: "src/target-model/records/target-program.ts", symbol: "CsharpTargetProgram" },
    diagnosticCodeFields: [{ file: "external/tsonic/packages/target-api/src/artifacts.ts", symbol: "TargetDiagnostic.code" }],
    // The rewritten planner constructs no diagnostics; failures go through the single invariant helper below.
    diagnosticCalls: [],
    invariantHelpers: [{ file: "src/backend/planner/diagnostics.ts", symbol: "failCsharpPlannerInvariant" }],
    recordReaders: [{
      file: "src/target-model/records/operations/operations.ts",
      symbol: "CsharpTargetOperationClassifications.operatorForm.usesExpectedResultType",
    }],
    ...keelOwnedCsharpResponsibilities,
  }),
  "tsonic-rust": Object.freeze({
    programType: { file: "src/target-model/records/target-program.ts", symbol: "RustTargetProgram" },
    diagnosticCodeFields: [{ file: "external/tsonic/packages/target-api/src/artifacts.ts", symbol: "TargetDiagnostic.code" }],
    keyDefinitions: [],
    keyTypes: [],
    // The rewritten planner constructs no diagnostics; failures go through the single invariant helper below.
    diagnosticCalls: [],
    invariantHelpers: [{ file: "src/backend/planner/diagnostics.ts", symbol: "failRustPlannerInvariant" }],
    cloneFields: [{ file: "src/backend/target-ast/syntax/nodes.ts", symbol: "RustExpr.method" }],
    recordReaders: [
      { file: "src/target-model/records/native/native-declaration-forms.ts", symbol: "RustNativeDeclarationForms.get" },
      { file: "src/target-model/records/objects/class-values.ts", symbol: "RustClassValuePlan.forDeclaration" },
      { file: "src/target-model/records/objects/class-values.ts", symbol: "RustClassValuePlan.viewFor" },
      { file: "src/analysis/storage/borrowed-element-reads.ts", symbol: "RustBorrowedElementReads.forExpression" },
      { file: "src/analysis/storage/borrowed-element-reads.ts", symbol: "RustBorrowedElementReads.forIteration" },
      { file: "src/analysis/storage/borrowed-element-reads.ts", symbol: "RustBorrowedElementReads.forStatement" },
      { file: "src/target-model/records/errors/error-transport.ts", symbol: "RustErrorTransportQueries.forComponent" },
      { file: "src/analysis/project-types/construction-plan.ts", symbol: "RustProjectConstructionQueries.externalInitializationForCall" },
      { file: "src/analysis/project-types/construction-plan.ts", symbol: "RustProjectConstructionQueries.forDefinition" },
      { file: "src/analysis/project-types/construction-readiness.ts", symbol: "RustConstructionPointQueries.expressionsWithin" },
      { file: "src/analysis/project-types/construction-readiness.ts", symbol: "RustConstructionPointQueries.layerCompletes" },
      { file: "src/analysis/project-types/construction-readiness.ts", symbol: "RustConstructionPointQueries.layerHasEarlyReturn" },
      { file: "src/analysis/project-types/construction-readiness.ts", symbol: "RustConstructionPointQueries.mutatesUnpublishedField" },
      { file: "src/analysis/project-types/construction-readiness.ts", symbol: "RustConstructionPointQueries.pointFor" },
      { file: "src/analysis/project-types/field-dispatch.ts", symbol: "RustProjectFieldDispatchQueries.implementationFor" },
      { file: "src/analysis/project-types/field-dispatch.ts", symbol: "RustProjectFieldDispatchQueries.planFor" },
      { file: "src/analysis/project-types/method-properties.ts", symbol: "RustProjectMethodPropertyPlan.usageFor" },
      { file: "src/analysis/project-types/object-representation.ts", symbol: "RustObjectRepresentationPlan.representationFor" },
      { file: "src/analysis/project-types/receiver-captures.ts", symbol: "RustReceiverFieldCaptureQueries.fixedSelfFor" },
      { file: "src/analysis/project-types/receiver-captures.ts", symbol: "RustReceiverFieldCaptureQueries.fixedSelfForReference" },
      { file: "src/analysis/project-types/receiver-captures.ts", symbol: "RustReceiverFieldCaptureQueries.isCaptured" },
      { file: "src/analysis/project-types/receiver-captures.ts", symbol: "RustReceiverFieldCaptureQueries.storageDeclaration" },
      { file: "src/analysis/project-types/receiver-field-aliases.ts", symbol: "RustReceiverFieldAliasQueries.aliasFor" },
      { file: "src/analysis/project/binary-dispatch-demand.ts", symbol: "RustBinaryDispatchDemandPlan.forHook" },
      { file: "src/analysis/project/dispatch-contexts.ts", symbol: "RustDispatchContextDeclarations.declaration" },
      { file: "src/analysis/project/dispatch-demand.ts", symbol: "RustDispatchContextDemandPlan.forComponent" },
      { file: "src/target-model/records/program/source-modules.ts", symbol: "RustSourceModuleConstructionIndex.construction" },
      { file: "src/target-model/records/program/source-modules.ts", symbol: "RustSourceModuleConstructionIndex.entries" },
      { file: "src/target-model/records/program/source-modules.ts", symbol: "RustSourceModuleConstructionIndex.from" },
      { file: "src/target-model/records/program/source-modules.ts", symbol: "RustSourceModuleConstructionIndex.targets" },
      { file: "src/analysis/storage/local-aliases.ts", symbol: "RustLocalStorageAliasPlan.owner" },
      { file: "src/analysis/storage/local-aliases.ts", symbol: "RustLocalStorageAliasPlan.requiresMutableOwner" },
      { file: "src/analysis/declarations/generic-requirements.ts", symbol: "RustDeclarationGenericRequirementIndex.contractForCarrier" },
      { file: "src/analysis/callables/storage/native-storage.ts", symbol: "RustNativeStoragePlan.parameterFor" },
      ...["contractFor", "parameterFor", "resolve", "allContracts"].map(name => ({
        file: "src/target-model/lifetimes/model.ts", symbol: `RustLifetimeIndex.${name}`,
      })),
    ],
    lazyQueries: [
      ...["callsFor", "bindingFor"].map(name => ({
        file: "src/analysis/callables/values/lexical-bindings.ts", symbol: `createRustSourceLexicalCallableQueries.${name}`,
      })),
      { file: "src/analysis/callables/ownership/borrowed-returns.ts", symbol: "createRustSourceCallableQueries.borrowedReturnParameter" },
      ...["suspendedParametersFor", "lexicalFor", "environmentFor"].map(name => ({
        file: "src/analysis/callables/ownership/retained-environment-shapes.ts", symbol: `createRustRetainedEnvironmentQueries.${name}`,
      })),
      ...["canUseSharedBorrow", "resolveParameterAbi"].map(name => ({
        file: "src/analysis/callables/calls/source-callable-abi.ts", symbol: `createRustSourceCallableAbiResolver.${name}`,
      })),
    ],
    ...keelOwnedRustResponsibilities,
  }),
});

export const keelOwnedNativeUnsafeReviews = Object.freeze([{
  repo: "rust-runtime",
  file: "tests/helpers/allocation_counts.rs",
  sourceSha256: "51b161241b9b6d49690154c9ab0506b671d1546075a7a81c5ee45335f9b48dc5",
  sites: [
    {
      bodySha256: "2d4e42f4ace84e3f2c93ff1ccfc183ced355240fc8d7191bdf25631d520fe21d", count: 1,
      reason: "CountingAllocator implements the native unsafe GlobalAlloc trait and preserves System's pointer, Layout and ownership contracts.",
      nativeEvidence: "Rust 1.98.1 core/src/alloc/global.rs:144; allocation_counts.rs:160-192. The recorder uses atomics and const-initialized thread-local Cells without allocating or unwinding.",
    },
    {
      bodySha256: "9c5471e7a81f26728563010cbd392f3644d9a31e293f528b407300c736dda281", count: 1,
      reason: "GlobalAlloc::alloc requires an unsafe implementation; the exact Layout and System return value are preserved.",
      nativeEvidence: "Rust 1.98.1 core/src/alloc/global.rs:178; allocation_counts.rs:161-167.",
    },
    {
      bodySha256: "59c607597524f4a0af0ae1a0cb9e729577202f53ac23765dcfea3dcf611c9ff4", count: 1,
      reason: "System.alloc requires the native unsafe call; its original Layout and returned pointer pass unchanged exactly once.",
      nativeEvidence: "Rust 1.98.1 core/src/alloc/global.rs:178; allocation_counts.rs:166. The measurement recorder does not access allocation memory.",
    },
    {
      bodySha256: "336dd46742f06612817d2af3a9d1b4a9071df93c5d29d03eca9acba6b42b8191", count: 1,
      reason: "GlobalAlloc::alloc_zeroed requires an unsafe implementation; the native System zeroed allocation remains authoritative.",
      nativeEvidence: "Rust 1.98.1 core/src/alloc/global.rs:216; allocation_counts.rs:169-175.",
    },
    {
      bodySha256: "71ad1bc261c0adce798f5db20e3a1384c04e1c333dbbc19a2c7a0258c937c33a", count: 1,
      reason: "System.alloc_zeroed receives the original Layout and provides the exact zeroed pointer or null result.",
      nativeEvidence: "Rust 1.98.1 core/src/alloc/global.rs:216; allocation_counts.rs:174. Counting does not initialize, read or retain allocated memory.",
    },
    {
      bodySha256: "7b8f09b247ad095d5e8ded229ec89ab9ab3a8d36a852d14a9994dd9dd2f106d6", count: 1,
      reason: "GlobalAlloc::dealloc requires an unsafe implementation; the caller's pointer and Layout obligations are unchanged.",
      nativeEvidence: "Rust 1.98.1 core/src/alloc/global.rs:193; allocation_counts.rs:177-182.",
    },
    {
      bodySha256: "6773fa899b171958d427eac74e03d27687ced14dba3b177094cee3ae661e2894", count: 1,
      reason: "System.dealloc receives the original pointer and Layout exactly once; counting never dereferences or retains the pointer.",
      nativeEvidence: "Rust 1.98.1 core/src/alloc/global.rs:193; allocation_counts.rs:181.",
    },
    {
      bodySha256: "d070e622c807dbe147dfab4c744ff0f0929ccde6cac73a0ec69b95719615bc60", count: 1,
      reason: "GlobalAlloc::realloc requires an unsafe implementation; original allocation and failure ownership semantics remain native.",
      nativeEvidence: "Rust 1.98.1 core/src/alloc/global.rs:286; allocation_counts.rs:184-191. This method's token context is also present in the seven-site baseline.",
    },
    {
      bodySha256: "1e79ad9757624717c1bac0197a861284c6808db671b300512e88a9e896d7cefc", count: 1,
      reason: "System.realloc receives the original pointer, Layout and requested size exactly once; the original allocation is not separately freed.",
      nativeEvidence: "Rust 1.98.1 core/src/alloc/global.rs:286; allocation_counts.rs:190. System's returned pointer and null failure semantics are preserved.",
    },
  ],
}]);

export function keelDefaultManifest() {
  return {
    schemaVersion: 1, basePins: keelBasePins, targets: keelOwnedTargets,
    runtimeFamilies: keelOwnedRuntimeFamilies, nodeModules: keelOwnedNodeModules,
    determinismPrograms: keelOwnedDeterminismPrograms,
    nativeUnsafeReviews: keelOwnedNativeUnsafeReviews,
  };
}
