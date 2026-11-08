import type { AstReader, Node } from "@tsonic/tsts";
export type SourceReferenceMeaning = "value" | "type" | "namespace";
export declare function sourceReferenceMeaning(ast: AstReader, node: Node): SourceReferenceMeaning;
export declare function isTypeSyntaxNode(ast: AstReader, node: Node): boolean;
export declare function referenceQueryNode(ast: AstReader, node: Node): Node | undefined;
//# sourceMappingURL=syntax.d.ts.map