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
export {
  createTargetArtifactContractGraph,
  reconstructTargetArtifacts,
} from "./target-artifacts/index.js";
export type {
  TargetArtifactContract,
  TargetArtifactContractBatchResult,
  TargetArtifactContractChange,
  TargetArtifactContractClosureResult,
  TargetArtifactContractGraph,
  TargetArtifactContractGraphOptions,
  TargetArtifactContractGraphResult,
  TargetArtifactContractUpdate,
  TargetArtifactDependency,
  TargetArtifactFacetContract,
  TargetArtifactReconstruction,
  TargetArtifactReconstructionOptions,
  TargetArtifactOwnerFailure,
  TargetArtifactReconstructionRunResult,
} from "./target-artifacts/index.js";
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
  TargetSourceDeclarationPolicy,
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
  SourceBindingWrite,
  SourceClassConstructorParameter,
  SourceClassConstructorResult,
  SourceClassConstructorSignature,
  SourceDeclarationReference,
  SourceDeclaredHeritageEdge,
  SourceDeclaredHeritageResult,
  SourceHeritagePathResult,
  SourceProgramNavigation,
  SourceProjectMemberDispatch,
  SourceProjectMemberImplementationResult,
  SourceProjectModuleDependency,
  SourceProjectReference,
} from "./source-navigation/index.js";
export {
  createTargetSourceProgram,
  sourceTypeSyntaxIsCompositional,
} from "./source-semantics/index.js";
export type {
  ResolvedSourceCallInfo,
  SourceCallResultSelection,
  SourceAuthoredTypeSelection,
  SourceContextualValueTypeSelection,
  SourceAuthoredOccurrence,
  SourceDocument,
  SourceFileSemantics,
  SourceOccurrence,
  SourceOccurrenceLookup,
  SourceProgramSemantics,
  SourceProgramDocuments,
  SourceSyntheticOccurrence,
  SourceTypeRelationship,
  SourceTypeRefinement,
  SourceValueTypeRefinementSelection,
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
