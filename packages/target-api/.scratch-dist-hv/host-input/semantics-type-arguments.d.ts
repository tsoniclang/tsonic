import type { AstReader, Node, SourceFileQueries, Type } from "@tsonic/tsts";
import type { ResolvedSourceCallInfo } from "./navigation-checker.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "./semantics-types.js";
export declare function getSourceCallTypeParameterDeclaration(ast: AstReader, queries: SourceFileSemantics, invocation: Node, call: ResolvedSourceCallInfo, argument: NonNullable<ResolvedSourceCallInfo["sourceSelectedMethodTypeArguments"]>[number]): Node | undefined;
export declare function getSourceMethodTypeArgumentComponent(argument: NonNullable<ResolvedSourceCallInfo["sourceSelectedMethodTypeArguments"]>[number]): SourceTypeComponentEvidence;
export interface SourceTypeArgumentBinding {
    readonly declaration: Node;
    readonly parameterType: Type;
    readonly argumentType: Type;
    readonly scope: "outer" | "local";
}
export declare function getSourceTypeArgumentBindings(ast: AstReader, queries: SourceFileQueries, type: Type): readonly SourceTypeArgumentBinding[] | undefined;
//# sourceMappingURL=semantics-type-arguments.d.ts.map