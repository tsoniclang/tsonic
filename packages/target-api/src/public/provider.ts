export { getStaticModuleReference } from "../module-reference.js";
export type { StaticModuleReference } from "../module-reference.js";
export {
  isTsonicSourceProfileDeclarationPath,
  normalizeTargetSourceProfileSegment,
  targetSourceProfileDeclaration,
  tsonicSourceProfileVirtualDirectory,
} from "../source-profile.js";
export type {
  TargetSourceDeclarationPolicy,
  TargetSourceProfileContributions,
  TargetSourceProfileDeclaration,
} from "../source-profile.js";
export type {
  TargetCapabilityContext,
  TargetCapabilityContribution,
  TargetCapabilityImplementation,
  TargetCapabilityRuntimeContext,
  TargetCapabilityRuntimeContributionContext,
  TargetCompositionContext,
  TargetProviderDescriptor,
  TargetProviderModuleOwnership,
  SelectedTargetCapabilityContributions,
  TargetRuntimeContributionContext,
  TargetSurfaceCompositionContext,
  TargetSourceCompilerContributions,
  TargetSurfaceImplementation,
  TsonicTargetCapabilityPlugin,
} from "../target/composition.js";
export type {
  TargetCompilationSession,
  TargetCompilationSessionContext,
} from "../target/compilation.js";
export { typescriptNoLibUtilityDeclarations } from "../typescript-no-lib-utilities.js";
