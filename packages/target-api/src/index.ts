export type {
  TargetArtifact,
  TargetArtifactKind,
  TargetCompileResult,
  TargetDiagnostic,
  TargetDiagnosticSourceSpan,
  TargetRuntimeContributions,
  TargetRuntimeReference,
  TargetSourceFile,
} from "./artifacts.js";
export type {
  TargetId,
  TargetSelection,
  TargetSelectionOptions,
  TargetSurfaceId,
  TargetTypescriptCompatibilityMode,
  TsonicProjectConfig,
} from "./config.js";
export {
  getTargetIdValidationMessage,
  isValidTargetId,
  isValidTargetSurfaceId,
} from "./config.js";
export type {
  TargetCapabilityContext,
  TargetCapabilityContribution,
  TargetCapabilityRuntimeContributionContext,
  TsonicPlugin,
  TsonicTargetCapabilityPlugin,
  TsonicTargetPlugin,
} from "./plugins.js";
export type {
  TargetLazySourceAnalysis,
  TargetSourceAccessKind,
  TargetSourceCallsiteKind,
  TargetSourceCallsite,
  TargetSourceReferenceRecord,
  TargetSourceUseOperation,
  TargetSourceUseRecord,
} from "./analysis/types.js";
export {
  createLazyTargetSourceAnalysis,
} from "./analysis/lazy.js";
export {
  isTsonicSourceProfileDeclarationPath,
  normalizeTargetSourceProfileSegment,
  targetSourceProfileDeclaration,
  tsonicSourceProfileVirtualDirectory,
} from "./source-profile.js";
export type {
  TargetSourceProfileContributions,
  TargetSourceProfileDeclaration,
} from "./source-profile.js";
export type {
  TargetBackend,
  TargetBackendContext,
  TargetAnalysisNodeOptions,
  TargetCallParameterCarrierResolution,
  TargetCallParameterCarriersResolved,
  TargetCarrierMissing,
  TargetCarrierResolution,
  TargetCarrierResolutionEvidence,
  TargetCarrierResolved,
  TargetCompilationPaths,
  TargetCompileInput,
  TargetFactQueries,
  TargetPack,
  TargetCapabilityImplementation,
  TargetCapabilityRuntimeContext,
  TargetProvider,
  TargetProviderModuleOwnership,
  TargetProviderContext,
  TargetProviderSourceProfileContext,
  TargetProjectSourceModuleDependency,
  TargetRuntimeContributionContext,
  TargetSourceAnalysisQueries,
  TargetSurfaceExtensionContext,
  TargetSurfaceImplementation,
  TargetSurfaceSourceProfileContext,
  TargetToolchain,
  TargetToolchainContext,
  TargetToolchainInput,
  TargetToolchainResult,
} from "./pack.js";
export { createTargetRegistry } from "./registry.js";
export type { TargetRegistry } from "./registry.js";
