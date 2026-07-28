import type { GoPtr } from "../go/compat.js";
import type { Context } from "../go/context.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import { type Program } from "../internal/compiler/program.js";
import { type AstReader } from "../services/ast-reader.js";
import { type TypeCheckerQueries } from "../services/type-checker.js";
import { type TypeShapeQueries } from "../services/type-shape.js";
import type { ExtensionDiagnostic } from "./host.js";
import type { ReadonlySourceFactResolver } from "./consumer.js";
export interface SourceFileQueries {
    readonly sourceFile: SourceFile;
    readonly ast: AstReader;
    readonly checker: TypeCheckerQueries;
    readonly typeShape: TypeShapeQueries;
}
export interface SourceProgramQueries {
    readonly ast: AstReader;
    readonly getSourceFiles: () => readonly GoPtr<SourceFile>[];
    readonly getSourceFile: (fileName: string) => GoPtr<SourceFile>;
    readonly getSourceFileQueries: (sourceFile: GoPtr<SourceFile>) => SourceFileQueries;
}
export interface CheckedSourceProgram extends SourceProgramQueries {
    readonly sourceFiles: readonly GoPtr<SourceFile>[];
    readonly sourceFacts?: ReadonlySourceFactResolver;
    readonly diagnostics: readonly GoPtr<Diagnostic>[];
    readonly extensionDiagnostics: readonly ExtensionDiagnostic[];
}
export interface CreateSourceProgramQueriesOptions {
    readonly context?: Context;
    readonly includeSourceFile?: (sourceFile: SourceFile) => boolean;
}
export declare function createSourceProgramQueries(program: GoPtr<Program>, options?: CreateSourceProgramQueriesOptions): SourceProgramQueries;
//# sourceMappingURL=source-program.d.ts.map