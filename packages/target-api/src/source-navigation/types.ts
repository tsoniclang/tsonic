import type {
  Node,
  Signature,
  SourceFile,
  Symbol,
  Type,
} from "@tsonic/tsts";

export interface SourceProjectReference {
  readonly symbol: Symbol;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
}

export interface SourceProjectModuleDependency {
  readonly sourceFile: SourceFile;
  readonly declaration: Node;
  readonly moduleSpecifier: Node;
  readonly kind: "import" | "export";
}

export interface SourceProjectModuleExport {
  readonly exportName: string;
  readonly symbol: Symbol;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
}

export interface SourceProjectMemberDispatch {
  readonly overridesBase: boolean;
  readonly hasDerivedOverride: boolean;
}

export type SourceProjectMemberImplementationResult =
  | {
      readonly kind: "resolved";
      readonly contractDeclaration: Node;
      readonly implementation: SourceDeclarationReference;
    }
  | { readonly kind: "unrelated" }
  | {
      readonly kind: "unresolved";
      readonly reason: string;
    };

export type SourceProjectMemberContractsResult =
  | {
      readonly kind: "resolved";
      readonly implementationDeclaration: Node;
      readonly contracts: readonly Node[];
    }
  | {
      readonly kind: "unresolved";
      readonly declaration: Node;
      readonly reason: string;
    };

export type SourceCallableImplementationResult =
  SourceProjectMemberImplementationResult;

export interface SourceBindingWrite {
  readonly reference: Node;
  readonly operation: Node;
  readonly kind: "assignment" | "update" | "iteration";
}

export interface SourceDeclarationReference {
  readonly symbol?: Symbol;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
  readonly project: boolean;
}

export interface SourceReferenceIndexStatistics {
  readonly constructionPasses: 1;
  readonly sourceFiles: number;
  readonly nodesVisited: number;
  readonly referenceCandidates: number;
  readonly selectedReferences: number;
  readonly selectedDeclarations: number;
  readonly reverseEdges: number;
  readonly indexedSymbols: number;
  readonly moduleExportsExamined: number;
}

export interface SourceExpressionEffects {
  readonly invokes: boolean;
  readonly mutates: boolean;
  readonly suspends: boolean;
  readonly mayThrow: boolean;
}

export interface SourceDeclarationUse {
  readonly reference: Node;
  readonly memberReceiver?: Node;
  readonly kind: "direct-call" | "first-class" | "source-linkage" | "type-only";
  readonly role:
    | "call-target"
    | "receiver"
    | "argument"
    | "return"
    | "yield"
    | "write"
    | "storage"
    | "comparison"
    | "condition"
    | "value"
    | "source-linkage"
    | "type-only";
  readonly captured: boolean;
  readonly throughMember: boolean;
}

export type SourceValueEscapeKind =
  | "argument"
  | "capture"
  | "export"
  | "return"
  | "storage"
  | "yield";

export interface SourceDeclarationUseSummary {
  readonly declaration: Node;
  readonly uses: readonly SourceDeclarationUse[];
  readonly directCallCount: number;
  readonly firstClassUseCount: number;
  readonly bindingWritten: boolean;
  readonly memberWritten: boolean;
  readonly constructorInitialized: boolean;
  readonly mutatedAfterInitialization: boolean;
  readonly receiverUsed: boolean;
  readonly identityCompared: boolean;
  readonly conditionallyRead: boolean;
  readonly aliasedOrStored: boolean;
  readonly captured: boolean;
  readonly exported: boolean;
  readonly escapeKinds: readonly SourceValueEscapeKind[];
  readonly hasUnclassifiedValueUse: boolean;
}

export interface SourceParameterUseSummary extends SourceDeclarationUseSummary {
  readonly kind: "parameter";
  readonly passedAsArgument: boolean;
  readonly returned: boolean;
  readonly yielded: boolean;
}

export interface SourceCountedLoop {
  readonly statement: Node;
  readonly counterDeclaration: Node;
  readonly counterSymbol: Symbol;
  readonly start: Node;
  readonly bound: Node;
  readonly body: Node;
  readonly direction: "ascending";
  readonly comparison: "exclusive-upper-bound";
  readonly step: 1;
}

export interface SourceExpressionValueFlowSummary {
  readonly expression: Node;
  readonly aliasDeclarations: readonly Node[];
  readonly uses: readonly SourceDeclarationUse[];
  readonly bindingAliased: boolean;
  readonly memberWritten: boolean;
  readonly receiverUsed: boolean;
  readonly identityCompared: boolean;
  readonly captured: boolean;
  readonly returned: boolean;
  readonly yielded: boolean;
  readonly passedAsArgument: boolean;
  readonly storedOutsideBinding: boolean;
  readonly exported: boolean;
  readonly discarded: boolean;
  readonly hasUnclassifiedUse: boolean;
  readonly escapes: boolean;
}

export interface SourceDeclaredHeritageEdge {
  readonly kind: "extends" | "implements";
  readonly sourceDeclaration: Node;
  readonly heritage: Node;
  readonly target: SourceDeclarationReference;
  readonly typeArguments: readonly Node[];
  readonly selectedType: Type;
  readonly selectedTypeArguments: readonly Type[];
}

export interface SourceClassConstructorParameter {
  readonly parameterIndex: number;
  readonly parameterName: string;
  readonly parameterSymbol: Symbol;
  readonly parameterDeclaration: Node;
  readonly authoredTypeNode?: Node;
  readonly selectedType: Type;
  readonly acceptsOmission: boolean;
  readonly rest: boolean;
}

export interface SourceClassConstructorSignature {
  readonly signature: Signature;
  readonly declaration?: Node;
  readonly parameters: readonly SourceClassConstructorParameter[];
}

export type SourceClassConstructorResult =
  | {
      readonly kind: "resolved";
      readonly declaration: Node;
      readonly implicit: boolean;
      readonly signatures: readonly SourceClassConstructorSignature[];
    }
  | {
      readonly kind: "unresolved";
      readonly declaration: Node;
      readonly reason: string;
    };

export type SourceDeclaredHeritageResult =
  | {
      readonly kind: "resolved";
      readonly edges: readonly SourceDeclaredHeritageEdge[];
    }
  | {
      readonly kind: "unresolved";
      readonly heritage: Node;
      readonly reason: string;
    };

export type SourceHeritagePathResult =
  | {
      readonly kind: "related";
      readonly edges: readonly SourceDeclaredHeritageEdge[];
    }
  | { readonly kind: "unrelated" }
  | {
      readonly kind: "unresolved";
      readonly heritage: Node;
      readonly reason: string;
    };

export interface SourceProgramNavigation {
  readonly sourceFiles: readonly SourceFile[];
  readonly referenceIndexStatistics: SourceReferenceIndexStatistics;
  sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
  referenceFor(node: Node | undefined): SourceProjectReference | undefined;
  declarationFor(node: Node | undefined): Node | undefined;
  moduleDependencies(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
  moduleReferences(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
  moduleExports(sourceFile: SourceFile): readonly SourceProjectModuleExport[];
  moduleHasTopLevelAwait(sourceFile: SourceFile): boolean;
  memberDispatch(node: Node | undefined): SourceProjectMemberDispatch | undefined;
  memberImplementation(
    classDeclaration: Node,
    contractMemberDeclaration: Node,
  ): SourceProjectMemberImplementationResult;
  memberContracts(
    implementationDeclaration: Node,
  ): SourceProjectMemberContractsResult;
  callableImplementation(
    contractDeclaration: Node,
  ): SourceCallableImplementationResult;
  classConstructors(declaration: Node): SourceClassConstructorResult;
  declaredHeritage(declaration: Node): SourceDeclaredHeritageResult;
  declaredHeritagePath(
    sourceDeclaration: Node,
    targetDeclaration: Node,
  ): SourceHeritagePathResult;
  bindingWritesWithin(symbol: Symbol, root: Node): readonly SourceBindingWrite[];
  referencesWithin(symbol: Symbol, root: Node): readonly Node[];
  referencesToDeclaration(declaration: Node): readonly Node[];
  declarationUses(declaration: Node): readonly SourceDeclarationUse[];
  declarationUseSummary(declaration: Node): SourceDeclarationUseSummary;
  parameterUseSummary(parameter: Node): SourceParameterUseSummary | undefined;
  countedLoop(statement: Node): SourceCountedLoop | undefined;
  expressionValueFlow(expression: Node): SourceExpressionValueFlowSummary;
  expressionResultUse(expression: Node): "consumed" | "discarded";
  expressionEffects(expression: Node): SourceExpressionEffects;
  hasReferenceOutside(symbol: Symbol, excludedNode: Node): boolean;
  isProjectShape(node: Node | undefined): boolean;
  isProjectConstructibleObject(node: Node | undefined): boolean;
  isProjectDeclaration(node: Node | undefined): boolean;
}
