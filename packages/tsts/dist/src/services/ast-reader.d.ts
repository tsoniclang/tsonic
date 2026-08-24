import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Kind } from "../internal/ast/generated/kinds.js";
import * as casts from "../internal/ast/generated/casts.js";
import * as predicates from "../internal/ast/generated/predicates.js";
export type AstModifierKind = "public" | "private" | "protected" | "readonly" | "override" | "export" | "abstract" | "ambient" | "static" | "async" | "default" | "const";
export type AstVariableDeclarationKind = "var" | "let" | "const" | "using" | "await using";
export interface AstRegularExpressionLiteralSyntax {
    readonly pattern: string;
    readonly flags: string;
}
export type AstAuthoredRange = {
    readonly kind: "authored";
    readonly start: number;
    readonly end: number;
} | {
    readonly kind: "synthetic";
};
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
    /** Returns the exact authored type node owned by syntax whose TS-Go schema permits one. */
    readonly typeNode: (node: GoPtr<Node>) => GoPtr<Node>;
    readonly typeParameters: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly typeArguments: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly arguments: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly elements: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly properties: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    /** Returns the exact `?` token owned by nodes whose schema permits one. */
    readonly questionToken: (node: GoPtr<Node>) => GoPtr<Node>;
    /** Returns the exact operator kind name for binary, update, and type-operator syntax. */
    readonly operatorKindName: (node: GoPtr<Node>) => string | undefined;
    readonly modifiers: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly modifierFlags: (node: GoPtr<Node>) => number;
    readonly hasModifier: (node: GoPtr<Node>, flags: number) => boolean;
    /** Tests syntactic modifiers. `"const"` means the `const enum` modifier, not a variable declaration kind. */
    readonly hasModifierKind: (node: GoPtr<Node>, kind: AstModifierKind) => boolean;
    /** Classifies a variable statement, declaration list, or direct variable declaration. */
    readonly variableDeclarationKind: (node: GoPtr<Node>) => AstVariableDeclarationKind | undefined;
    /** Uses TS-Go's canonical grammar predicate for `as const` and `<const>` assertions. */
    readonly isConstAssertion: (node: GoPtr<Node>) => boolean;
    /** Returns the exact authored pattern and flags stored by a TS-Go regular-expression literal. */
    readonly regularExpressionLiteral: (node: GoPtr<Node>) => AstRegularExpressionLiteralSyntax | undefined;
    readonly heritageElements: (node: GoPtr<Node>, kind: "extends" | "implements") => readonly GoPtr<Node>[];
    readonly extendsHeritageElements: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly implementsHeritageElements: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
    readonly isTypeOnlyImportDeclaration: (node: GoPtr<Node>) => boolean;
    readonly isTypeOnlyImportOrExportDeclaration: (node: GoPtr<Node>) => boolean;
    readonly pos: (node: GoPtr<Node>) => number;
    readonly end: (node: GoPtr<Node>) => number;
    /** Returns trivia-free UTF-16 offsets into the exact checked source text. */
    readonly authoredRange: (node: GoPtr<Node>) => AstAuthoredRange;
    readonly getSourceFile: (node: GoPtr<Node>) => GoPtr<SourceFile>;
    readonly getFileName: (sourceFile: GoPtr<SourceFile>) => string;
    readonly getPath: (sourceFile: GoPtr<SourceFile>) => string;
    readonly getSourceText: (sourceFile: GoPtr<SourceFile>) => string;
    readonly isDeclarationFile: (sourceFile: GoPtr<SourceFile>) => boolean;
    readonly is: typeof predicates;
    readonly as: typeof casts;
}
export declare function createAstReader(): AstReader;
//# sourceMappingURL=ast-reader.d.ts.map