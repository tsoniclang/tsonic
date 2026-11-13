import type { Diagnostic } from "../internal/ast/diagnostic.js";
import type { CompilerHost } from "../internal/compiler/host.js";
import type { ParsedCommandLine } from "../internal/tsoptions/parsedcommandline.js";
export interface SourceImportPreparationInput {
    readonly host: CompilerHost;
    readonly config: ParsedCommandLine;
}
type SourceReferenceSyntax = {
    readonly kind: "import" | "export";
    readonly placement: "statement" | "ambient-module";
} | {
    readonly kind: "import-type" | "require";
    readonly placement: "statement" | "ambient-module" | "expression";
} | {
    readonly kind: "dynamic-import";
    readonly placement: "expression";
} | {
    readonly kind: "reference-path" | "reference-types" | "reference-lib";
    readonly placement: "directive";
};
export type SourceImportPreparationReference = SourceReferenceSyntax & {
    readonly specifier: string;
    readonly start: number;
    readonly length: number;
    readonly mode: "import" | "require" | "none";
    readonly resolution: {
        readonly kind: "resolved";
        readonly fileName: string;
    } | {
        readonly kind: "unresolved";
    };
};
export interface SourceImportPreparationFile {
    readonly fileName: string;
    readonly declarationFile: boolean;
    readonly references: readonly SourceImportPreparationReference[];
}
export interface SourceImportPreparation {
    readonly roots: readonly {
        readonly fileName: string;
        readonly state: "loaded" | "missing";
    }[];
    readonly files: readonly SourceImportPreparationFile[];
    readonly diagnostics: readonly Diagnostic[];
}
export declare function prepareSourceImports(input: SourceImportPreparationInput): SourceImportPreparation;
export {};
//# sourceMappingURL=source-import-preparation.d.ts.map