import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceNavigationCall, SourceNavigationMemberAccess } from "../source-model/navigation-records.js";
import type { SourceExpressionResultDisposition } from "./expression-use-model.js";

export type {
  SourceNavigationCall, SourceNavigationCallBinding, SourceNavigationMemberAccess, SourceNavigationSignatureParameter,
} from "../source-model/navigation-records.js";

// The checker-free navigation records are defined in records.ts and re-exported here for the Host.
export type * from "./records.js";
import type {
  SourceProjectReference, SourceProjectModuleDependency, SourceProjectModuleSpecifierResolution, SourceProjectModuleExport, SourceProjectMemberDispatch, SourceProjectMemberImplementationResult, SourceProjectMemberContractsResult, SourceCallableImplementationResult, SourceBindingWrite, SourceDeclarationReference, SourceReferenceIndexStatistics, SourceDeclarationUse, SourceDeclarationUseSummary, SourceParameterUseSummary, SourceCountedLoop, SourceExpressionValueFlowSummary, SourceClassConstructorResult, SourceDeclaredHeritageResult, SourceHeritagePathResult,
} from "./records.js";

export interface SourceProgramNavigation {
  readonly sourceFiles: readonly SourceFile[];
  readonly nodes: readonly Node[];
  nodesForFiles(sourceFiles: readonly SourceFile[]): readonly Node[];
  readonly referenceIndexStatistics: SourceReferenceIndexStatistics;
  sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
  referenceFor(node: Node | undefined): SourceProjectReference | undefined;
  declarationFor(node: Node | undefined): Node | undefined;
  moduleDependencies(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
  moduleReferences(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
  moduleSpecifierResolution(
    moduleSpecifier: Node,
  ): SourceProjectModuleSpecifierResolution;
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
  /** All declarations of the entity a declaration declares (overloads, merged declarations, accessor pairs). */
  mergedDeclarations(declaration: Node): readonly Node[];
  /** Writes of the binding a declaration declares (any of its merged declarations) within a subtree. */
  bindingWritesWithin(declaration: Node, root: Node): readonly SourceBindingWrite[];
  referencesWithin(declaration: Node, root: Node): readonly Node[];
  referencesToDeclaration(declaration: Node): readonly Node[];
  declarationUses(declaration: Node): readonly SourceDeclarationUse[];
  declarationUseSummary(declaration: Node): SourceDeclarationUseSummary;
  parameterUseSummary(parameter: Node): SourceParameterUseSummary | undefined;
  countedLoop(statement: Node): SourceCountedLoop | undefined;
  expressionValueFlow(expression: Node): SourceExpressionValueFlowSummary;
  expressionResultUse(expression: Node): "consumed" | "discarded";
  expressionResultDisposition(expression: Node): SourceExpressionResultDisposition;
  hasReferenceOutside(declaration: Node, excludedNode: Node): boolean;
  isProjectDeclaration(node: Node | undefined): boolean;
  /** The checker selection at a call, `new`, tagged template or `super(...)`, as declarations (host-input). */
  call(use: Node): SourceNavigationCall | undefined;
  /** The checker member selection at a property or element access, as declarations (host-input). */
  memberAccess(access: Node): SourceNavigationMemberAccess | undefined;
  /** Parameters of a callable declaration's own declared signature; undefined when it declares none. */
  declaredParameters(declaration: Node): readonly Node[] | undefined;
}
