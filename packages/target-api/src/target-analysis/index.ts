export { selectTargetNativeHandler, selectTargetNativePointerOperation } from "./native-handlers.js";
export { snapshotTargetReadonlyMap } from "./readonly-map.js";
export type { TargetNativeHandler } from "./native-handlers.js";
export {
  createSourceDeclarationMembership,
} from "./declaration-membership.js";
export {
  createTargetClassificationBuilder,
  createTargetClassificationKey,
  createTargetUseClassificationBuilder,
} from "./classifications.js";
export type {
  TargetClassificationBuilder,
  TargetClassificationKey,
  TargetClassificationQueries,
  TargetClassificationWriteResult,
  TargetUseClassificationBuilder,
  TargetUseClassificationQueries,
} from "./classifications.js";
export {
  resolveTargetContractFixedPoint,
} from "./contracts.js";
export type {
  TargetContractEvaluation,
  TargetContractEvaluationContext,
  TargetContractFailure,
  TargetContractFixedPointRequest,
  TargetContractFixedPointResult,
  TargetContractProgram,
  TargetContractRevision,
} from "./contracts.js";
export {
  targetSourceSyntaxProgram,
} from "./source-syntax.js";
export type {
  TargetSourceSyntaxProgram,
} from "./source-syntax.js";
export {
  snapshotTargetPlanningSourceNavigation,
} from "./source-navigation-snapshot.js";
export type {
  TargetPlanningSourceNavigation,
} from "./source-navigation-snapshot.js";
export {
  createTargetSafetyApplicationIndex,
} from "./safety-applications.js";
export type {
  TargetSafetyApplication,
  TargetSafetyApplicationFact,
  TargetSafetyApplicationIndex,
  TargetSafetyApplicationIndexInput,
  TargetSafetyApplicationPlacement,
  TargetSafetyBuilderFact,
  TargetSafetyOperation,
} from "./safety-applications.js";
export {
  targetUseSiteIdentity,
  targetUseSiteRef,
} from "./use-sites.js";
export { targetStronglyConnectedComponents } from "./graph-components.js";
export * from "./ownership/index.js";
export * from "./flow/index.js";
export type { TargetGraphComponentsSelection } from "./graph-components.js";
export { createTargetGraphComponentQuery } from "./graph-component-query.js";
export { createSourceErrorStorageDemandQuery, createSourceErrorDeclarationQuery } from "./error-storage/error-storage-demands.js";
export type { SourceErrorStorageDemand, SourceErrorStorageDemandQueries } from "./error-storage/error-storage-demands.js";
export { createSourceStorageQuery } from "./source-storage/queries.js";
export { createSourceGlobalCallStorageEffects } from "./source-storage/model/global-call-effects.js";
export type { SourceGlobalCallStorageEffect } from "./source-storage/model/global-call-effects.js";
export { createSourceStorageBudget, defaultSourceStorageLimits } from "./source-storage/model/resource-budget.js";
export type { SourceStorageBudget } from "./source-storage/model/resource-budget.js";
export type { SourceStorageProjection, SourceStorageSubject } from "./source-storage/model/subjects.js";
export type {
  SourceStorageBindings, SourceStorageBindingsSelection, SourceStorageInstanceRegion,
  SourceStorageBoundActivation, SourceStorageActivationsSelection,
  SourceStorageValueFrontier, SourceStorageValueFrontierSelection,
  SourceStorageInstanceRegionsSelection, SourceStorageLimits, SourceStorageNodesSelection, SourceStorageImplementationsSelection,
  SourceStorageOriginsSelection, SourceStorageQueries, SourceStorageSubjectSelection,
  SourceStorageConstructionClass, SourceStorageConstructionSelection,
  SourceStorageSubjectsSelection, SourceStorageTypedSubject, SourceStorageProducer,
  SourceStorageTypeSelection, SourceStorageUnresolved,
  SourceStorageWrittenValue, SourceStorageWriteOccurrence, SourceStorageWriteSelection, SourceStorageMemberWritesSelection,
  SourceStorageFormalMemberWriteDemandSelection,
  SourceStorageArgumentTransport, SourceStorageArgumentsSelection, SourceStorageBoundary,
  SourceStorageClosedOriginsSelection, SourceStorageDomainBoundary, SourceStorageProducersSelection,
  SourceStorageCallEffect, SourceStorageEffects,
} from "./source-storage/model/types.js";
export type { SourceErrorRetainedDemand, SourceErrorStorageProtocol } from "./error-storage/protocol.js";
export type { SourceErrorCheckedValue, SourceErrorDeclaredSlot, SourceErrorScalarSlot, SourceErrorDeclarationProtocol,
  SourceErrorDeclarationSelection, SourceErrorFieldUse, SourceErrorConstruction, SourceErrorScalarMutation,
  SourceErrorMutation, SourceErrorParameterUse, SourceErrorLocalInvalidation, SourceErrorDeclarationQueries } from "./error-storage/protocol.js";
export type {
  TargetUseSiteRef,
} from "./use-sites.js";
export { analyzeSourceArtifactFiles } from "./artifacts/source-files.js";
export { sourceSafetyPositionIssue } from "./safety-position.js";
export { createSourceExplicitUnsafeContextIndex } from "./safety-contexts.js";
export type { SourceArtifactFile, SourceArtifactIssue } from "./artifacts/source-files.js";

export { validateSourceBinaryEntry } from "./entry-validation.js";
export type { SourceBinaryEntryIssue } from "./entry-validation.js";
export { analyzeSourceConstructorResults } from "./constructor-results.js";
export type { SourceConstructorResultIssue } from "./constructor-results.js";
