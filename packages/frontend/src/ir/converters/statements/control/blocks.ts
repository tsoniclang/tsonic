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

const stripRuntimeNullish = (type: IrType | undefined): IrType | undefined => {
  if (!type || type.kind !== "unionType") {
    return type;
  }

  const nonNullish = type.types.filter(
    (member) =>
      !(
        member.kind === "primitiveType" &&
        (member.name === "null" || member.name === "undefined")
      )
  );

  return nonNullish.length === 1 ? nonNullish[0] : type;
};

const isJsNumberType = (type: IrType | undefined): boolean => {
  const stripped = stripRuntimeNullish(type);
  return stripped?.kind === "primitiveType" && stripped.name === "number";
};

const intType: IrType = { kind: "primitiveType", name: "int" };
const numberType: IrType = { kind: "primitiveType", name: "number" };

const isIntType = (type: IrType | undefined): boolean => {
  const stripped = stripRuntimeNullish(type);
  return (
    (stripped?.kind === "primitiveType" && stripped.name === "int") ||
    (stripped?.kind === "referenceType" && stripped.name === "int")
  );
};

const getArrayElementType = (type: IrType | undefined): IrType | undefined => {
  const stripped = stripRuntimeNullish(type);
  return stripped?.kind === "arrayType" ? stripped.elementType : undefined;
};

const resolveIdentifierReadType = (
  identifier: ts.Identifier,
  ctx: ProgramContext
): IrType | undefined => {
  const declId = ctx.binding.resolveIdentifier(identifier);
  if (!declId) {
    return undefined;
  }

  return ctx.typeEnv?.get(declId.id) ?? ctx.typeSystem.typeOfValueRead(declId);
};

const resolveSimpleNumericAssignmentType = (
  expression: ts.Expression,
  ctx: ProgramContext
): IrType | undefined => {
  if (ts.isNumericLiteral(expression)) {
    return Number.isInteger(Number(expression.text)) ? intType : numberType;
  }

  if (ts.isIdentifier(expression)) {
    return resolveIdentifierReadType(expression, ctx);
  }

  if (ts.isParenthesizedExpression(expression)) {
    return resolveSimpleNumericAssignmentType(expression.expression, ctx);
  }

  if (ts.isNonNullExpression(expression)) {
    return stripRuntimeNullish(
      resolveSimpleNumericAssignmentType(expression.expression, ctx)
    );
  }

  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression
  ) {
    return getArrayElementType(
      resolveSimpleNumericAssignmentType(expression.expression, ctx)
    );
  }

  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind;
    if (
      operator !== ts.SyntaxKind.PlusToken &&
      operator !== ts.SyntaxKind.MinusToken &&
      operator !== ts.SyntaxKind.AsteriskToken &&
      operator !== ts.SyntaxKind.SlashToken &&
      operator !== ts.SyntaxKind.PercentToken
    ) {
      return undefined;
    }

    const leftType = resolveSimpleNumericAssignmentType(expression.left, ctx);
    const rightType = resolveSimpleNumericAssignmentType(expression.right, ctx);
    if (isJsNumberType(leftType) || isJsNumberType(rightType)) {
      return numberType;
    }
    if (isIntType(leftType) && isIntType(rightType)) {
      return intType;
    }
  }

  return undefined;
};

const isMutableIntegerLiteralDeclaration = (
  decl: ts.VariableDeclaration,
  declarationList: ts.VariableDeclarationList
): decl is ts.VariableDeclaration & { name: ts.Identifier } =>
  (!(declarationList.flags & ts.NodeFlags.Const) ||
    !!(declarationList.flags & ts.NodeFlags.Let)) &&
  ts.isIdentifier(decl.name) &&
  decl.type === undefined &&
  !!decl.initializer &&
  ts.isNumericLiteral(decl.initializer) &&
  Number.isInteger(Number(decl.initializer.text));

const collectMutableNumericLiteralWideningDeclIds = (
  block: ts.Block,
  ctx: ProgramContext
): ReadonlySet<number> | undefined => {
  const candidates = new Map<string, number>();
  const wideningDeclIds = new Set<number>();

  const rememberDeclaration = (decl: ts.VariableDeclaration): void => {
    const parent = decl.parent;
    if (
      !parent ||
      !ts.isVariableDeclarationList(parent) ||
      !isMutableIntegerLiteralDeclaration(decl, parent)
    ) {
      return;
    }

    const declId = ctx.binding.resolveIdentifier(decl.name);
    if (declId) {
      candidates.set(decl.name.text, declId.id);
    }
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionLike(node) ||
      ts.isClassLike(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node)
    ) {
      return;
    }

    if (ts.isVariableDeclaration(node)) {
      rememberDeclaration(node);
      return;
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const candidateDeclId = candidates.get(node.left.text);
      if (
        candidateDeclId !== undefined &&
        isJsNumberType(resolveSimpleNumericAssignmentType(node.right, ctx))
      ) {
        wideningDeclIds.add(candidateDeclId);
      }
    }

    ts.forEachChild(node, visit);
  };

  for (const statement of block.statements) {
    visit(statement);
  }

  return wideningDeclIds.size > 0 ? wideningDeclIds : undefined;
};

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
  const mutableNumericLiteralWideningDeclIds =
    collectMutableNumericLiteralWideningDeclIds(node, ctx);
  let currentCtx = mutableNumericLiteralWideningDeclIds
    ? {
        ...ctx,
        mutableNumericLiteralWideningDeclIds: new Set([
          ...(ctx.mutableNumericLiteralWideningDeclIds ?? []),
          ...mutableNumericLiteralWideningDeclIds,
        ]),
      }
    : ctx;
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
