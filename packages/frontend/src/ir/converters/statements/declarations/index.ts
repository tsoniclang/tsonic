/**
 * Declaration converters - Public API
 */

export {
  setMetadataRegistry,
  setBindingRegistry,
  setTypeRegistry,
  setNominalEnv,
  getTypeRegistry,
  getNominalEnv,
  clearTypeRegistries,
  // TypeSystem singleton for migration period
  setTypeSystem,
  getTypeSystem,
  // Internal accessors for TypeSystem construction only
  _internalGetTypeRegistry,
  _internalGetNominalEnv,
} from "./registry.js";
export { convertVariableStatement } from "./variables.js";
export { convertFunctionDeclaration } from "./functions.js";
export { convertClassDeclaration } from "./classes.js";
export {
  convertInterfaceDeclaration,
  convertInterfaceMember,
} from "./interfaces.js";
export { convertEnumDeclaration } from "./enums.js";
export { convertTypeAliasDeclaration } from "./type-aliases.js";
