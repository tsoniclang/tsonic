export {
  classifyDeclarationKind,
  classifyLocalTypeDeclarationKind,
  declarationNameOf,
  resolveExportedDeclaration,
  resolveImportedLocalDeclaration,
  resolveModuleLocalDeclaration,
} from "./export-resolution/declarations.js";
export {
  collectModuleExports,
  finalizeCrossNamespaceReexports,
} from "./export-resolution/module-exports.js";
export { buildModuleSourceIndex } from "./export-resolution/source-index.js";
export {
  typeNodeUsesImportedTypeNames,
  unwrapParens,
} from "./export-resolution/type-helpers.js";
export { collectExtensionWrapperImportsFromSourceType } from "./export-resolution/wrappers.js";
