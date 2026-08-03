import type { GoPtr } from "../go/compat.js";
import type { Context } from "../go/context.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import type { CompilerHost } from "../internal/compiler/host.js";
import type { Program, ProgramOptions } from "../internal/compiler/program.js";
import type { ParsedCommandLine } from "../internal/tsoptions/parsedcommandline.js";
import type { ExtensionHostOptions } from "../extensions/host.js";
import type { CheckedSourceProgram } from "../extensions/source-program.js";
export type CompilerDiagnosticKind = "config" | "program" | "global" | "syntactic" | "bind" | "semantic" | "suggestion" | "declaration" | "all";
export interface CompilerSessionOptions {
    readonly programOptions: ProgramOptions;
    readonly extensionHostOptions?: ExtensionHostOptions;
    readonly context?: Context;
}
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