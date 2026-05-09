/**
 * Declaration converters - Public API
 *
 * Declaration converter facade.
 * All context now flows through ProgramContext.
 */

export { convertVariableStatement } from "./variables.js";
export { convertFunctionDeclaration } from "./functions.js";
export { convertClassDeclaration } from "./classes.js";
export {
  convertInterfaceDeclaration,
  convertInterfaceMember,
} from "./interfaces.js";
export { convertEnumDeclaration } from "./enums.js";
export { convertTypeAliasDeclaration } from "./type-aliases.js";
