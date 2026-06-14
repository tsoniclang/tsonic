export { type ModifierList, type Node, type NodeList, type SourceFile, } from "./syntax.js";
export * as TstsSyntax from "./syntax.js";
export * from "./ast-helpers.js";
export { parseTstsSourceFile } from "./parse-source.js";
export type { ParseTstsSourceOptions } from "./parse-source.js";
export { defineExtensionFactKey, ExtensionFacts } from "./facts.js";
export type { ExtensionFactKey, ExtensionFactKeyLike, ExtensionFactRecord, ExtensionFactSnapshot, } from "./facts.js";
export { createExtensionCheckerHandle, createExtensionTypeChecker, hasTstsChecker, } from "./checker-facade.js";
export type { ExtensionCheckerHandle, ExtensionTypeChecker, } from "./checker-facade.js";
export { createExtensionImportIndex } from "./import-index.js";
export type { ExtensionImportBinding, ExtensionImportBindingKind, ExtensionImportIndex, ExtensionImportModule, } from "./import-index.js";
export { createExtensionModuleGraph } from "./module-graph.js";
export type { ExtensionExportBinding, ExtensionExportBindingKind, ExtensionModuleGraph, ExtensionModuleImport, ExtensionResolvedModule, ExtensionSourceModule, } from "./module-graph.js";
export { createExtensionHost } from "./extension-host.js";
export type { CompilerExtension, ExtensionCheckedSourceFileContext, ExtensionConfigureContext, ExtensionDiagnostic, ExtensionDiagnosticCategory, ExtensionDiagnostics, ExtensionHost, ExtensionProgramContext, ExtensionSourceFileContext, } from "./extension-host.js";
//# sourceMappingURL=index.d.ts.map