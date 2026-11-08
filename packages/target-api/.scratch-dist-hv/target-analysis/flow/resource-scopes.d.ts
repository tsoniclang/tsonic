import type { AstReader, Node } from "@tsonic/tsts";
export interface SourceResourceScope {
    readonly declarations: readonly Node[];
    readonly kind: "sync" | "async";
}
export interface SourceResourceScopes {
    readonly variables: ReadonlyMap<Node, readonly Node[]>;
    readonly scopes: ReadonlyMap<Node, SourceResourceScope>;
    readonly tails: ReadonlyMap<Node, readonly Node[]>;
}
export declare function analyzeSourceResourceScopes(ast: AstReader, nodes: readonly Node[], erased: (node: Node) => boolean): SourceResourceScopes;
//# sourceMappingURL=resource-scopes.d.ts.map