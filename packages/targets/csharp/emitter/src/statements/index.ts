/**
 * Statement emitters barrel exports
 */

// Block and simple statements (AST)
export {
  emitBlockStatementAst,
  emitReturnStatementAst,
  emitYieldExpressionAst,
  emitYieldStatementAst,
  emitExpressionStatementAst,
  emitGeneratorReturnStatementAst,
} from "./blocks.js";

// Control flow statements (AST)
export {
  emitIfStatementAst,
  emitWhileStatementAst,
  emitForStatementAst,
  emitForOfStatementAst,
  emitForInStatementAst,
  emitSwitchStatementAst,
  emitTryStatementAst,
  emitThrowStatementAst,
} from "./control.js";

// Class-related helpers
export {
  emitClassMember,
  emitParameters,
  capitalize,
  extractInlineObjectTypes,
  emitExtractedType,
  emitInterfaceMemberAsProperty,
  type ExtractedType,
} from "./classes.js";

// Declaration emitters
export {
  emitVariableDeclaration,
  emitVariableDeclarationAst,
  emitFunctionDeclaration,
  emitFunctionDeclarationAst,
  emitClassDeclaration,
  emitInterfaceDeclaration,
  emitEnumDeclaration,
  emitTypeAliasDeclaration,
} from "./declarations.js";
