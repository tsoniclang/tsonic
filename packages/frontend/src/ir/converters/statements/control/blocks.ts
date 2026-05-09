/**
 * Block statement converter
 *
 * Uses ProgramContext for block conversion.
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
import {
  getAccessPathTarget,
  getCurrentTypeForAccessExpression,
} from "../../access-paths.js";
import { getReadableMemberTypeForNarrowing } from "../../narrowing-property-helpers.js";

const tryResolveReadableAssignedAccessType = (
  expr: ts.Expression,
  ctx: ProgramContext
): IrType | undefined => {
  if (ts.isPropertyAccessExpression(expr) || ts.isPropertyAccessChain(expr)) {
    const receiverType = getCurrentTypeForAccessExpression(
      expr.expression,
      ctx
    );
    if (!receiverType) {
      return undefined;
    }

    return getReadableMemberTypeForNarrowing(receiverType, expr.name.text, ctx);
  }

  if (ts.isElementAccessExpression(expr) || ts.isElementAccessChain(expr)) {
    const propertyExpr = expr.argumentExpression;
    if (
      !propertyExpr ||
      (!ts.isStringLiteral(propertyExpr) &&
        !ts.isNoSubstitutionTemplateLiteral(propertyExpr))
    ) {
      return undefined;
    }

    const receiverType = getCurrentTypeForAccessExpression(
      expr.expression,
      ctx
    );
    if (!receiverType) {
      return undefined;
    }

    return getReadableMemberTypeForNarrowing(
      receiverType,
      propertyExpr.text,
      ctx
    );
  }

  return undefined;
};

const resolveAssignedAccessPathFlowType = (
  expr: ts.Expression,
  assignedType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  const readableType = tryResolveReadableAssignedAccessType(expr, ctx);
  if (!readableType) {
    return assignedType;
  }

  if (!assignedType) {
    return readableType;
  }

  return ctx.typeSystem.isAssignableTo(assignedType, readableType)
    ? assignedType
    : readableType;
};

const statementAlwaysTerminates = (stmt: IrStatement): boolean => {
  switch (stmt.kind) {
    case "returnStatement":
    case "throwStatement":
    case "generatorReturnStatement":
    case "breakStatement":
    case "continueStatement":
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

  for (let index = 0; index < node.statements.length; index++) {
    const s = node.statements[index];
    if (!s) {
      continue;
    }
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
            resolveAssignedAccessPathFlowType(
              expr.left,
              single.expression.right.inferredType,
              currentCtx
            )
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
