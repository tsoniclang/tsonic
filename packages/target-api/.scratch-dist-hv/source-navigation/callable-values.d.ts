import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNavigationQueryContext } from "./query-context.js";
import type { SourceNavigationMemberAccess } from "./types.js";
export interface SourceCallableValue {
    readonly expression: Node;
    readonly selectedDeclaration: Node;
    /** The member selection of a property or element access value (host-input witness). */
    readonly access?: SourceNavigationMemberAccess;
    readonly receiverDeclaration?: Node;
    readonly aliases: readonly Node[];
}
interface SourceCallableValueOptions {
    readonly typeAssertions?: "transparent";
    readonly stopAtDeclaration?: Node;
}
export declare function sourceCallableValueExpression(ast: AstReader, node: Node | undefined, options?: SourceCallableValueOptions): Node | undefined;
export declare function createSourceCallableValueQuery(source: SourceNavigationQueryContext, options?: SourceCallableValueOptions): (expression: Node) => SourceCallableValue | undefined;
export {};
//# sourceMappingURL=callable-values.d.ts.map