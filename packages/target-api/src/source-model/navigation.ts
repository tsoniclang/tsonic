import type { Node, ProviderVirtualDeclarationFact, SourceFile } from "@tsonic/tsts";
import type { SourcePresence, SourceResult, SourceSignatureIdentity, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceCallableRole, SourceCallableRoles } from "../source-navigation/callable-boundaries.js";
import type { SourceExpressionResultDisposition } from "../source-navigation/expression-use-model.js";
import type { SourceProfileDeclarationIdentity } from "../target-analysis/source-profile-identity.js";

export interface SourceNodeReference {
  readonly meaning: "value" | "type" | "namespace";
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
  readonly project: boolean;
}

export interface SourceNodeModuleDependency {
  readonly sourceFile: SourceFile;
  readonly declaration: Node;
  readonly moduleSpecifier: Node;
  readonly kind: "import" | "export";
}

export type SourceNodeModuleResolution =
  | { readonly kind: "project"; readonly sourceFile: SourceFile; readonly moduleSpecifier: Node }
  | { readonly kind: "non-project" | "unresolved"; readonly moduleSpecifier: Node };

export interface SourceNodeModuleExport {
  readonly exportName: string;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
}

export type SourceNodeMemberImplementation =
  | { readonly kind: "resolved"; readonly contractDeclaration: Node; readonly implementation: SourceNodeReference }
  | { readonly kind: "unrelated" }
  | { readonly kind: "unresolved"; readonly reason: string };

export type SourceNodeMemberContracts =
  | { readonly kind: "resolved"; readonly implementationDeclaration: Node; readonly contracts: readonly Node[] }
  | { readonly kind: "unresolved"; readonly declaration: Node; readonly reason: string };

export interface SourceNodeWriteValue {
  readonly kind: "value" | "iteration-value" | "iteration-key";
  readonly expression: Node;
  readonly projection: readonly Node[];
}

export interface SourceNodeWrite {
  readonly reference: Node;
  readonly operation: Node;
  readonly kind: "assignment" | "update" | "iteration" | "initialization" | "deletion";
  readonly values: readonly SourceNodeWriteValue[];
}

export interface SourceNodeUse {
  readonly reference: Node;
  readonly memberReceiver?: Node;
  readonly kind: "direct-call" | "first-class" | "source-linkage" | "type-only";
  readonly role: "call-target" | "receiver" | "argument" | "return" | "yield" | "write" | "storage"
    | "comparison" | "condition" | "value" | "source-linkage" | "type-only";
  readonly captured: boolean;
  readonly throughMember: boolean;
}

export interface SourceNodeUseSummary {
  readonly declaration: Node;
  readonly uses: readonly SourceNodeUse[];
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
  readonly escapeKinds: readonly SourceNodeEscapeKind[];
  readonly hasUnclassifiedValueUse: boolean;
}

export type SourceNodeEscapeKind = "argument" | "capture" | "export" | "return" | "storage" | "yield";

export interface SourceNodeParameterUseSummary extends SourceNodeUseSummary {
  readonly kind: "parameter";
  readonly passedAsArgument: boolean;
  readonly returned: boolean;
  readonly yielded: boolean;
}

export interface SourceNodeEffects {
  readonly invokes: boolean;
  readonly mutates: boolean;
  readonly suspends: boolean;
  readonly mayThrow: boolean;
}

export interface SourceNodeCountedLoop {
  readonly statement: Node;
  readonly counterDeclaration: Node;
  readonly start: Node;
  readonly bound: Node;
  readonly body: Node;
  readonly direction: "ascending";
  readonly comparison: "exclusive-upper-bound";
  readonly step: 1;
}

export interface SourceNodeReferenceIndexStatistics {
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

export interface SourceNodeValueFlow {
  readonly expression: Node;
  readonly aliasDeclarations: readonly Node[];
  readonly uses: readonly SourceNodeUse[];
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

export interface SourceNodeHeritageEdge {
  readonly kind: "extends" | "implements";
  readonly sourceDeclaration: Node;
  readonly heritage: Node;
  readonly target: SourceNodeReference;
  readonly typeArguments: readonly Node[];
  readonly selected: SourceTypeEvidence;
  readonly arguments: readonly SourceTypeEvidence[];
}

export type SourceNodeHeritage =
  | { readonly kind: "resolved"; readonly edges: readonly SourceNodeHeritageEdge[] }
  | { readonly kind: "unresolved"; readonly heritage: Node; readonly reason: string };

export interface SourceNodeConstructorSignature {
  readonly identity: SourceSignatureIdentity;
  readonly base: SourcePresence<{ readonly declaration: Node; readonly identity: SourceSignatureIdentity }>;
  readonly parameters: readonly {
    readonly parameterIndex: number;
    readonly parameterName: string;
    readonly parameterDeclaration: Node | undefined;
    readonly authoredTypeNode?: Node;
    readonly value: SourceTypeEvidence;
    readonly acceptsOmission: boolean;
    readonly rest: boolean;
  }[];
}

export type SourceNodeConstructors =
  | { readonly kind: "resolved"; readonly declaration: Node; readonly witness: "implicit" | "declared";
      readonly signatures: readonly SourceNodeConstructorSignature[] }
  | { readonly kind: "unresolved"; readonly declaration: Node; readonly reason: string };

export interface SourceNodeNavigationFacts {
  readonly sourceFiles: readonly SourceFile[];
  readonly nodes: readonly Node[];
  readonly referenceIndexStatistics: SourceNodeReferenceIndexStatistics;
  includes(node: Node): boolean;
  callableRoles(node: Node): SourceCallableRoles;
  enclosing(node: Node | undefined, role: SourceCallableRole): Node | undefined;
  nodesForFiles(files: readonly SourceFile[]): readonly Node[];
  sourceReferenceFor(node: Node | undefined): SourceNodeReference | undefined;
  referenceFor(node: Node | undefined): SourceNodeReference | undefined;
  declarationFor(node: Node | undefined): Node | undefined;
  moduleDependencies(file: SourceFile): readonly SourceNodeModuleDependency[];
  moduleReferences(file: SourceFile): readonly SourceNodeModuleDependency[];
  moduleSpecifierResolution(specifier: Node): SourceNodeModuleResolution;
  moduleExports(file: SourceFile): readonly SourceNodeModuleExport[];
  moduleHasTopLevelAwait(file: SourceFile): boolean;
  memberDispatch(node: Node | undefined): { readonly overridesBase: boolean; readonly hasDerivedOverride: boolean } | undefined;
  memberImplementation(declaration: Node, contract: Node): SourceNodeMemberImplementation;
  memberContracts(declaration: Node): SourceNodeMemberContracts;
  callableImplementation(declaration: Node): SourceNodeMemberImplementation;
  classConstructors(declaration: Node): SourceResult<SourceNodeConstructors>;
  declaredHeritage(declaration: Node): SourceResult<SourceNodeHeritage>;
  declaredHeritagePath(source: Node, target: Node): SourceResult<SourceNodeHeritage | { readonly kind: "unrelated" }>;
  declarationWrites(declaration: Node, root: Node): readonly SourceNodeWrite[];
  referencesToDeclaration(declaration: Node): readonly Node[];
  declarationUses(declaration: Node): readonly SourceNodeUse[];
  declarationUseSummary(declaration: Node): SourceNodeUseSummary;
  parameterUseSummary(parameter: Node): SourceNodeParameterUseSummary | undefined;
  countedLoop(statement: Node): SourceNodeCountedLoop | undefined;
  expressionValueFlow(expression: Node): SourceNodeValueFlow;
  expressionResultUse(expression: Node): "consumed" | "discarded";
  expressionResultDisposition(expression: Node): SourceExpressionResultDisposition;
  expressionEffects(expression: Node): SourceNodeEffects;
  hasReferenceOutside(declaration: Node, excluded: Node): boolean;
  isProjectShape(node: Node | undefined): boolean;
  isProjectConstructibleObject(node: Node | undefined): boolean;
  isProjectDeclaration(node: Node | undefined): boolean;
  providerDeclaration(node: Node): SourcePresence<ProviderVirtualDeclarationFact>;
  profileDeclaration(node: Node): SourcePresence<SourceProfileDeclarationIdentity>;
}
