import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
export type SourceSubtreeParticipation = {
    readonly kind: "resolved";
    readonly nodes: readonly Node[];
} | {
    readonly kind: "unresolved";
    readonly reason: string;
};
type SourceLexicalFunctionNavigation = Pick<SourceProgramNavigation, "declarationUseSummary" | "mergedDeclarations" | "referencesWithin" | "sourceReferenceFor" | "callableImplementation">;
export interface SourceCallableInvocationReference {
    readonly referenceDeclaration: Node | undefined;
    readonly directDeclaration: boolean;
    readonly directModule: boolean;
    readonly directLexical: boolean;
    readonly callAlias: boolean;
    readonly nativeFunction: boolean;
}
export declare function createSourceCallableInvocationReferenceQuery(input: {
    readonly ast: AstReader;
    readonly navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "callableImplementation">;
    readonly nativeCallableFor: (binding: Node) => Node | undefined;
    readonly lexicalBindingFor: (declaration: Node) => Node | undefined;
    readonly callAliasFor: (binding: Node) => Node | undefined;
}): {
    forTarget(callee: Node, declaration: Node): SourceCallableInvocationReference;
};
export declare function sourceNodesOutsideErasedSubtrees(ast: Pick<AstReader, "parent">, nodes: readonly Node[], isErased: (node: Node) => boolean): SourceSubtreeParticipation;
export declare function sourceLexicalFunctionIsUnused(declaration: Node, ast: AstReader, navigation: SourceLexicalFunctionNavigation): boolean;
export declare function createSourceSingleInvocationQuery(ast: AstReader, navigation: SourceLexicalFunctionNavigation): (declaration: Node) => boolean;
export {};
//# sourceMappingURL=callable-invocations.d.ts.map