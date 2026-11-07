export type {
  TargetId,
  TargetSelection,
  TargetSelectionOptions,
  TargetSurfaceId,
  TsonicProjectConfig,
} from "../config.js";
export {
  getTargetIdValidationMessage,
  isValidTargetId,
  isValidTargetSurfaceId,
} from "../config.js";
export type {
  TargetCompilationSession,
  TargetCompilationSessionContext,
  TargetCompileInput,
} from "../target/compilation.js";
export type { TargetCompilationPaths } from "../target/paths.js";
export type {
  TargetPack,
  TsonicPlugin,
  TsonicTargetPlugin,
} from "../target/pack.js";
export type {
  TargetStarterFile,
  TargetStarterProject,
  TargetStarterProjectContext,
  TargetStarterRequirement,
  TargetStarterRequirementCheck,
  TargetStarterSelection,
  TargetStarterScripts,
} from "../target/starter.js";
export type {
  SelectedTargetCapabilityContributions,
  TargetCompositionContext,
  TargetProviderDescriptor,
  TargetSourceCompilerContributions,
  TargetSurfaceImplementation,
} from "../target/composition.js";
export type {
  TargetProviderSourceCallSelector, TargetSourceExtensionContribution, TargetSourceProviderCallAnalysis,
  TargetSourceSafetyApplicationPlacement, TargetSourceSafetyBuilderAnalysis, TargetSourceSafetyBuilderFact,
  TargetSourceSafetyContract, TargetSourceSafetyMemberKind, TargetSourceSafetyProviderNames,
  TargetSourceUnsafeContextAnalysis, TargetSourceUnsafeContextFact,
} from "../target/source-extensions.js";
export type {
  TargetSourceProfileContributions,
} from "../source-profile.js";
export type {
  TargetToolchain,
  TargetToolchainContext,
  TargetToolchainInput,
  TargetToolchainResult,
} from "../target/toolchain.js";
export type {
  TargetSourcePackage,
  TargetSourcePackageComponent,
  TargetSourcePackageExport,
  TargetSourcePackageGraph,
} from "../source-packages/model.js";
export { createTargetRegistry } from "../registry.js";
export type { TargetRegistry } from "../registry.js";
