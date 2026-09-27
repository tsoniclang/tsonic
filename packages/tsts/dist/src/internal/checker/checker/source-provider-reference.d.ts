import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/ast.js";
import type { Symbol } from "../../ast/symbol.js";
import { type ProviderTypeFamilyFact, type ProviderVirtualDeclarationFact } from "../../../extensions/facts.js";
import type { Checker } from "./state.js";
export type SourceProviderOrdinaryFacet = {
    readonly kind: "declaration";
    readonly declaration: ProviderVirtualDeclarationFact;
} | {
    readonly kind: "type-family";
    readonly family: ProviderTypeFamilyFact;
};
export type SourceProviderReferenceInfo = {
    readonly expression: Node;
    readonly symbol: Symbol;
} & ({
    readonly intrinsic: ProviderVirtualDeclarationFact;
    readonly ordinary?: SourceProviderOrdinaryFacet;
} | {
    readonly intrinsic?: never;
    readonly ordinary: SourceProviderOrdinaryFacet;
});
export declare function resolveSourceProviderReference(checker: GoPtr<Checker>, expression: GoPtr<Node>): SourceProviderReferenceInfo | undefined;
//# sourceMappingURL=source-provider-reference.d.ts.map