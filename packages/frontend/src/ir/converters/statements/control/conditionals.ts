/**
 * Conditional statement converters (if, switch)
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
import type { Binding } from "../../../binding/index.js";

/**
 * Convert if statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Passed through to nested statements for return expressions.
 */
export const convertIfStatement = (
  node: ts.IfStatement,
  binding: Binding,
  expectedReturnType?: IrType
): IrIfStatement => {
  const thenStmt = convertStatementSingle(
    node.thenStatement,
    binding,
    expectedReturnType
  );
  const elseStmt = node.elseStatement
    ? convertStatementSingle(node.elseStatement, binding, expectedReturnType)
    : undefined;

  return {
    kind: "ifStatement",
    condition: convertExpression(node.expression, binding, undefined),
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
  binding: Binding,
  expectedReturnType?: IrType
): IrSwitchStatement => {
  return {
    kind: "switchStatement",
    expression: convertExpression(node.expression, binding, undefined),
    cases: node.caseBlock.clauses.map((clause) =>
      convertSwitchCase(clause, binding, expectedReturnType)
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
  binding: Binding,
  expectedReturnType?: IrType
): IrSwitchCase => {
  return {
    kind: "switchCase",
    test: ts.isCaseClause(node)
      ? convertExpression(node.expression, binding, undefined)
      : undefined,
    statements: node.statements.flatMap((s) =>
      flattenStatementResult(convertStatement(s, binding, expectedReturnType))
    ),
  };
};
