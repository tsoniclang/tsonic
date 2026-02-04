/**
 * Conditional statement converters (if, switch)
 *
 * Phase 5 Step 4: Uses ProgramContext instead of Binding.
 */

import * as ts from "typescript";
import {
  IrStatement,
  IrIfStatement,
  IrSwitchStatement,
  IrSwitchCase,
  IrType,
  IrVariableDeclaration,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import {
  convertStatementSingle,
  flattenStatementResult,
  convertStatement,
} from "../../../statement-converter.js";
import type { ProgramContext } from "../../../program-context.js";
import {
  collectTypeNarrowingsInTruthyExpr,
  withAppliedNarrowings,
} from "../../flow-narrowing.js";
import { withVariableTypeEnv } from "../../type-env.js";

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
  const thenCtx = withAppliedNarrowings(
    ctx,
    collectTypeNarrowingsInTruthyExpr(node.expression, ctx)
  );

  const elseCtx = (() => {
    if (!node.elseStatement) return ctx;

    let unwrapped: ts.Expression = node.expression;
    while (ts.isParenthesizedExpression(unwrapped)) {
      unwrapped = unwrapped.expression;
    }

    // Else branch runs when the inner condition is truthy.
    // This supports idiomatic `if (!(x instanceof T)) { ... } else { x.tMember }`.
    if (
      ts.isPrefixUnaryExpression(unwrapped) &&
      unwrapped.operator === ts.SyntaxKind.ExclamationToken
    ) {
      return withAppliedNarrowings(
        ctx,
        collectTypeNarrowingsInTruthyExpr(unwrapped.operand, ctx)
      );
    }

    return ctx;
  })();

  const thenStmt = convertStatementSingle(
    node.thenStatement,
    thenCtx,
    expectedReturnType
  );
  const elseStmt = node.elseStatement
    ? convertStatementSingle(node.elseStatement, elseCtx, expectedReturnType)
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
  let currentCtx = ctx;
  const statements: IrStatement[] = [];

  for (const s of node.statements) {
    const converted = convertStatement(s, currentCtx, expectedReturnType);
    statements.push(...flattenStatementResult(converted));

    if (
      ts.isVariableStatement(s) &&
      converted !== null &&
      !Array.isArray(converted)
    ) {
      const single = converted as IrStatement;
      if (single.kind !== "variableDeclaration") continue;
      currentCtx = withVariableTypeEnv(
        currentCtx,
        s.declarationList.declarations,
        single as IrVariableDeclaration
      );
    }
  }

  return {
    kind: "switchCase",
    test: ts.isCaseClause(node)
      ? convertExpression(node.expression, ctx, undefined)
      : undefined,
    statements,
  };
};
