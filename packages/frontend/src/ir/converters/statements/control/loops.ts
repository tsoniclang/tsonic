/**
 * Loop statement converters (while, for, for-of, for-in)
 *
 * Phase 5 Step 4: Uses ProgramContext instead of Binding.
 */

import * as ts from "typescript";
import {
  IrWhileStatement,
  IrForStatement,
  IrForOfStatement,
  IrType,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import { convertStatementSingle } from "../../../statement-converter.js";
import { convertVariableDeclarationList } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";

/**
 * Convert while statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertWhileStatement = (
  node: ts.WhileStatement,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrWhileStatement => {
  const body = convertStatementSingle(node.statement, ctx, expectedReturnType);
  return {
    kind: "whileStatement",
    condition: convertExpression(node.expression, ctx, undefined),
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
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrForStatement => {
  const body = convertStatementSingle(node.statement, ctx, expectedReturnType);
  return {
    kind: "forStatement",
    initializer: node.initializer
      ? ts.isVariableDeclarationList(node.initializer)
        ? convertVariableDeclarationList(node.initializer, ctx)
        : convertExpression(node.initializer, ctx, undefined)
      : undefined,
    condition: node.condition
      ? convertExpression(node.condition, ctx, undefined)
      : undefined,
    update: node.incrementor
      ? convertExpression(node.incrementor, ctx, undefined)
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
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrForOfStatement => {
  const firstDecl = ts.isVariableDeclarationList(node.initializer)
    ? node.initializer.declarations[0]
    : undefined;

  const variable = ts.isVariableDeclarationList(node.initializer)
    ? convertBindingName(firstDecl?.name ?? ts.factory.createIdentifier("_"))
    : convertBindingName(node.initializer as ts.BindingName);

  const body = convertStatementSingle(node.statement, ctx, expectedReturnType);
  return {
    kind: "forOfStatement",
    variable,
    expression: convertExpression(node.expression, ctx, undefined),
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
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrForStatement => {
  // Note: for...in needs special handling in C# - variable extraction will be handled in emitter
  // We'll need to extract the variable info in the emitter phase

  const body = convertStatementSingle(node.statement, ctx, expectedReturnType);
  // Note: for...in needs special handling in C#
  return {
    kind: "forStatement",
    initializer: undefined,
    condition: undefined,
    update: undefined,
    body: body ?? { kind: "emptyStatement" },
  };
};
