import type { GoPtr } from "../go/compat.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Program } from "../internal/compiler/program.js";
import type { CompilerExtension, ExtensionDiagnostic, ExtensionHost } from "../extensions/extension-host.js";
import type { ExtensionTypeChecker } from "../extensions/checker-facade.js";
import type { ExtensionModuleGraph } from "../extensions/module-graph.js";
import type { TranspileCompilerOptions } from "./transpile.js";
export type CreateCompilerSourceProgramOptions = {
    readonly projectRoot?: string;
    readonly compilerOptions?: TranspileCompilerOptions;
    readonly extensions?: readonly CompilerExtension[];
    readonly runSemanticChecks?: boolean;
    readonly runExtensionChecks?: boolean;
};
export type CompilerSourceProgram = {
    readonly program: GoPtr<Program>;
    readonly sourceFiles: readonly SourceFile[];
    readonly moduleGraph: ExtensionModuleGraph;
    readonly extensionHost: ExtensionHost;
    readonly diagnostics: readonly Diagnostic[];
    readonly extensionDiagnostics: readonly ExtensionDiagnostic[];
    withSemanticView<T>(sourceFile: GoPtr<SourceFile>, run: (semantics: ExtensionTypeChecker) => T): T;
};
export declare const createCompilerSourceProgram: (filePaths: readonly string[], options?: CreateCompilerSourceProgramOptions) => CompilerSourceProgram;
//# sourceMappingURL=source-program.d.ts.map