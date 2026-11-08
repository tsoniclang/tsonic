import type { SourceAnalysisProgram } from "./analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
export interface SourceBinaryEntryIssue {
    readonly code: "TSONIC_UNCALLED_BINARY_ENTRY_MAIN";
    readonly node: Node;
    readonly message: string;
    readonly evidence: readonly string[];
}
export declare function validateSourceBinaryEntry(source: SourceAnalysisProgram, entrySourceFile: SourceFile): readonly SourceBinaryEntryIssue[];
//# sourceMappingURL=entry-validation.d.ts.map