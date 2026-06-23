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
import type { TargetArtifact, TargetCompileResult } from "./artifacts.js";
import type {
  TargetSelection,
  TargetSurfaceId,
  TsonicProjectConfig,
} from "./config.js";

export interface TargetProviderContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
}

export interface TargetSurfaceExtensionContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
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

export interface TargetRuntimeArtifactContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly paths: TargetCompilationPaths;
}

export interface TargetSemanticNodeOptions {
  readonly sourceFile: SourceFile;
}

export interface TargetProjectSourceReference {
  readonly symbol: Symbol;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
}

export interface TargetProjectSourceMethodDispatch {
  readonly overridesBase: boolean;
  readonly hasDerivedOverride: boolean;
}

export interface TargetSemanticQueries {
  getRuntimeCarrier(subject: ExtensionFactSubject | undefined): TargetTypeRef | undefined;
  getRuntimeCarrierForNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): TargetTypeRef | undefined;
  getTargetBinding(subject: ExtensionFactSubject | undefined): TargetBindingFact | undefined;
  getTargetBindingForReference(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): TargetBindingFact | undefined;
  getSymbolAtLocation(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): Symbol | undefined;
  getResolvedSymbol(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): Symbol | undefined;
  getTypeOfSymbol(symbol: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): Type | undefined;
  getTypeAtLocation(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): Type | undefined;
  getTypeFromTypeNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): Type | undefined;
  getResolvedCallReturnType(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): Type | undefined;
  getResolvedCallReturnRuntimeCarrier(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): TargetTypeRef | undefined;
  getResolvedCallParameterDeclarations(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): readonly (Node | undefined)[] | undefined;
  getResolvedCallParameterTypes(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): readonly (Type | undefined)[] | undefined;
  getResolvedCallParameterRuntimeCarriers(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): readonly (TargetTypeRef | undefined)[] | undefined;
  getEnumMemberConstant(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): { readonly value: string | number | undefined } | undefined;
  getReturnTypeCarrierFromDeclaration(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): TargetTypeRef | undefined;
  isProjectSourceShapeForNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): boolean;
  isProjectSourceConstructibleObjectForNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): boolean;
  getProjectSourceDeclarationForNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): Node | undefined;
  getProjectSourceReferenceForNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): TargetProjectSourceReference | undefined;
  getProjectSourceMethodDispatch(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): TargetProjectSourceMethodDispatch | undefined;
  describeTypeAtLocation(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): string | undefined;
}

export interface TargetCompileInput {
  readonly program: Program;
  readonly ast: AstReader;
  readonly types: TypeShapeQueries;
  readonly sourceFiles: readonly SourceFile[];
  readonly facts: ExtensionConsumerQueries;
  readonly semantics: TargetSemanticQueries;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
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
  createExtensions(context: TargetProviderContext): readonly CompilerExtension[];
  runtimeArtifacts?(context: TargetRuntimeArtifactContext): readonly TargetArtifact[];
}

export interface TargetSurfaceImplementation {
  readonly id: TargetSurfaceId;
  readonly displayName: string;
  readonly requiredSurfaces?: readonly TargetSurfaceId[];
  createExtensions?(context: TargetSurfaceExtensionContext): readonly CompilerExtension[];
  runtimeArtifacts(context: TargetRuntimeArtifactContext): readonly TargetArtifact[];
}

export interface TargetPack {
  readonly id: string;
  readonly displayName: string;
  readonly provider?: TargetProvider;
  readonly surfaces?: readonly TargetSurfaceImplementation[];
  createBackend(context: TargetBackendContext): TargetBackend;
  createToolchain(context: TargetToolchainContext): TargetToolchain;
}
