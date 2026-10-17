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
    providerModelPaths: ["src/providers/native/relations/index.ts", "src/providers/native/relations/relation-model.ts"],
    providerSdkPaths: ["src/public/provider-dotnet.ts"],
    programType: { file: "src/analysis/program/model.ts", symbol: "CsharpTargetProgram" },
    diagnosticCodeFields: [{ file: "external/tsonic/packages/target-api/src/artifacts.ts", symbol: "TargetDiagnostic.code" }],
    diagnosticCalls: ["selectedPolicyDiagnostic", "targetPolicyDiagnostic", "unsupportedNodeDiagnostic"].map(symbol => ({
      file: "src/backend/planner/diagnostics.ts", symbol,
    })),
    invariantHelpers: [{ file: "src/backend/planner/diagnostics.ts", symbol: "failCsharpPlannerInvariant" }],
    recordReaders: [{
      file: "src/target-model/records/operations.ts",
      symbol: "CsharpTargetOperationClassifications.operatorForm.usesExpectedResultType",
    }],
    ...keelOwnedCsharpResponsibilities,
  }),
  "tsonic-rust": Object.freeze({
    programType: { file: "src/analysis/program/model.ts", symbol: "RustTargetProgram" },
    diagnosticCodeFields: [{ file: "external/tsonic/packages/target-api/src/artifacts.ts", symbol: "TargetDiagnostic.code" }],
    keyDefinitions: [],
    keyTypes: [],
    diagnosticCalls: ["unsupportedStatementDiagnostic", "missingFactDiagnostic", "unsupportedConstructDiagnostic"].map(symbol => ({
      file: "src/backend/planner/diagnostics.ts", symbol,
    })),
    invariantHelpers: [{ file: "src/backend/planner/diagnostics.ts", symbol: "failRustPlannerInvariant" }],
    cloneFields: [{ file: "src/backend/target-ast/syntax/nodes.ts", symbol: "RustExpr.method" }],
    recordReaders: [
      { file: "src/analysis/control-flow/counted-loop-representations.ts", symbol: "RustCountedLoopRepresentationPlan.representationFor" },
      { file: "src/analysis/declarations/enum-member-constants.ts", symbol: "RustEnumMemberConstantIndex.forMember" },
      { file: "src/analysis/numeric/representations.ts", symbol: "RustNumericRepresentations.usesInt32Remainder" },
      { file: "src/analysis/objects/class-values.ts", symbol: "RustClassValuePlan.forCarrier" },
      { file: "src/analysis/objects/class-values.ts", symbol: "RustClassValuePlan.forDeclaration" },
      { file: "src/analysis/objects/class-values.ts", symbol: "RustClassValuePlan.viewFor" },
      { file: "src/analysis/objects/frozen-data-writes.ts", symbol: "RustFrozenDataWritePlan.capturesFieldIdentity" },
      { file: "src/analysis/objects/frozen-data-writes.ts", symbol: "RustFrozenDataWritePlan.receiverForDeclaration" },
      { file: "src/analysis/program/borrowed-element-reads.ts", symbol: "RustBorrowedElementReads.forExpression" },
      { file: "src/analysis/program/borrowed-element-reads.ts", symbol: "RustBorrowedElementReads.forIteration" },
      { file: "src/analysis/program/borrowed-element-reads.ts", symbol: "RustBorrowedElementReads.forStatement" },
      { file: "src/analysis/program/borrowed-element-reads.ts", symbol: "RustBorrowedElementReads.endingAt" },
      { file: "src/analysis/program/error-transport.ts", symbol: "RustErrorTransportQueries.forComponent" },
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
      { file: "src/analysis/project/dispatch-contexts.ts", symbol: "RustDispatchContextCatalog.declaration" },
      { file: "src/analysis/project/dispatch-demand.ts", symbol: "RustDispatchContextDemandPlan.forComponent" },
      { file: "src/analysis/source-modules/model.ts", symbol: "RustSourceModuleConstructionIndex.construction" },
      { file: "src/analysis/source-modules/model.ts", symbol: "RustSourceModuleConstructionIndex.entries" },
      { file: "src/analysis/source-modules/model.ts", symbol: "RustSourceModuleConstructionIndex.from" },
      { file: "src/analysis/source-modules/model.ts", symbol: "RustSourceModuleConstructionIndex.targets" },
      { file: "src/analysis/storage/borrowed-initializers.ts", symbol: "RustBorrowedInitializerQueries.forExpression" },
      { file: "src/analysis/storage/capture-storage.ts", symbol: "RustCaptureStoragePlan.deferredForScope" },
      { file: "src/analysis/storage/capture-storage.ts", symbol: "RustCaptureStoragePlan.iterationsForScope" },
      { file: "src/analysis/storage/local-aliases.ts", symbol: "RustLocalStorageAliasPlan.owner" },
      { file: "src/analysis/storage/local-aliases.ts", symbol: "RustLocalStorageAliasPlan.requiresMutableOwner" },
      { file: "src/analysis/storage/provider-mutable-inputs.ts", symbol: "RustProviderMutableInputPlan.forOperation" },
      { file: "src/analysis/callables/native-storage.ts", symbol: "RustNativeStoragePlan.parameterFor" },
      ...["contractFor", "parameterFor", "resolve", "allContracts"].map(name => ({
        file: "src/target-model/lifetimes/model.ts", symbol: `RustLifetimeIndex.${name}`,
      })),
    ],
    lazyQueries: [
      ...["callsFor", "bindingFor"].map(name => ({
        file: "src/policy/ownership/source-lexical-callable.ts", symbol: `createRustSourceLexicalCallableQueries.${name}`,
      })),
      { file: "src/policy/ownership/source-borrowed-return.ts", symbol: "createRustSourceCallableQueries.borrowedReturnParameter" },
      ...["suspendedParametersFor", "lexicalFor", "environmentFor"].map(name => ({
        file: "src/policy/ownership/retained-environment-queries.ts", symbol: `createRustRetainedEnvironmentQueries.${name}`,
      })),
      ...["canUseSharedBorrow", "resolveParameterAbi"].map(name => ({
        file: "src/policy/ownership/source-callable-abi.ts", symbol: `createRustSourceCallableAbiResolver.${name}`,
      })),
    ],
    ...keelOwnedRustResponsibilities,
  }),
});

export function keelDefaultManifest() {
  return {
    schemaVersion: 1, basePins: keelBasePins, targets: keelOwnedTargets,
    runtimeFamilies: keelOwnedRuntimeFamilies, nodeModules: keelOwnedNodeModules,
    determinismPrograms: keelOwnedDeterminismPrograms,
  };
}
