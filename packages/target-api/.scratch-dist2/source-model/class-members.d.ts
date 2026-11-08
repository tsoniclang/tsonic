import type { AstReader, Node } from "@tsonic/tsts";
export declare function sourceClassFieldIsTypeOnly(ast: AstReader, declaration: Node): boolean;
export declare function sourceClassFieldHasStorage(ast: AstReader, declaration: Node): boolean;
export declare function sourceParameterIsProperty(ast: AstReader, declaration: Node): boolean;
export declare function sourceObjectMemberDeclarations(ast: AstReader, declaration: Node): readonly (Node | undefined)[];
export declare function sourceMemberOwner(ast: AstReader, declaration: Node): Node | undefined;
//# sourceMappingURL=class-members.d.ts.map