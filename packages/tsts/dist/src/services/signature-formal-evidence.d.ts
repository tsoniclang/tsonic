import { type Node } from "../internal/ast/ast.js";
import type { Checker } from "../internal/checker/checker/state.js";
import { type Signature, type Type } from "../internal/checker/types.js";
export interface CompletedTupleFormal {
    readonly original: Signature;
    readonly declaration: Node;
    readonly binder: Type;
    readonly selected: Type;
}
export declare function readCompletedTupleFormal(checker: Checker, signature: Signature, ordinal: number, selected: Type): CompletedTupleFormal | undefined;
//# sourceMappingURL=signature-formal-evidence.d.ts.map