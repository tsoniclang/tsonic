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
  IrForInStatement,
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
): IrForInStatement => {
  const firstDecl = ts.isVariableDeclarationList(node.initializer)
    ? node.initializer.declarations[0]
    : undefined;

  const variable = ts.isVariableDeclarationList(node.initializer)
    ? convertBindingName(firstDecl?.name ?? ts.factory.createIdentifier("_"))
    : ts.isIdentifier(node.initializer)
      ? convertBindingName(node.initializer)
      : convertBindingName(ts.factory.createIdentifier("_"));

  const typedVariable =
    variable.kind === "identifierPattern"
      ? { ...variable, type: { kind: "primitiveType", name: "string" } as const }
      : variable;

  const body = convertStatementSingle(node.statement, ctx, expectedReturnType);
  return {
    kind: "forInStatement",
    variable: typedVariable,
    expression: convertExpression(node.expression, ctx, undefined),
    body: body ?? { kind: "emptyStatement" },
  };
};
