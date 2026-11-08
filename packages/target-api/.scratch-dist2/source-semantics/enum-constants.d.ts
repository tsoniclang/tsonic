import type { AstReader, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceEnumConstantIndex } from "./enum-model.js";
/**
 * The Host enum constant facts: the exact value of every enum member of the program (enum initializer evaluation from
 * syntax and declarations), the integer width of each enum declaration, and the declaration-level admission issues
 * (merged declarations). Checker-free (I3). The use-site admission issues (enum values used as numbers or strings) are
 * Host-fact analyses over the value model: analyzeSourceEnumNumericUses (enum-numeric-uses.ts).
 */
export declare function analyzeSourceEnumConstants(ast: AstReader, sourceFiles: readonly SourceFile[], navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "mergedDeclarations" | "memberAccess">): SourceEnumConstantIndex;
export declare function selectSourceEnumIntegerWidth(values: readonly (bigint | string)[]): {
    readonly kind: "resolved";
    readonly integerWidth: 32 | 64;
} | {
    readonly kind: "rejected";
    readonly index: number;
    readonly reason: string;
};
//# sourceMappingURL=enum-constants.d.ts.map