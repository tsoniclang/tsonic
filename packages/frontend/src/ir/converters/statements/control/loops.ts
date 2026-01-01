/**
 * Loop statement converters (while, for, for-of, for-in)
 */

import * as ts from "typescript";
import {
  IrWhileStatement,
  IrForStatement,
  IrForOfStatement,
  IrType,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertBindingName } from "../../../type-converter.js";
import { convertStatementSingle } from "../../../statement-converter.js";
import { convertVariableDeclarationList } from "../helpers.js";
import type { Binding } from "../../../binding/index.js";

/**
 * Convert while statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertWhileStatement = (
  node: ts.WhileStatement,
  binding: Binding,
  expectedReturnType?: IrType
): IrWhileStatement => {
  const body = convertStatementSingle(
    node.statement,
    binding,
    expectedReturnType
  );
  return {
    kind: "whileStatement",
    condition: convertExpression(node.expression, binding, undefined),
    body: body ?? { kind: "emptyStatement" },
  };
};

/**
 * Convert for statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertForStatement = (
  node: ts.ForStatement,
  binding: Binding,
  expectedReturnType?: IrType
): IrForStatement => {
  const body = convertStatementSingle(
    node.statement,
    binding,
    expectedReturnType
  );
  return {
    kind: "forStatement",
    initializer: node.initializer
      ? ts.isVariableDeclarationList(node.initializer)
        ? convertVariableDeclarationList(node.initializer, binding)
        : convertExpression(node.initializer, binding, undefined)
      : undefined,
    condition: node.condition
      ? convertExpression(node.condition, binding, undefined)
      : undefined,
    update: node.incrementor
      ? convertExpression(node.incrementor, binding, undefined)
      : undefined,
    body: body ?? { kind: "emptyStatement" },
  };
};

/**
 * Convert for-of statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertForOfStatement = (
  node: ts.ForOfStatement,
  binding: Binding,
  expectedReturnType?: IrType
): IrForOfStatement => {
  const firstDecl = ts.isVariableDeclarationList(node.initializer)
    ? node.initializer.declarations[0]
    : undefined;

  const variable = ts.isVariableDeclarationList(node.initializer)
    ? convertBindingName(firstDecl?.name ?? ts.factory.createIdentifier("_"))
    : convertBindingName(node.initializer as ts.BindingName);

  const body = convertStatementSingle(
    node.statement,
    binding,
    expectedReturnType
  );
  return {
    kind: "forOfStatement",
    variable,
    expression: convertExpression(node.expression, binding, undefined),
    body: body ?? { kind: "emptyStatement" },
    isAwait: !!node.awaitModifier,
  };
};

/**
 * Convert for-in statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertForInStatement = (
  node: ts.ForInStatement,
  binding: Binding,
  expectedReturnType?: IrType
): IrForStatement => {
  // Note: for...in needs special handling in C# - variable extraction will be handled in emitter
  // We'll need to extract the variable info in the emitter phase

  const body = convertStatementSingle(
    node.statement,
    binding,
    expectedReturnType
  );
  // Note: for...in needs special handling in C#
  return {
    kind: "forStatement",
    initializer: undefined,
    condition: undefined,
    update: undefined,
    body: body ?? { kind: "emptyStatement" },
  };
};
