/**
 * Conditional statement converters (if, switch)
 */

import * as ts from "typescript";
import {
  IrIfStatement,
  IrSwitchStatement,
  IrSwitchCase,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import {
  convertStatementSingle,
  flattenStatementResult,
  convertStatement,
} from "../../../statement-converter.js";

/**
 * Convert if statement
 */
export const convertIfStatement = (
  node: ts.IfStatement,
  checker: ts.TypeChecker
): IrIfStatement => {
  const thenStmt = convertStatementSingle(node.thenStatement, checker);
  const elseStmt = node.elseStatement
    ? convertStatementSingle(node.elseStatement, checker)
    : undefined;

  return {
    kind: "ifStatement",
    condition: convertExpression(node.expression, checker),
    thenStatement: thenStmt ?? { kind: "emptyStatement" },
    elseStatement: elseStmt ?? undefined,
  };
};

/**
 * Convert switch statement
 */
export const convertSwitchStatement = (
  node: ts.SwitchStatement,
  checker: ts.TypeChecker
): IrSwitchStatement => {
  return {
    kind: "switchStatement",
    expression: convertExpression(node.expression, checker),
    cases: node.caseBlock.clauses.map((clause) =>
      convertSwitchCase(clause, checker)
    ),
  };
};

/**
 * Convert switch case
 */
export const convertSwitchCase = (
  node: ts.CaseOrDefaultClause,
  checker: ts.TypeChecker
): IrSwitchCase => {
  return {
    kind: "switchCase",
    test: ts.isCaseClause(node)
      ? convertExpression(node.expression, checker)
      : undefined,
    statements: node.statements.flatMap((s) =>
      flattenStatementResult(convertStatement(s, checker))
    ),
  };
};
