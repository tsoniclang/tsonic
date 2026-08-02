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
export {
  isTsonicSourceProfileDeclarationPath,
  normalizeTargetSourceProfileSegment,
  targetSourceProfileDeclaration,
  tsonicSourceProfileVirtualDirectory,
} from "./source-profile.js";
export {
  getStaticModuleReference,
} from "./module-reference.js";
export type {
  StaticModuleReference,
} from "./module-reference.js";
export type {
  TargetSourceProfileContributions,
  TargetSourceProfileDeclaration,
} from "./source-profile.js";
export {
  createSourceProgramNavigation,
  sourceProjectFiles,
  sourceFileIdentity,
  sourceNodeIdentity,
  sourceNodesEqual,
  sourceSymbolIdentity,
  sourceSymbolsEqual,
} from "./source-navigation/index.js";
export type {
  SourceClassConstructorParameter,
  SourceClassConstructorResult,
  SourceClassConstructorSignature,
  SourceDeclarationReference,
  SourceDeclaredHeritageEdge,
  SourceDeclaredHeritageResult,
  SourceHeritagePathResult,
  SourceProgramNavigation,
  SourceProjectMemberDispatch,
  SourceProjectModuleDependency,
  SourceProjectReference,
} from "./source-navigation/index.js";
export {
  createTargetSourceProgram,
} from "./source-semantics/index.js";
export type {
  SourceFileSemantics,
  SourceProgramSemantics,
  SourceTypeRelationship,
  TargetSourceProgram,
} from "./source-semantics/index.js";
export type {
  TargetBackend,
  TargetBackendContext,
  TargetCompilationPaths,
  TargetCompileInput,
  TargetPack,
  TargetCapabilityImplementation,
  TargetCapabilityRuntimeContext,
  TargetProvider,
  TargetProviderModuleOwnership,
  TargetProviderContext,
  TargetProviderSourceProfileContext,
  TargetRuntimeContributionContext,
  TargetSourceCompilerContributions,
  TargetSurfaceSourceCompilerContext,
  TargetSurfaceImplementation,
  TargetSurfaceSourceProfileContext,
  TargetToolchain,
  TargetToolchainContext,
  TargetToolchainInput,
  TargetToolchainResult,
} from "./pack.js";
export { createTargetRegistry } from "./registry.js";
export type { TargetRegistry } from "./registry.js";
