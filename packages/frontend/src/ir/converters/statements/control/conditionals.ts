/**
 * Conditional statement converters (if, switch)
 *
 * Uses ProgramContext for conditional conversion.
 */

import * as ts from "typescript";
import {
  IrBranchNarrowing,
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
  collectTypeNarrowingsInFalsyExpr,
  withAppliedNarrowings,
} from "../../flow-narrowing.js";
import type { TypeNarrowing } from "../../flow-narrowing.js";
import { withVariableTypeEnv } from "../../type-env.js";

const convertBranchNarrowings = (
  narrowings: readonly TypeNarrowing[],
  ctx: ProgramContext
): readonly IrBranchNarrowing[] => {
  const converted: IrBranchNarrowing[] = [];
  for (const narrowing of narrowings) {
    if (!narrowing.bindingKey || !narrowing.targetNode) {
      continue;
    }

    const targetExpr = convertExpression(narrowing.targetNode, ctx, undefined);
    if (targetExpr.kind !== "identifier" && targetExpr.kind !== "memberAccess") {
      continue;
    }

    converted.push({
      bindingKey: narrowing.bindingKey,
      targetExpr,
      targetType: narrowing.targetType,
    });
  }

  return converted;
};

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
  const truthyNarrowings = collectTypeNarrowingsInTruthyExpr(node.expression, ctx);
  const thenCtx = withAppliedNarrowings(
    ctx,
    truthyNarrowings
  );

  const falsyNarrowings = collectTypeNarrowingsInFalsyExpr(
    node.expression,
    ctx
  );
  const elseCtx = (() => {
    if (!node.elseStatement) return ctx;
    return withAppliedNarrowings(ctx, falsyNarrowings);
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
    ...(truthyNarrowings.length > 0
      ? { thenNarrowings: convertBranchNarrowings(truthyNarrowings, ctx) }
      : {}),
    ...(falsyNarrowings.length > 0
      ? { elseNarrowings: convertBranchNarrowings(falsyNarrowings, ctx) }
      : {}),
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
