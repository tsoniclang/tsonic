import type { Node } from "@tsonic/tsts";
import type { SourceNavigationQueryContext } from "./query-context.js";
export declare function sourceConstructionExpression(invocation: Node, source: Pick<SourceNavigationQueryContext, "ast" | "navigation">, step: () => boolean): Node | undefined;
export declare function sourceSuperConstructor(invocation: Node, source: Pick<SourceNavigationQueryContext, "ast" | "navigation">, step: () => boolean): {
    readonly owner: Node;
    readonly callee: Node;
} | undefined;
export declare function sourceInstanceInitializers(declaration: Node, source: Pick<SourceNavigationQueryContext, "ast" | "navigation">, step: () => boolean): readonly Node[] | undefined;
//# sourceMappingURL=class-initialization.d.ts.map