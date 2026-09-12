import type { SourceFile } from "../internal/ast/ast.js";
import type { TargetAstEncodingLimits } from "./target-ast-resource-budget.js";
export declare class TargetAstEncodingError extends Error {
    readonly kind: number | undefined;
    readonly field: string | undefined;
    constructor(message: string, kind?: number, field?: string);
}
export declare function encodeTargetSourceFileForPrinting(sourceFile: SourceFile, limits?: TargetAstEncodingLimits): Uint8Array;
//# sourceMappingURL=target-ast-encoding.d.ts.map