import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
export declare function sourceFileIdentity(ast: AstReader, sourceFile: SourceFile | undefined): string | undefined;
export declare function sourceNodeIdentity(ast: AstReader, node: Node | undefined): string | undefined;
export declare function projectSourceNodeIdentity(ast: AstReader, node: Node | undefined, projectRoot: string): string | undefined;
export declare function sourceNodesEqual(ast: AstReader, left: Node | undefined, right: Node | undefined): boolean;
//# sourceMappingURL=identity.d.ts.map