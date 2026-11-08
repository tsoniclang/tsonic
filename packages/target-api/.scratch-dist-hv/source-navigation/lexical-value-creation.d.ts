import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationUse } from "./types.js";
import type { SourceProgramNavigation } from "./types.js";
import { type SourceNodeDomain } from "./lexical-captures.js";
export declare function sourceLexicalFunctionValueOrder(declarations: readonly Node[], ast: AstReader, navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "declarationUseSummary">, domain: SourceNodeDomain, isRuntimeUse?: (use: SourceDeclarationUse, declaration: Node) => boolean): {
    readonly kind: "resolved";
    readonly declarations: readonly Node[];
} | {
    readonly kind: "unresolved";
    readonly reason: string;
};
//# sourceMappingURL=lexical-value-creation.d.ts.map