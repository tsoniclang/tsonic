import type { SourceAnalysisProgram } from "./analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceBindingWrite, SourceCallableImplementationResult, SourceCountedLoop, SourceDeclarationReference, SourceDeclarationUseSummary, SourceDeclaredHeritageResult, SourceExpressionEffects, SourceProjectMemberContractsResult, SourceProjectMemberDispatch, SourceProjectModuleDependency, SourceProjectModuleExport, SourceProjectReference } from "../source-navigation/index.js";
export interface TargetPlanningSourceNavigation {
    readonly sourceFiles: readonly SourceFile[];
    sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
    referenceFor(node: Node | undefined): SourceProjectReference | undefined;
    declarationFor(node: Node | undefined): Node | undefined;
    moduleDependencies(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
    moduleReferences(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
    moduleExports(sourceFile: SourceFile): readonly SourceProjectModuleExport[];
    moduleHasTopLevelAwait(sourceFile: SourceFile): boolean;
    memberDispatch(node: Node | undefined): SourceProjectMemberDispatch | undefined;
    memberContracts(node: Node): SourceProjectMemberContractsResult;
    callableImplementation(node: Node): SourceCallableImplementationResult;
    declaredHeritage(node: Node): SourceDeclaredHeritageResult;
    /** Writes of the binding a declaration declares, within root (keyed by declaration, B3 D1). */
    bindingWritesWithin(declaration: Node, root: Node): readonly SourceBindingWrite[];
    declarationUseSummary(node: Node): SourceDeclarationUseSummary;
    countedLoop(node: Node): SourceCountedLoop | undefined;
    expressionEffects(node: Node): SourceExpressionEffects;
    isProjectConstructibleObject(node: Node | undefined): boolean;
    isProjectDeclaration(node: Node | undefined): boolean;
}
export declare function snapshotTargetPlanningSourceNavigation(source: SourceAnalysisProgram): TargetPlanningSourceNavigation;
//# sourceMappingURL=source-navigation-snapshot.d.ts.map