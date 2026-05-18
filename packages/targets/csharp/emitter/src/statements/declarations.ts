/**
 * Declaration emitters (variables, functions, classes, interfaces, enums, type aliases)
 * Main dispatcher - re-exports from declarations/ subdirectory
 */

export {
  emitVariableDeclaration,
  emitVariableDeclarationAst,
  emitFunctionDeclaration,
  emitFunctionDeclarationAst,
  emitClassDeclaration,
  emitInterfaceDeclaration,
  emitEnumDeclaration,
  emitTypeAliasDeclaration,
} from "./declarations/index.js";
