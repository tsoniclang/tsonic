import type { GoPtr, GoSlice } from "../go/compat.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import type { SourceFile } from "../internal/ast/ast.js";
export declare function collectExtensionDiagnosticsForSourceFile(program: object, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
//# sourceMappingURL=diagnostics.d.ts.map