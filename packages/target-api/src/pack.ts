import type {
  AstReader,
  CompilerExtension,
  ExtensionConsumerQueries,
  ExtensionFactSubject,
  Node,
  Program,
  SourceFile,
  Symbol,
  TargetBindingFact,
  TargetTypeRef,
  Type,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type { TargetCompileResult, TargetRuntimeContributions, TargetRuntimeReference } from "./artifacts.js";
import type {
  TargetLazySourceAnalysis,
} from "./analysis/types.js";
import type {
  TargetSelection,
  TargetSurfaceId,
  TsonicProjectConfig,
} from "./config.js";
import type {
  TargetCapabilityOperationMapper,
  TargetCapabilityRuntimeContributionContext,
  TsonicTargetCapabilityPlugin,
} from "./plugins.js";
import type {
  TargetSourceProfileContributions,
} from "./source-profile.js";

export interface TargetProviderContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
}

export interface TargetProviderModuleOwnership {
  readonly specifierPrefix: string;
  readonly providerId?: string;
  readonly message?: string;
}

export interface TargetSurfaceExtensionContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly surface: TargetSurfaceImplementation;
}

export interface TargetBackendContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
}

export interface TargetToolchainContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
}

export interface TargetCompilationPaths {
  readonly projectFilePath: string;
  readonly projectRoot: string;
  readonly outputRoot: string;
  readonly targetOutputRoot: string;
}

export interface TargetRuntimeContributionContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly paths: TargetCompilationPaths;
}

export interface TargetProviderSourceProfileContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
}

export interface TargetSurfaceSourceProfileContext extends TargetProviderSourceProfileContext {
  readonly surface: TargetSurfaceImplementation;
}

export interface TargetAnalysisNodeOptions {
  readonly sourceFile: SourceFile;
}

export interface TargetCarrierResolutionEvidence {
  readonly message: string;
  readonly subject?: ExtensionFactSubject;
}

export interface TargetCarrierResolved {
  readonly kind: "resolved";
  readonly carrier: TargetTypeRef;
  readonly evidence: readonly TargetCarrierResolutionEvidence[];
}

export interface TargetCarrierMissing {
  readonly kind: "missing";
  readonly reason: string;
  readonly evidence: readonly TargetCarrierResolutionEvidence[];
}

export type TargetCarrierResolution = TargetCarrierResolved | TargetCarrierMissing;

export interface TargetCallParameterCarriersResolved {
  readonly kind: "resolved-parameters";
  readonly parameters: readonly TargetCarrierResolution[];
  readonly evidence: readonly TargetCarrierResolutionEvidence[];
}

export type TargetCallParameterCarrierResolution = TargetCallParameterCarriersResolved | TargetCarrierMissing;

export interface TargetProjectSourceReference {
  readonly symbol: Symbol;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
}

export interface TargetProjectSourceModuleDependency {
  readonly sourceFile: SourceFile;
  readonly declaration: Node;
  readonly moduleSpecifier: Node;
  readonly kind: "import" | "export";
}

export interface TargetProjectSourceMemberDispatch {
  readonly overridesBase: boolean;
  readonly hasDerivedOverride: boolean;
}

export interface TargetSourceAnalysisQueries {
  readonly lazy: TargetLazySourceAnalysis;
  getSymbolName(symbol: ExtensionFactSubject | undefined): string | undefined;
  getSymbolDeclarations(symbol: ExtensionFactSubject | undefined): readonly Node[];
  getSymbolAtLocation(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): Symbol | undefined;
  getResolvedSymbol(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): Symbol | undefined;
  getTypeSymbol(type: Type | undefined): Symbol | undefined;
  getTypeAliasSymbol(type: Type | undefined): Symbol | undefined;
  getTypeOfSymbol(symbol: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): Type | undefined;
  getTypeAtLocation(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): Type | undefined;
  getTypeFromTypeNode(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): Type | undefined;
  getResolvedCallReturnType(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): Type | undefined;
  getResolvedCallParameterDeclarations(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): readonly (Node | undefined)[] | undefined;
  getResolvedCallParameterTypes(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): readonly (Type | undefined)[] | undefined;
  getEnumMemberConstant(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): { readonly value: string | number | undefined } | undefined;
  isProjectSourceShapeForNode(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): boolean;
  isProjectSourceConstructibleObjectForNode(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): boolean;
  getProjectSourceDeclarationForNode(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): Node | undefined;
  getProjectSourceReferenceForNode(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): TargetProjectSourceReference | undefined;
  getProjectSourceModuleDependencies(sourceFile: SourceFile): readonly TargetProjectSourceModuleDependency[];
  getProjectSourceMemberDispatch(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): TargetProjectSourceMemberDispatch | undefined;
  describeTypeAtLocation(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): string | undefined;
}

export interface TargetFactQueries {
  resolveRuntimeCarrier(subject: ExtensionFactSubject | undefined): TargetCarrierResolution;
  resolveRuntimeCarrierForNode(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): TargetCarrierResolution;
  getTargetBinding(subject: ExtensionFactSubject | undefined): TargetBindingFact | undefined;
  getTargetBindingForReference(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): TargetBindingFact | undefined;
  resolveCallReturnRuntimeCarrier(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): TargetCarrierResolution;
  resolveCallParameterRuntimeCarriers(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): TargetCallParameterCarrierResolution;
  resolveDeclarationReturnCarrier(node: ExtensionFactSubject | undefined, options: TargetAnalysisNodeOptions): TargetCarrierResolution;
}

export interface TargetCompileInput {
  readonly program: Program;
  readonly ast: AstReader;
  readonly types: TypeShapeQueries;
  readonly sourceFiles: readonly SourceFile[];
  readonly facts: ExtensionConsumerQueries;
  readonly analysis: TargetSourceAnalysisQueries;
  readonly targetFacts: TargetFactQueries;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly runtimeReferences: readonly TargetRuntimeReference[];
  readonly paths: TargetCompilationPaths;
}

export interface TargetBackend {
  compile(input: TargetCompileInput): TargetCompileResult;
}

export interface TargetToolchainInput {
  readonly artifactsRoot: string;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly compileResult: TargetCompileResult;
}

export interface TargetToolchainResult {
  readonly diagnostics: readonly string[];
  readonly producedArtifacts: readonly string[];
}

export interface TargetToolchain {
  prepare(input: TargetToolchainInput): TargetToolchainResult;
}

export interface TargetProvider {
  readonly id: string;
  readonly displayName: string;
  readonly moduleOwnership?: readonly TargetProviderModuleOwnership[];
  sourceProfileContributions?(context: TargetProviderSourceProfileContext): TargetSourceProfileContributions;
  createExtensions(context: TargetProviderContext): readonly CompilerExtension[];
  runtimeContributions?(context: TargetRuntimeContributionContext): TargetRuntimeContributions;
}

export type TargetCapabilityImplementation = TsonicTargetCapabilityPlugin;
export type TargetCapabilityMapper = TargetCapabilityOperationMapper;
export type TargetCapabilityRuntimeContext = TargetCapabilityRuntimeContributionContext;

export interface TargetSurfaceImplementation {
  readonly id: TargetSurfaceId;
  readonly displayName: string;
  readonly requiredSurfaces?: readonly TargetSurfaceId[];
  sourceProfileContributions?(context: TargetSurfaceSourceProfileContext): TargetSourceProfileContributions;
  createExtensions?(context: TargetSurfaceExtensionContext): readonly CompilerExtension[];
  runtimeContributions(context: TargetRuntimeContributionContext): TargetRuntimeContributions;
}

export interface TargetPack {
  readonly id: string;
  readonly displayName: string;
  readonly provider?: TargetProvider;
  readonly surfaces?: readonly TargetSurfaceImplementation[];
  createBackend(context: TargetBackendContext): TargetBackend;
  createToolchain(context: TargetToolchainContext): TargetToolchain;
}
