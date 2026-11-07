// @tsonic/target-api/analysis: program-free analysis algorithms and vocabulary a target may call directly.
// Nothing here takes the Host program or a checker type. Every analysis that reads the Source program is a member of
// SourceProgramFacts.analyses (`@tsonic/target-api/source`); the Host-internal barrel is `@tsonic/target-api/host`.
export { selectTargetNativeHandler, selectTargetNativePointerOperation } from "../target-analysis/native-handlers.js";
export type { TargetNativeHandler } from "../target-analysis/native-handlers.js";
export { snapshotTargetReadonlyMap } from "../target-analysis/readonly-map.js";
export { createSourceDeclarationMembership } from "../target-analysis/declaration-membership.js";
export {
  createTargetClassificationBuilder, createTargetClassificationKey, createTargetUseClassificationBuilder,
} from "../target-analysis/classifications.js";
export type {
  TargetClassificationBuilder, TargetClassificationKey, TargetClassificationQueries, TargetClassificationWriteResult,
  TargetUseClassificationBuilder, TargetUseClassificationQueries,
} from "../target-analysis/classifications.js";
export { resolveTargetContractFixedPoint } from "../target-analysis/contracts.js";
export type {
  TargetContractEvaluation, TargetContractEvaluationContext, TargetContractFailure, TargetContractFixedPointRequest,
  TargetContractFixedPointResult, TargetContractProgram, TargetContractRevision,
} from "../target-analysis/contracts.js";
export { targetSourceSyntaxProgram } from "../target-analysis/source-syntax.js";
export type { TargetSourceSyntaxProgram } from "../target-analysis/source-syntax.js";
export { createTargetSafetyApplicationIndex } from "../target-analysis/safety-applications.js";
export type {
  TargetSafetyApplication, TargetSafetyApplicationFact, TargetSafetyApplicationIndex, TargetSafetyApplicationIndexInput,
  TargetSafetyApplicationPlacement, TargetSafetyBuilderFact, TargetSafetyOperation,
} from "../target-analysis/safety-applications.js";
export { targetUseSiteIdentity, targetUseSiteRef } from "../target-analysis/use-sites.js";
export type { TargetUseSiteRef } from "../target-analysis/use-sites.js";
export { targetStronglyConnectedComponents } from "../target-analysis/graph-components.js";
export type { TargetGraphComponentsSelection } from "../target-analysis/graph-components.js";
export { createTargetGraphComponentQuery } from "../target-analysis/graph-component-query.js";
export { sourceSafetyPositionIssue } from "../target-analysis/safety-position.js";
export { createSourceExplicitUnsafeContextIndex } from "../target-analysis/safety-contexts.js";
export { solveSourceFlow } from "../target-analysis/flow/solver.js";
export { analyzeSourceStatementExits } from "../target-analysis/flow/statement-exits.js";
export type { SourceStatementExitFacts } from "../target-analysis/flow/statement-exits.js";
export { analyzeSourceResourceScopes } from "../target-analysis/flow/resource-scopes.js";
export type { SourceResourceScope, SourceResourceScopes } from "../target-analysis/flow/resource-scopes.js";
export { defaultSourceFlowLimits } from "../target-analysis/flow/resources.js";
export type {
  SourceControlFlowGraph, SourceControlFlowSelectedDomain, SourceControlFlowSelection, SourceDeclarationControlFlowOptions,
  SourceDeclarationFlowExecutionRegion, SourceFlowEdge, SourceFlowEdgeKind, SourceFlowLattice, SourceFlowLimits,
  SourceFlowOperation, SourceFlowPoint, SourceFlowProblem, SourceFlowSolution, SourceFlowUnresolved, SourceFlowWork,
} from "../target-analysis/flow/model.js";
export {
  createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits, sourceDeclarationOwnershipUnresolved,
} from "../target-analysis/ownership/contracts.js";
export { sourceGenericAdoptionDiagnosticCode, sourceGenericAdoptionDiagnosticMessage }
  from "../target-analysis/ownership/generic-adoption.js";
export { createSourceContinuationTransfer } from "../target-analysis/ownership/continuation.js";
export type { SourceContinuationLattice, SourceContinuationState, SourceContinuationTransfer }
  from "../target-analysis/ownership/continuation.js";
export type {
  SourceDeclarationAsyncCompletionSelection, SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipCause,
  SourceDeclarationOwnershipContract, SourceDeclarationOwnershipEvidence, SourceDeclarationOwnershipLimits,
  SourceDeclarationOwnershipPremises, SourceDeclarationOwnershipUnresolved, SourceDeclarationOwnershipValue,
  SourceDeclarationPendingOperation, SourceDeclarationRetentionPremise, SourceDeclarationRetentionSelection,
  SourceDeclarationSuspensionSelection,
} from "../target-analysis/ownership/model.js";
export { createSourceStorageBudget, defaultSourceStorageLimits } from "../target-analysis/source-storage/model/resource-budget.js";
export type { SourceStorageBudget } from "../target-analysis/source-storage/model/resource-budget.js";
export type { SourceStorageProjection, SourceStorageSubject } from "../target-analysis/source-storage/model/subjects.js";
export type {
  SourceStorageBindings, SourceStorageBindingsSelection, SourceStorageInstanceRegion, SourceStorageBoundActivation,
  SourceStorageActivationsSelection, SourceStorageBoundTypesSelection, SourceStorageValueFrontier, SourceStorageValueFrontierSelection,
  SourceStorageInstanceRegionsSelection, SourceStorageLimits, SourceStorageNodesSelection,
  SourceStorageImplementationsSelection, SourceStorageOriginsSelection, SourceStorageQueries,
  SourceStorageSubjectSelection, SourceStorageConstructionClass, SourceStorageConstructionSelection,
  SourceStorageSubjectsSelection, SourceStorageTypedSubject, SourceStorageProducer, SourceStorageTypeSelection,
  SourceStorageUnresolved, SourceStorageWrittenValue, SourceStorageWriteOccurrence, SourceStorageWriteSelection,
  SourceStorageMemberWritesSelection, SourceStorageFormalMemberWriteDemandSelection, SourceStorageArgumentTransport,
  SourceStorageArgumentsSelection, SourceStorageBoundary, SourceStorageClosedOriginsSelection, SourceStorageDomainBoundary,
  SourceStorageProducersSelection, SourceStorageCallEffect, SourceStorageEffects,
} from "../target-analysis/source-storage/model/types.js";
export type { SourceArtifactFile, SourceArtifactIssue } from "../target-analysis/artifacts/source-files.js";
export type { SourceBinaryEntryIssue } from "../target-analysis/entry-validation.js";
export type { SourceErrorRetainedDemand, SourceErrorStorageProtocol } from "../target-analysis/error-storage/protocol.js";
export type { SourceErrorStorageDemand, SourceErrorStorageDemandQueries } from "../target-analysis/error-storage/model.js";
