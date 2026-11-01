import type { Node } from "@tsonic/tsts";
import { fixture } from "./generic-adoption-fixtures.mjs";
import type { SourceDeclarationOwnershipLimits } from "../../../../../packages/target-api/src/target-analysis/ownership/model.js";
declare function declaredQuery(current: ReturnType<typeof fixture>, limits?: SourceDeclarationOwnershipLimits): import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipUnresolved | {
    readonly kind: "resolved";
    readonly issues: readonly import("../../../../../packages/target-api/src/target-analysis/ownership/generic-adoption.js").SourceGenericAdoptionIssue[];
};
export declare function checkedOperation(current: ReturnType<typeof fixture>, expression: string): {
    node: Node;
    type: import("@tsonic/tsts").Type | undefined;
    declaration: Node | undefined;
    typeArgumentCount: number;
    sourceSpan: {
        line: number;
        column: number;
        fileName: string;
        endLine: number;
        endColumn: number;
    };
};
export { declaredQuery };
