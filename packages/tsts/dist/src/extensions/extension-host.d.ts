import type { GoPtr } from "../go/compat.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Program } from "../internal/compiler/program.js";
import { ExtensionFacts } from "./facts.js";
import type { ExtensionCheckerHandle, ExtensionTypeChecker } from "./checker-facade.js";
import type { ExtensionImportIndex } from "./import-index.js";
export type ExtensionDiagnosticCategory = "error" | "warning" | "suggestion";
export type ExtensionDiagnostic = {
    readonly extensionId: string;
    readonly code: string;
    readonly category: ExtensionDiagnosticCategory;
    readonly message: string;
    readonly sourceFile?: GoPtr<SourceFile>;
    readonly node?: object;
};
export type ExtensionDiagnostics = {
    add(diagnostic: ExtensionDiagnostic): void;
    all(): readonly ExtensionDiagnostic[];
};
export type ExtensionConfigureContext = {
    readonly facts: ExtensionFacts;
    readonly diagnostics: ExtensionDiagnostics;
};
export type ExtensionSourceFileContext = {
    readonly program?: GoPtr<Program>;
    readonly sourceFile: GoPtr<SourceFile>;
    readonly imports: ExtensionImportIndex;
    readonly facts: ExtensionFacts;
    readonly diagnostics: ExtensionDiagnostics;
};
export type ExtensionCheckedSourceFileContext = ExtensionSourceFileContext & {
    readonly checker: ExtensionTypeChecker;
};
export type ExtensionProgramContext = {
    readonly program: GoPtr<Program>;
    readonly sourceFiles: readonly GoPtr<SourceFile>[];
    readonly facts: ExtensionFacts;
    readonly diagnostics: ExtensionDiagnostics;
};
export type CompilerExtension = {
    readonly id: string;
    readonly dependsOn?: readonly string[];
    readonly runsAfter?: readonly string[];
    configure?(context: ExtensionConfigureContext): void;
    afterParseSourceFile?(context: ExtensionSourceFileContext): void;
    afterBindSourceFile?(context: ExtensionSourceFileContext): void;
    afterCheckSourceFile?(context: ExtensionCheckedSourceFileContext): void;
    afterCheckProgram?(context: ExtensionProgramContext): void;
    validateProgram?(context: ExtensionProgramContext): void;
};
export type ExtensionHost = {
    readonly extensions: readonly CompilerExtension[];
    readonly facts: ExtensionFacts;
    readonly diagnostics: ExtensionDiagnostics;
    configure(): void;
    afterParseSourceFile(sourceFile: GoPtr<SourceFile>, program?: GoPtr<Program>): void;
    afterBindSourceFile(sourceFile: GoPtr<SourceFile>, program?: GoPtr<Program>): void;
    afterCheckSourceFile(sourceFile: GoPtr<SourceFile>, checker: ExtensionCheckerHandle, program?: GoPtr<Program>): void;
    afterCheckProgram(program: GoPtr<Program>, sourceFiles: readonly GoPtr<SourceFile>[]): void;
    validateProgram(program: GoPtr<Program>, sourceFiles: readonly GoPtr<SourceFile>[]): void;
};
export declare const createExtensionHost: (extensions: readonly CompilerExtension[]) => ExtensionHost;
//# sourceMappingURL=extension-host.d.ts.map