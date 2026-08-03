import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Program } from "../internal/compiler/program.js";
export declare function createProgram(sourceText: string, settings?: {
    readonly noLib?: boolean;
    readonly fileName?: "index.ts" | "index.js";
    readonly checkJs?: boolean;
}): {
    readonly program: GoPtr<Program>;
    readonly index: GoPtr<SourceFile>;
};
export declare function assertCleanSemanticDiagnostics(program: GoPtr<Program>, sourceFile: GoPtr<SourceFile>): void;
export declare function findIdentifierByText(root: GoPtr<Node>, text: string, predicate: (node: GoPtr<Node>) => boolean): GoPtr<Node>;
export declare function findFirstNodeByKind(root: GoPtr<Node>, kind: number): GoPtr<Node>;
export declare function findNodesByKind(root: GoPtr<Node>, kind: number): readonly Node[];
export declare function findPropertyAccessByName(root: GoPtr<Node>, name: string, predicate: (node: GoPtr<Node>) => boolean): GoPtr<Node>;
//# sourceMappingURL=type-checker-test-support.d.ts.map