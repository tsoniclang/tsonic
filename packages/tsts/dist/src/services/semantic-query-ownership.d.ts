import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Program } from "../internal/compiler/program.js";
import type { Signature, Type } from "../internal/checker/types.js";
export declare function assertSemanticProgramActive(program: Program | undefined): void;
export declare function assertSemanticSourceFileOwned(program: Program, sourceFile: SourceFile): void;
export declare function assertSemanticNodeOwned(program: Program | undefined, node: Node | undefined): void;
export declare function assertSemanticSymbolOwned(program: Program | undefined, symbol: Symbol | undefined): void;
export declare function assertSemanticTypeOwned(program: Program | undefined, type: Type | undefined): void;
export declare function assertSemanticSignatureOwned(program: Program | undefined, signature: Signature | undefined): void;
//# sourceMappingURL=semantic-query-ownership.d.ts.map