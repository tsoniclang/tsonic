import type { Node } from "@tsonic/tsts";
import type { SourceNavigationQueryContext } from "./query-context.js";
import type { SourceNavigationMemberAccess } from "./types.js";
export interface SourceCallOnlyAlias {
    readonly expression: Node;
    readonly selectedDeclaration: Node;
    /** The member selection when the aliased value is a property access (host-input witness). */
    readonly access?: SourceNavigationMemberAccess;
    readonly receiverDeclaration?: Node;
    readonly declarations: readonly Node[];
    readonly calls: readonly Node[];
}
export declare function createSourceCallOnlyAliasQuery(source: SourceNavigationQueryContext): (declaration: Node) => SourceCallOnlyAlias | undefined;
//# sourceMappingURL=callable-aliases.d.ts.map