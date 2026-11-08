import type { AstReader, Node } from "@tsonic/tsts";
type LexicalThisAstReader = Pick<AstReader, "body" | "children" | "kindName">;
export declare function sourceCallableUsesLexicalThis(ast: LexicalThisAstReader, callable: Node): boolean;
export declare function sourceExpressionUsesLexicalThis(ast: Pick<LexicalThisAstReader, "children" | "kindName">, expression: Node): boolean;
export {};
//# sourceMappingURL=lexical-this.d.ts.map