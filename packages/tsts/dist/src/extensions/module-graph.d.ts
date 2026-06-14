import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/spine.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Program } from "../internal/compiler/program.js";
import { type ExtensionImportBinding, type ExtensionImportModule } from "./import-index.js";
export type ExtensionResolvedModule = {
    readonly resolvedFileName: string;
    readonly originalPath: string;
    readonly extension: string;
    readonly packageName?: string | undefined;
    readonly packageSubmoduleName?: string | undefined;
    readonly packageVersion?: string | undefined;
    readonly isExternalLibraryImport: boolean;
};
export type ExtensionExportBindingKind = "named" | "default" | "namespace" | "star" | "export-equals";
export type ExtensionExportBinding = {
    readonly kind: ExtensionExportBindingKind;
    readonly exportedName?: string | undefined;
    readonly localName?: string | undefined;
    readonly sourceSpecifier?: string | undefined;
    readonly isTypeOnly: boolean;
    readonly exportNode: GoPtr<Node>;
    readonly bindingNode: GoPtr<Node>;
    readonly resolvedModule?: ExtensionResolvedModule | undefined;
};
export type ExtensionModuleImport = ExtensionImportModule & {
    readonly resolvedModule?: ExtensionResolvedModule | undefined;
};
export type ExtensionSourceModule = {
    readonly sourceFile: GoPtr<SourceFile>;
    readonly fileName: string;
    readonly text: string;
    readonly imports: readonly ExtensionModuleImport[];
    readonly exports: readonly ExtensionExportBinding[];
    readonly hasTopLevelCode: boolean;
};
export type ExtensionModuleGraph = {
    readonly modules: readonly ExtensionSourceModule[];
    getSourceFileModule(sourceFile: GoPtr<SourceFile>): ExtensionSourceModule | undefined;
    getImports(sourceFile: GoPtr<SourceFile>): readonly ExtensionModuleImport[];
    getExports(sourceFile: GoPtr<SourceFile>): readonly ExtensionExportBinding[];
    getResolvedModule(sourceFile: GoPtr<SourceFile>, specifier: string): ExtensionResolvedModule | undefined;
    getImportBinding(sourceFile: GoPtr<SourceFile>, localName: string): ExtensionImportBinding | undefined;
    getExportBinding(sourceFile: GoPtr<SourceFile>, exportedName: string): ExtensionExportBinding | undefined;
};
export declare const createExtensionModuleGraph: (program: GoPtr<Program>, sourceFiles: readonly GoPtr<SourceFile>[]) => ExtensionModuleGraph;
//# sourceMappingURL=module-graph.d.ts.map