import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceDeclarationReference, SourceProjectReference, SourceReferenceIndexStatistics } from "./types.js";
export interface SourceReferenceNavigation {
    readonly referenceIndexStatistics: SourceReferenceIndexStatistics;
    sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
    referenceFor(node: Node | undefined): SourceProjectReference | undefined;
    declarationFor(node: Node | undefined): Node | undefined;
    referencesToDeclaration(declaration: Node | undefined): readonly Node[];
    /** References to every merged declaration of the entity `declaration` declares. */
    referencesToEntity(declaration: Node): readonly Node[];
    isProjectDeclaration(node: Node | undefined): boolean;
}
/**
 * Reference navigation over the reference index. A reference is the declaration the occurrence selects; there is no
 * fallback through the checked type of the node (R3): a node that selects no declaration has no reference.
 */
export declare function createSourceReferenceNavigation(input: SourceNavigationInput, sourceFiles: readonly SourceFile[], ambientFiles?: readonly SourceFile[]): SourceReferenceNavigation;
//# sourceMappingURL=references.d.ts.map