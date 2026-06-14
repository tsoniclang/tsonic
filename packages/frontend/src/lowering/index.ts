export type {
  BackendTargetId,
  LoweringBindingAccessPlan,
  LoweringBindingElementPlan,
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
  LoweringObjectPropertyPlan,
  LoweringParameterPlan,
  LoweringPipelineOptions,
  LoweringPipelineResult,
  LoweringPlanBase,
  LoweringStatementPlan,
  LoweringSyntheticDeclarationPlan,
  LoweringTypePlan,
  LoweringVariablePlan,
} from "./types.js";
export { createLoweringInput } from "./input.js";
export { createLoweringModulePlan } from "./module-plan.js";
export { runLoweringPipeline } from "./pipeline.js";
