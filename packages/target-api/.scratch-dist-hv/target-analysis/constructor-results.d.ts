import { type SourceAnalysisProgram } from "./analysis-program.js";
import type { Node } from "@tsonic/tsts";
export interface SourceConstructorResultIssue {
    readonly code: "TSONIC_CONSTRUCTOR_RESULT_NOT_SUPPORTED" | "TSONIC_CONSTRUCTOR_RESULT_NOT_PROVEN";
    readonly category: "error";
    readonly source: "tsonic";
    readonly sourceNode?: Node;
    readonly message: string;
}
export declare function analyzeSourceConstructorResults(source: SourceAnalysisProgram): readonly SourceConstructorResultIssue[];
//# sourceMappingURL=constructor-results.d.ts.map