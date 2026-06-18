import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/spine.js";
import type { SourceFile } from "../internal/ast/ast.js";
export type ExtensionImportBindingKind = "named" | "namespace" | "default";
export type ExtensionImportBinding = {
    readonly kind: ExtensionImportBindingKind;
    readonly localName: string;
    readonly importedName: string;
    readonly isTypeOnly: boolean;
    readonly importNode: GoPtr<Node>;
    readonly bindingNode: GoPtr<Node>;
};
export type ExtensionImportModule = {
    readonly specifier: string;
    readonly isTypeOnly: boolean;
    readonly importNode: GoPtr<Node>;
    readonly bindings: readonly ExtensionImportBinding[];
};
export type ExtensionImportIndex = {
    readonly sourceFile: GoPtr<SourceFile>;
    readonly modules: readonly ExtensionImportModule[];
    getBindingsFrom(specifier: string): readonly ExtensionImportBinding[];
    resolveLocalName(localName: string): ExtensionImportBinding | undefined;
};
export declare const createExtensionImportIndex: (sourceFile: GoPtr<SourceFile>) => ExtensionImportIndex;
//# sourceMappingURL=import-index.d.ts.map