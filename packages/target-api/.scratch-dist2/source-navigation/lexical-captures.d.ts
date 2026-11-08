import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
export interface SourceLexicalCapture {
    readonly declaration: Node;
    readonly references: readonly Node[];
}
export interface SourceLexicalCaptureSelection {
    readonly captures: readonly SourceLexicalCapture[];
    readonly selfReferences: readonly Node[];
    readonly receivers: readonly {
        readonly owner: Node;
        readonly references: readonly Node[];
    }[];
}
export type SourceNodeDomain = "source" | {
    readonly has: (node: Node) => boolean;
};
export declare function sourceLexicalCaptures(scope: Node, roots: readonly Node[], ast: AstReader, navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">, domain: SourceNodeDomain, step?: (node?: Node) => void): SourceLexicalCaptureSelection;
/**
 * The published lexical capture query (`facts.analyses.lexicalCaptures`): the full selection of an owner over the whole
 * owner (roots `[owner]`), with every captured binding's references, the owner's self references and the captured outer
 * receivers. Keyed by declaration Node; references resolve through the reference index (no Symbol, I3). One memo table
 * per program view (I5). The owner domain is exactly the role union `callable-body` ∪ `class-scope` of a project
 * declaration (callable-boundaries.ts); an owner outside it is an invariant failure. `navigation.scopes.captures` is a
 * projection of this selection (roles.ts), so both answer from one selection.
 */
export declare function createSourceLexicalCaptureQuery(ast: AstReader, navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "isProjectDeclaration">): (owner: Node) => SourceLexicalCaptureSelection;
export declare function sourceDeclarationIsModuleScoped(declaration: Node, ast: AstReader, step?: (node?: Node) => void): boolean;
export declare function sourceBindingScope(declaration: Node, ast: AstReader): Node | undefined;
export declare function sourceBindingIterationScope(declaration: Node, ast: AstReader): Node | undefined;
//# sourceMappingURL=lexical-captures.d.ts.map