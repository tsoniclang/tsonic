// @tsonic/target-api/analysis: program-free analysis algorithms and vocabulary a target may call directly.
// Nothing here takes the Host program or a checker type. Every analysis that reads the Source program is a member of
// SourceProgramFacts.analyses (`@tsonic/target-api/source`); the Host-internal barrel is `@tsonic/target-api/host`.
export { selectTargetNativeHandler, selectTargetNativePointerOperation } from "../target-analysis/native-handlers.js";
export { snapshotTargetReadonlyMap } from "../target-analysis/readonly-map.js";
export { createSourceDeclarationMembership } from "../target-analysis/declaration-membership.js";
export { createTargetClassificationBuilder, createTargetClassificationKey, createTargetUseClassificationBuilder, } from "../target-analysis/classifications.js";
export { resolveTargetContractFixedPoint } from "../target-analysis/contracts.js";
export { targetSourceSyntaxProgram } from "../target-analysis/source-syntax.js";
export { createTargetSafetyApplicationIndex } from "../target-analysis/safety-applications.js";
export { targetUseSiteIdentity, targetUseSiteRef } from "../target-analysis/use-sites.js";
export { targetStronglyConnectedComponents } from "../target-analysis/graph-components.js";
export { createTargetGraphComponentQuery } from "../target-analysis/graph-component-query.js";
export { sourceSafetyPositionIssue } from "../target-analysis/safety-position.js";
export { createSourceExplicitUnsafeContextIndex } from "../target-analysis/safety-contexts.js";
export { solveSourceFlow } from "../target-analysis/flow/solver.js";
export { analyzeSourceStatementExits } from "../target-analysis/flow/statement-exits.js";
export { analyzeSourceResourceScopes } from "../target-analysis/flow/resource-scopes.js";
export { defaultSourceFlowLimits } from "../target-analysis/flow/resources.js";
export { createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits, sourceDeclarationOwnershipUnresolved, } from "../target-analysis/ownership/contracts.js";
export { sourceGenericAdoptionDiagnosticCode, sourceGenericAdoptionDiagnosticMessage } from "../target-analysis/ownership/generic-adoption.js";
export { createSourceContinuationTransfer } from "../target-analysis/ownership/continuation.js";
export { createSourceStorageBudget, defaultSourceStorageLimits } from "../target-analysis/source-storage/model/resource-budget.js";
//# sourceMappingURL=analysis.js.map