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

/**
 * Convert if statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Passed through to nested statements for return expressions.
 */
export const convertIfStatement = (
  node: ts.IfStatement,
  checker: ts.TypeChecker,
  expectedReturnType?: IrType
): IrIfStatement => {
  const thenStmt = convertStatementSingle(
    node.thenStatement,
    checker,
    expectedReturnType
  );
  const elseStmt = node.elseStatement
    ? convertStatementSingle(node.elseStatement, checker, expectedReturnType)
    : undefined;

  return {
    kind: "ifStatement",
    condition: convertExpression(node.expression, checker, undefined),
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
  checker: ts.TypeChecker,
  expectedReturnType?: IrType
): IrSwitchStatement => {
  return {
    kind: "switchStatement",
    expression: convertExpression(node.expression, checker, undefined),
    cases: node.caseBlock.clauses.map((clause) =>
      convertSwitchCase(clause, checker, expectedReturnType)
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
  checker: ts.TypeChecker,
  expectedReturnType?: IrType
): IrSwitchCase => {
  return {
    kind: "switchCase",
    test: ts.isCaseClause(node)
      ? convertExpression(node.expression, checker, undefined)
      : undefined,
    statements: node.statements.flatMap((s) =>
      flattenStatementResult(convertStatement(s, checker, expectedReturnType))
    ),
  };
};
