/**
 * Statement emitters barrel exports
 */

// Block and simple statements
export {
  emitBlockStatement,
  emitReturnStatement,
  emitYieldStatement,
  emitExpressionStatement,
} from "./blocks.js";

// Control flow statements
export {
  emitIfStatement,
  emitWhileStatement,
  emitForStatement,
  emitForOfStatement,
  emitForInStatement,
  emitSwitchStatement,
  emitTryStatement,
  emitThrowStatement,
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
  emitFunctionDeclaration,
  emitClassDeclaration,
  emitInterfaceDeclaration,
  emitEnumDeclaration,
  emitTypeAliasDeclaration,
} from "./declarations.js";
