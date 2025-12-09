/**
 * Loop statement converters (while, for, for-of, for-in)
 */

import * as ts from "typescript";
import {
  IrWhileStatement,
  IrForStatement,
  IrForOfStatement,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertBindingName } from "../../../type-converter.js";
import { convertStatementSingle } from "../../../statement-converter.js";
import { convertVariableDeclarationList } from "../helpers.js";

/**
 * Convert while statement
 */
export const convertWhileStatement = (
  node: ts.WhileStatement,
  checker: ts.TypeChecker
): IrWhileStatement => {
  const body = convertStatementSingle(node.statement, checker);
  return {
    kind: "whileStatement",
    condition: convertExpression(node.expression, checker),
    body: body ?? { kind: "emptyStatement" },
  };
};

/**
 * Convert for statement
 */
export const convertForStatement = (
  node: ts.ForStatement,
  checker: ts.TypeChecker
): IrForStatement => {
  const body = convertStatementSingle(node.statement, checker);
  return {
    kind: "forStatement",
    initializer: node.initializer
      ? ts.isVariableDeclarationList(node.initializer)
        ? convertVariableDeclarationList(node.initializer, checker)
        : convertExpression(node.initializer, checker)
      : undefined,
    condition: node.condition
      ? convertExpression(node.condition, checker)
      : undefined,
    update: node.incrementor
      ? convertExpression(node.incrementor, checker)
      : undefined,
    body: body ?? { kind: "emptyStatement" },
  };
};

/**
 * Convert for-of statement
 */
export const convertForOfStatement = (
  node: ts.ForOfStatement,
  checker: ts.TypeChecker
): IrForOfStatement => {
  const firstDecl = ts.isVariableDeclarationList(node.initializer)
    ? node.initializer.declarations[0]
    : undefined;

  const variable = ts.isVariableDeclarationList(node.initializer)
    ? convertBindingName(firstDecl?.name ?? ts.factory.createIdentifier("_"))
    : convertBindingName(node.initializer as ts.BindingName);

  const body = convertStatementSingle(node.statement, checker);
  return {
    kind: "forOfStatement",
    variable,
    expression: convertExpression(node.expression, checker),
    body: body ?? { kind: "emptyStatement" },
    isAwait: !!node.awaitModifier,
  };
};

/**
 * Convert for-in statement
 */
export const convertForInStatement = (
  node: ts.ForInStatement,
  checker: ts.TypeChecker
): IrForStatement => {
  // Note: for...in needs special handling in C# - variable extraction will be handled in emitter
  // We'll need to extract the variable info in the emitter phase

  const body = convertStatementSingle(node.statement, checker);
  // Note: for...in needs special handling in C#
  return {
    kind: "forStatement",
    initializer: undefined,
    condition: undefined,
    update: undefined,
    body: body ?? { kind: "emptyStatement" },
  };
};
