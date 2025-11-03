/**
 * Declaration converters - Public API
 */

export { setMetadataRegistry, setBindingRegistry } from "./registry.js";
export { convertVariableStatement } from "./variables.js";
export { convertFunctionDeclaration } from "./functions.js";
export { convertClassDeclaration } from "./classes.js";
export {
  convertInterfaceDeclaration,
  convertInterfaceMember,
} from "./interfaces.js";
export { convertEnumDeclaration } from "./enums.js";
export { convertTypeAliasDeclaration } from "./type-aliases.js";
