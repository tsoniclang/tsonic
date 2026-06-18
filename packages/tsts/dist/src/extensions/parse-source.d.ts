import type { GoPtr } from "../go/compat.js";
import type { SourceFile } from "../internal/ast/ast.js";
export type ParseTstsSourceOptions = {
    readonly fileName?: string;
    readonly tsx?: boolean;
    readonly useCaseSensitiveFileNames?: boolean;
};
export declare const parseTstsSourceFile: (sourceText: string, options?: ParseTstsSourceOptions) => GoPtr<SourceFile>;
//# sourceMappingURL=parse-source.d.ts.map