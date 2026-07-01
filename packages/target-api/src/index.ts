export type {
  TargetArtifact,
  TargetArtifactKind,
  TargetCompileResult,
  TargetDiagnostic,
  TargetRuntimeContributions,
  TargetRuntimeReference,
  TargetSourceFile,
} from "./artifacts.js";
export type {
  TargetId,
  TargetProviderPackageId,
  TargetSelection,
  TargetSelectionOptions,
  TargetSurfaceId,
  TargetTypescriptCompatibilityMode,
  TsonicProjectConfig,
} from "./config.js";
export {
  getTargetIdValidationMessage,
  isValidTargetId,
  isValidTargetProviderPackageId,
  isValidTargetSurfaceId,
} from "./config.js";
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
  TargetProvider,
  TargetProviderPackageContext,
  TargetProviderPackageImplementation,
  TargetProviderModuleOwnership,
  TargetProviderContext,
  TargetProjectSourceModuleDependency,
  TargetRuntimeContributionContext,
  TargetSourceAnalysisQueries,
  TargetSurfaceExtensionContext,
  TargetSurfaceImplementation,
  TargetToolchain,
  TargetToolchainContext,
  TargetToolchainInput,
  TargetToolchainResult,
} from "./pack.js";
export { createTargetRegistry } from "./registry.js";
export type { TargetRegistry } from "./registry.js";
