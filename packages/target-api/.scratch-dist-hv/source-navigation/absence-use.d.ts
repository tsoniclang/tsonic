import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
export type SourceAbsenceUse = "coalesce" | "comparison" | undefined;
/**
 * How an expression's absence is used: the left operand of `??`, or an operand of an equality comparison whose other
 * operand is an authored absence (`null`, `undefined`, `void e`). Syntax only (R3: no checked operand type).
 */
export declare function sourceAbsenceUse(expression: Node, context: {
    readonly ast: AstReader;
    readonly navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">;
}): SourceAbsenceUse;
//# sourceMappingURL=absence-use.d.ts.map