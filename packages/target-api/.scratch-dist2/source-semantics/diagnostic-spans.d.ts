import type { AstReader, SourceFile } from "@tsonic/tsts";
import type { TargetDiagnosticSourceSpan } from "../artifacts.js";
export declare function createSourceDiagnosticSpanReader(ast: Pick<AstReader, "getSourceText" | "getFileName">): (sourceFile: SourceFile, pos: number, end: number) => TargetDiagnosticSourceSpan | undefined;
//# sourceMappingURL=diagnostic-spans.d.ts.map