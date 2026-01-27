/**
 * Statement Emitter - IR statements to C# code
 * Main dispatcher - delegates to specialized modules
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "./types.js";

// Import statement emitters from specialized modules
import {
  emitVariableDeclaration,
  emitFunctionDeclaration,
  emitClassDeclaration,
  emitInterfaceDeclaration,
  emitEnumDeclaration,
  emitTypeAliasDeclaration,
} from "./statements/declarations.js";

import {
  emitBlockStatement,
  emitReturnStatement,
  emitExpressionStatement,
  emitYieldStatement,
  emitGeneratorReturnStatement,
} from "./statements/blocks.js";

import {
  emitIfStatement,
  emitWhileStatement,
  emitForStatement,
  emitForOfStatement,
  emitForInStatement,
  emitSwitchStatement,
  emitTryStatement,
  emitThrowStatement,
} from "./statements/control.js";

/**
 * Emit a C# statement from an IR statement
 */
export const emitStatement = (
  stmt: IrStatement,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  switch (stmt.kind) {
    case "variableDeclaration":
      return emitVariableDeclaration(stmt, context);

    case "functionDeclaration":
      return emitFunctionDeclaration(stmt, context);

    case "classDeclaration":
      return emitClassDeclaration(stmt, context);

    case "interfaceDeclaration":
      return emitInterfaceDeclaration(stmt, context);

    case "enumDeclaration":
      return emitEnumDeclaration(stmt, context);

    case "typeAliasDeclaration":
      return emitTypeAliasDeclaration(stmt, context);

    case "blockStatement":
      return emitBlockStatement(stmt, context);

    case "ifStatement":
      return emitIfStatement(stmt, context);

    case "whileStatement":
      return emitWhileStatement(stmt, context);

    // Note: doWhileStatement not in current IR types
    // case "doWhileStatement":
    //   return emitDoWhileStatement(stmt, context);

    case "forStatement":
      return emitForStatement(stmt, context);

    case "forOfStatement":
      return emitForOfStatement(stmt, context);

    case "forInStatement":
      return emitForInStatement(stmt, context);

    case "switchStatement":
      return emitSwitchStatement(stmt, context);

    case "tryStatement":
      return emitTryStatement(stmt, context);

    case "throwStatement":
      return emitThrowStatement(stmt, context);

    case "returnStatement":
      return emitReturnStatement(stmt, context);

    case "breakStatement":
      return [`${ind}break;`, context];

    case "continueStatement":
      return [`${ind}continue;`, context];

    case "expressionStatement":
      return emitExpressionStatement(stmt, context);

    case "yieldStatement":
      return emitYieldStatement(stmt, context);

    case "generatorReturnStatement":
      return emitGeneratorReturnStatement(stmt, context);

    case "emptyStatement":
      return [`${ind};`, context];

    default:
      throw new Error(
        `Unhandled IR statement kind: ${String((stmt as { kind?: unknown }).kind)}`
      );
  }
};

// Re-export commonly used functions for backward compatibility
export { emitBlockStatement } from "./statements/blocks.js";
export { emitParameters } from "./statements/classes.js";
