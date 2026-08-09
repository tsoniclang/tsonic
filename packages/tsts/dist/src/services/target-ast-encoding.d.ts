import type { SourceFile } from "../internal/ast/ast.js";
export declare class TargetAstEncodingError extends Error {
    readonly kind: number | undefined;
    readonly field: string | undefined;
    constructor(message: string, kind?: number, field?: string);
}
export declare function encodeTargetSourceFileForPrinting(sourceFile: SourceFile): Uint8Array;
//# sourceMappingURL=target-ast-encoding.d.ts.map