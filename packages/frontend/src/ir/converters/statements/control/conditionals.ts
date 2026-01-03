/**
 * Conditional statement converters (if, switch)
 *
 * Phase 5 Step 4: Uses ProgramContext instead of Binding.
 */

import * as ts from "typescript";
import {
  IrIfStatement,
  IrSwitchStatement,
  IrSwitchCase,
  IrType,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import {
  convertStatementSingle,
  flattenStatementResult,
  convertStatement,
} from "../../../statement-converter.js";
import type { ProgramContext } from "../../../program-context.js";

/**
 * Convert if statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Passed through to nested statements for return expressions.
 */
export const convertIfStatement = (
  node: ts.IfStatement,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrIfStatement => {
  const thenStmt = convertStatementSingle(
    node.thenStatement,
    ctx,
    expectedReturnType
  );
  const elseStmt = node.elseStatement
    ? convertStatementSingle(node.elseStatement, ctx, expectedReturnType)
    : undefined;

  return {
    kind: "ifStatement",
    condition: convertExpression(node.expression, ctx, undefined),
    thenStatement: thenStmt ?? { kind: "emptyStatement" },
    elseStatement: elseStmt ?? undefined,
  };
};

/**
 * Convert switch statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertSwitchStatement = (
  node: ts.SwitchStatement,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrSwitchStatement => {
  return {
    kind: "switchStatement",
    expression: convertExpression(node.expression, ctx, undefined),
    cases: node.caseBlock.clauses.map((clause) =>
      convertSwitchCase(clause, ctx, expectedReturnType)
    ),
  };
};

/**
 * Convert switch case
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 */
export const convertSwitchCase = (
  node: ts.CaseOrDefaultClause,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrSwitchCase => {
  return {
    kind: "switchCase",
    test: ts.isCaseClause(node)
      ? convertExpression(node.expression, ctx, undefined)
      : undefined,
    statements: node.statements.flatMap((s) =>
      flattenStatementResult(convertStatement(s, ctx, expectedReturnType))
    ),
  };
};
