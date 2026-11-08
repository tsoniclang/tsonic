import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceDeclarationReference, SourceReferenceIndexStatistics } from "./types.js";
export interface SourceReferenceIndexLimits {
    readonly sourceFiles: number;
    readonly nodesVisited: number;
    readonly referenceCandidates: number;
    readonly selectedReferences: number;
    readonly selectedDeclarations: number;
    readonly reverseEdges: number;
    readonly moduleExportsExamined: number;
}
export interface SourceDeclarationReferenceIndex {
    readonly statistics: SourceReferenceIndexStatistics;
    sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
    referencesToDeclaration(declaration: Node | undefined): readonly Node[];
}
/**
 * The reverse reference index, built in one pass over the project files. Each reference occurrence is keyed by the
 * declaration host-input selects for it (I3); one canonical reference record per declaration.
 *
 * `ambientFiles` (the program's declaration files and provider modules) are indexed only at their ambient value
 * positions (Q113(1)): the expression of a computed property name (`[Symbol.iterator]`), an enum member initializer and
 * an export assignment's expression. Every other position of a declaration file stays unindexed.
 */
export declare function createSourceDeclarationReferenceIndex(input: SourceNavigationInput, sourceFiles: readonly SourceFile[], isProjectDeclaration: (declaration: Node | undefined) => boolean, requestedLimits?: SourceReferenceIndexLimits, ambientFiles?: readonly SourceFile[]): SourceDeclarationReferenceIndex;
//# sourceMappingURL=reference-index.d.ts.map