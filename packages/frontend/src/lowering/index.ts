export type {
  BackendTargetId,
  LoweringBuildContext,
  LoweringCallPlan,
  LoweringDeclarationPlan,
  LoweringExpressionPlan,
  LoweringFeature,
  LoweringIndexAccessPlan,
  LoweringInput,
  LoweringMemberAccessPlan,
  LoweringModuleIdentity,
  LoweringModulePlan,
  LoweringNarrowingPlan,
  LoweringPipelineOptions,
  LoweringPipelineResult,
  LoweringPlanBase,
  LoweringStatementPlan,
  LoweringSyntheticDeclarationPlan,
  LoweringTypePlan,
} from "./types.js";
export { createLoweringInput } from "./input.js";
export { createLoweringModulePlan } from "./module-plan.js";
export { runLoweringPipeline } from "./pipeline.js";
