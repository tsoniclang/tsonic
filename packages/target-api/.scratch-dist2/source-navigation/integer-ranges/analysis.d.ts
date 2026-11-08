import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../types.js";
import type { SourceIntegerRange } from "./domain.js";
export interface SourceIntegerRangeOptions {
    readonly ast: AstReader;
    readonly navigation: SourceProgramNavigation;
    readonly sourceFiles: readonly SourceFile[];
    isNumber(expression: Node): boolean;
}
export interface SourceIntegerRangeQueries {
    readonly exactInt32Remainders: readonly Node[];
    range(expression: Node): SourceIntegerRange | undefined;
}
export declare function analyzeSourceIntegerRanges(options: SourceIntegerRangeOptions): SourceIntegerRangeQueries;
//# sourceMappingURL=analysis.d.ts.map