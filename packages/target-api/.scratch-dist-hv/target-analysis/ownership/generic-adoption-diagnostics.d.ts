import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { TargetDiagnosticSourceSpan } from "../../artifacts.js";
export declare function sourceGenericAdoptionDiagnosticMessage(parameter: string, operand: string): string;
export declare function createSourceGenericAdoptionDiagnostics(source: SourceAnalysisProgram, projectRoot: string): (site: Node, declaration: Node, operation: Node, parameter: Node, operand: Node) => Readonly<{
    sourceSpan: TargetDiagnosticSourceSpan;
    message: string;
    evidence: readonly string[];
}> | undefined;
//# sourceMappingURL=generic-adoption-diagnostics.d.ts.map