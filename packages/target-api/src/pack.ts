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
import type { TargetCompileResult } from "./artifacts.js";
import type { TargetSelection, TsonicProjectConfig } from "./config.js";

export interface TargetExtensionContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
}

export interface TargetBackendContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
}

export interface TargetCompilationPaths {
  readonly projectFilePath: string;
  readonly projectRoot: string;
  readonly outputRoot: string;
  readonly targetOutputRoot: string;
}

export interface TargetSemanticNodeOptions {
  readonly sourceFile: SourceFile;
}

export interface TargetProjectSourceReference {
  readonly symbol: Symbol;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
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
  getEnumMemberConstant(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): { readonly value: string | number | undefined } | undefined;
  getReturnTypeCarrierFromDeclaration(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): TargetTypeRef | undefined;
  isProjectSourceShapeForNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): boolean;
  isProjectSourceConstructibleObjectForNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): boolean;
  getProjectSourceDeclarationForNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): Node | undefined;
  getProjectSourceReferenceForNode(node: ExtensionFactSubject | undefined, options: TargetSemanticNodeOptions): TargetProjectSourceReference | undefined;
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

export interface TargetPack {
  readonly id: string;
  readonly displayName: string;
  createExtensions(context: TargetExtensionContext): readonly CompilerExtension[];
  createBackend(context: TargetBackendContext): TargetBackend;
  createToolchain(context: TargetBackendContext): TargetToolchain;
}
