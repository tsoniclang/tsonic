import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/ast.js";
import type { Symbol } from "../../ast/symbol.js";
import { type ProviderTypeFamilyFact, type ProviderVirtualDeclarationFact } from "../../../extensions/facts.js";
import type { Checker } from "./state.js";
export interface SourceIntrinsicDeclarationInfo {
    readonly expression: Node;
    readonly symbol: Symbol;
    readonly declaration: ProviderVirtualDeclarationFact;
    readonly ordinary?: {
        readonly kind: "declaration";
        readonly declaration: ProviderVirtualDeclarationFact;
    } | {
        readonly kind: "type-family";
        readonly family: ProviderTypeFamilyFact;
    };
}
export declare function resolveSourceIntrinsicDeclaration(checker: GoPtr<Checker>, expression: GoPtr<Node>): SourceIntrinsicDeclarationInfo | undefined;
//# sourceMappingURL=source-intrinsic-evidence.d.ts.map