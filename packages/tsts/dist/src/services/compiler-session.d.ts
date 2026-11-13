import type { GoPtr } from "../go/compat.js";
import type { Context } from "../go/context.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import type { CompilerHost } from "../internal/compiler/host.js";
import type { Program, ProgramOptions } from "../internal/compiler/program.js";
import type { ParsedCommandLine } from "../internal/tsoptions/parsedcommandline.js";
import { type ExtensionHostOptions } from "../extensions/host.js";
import type { CheckedSourceProgram } from "../extensions/source-program.js";
export type CompilerDiagnosticKind = "config" | "program" | "global" | "syntactic" | "bind" | "semantic" | "suggestion" | "declaration" | "all";
export interface CompilerSessionOptions {
    readonly programOptions: ProgramOptions;
    readonly extensionHostOptions?: ExtensionHostOptions;
    readonly context?: Context;
}
/**
 * A session over in-memory files has two input modes, chosen by the caller and never by which files are present.
 *
 * Options mode (the default): the compiler options are exactly `compilerOptions` (`{}` when omitted), read by the
 * compiler's reader of a configuration object; a rejected option is a configuration diagnostic with no file and no
 * site. The roots are exactly `rootFiles`, each resolved against the current directory; `[]` is a valid empty
 * program, not "omitted", and no diagnostic is made for it. Only when `rootFiles` is omitted are the roots inferred:
 * every key of `files` whose extension the compiler supports under those options (GetSupportedExtensions: the
 * TypeScript extensions, and the JavaScript ones only with allowJs), sorted; no host file system and nothing
 * installed is consulted. No file is read as configuration: a tsconfig among `files`, and anything it extends, stays
 * an ordinary file of the file system and has no influence on options or roots.
 *
 * Configuration mode, selected only by `configFileName`: that name is resolved as root names are (against the current
 * directory, normalized) and found with the file system's own case rule; the configuration is read from that file
 * with what it extends, as the compiler reads a project, its diagnostics included. `compilerOptions` and
 * `rootFiles` may not be given with it.
 */
export interface InMemoryCompilerSessionOptions {
    readonly currentDirectory: string;
    readonly files: ReadonlyMap<string, string> | Record<string, string>;
    readonly rootFiles?: readonly string[];
    readonly configFileName?: string;
    readonly compilerOptions?: Record<string, unknown>;
    readonly extensionHostOptions?: ExtensionHostOptions;
    readonly useCaseSensitiveFileNames?: boolean;
    readonly context?: Context;
}
export interface CompilerSession {
    readonly program: GoPtr<Program>;
    readonly host: CompilerHost;
    readonly config: GoPtr<ParsedCommandLine>;
    readonly getSourceFilesToEmit: (targetSourceFile?: GoPtr<SourceFile>, forceDtsEmit?: boolean) => readonly GoPtr<SourceFile>[];
    readonly ensureBound: () => void;
    readonly ensureChecked: (sourceFile?: GoPtr<SourceFile>) => readonly GoPtr<Diagnostic>[];
    readonly getDiagnostics: (kind?: CompilerDiagnosticKind, sourceFile?: GoPtr<SourceFile>) => readonly GoPtr<Diagnostic>[];
    readonly checkSource: () => CheckedSourceProgram;
}
export declare function createCompilerSession(options: CompilerSessionOptions): CompilerSession;
export declare function createCompilerSessionFromProgram(program: GoPtr<Program>, host: CompilerHost, config: GoPtr<ParsedCommandLine>, context?: Context): CompilerSession;
export declare function createCompilerSessionFromFiles(options: InMemoryCompilerSessionOptions): CompilerSession;
//# sourceMappingURL=compiler-session.d.ts.map