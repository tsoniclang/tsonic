export {
  classifyExportKind,
  resolveLocalModuleFile,
  resolveLocalSourceModuleKey,
  resolveRelativeSourceModulePath,
} from "./source-modules/module-resolution.js";
export { discoverSourceModuleInfos } from "./source-modules/discovery.js";
export { collectExtensionWrapperImportsFromSourceType } from "./source-modules/wrappers.js";
export { renderExportedTypeAlias } from "./source-modules/type-aliases.js";
