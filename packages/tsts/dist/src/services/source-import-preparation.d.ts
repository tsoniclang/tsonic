import type { Diagnostic } from "../internal/ast/diagnostic.js";
import type { CompilerHost } from "../internal/compiler/host.js";
import type { ParsedCommandLine } from "../internal/tsoptions/parsedcommandline.js";
import type { LibFile } from "../internal/compiler/fileloader.js";
import type { GoPtr } from "../go/compat.js";
export interface SourceImportPreparationInput {
    readonly host: CompilerHost;
    readonly config: ParsedCommandLine;
    /**
     * The program's library files, selected by the caller: library file name (as the compiler's lib names map to
     * files, e.g. "lib.es5.d.ts") to the file of the program that is that library. When given, an empty map included,
     * it is the only source of library files; when absent, the host's default library directory is.
     */
    readonly libraryFiles?: ReadonlyMap<string, string>;
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
/**
 * The file the loader actually loaded for each library name, from its library records, derived once per preparation.
 * A record exists for a library the loader loaded (by a lib entry or a directive, its replacement included) and, for
 * the caller's selected library files, for a bound file of the program however it entered, under the bound name that
 * orders first. The loader keeps one file per name, so a second record of a name with another file is an invariant
 * failure.
 */
export declare function loadedLibraryFilesByName(records: Iterable<GoPtr<LibFile>>): ReadonlyMap<string, string>;
export declare function prepareSourceImports(input: SourceImportPreparationInput): SourceImportPreparation;
export {};
//# sourceMappingURL=source-import-preparation.d.ts.map