/**
 * Control flow statement converters (if, while, for, switch, try, block)
 */

import * as ts from "typescript";
import {
  IrStatement,
  IrBlockStatement,
  IrIfStatement,
  IrWhileStatement,
  IrForStatement,
  IrForOfStatement,
  IrSwitchStatement,
  IrSwitchCase,
  IrTryStatement,
  IrCatchClause,
} from "../../types.js";
import { convertExpression } from "../../expression-converter.js";
import { convertBindingName } from "../../type-converter.js";
import { convertStatement } from "../../statement-converter.js";
import { convertVariableDeclarationList } from "./helpers.js";

/**
 * Convert if statement
 */
export const convertIfStatement = (
  node: ts.IfStatement,
  checker: ts.TypeChecker
): IrIfStatement => {
  const thenStmt = convertStatement(node.thenStatement, checker);
  const elseStmt = node.elseStatement
    ? convertStatement(node.elseStatement, checker)
    : undefined;

  return {
    kind: "ifStatement",
    condition: convertExpression(node.expression, checker),
    thenStatement: thenStmt ?? { kind: "emptyStatement" },
    elseStatement: elseStmt ?? undefined,
  };
};

/**
 * Convert while statement
 */
export const convertWhileStatement = (
  node: ts.WhileStatement,
  checker: ts.TypeChecker
): IrWhileStatement => {
  const body = convertStatement(node.statement, checker);
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
  const body = convertStatement(node.statement, checker);
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

  const body = convertStatement(node.statement, checker);
  return {
    kind: "forOfStatement",
    variable,
    expression: convertExpression(node.expression, checker),
    body: body ?? { kind: "emptyStatement" },
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

  const body = convertStatement(node.statement, checker);
  // Note: for...in needs special handling in C#
  return {
    kind: "forStatement",
    initializer: undefined,
    condition: undefined,
    update: undefined,
    body: body ?? { kind: "emptyStatement" },
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
    statements: node.statements
      .map((s) => convertStatement(s, checker))
      .filter((s): s is IrStatement => s !== null),
  };
};

/**
 * Convert try statement
 */
export const convertTryStatement = (
  node: ts.TryStatement,
  checker: ts.TypeChecker
): IrTryStatement => {
  return {
    kind: "tryStatement",
    tryBlock: convertBlockStatement(node.tryBlock, checker),
    catchClause: node.catchClause
      ? convertCatchClause(node.catchClause, checker)
      : undefined,
    finallyBlock: node.finallyBlock
      ? convertBlockStatement(node.finallyBlock, checker)
      : undefined,
  };
};

/**
 * Convert catch clause
 */
export const convertCatchClause = (
  node: ts.CatchClause,
  checker: ts.TypeChecker
): IrCatchClause => {
  return {
    kind: "catchClause",
    parameter: node.variableDeclaration
      ? convertBindingName(node.variableDeclaration.name)
      : undefined,
    body: convertBlockStatement(node.block, checker),
  };
};

/**
 * Convert block statement
 */
export const convertBlockStatement = (
  node: ts.Block,
  checker: ts.TypeChecker
): IrBlockStatement => {
  return {
    kind: "blockStatement",
    statements: node.statements
      .map((s) => convertStatement(s, checker))
      .filter((s): s is IrStatement => s !== null),
  };
};
