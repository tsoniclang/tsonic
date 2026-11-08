import type { AstReader, Node, Type, TypeCheckerQueries } from "@tsonic/tsts";
import type { SourceProviderSignatureSelection } from "../source-semantics/provider-signature.js";
import type { ResolvedSourceCallInfo } from "./navigation-checker.js";
export type { ResolvedSourceCallInfo } from "./navigation-checker.js";
export interface SourceCallResultSelection {
    readonly authoredTypeNode?: Node;
    readonly selectedReturnType: Type;
    readonly resultType: Type;
    readonly providerSignature?: SourceProviderSignatureSelection;
}
export declare function selectSourceCallResult(ast: AstReader, checker: TypeCheckerQueries, source: ResolvedSourceCallInfo, providerSignature: (declaration: Node | undefined) => SourceProviderSignatureSelection | undefined): SourceCallResultSelection | undefined;
//# sourceMappingURL=semantics-call-result-selection.d.ts.map