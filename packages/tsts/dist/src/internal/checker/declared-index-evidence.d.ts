import type { Node } from "../ast/spine.js";
import type { Type } from "./types.js";
export declare class DeclaredIndexReadSource {
    #private;
    readonly annotation: Node;
    readonly receiver: Type;
    readonly index: Type;
    readonly result: Type;
    readonly kind: "declared-index-read";
    private constructor();
    get declaration(): Node;
    static retain(annotation: Node, receiver: Type, index: Type, declaration: Node, result: Type): DeclaredIndexReadSource;
    static owns(value: object): value is DeclaredIndexReadSource;
}
export declare function hasDeclaredIndexReadEvidence(value: unknown): value is DeclaredIndexReadSource;
//# sourceMappingURL=declared-index-evidence.d.ts.map