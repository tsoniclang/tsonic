/**
 * Block statement converter
 *
 * Phase 5 Step 4: Uses ProgramContext instead of Binding.
 */

import * as ts from "typescript";
import {
  IrStatement,
  IrBlockStatement,
  IrType,
  IrVariableDeclaration,
} from "../../../types.js";
import {
  convertStatement,
  flattenStatementResult,
} from "../../../statement-converter.js";
import type { ProgramContext } from "../../../program-context.js";
import { withVariableTypeEnv } from "../../type-env.js";
import {
  collectTypeNarrowingsInFalsyExpr,
  collectTypeNarrowingsInTruthyExpr,
  withAppliedNarrowings,
  withAssignedAccessPathType,
} from "../../flow-narrowing.js";
import { getAccessPathTarget } from "../../access-paths.js";

const statementAlwaysTerminates = (stmt: IrStatement): boolean => {
  switch (stmt.kind) {
    case "returnStatement":
    case "throwStatement":
    case "generatorReturnStatement":
      return true;
    case "blockStatement":
      return stmt.statements.some((inner) => statementAlwaysTerminates(inner));
    case "ifStatement":
      return stmt.elseStatement
        ? statementAlwaysTerminates(stmt.thenStatement) &&
            statementAlwaysTerminates(stmt.elseStatement)
        : false;
    case "tryStatement": {
      const tryTerminates = statementAlwaysTerminates(stmt.tryBlock);
      const catchTerminates = stmt.catchClause
        ? statementAlwaysTerminates(stmt.catchClause.body)
        : true;
      const finallyTerminates = stmt.finallyBlock
        ? statementAlwaysTerminates(stmt.finallyBlock)
        : true;
      return tryTerminates && catchTerminates && finallyTerminates;
    }
    default:
      return false;
  }
};

/**
 * Convert block statement
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Pass `undefined` explicitly when not inside a function.
 */
export const convertBlockStatement = (
  node: ts.Block,
  ctx: ProgramContext,
  expectedReturnType: IrType | undefined
): IrBlockStatement => {
  let currentCtx = ctx;
  const statements: IrStatement[] = [];

  for (const s of node.statements) {
    const converted = convertStatement(s, currentCtx, expectedReturnType);
    statements.push(...flattenStatementResult(converted));

    // Variable declarations introduce new bindings. Thread their inferred types forward
    // so later statements in the same block can use deterministic types (no "unknown").
    if (
      ts.isVariableStatement(s) &&
      converted !== null &&
      !Array.isArray(converted)
    ) {
      const single = converted as IrStatement;
      if (single.kind !== "variableDeclaration") continue;
      const varDecl = single as IrVariableDeclaration;
      currentCtx = withVariableTypeEnv(
        currentCtx,
        s.declarationList.declarations,
        varDecl
      );
    }

    if (
      ts.isExpressionStatement(s) &&
      converted !== null &&
      !Array.isArray(converted)
    ) {
      const single = converted as IrStatement;
      if (single.kind !== "expressionStatement") {
        continue;
      }

      const expr = s.expression;
      if (
        ts.isBinaryExpression(expr) &&
        expr.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        single.expression.kind === "assignment"
      ) {
        const target = getAccessPathTarget(expr.left, currentCtx);
        if (target) {
          currentCtx = withAssignedAccessPathType(
            currentCtx,
            target,
            single.expression.right.inferredType
          );
        }
        continue;
      }

      if (
        (ts.isPrefixUnaryExpression(expr) ||
          ts.isPostfixUnaryExpression(expr)) &&
        (expr.operator === ts.SyntaxKind.PlusPlusToken ||
          expr.operator === ts.SyntaxKind.MinusMinusToken)
      ) {
        const target = getAccessPathTarget(expr.operand, currentCtx);
        if (target) {
          currentCtx = withAssignedAccessPathType(
            currentCtx,
            target,
            single.expression.inferredType
          );
        }
      }
    }

    if (
      ts.isIfStatement(s) &&
      converted !== null &&
      !Array.isArray(converted)
    ) {
      const singleStatement = converted as IrStatement;
      const ifStatement =
        singleStatement.kind === "ifStatement" ? singleStatement : undefined;
      if (!ifStatement) {
        continue;
      }
      const thenTerminates = statementAlwaysTerminates(
        ifStatement.thenStatement
      );
      const elseTerminates = ifStatement.elseStatement
        ? statementAlwaysTerminates(ifStatement.elseStatement)
        : false;

      if (thenTerminates && !elseTerminates) {
        currentCtx = withAppliedNarrowings(
          currentCtx,
          collectTypeNarrowingsInFalsyExpr(s.expression, currentCtx)
        );
        continue;
      }

      if (elseTerminates && !thenTerminates) {
        currentCtx = withAppliedNarrowings(
          currentCtx,
          collectTypeNarrowingsInTruthyExpr(s.expression, currentCtx)
        );
      }
    }
  }

  return {
    kind: "blockStatement",
    statements,
  };
};
