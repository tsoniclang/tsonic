import type { SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceLexicalCapture, SourceNodeDomain } from "../../source-navigation/lexical-captures.js";
export declare function createSourceFlowCaptureQuery(source: SourceAnalysisProgram, step: (node?: Node) => void, domain: SourceNodeDomain): (node: Node) => readonly SourceLexicalCapture[];
//# sourceMappingURL=captures.d.ts.map