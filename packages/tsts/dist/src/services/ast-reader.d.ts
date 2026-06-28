import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Kind } from "../internal/ast/generated/kinds.js";
import * as casts from "../internal/ast/generated/casts.js";
import * as predicates from "../internal/ast/generated/predicates.js";
import type { ModifierFlags } from "../internal/ast/modifierflags.js";
export interface AstReader {
    readonly kind: (node: GoPtr<Node>) => Kind | undefined;
    readonly kindName: (node: GoPtr<Node>) => string;
    readonly text: (node: GoPtr<Node>) => string;
    readonly name: (node: GoPtr<Node>) => GoPtr<Node>;
    readonly body: (node: GoPtr<Node>) => GoPtr<Node>;
    readonly parent: (node: GoPtr<Node>) => GoPtr<Node>;
    readonly children: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly forEachChild: (node: GoPtr<Node>, callback: (child: GoPtr<Node>) => void) => void;
    readonly statements: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly members: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly parameters: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly typeParameters: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly typeArguments: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly arguments: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly elements: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly properties: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly modifiers: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly modifierFlags: (node: GoPtr<Node>) => ModifierFlags;
    readonly hasModifier: (node: GoPtr<Node>, flags: ModifierFlags) => boolean;
    readonly pos: (node: GoPtr<Node>) => number;
    readonly end: (node: GoPtr<Node>) => number;
    readonly getSourceFile: (node: GoPtr<Node>) => GoPtr<SourceFile>;
    readonly getFileName: (sourceFile: GoPtr<SourceFile>) => string;
    readonly getPath: (sourceFile: GoPtr<SourceFile>) => string;
    readonly getSourceText: (sourceFile: GoPtr<SourceFile>) => string;
    readonly is: typeof predicates;
    readonly as: typeof casts;
}
export declare function createAstReader(): AstReader;
//# sourceMappingURL=ast-reader.d.ts.map