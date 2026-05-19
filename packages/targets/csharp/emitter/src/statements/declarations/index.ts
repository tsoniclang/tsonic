/**
 * Declaration emitters - Public API
 */

export {
  emitVariableDeclaration,
  emitVariableDeclarationAst,
} from "./variables.js";
export {
  emitFunctionDeclaration,
  emitFunctionDeclarationAst,
} from "./functions.js";
export { emitClassDeclaration } from "./classes.js";
export { emitInterfaceDeclaration } from "./interfaces.js";
export { emitEnumDeclaration } from "./enums.js";
export { emitTypeAliasDeclaration } from "./type-aliases.js";
