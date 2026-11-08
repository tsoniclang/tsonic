import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNavigationCallBinding, SourceNavigationSignatureParameter, SourceProgramNavigation } from "./types.js";
interface SourceCallArgumentContext {
    readonly ast: AstReader;
    readonly navigation: Pick<SourceProgramNavigation, "call">;
}
export interface SourceCallArgumentCorrespondence {
    readonly bindingIndex: number;
    readonly binding: SourceNavigationCallBinding;
    readonly argument: {
        readonly expression: Node;
    };
    readonly parameter: SourceNavigationSignatureParameter;
}
/** Argument-to-parameter rows of the call host-input selected at `call`; undefined for an untyped or unselected call. */
export declare function sourceCallArgumentCorrespondences(context: SourceCallArgumentContext, call: Node): readonly SourceCallArgumentCorrespondence[] | undefined;
export declare function sourceSingleCallValueArgument(correspondence: readonly SourceCallArgumentCorrespondence[] | undefined, declaration: Node): Node | undefined;
export interface SourceClosedCallableArgument {
    readonly call: Node;
    readonly argument: Node;
    readonly argumentIndex: number;
}
export declare function sourceExpressionCallArgument(reference: Node, source: SourceCallArgumentContext): SourceClosedCallableArgument | undefined;
export {};
//# sourceMappingURL=callable-arguments.d.ts.map