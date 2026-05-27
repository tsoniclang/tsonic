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
import type { BindingInternal } from "../../../binding/index.js";
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
  getAccessPathKey,
  getCurrentTypeForAccessPath,
  getCurrentTypeForAccessExpression,
  type AccessPathTarget,
} from "../../access-paths.js";
import { getReadableMemberTypeForNarrowing } from "../../narrowing-property-helpers.js";
import { isAssignmentOperator } from "../../expressions/helpers.js";

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

const getSignedNumericLiteralText = (
  expression: ts.Expression
): string | undefined => {
  if (ts.isNumericLiteral(expression)) {
    return expression.text;
  }

  if (
    ts.isPrefixUnaryExpression(expression) &&
    ts.isNumericLiteral(expression.operand) &&
    (expression.operator === ts.SyntaxKind.MinusToken ||
      expression.operator === ts.SyntaxKind.PlusToken)
  ) {
    return `${expression.operator === ts.SyntaxKind.MinusToken ? "-" : ""}${expression.operand.text}`;
  }

  return undefined;
};

const getNumericLiteralExpressionType = (
  expression: ts.Expression
): IrType | undefined => {
  const text = getSignedNumericLiteralText(expression);
  if (text === undefined) {
    return undefined;
  }
  return Number.isInteger(Number(text)) ? intType : numberType;
};

const isIntegerNumericLiteralExpression = (
  expression: ts.Expression
): boolean => {
  const type = getNumericLiteralExpressionType(expression);
  return type?.kind === "primitiveType" && type.name === "int";
};

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

const getIterableElementType = (
  type: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined =>
  getArrayElementType(type) ??
  ctx.typeSystem.getIterableShape(type)?.elementType;

const resolveIdentifierReadType = (
  identifier: ts.Identifier,
  ctx: ProgramContext,
  localTypes?: ReadonlyMap<string, IrType>
): IrType | undefined => {
  const localType = localTypes?.get(identifier.text);
  if (localType) {
    return localType;
  }

  const declId = ctx.binding.resolveIdentifier(identifier);
  if (!declId) {
    return undefined;
  }

  return ctx.typeEnv?.get(declId.id) ?? ctx.typeSystem.typeOfValueRead(declId);
};

const resolveSimpleNumericAssignmentType = (
  expression: ts.Expression,
  ctx: ProgramContext,
  localTypes?: ReadonlyMap<string, IrType>
): IrType | undefined => {
  const literalType = getNumericLiteralExpressionType(expression);
  if (literalType) {
    return literalType;
  }

  if (ts.isIdentifier(expression)) {
    return resolveIdentifierReadType(expression, ctx, localTypes);
  }

  if (ts.isCallExpression(expression)) {
    const argumentTypes = expression.arguments.map((argument) =>
      ts.isSpreadElement(argument)
        ? undefined
        : resolveSimpleNumericAssignmentType(argument, ctx, localTypes)
    );
    const calleeType = resolveSimpleNumericAssignmentType(
      expression.expression,
      ctx,
      localTypes
    );
    const callable = ctx.typeSystem.resolveCallableType(calleeType, {
      argumentCount: expression.arguments.length,
      argTypes: argumentTypes,
    });
    if (
      callable.resolved &&
      callable.resolved.returnType.kind !== "unknownType"
    ) {
      return callable.resolved.returnType;
    }

    const sigId = ctx.binding.resolveCallSignature(expression);
    if (!sigId) {
      return undefined;
    }
    const resolved = ctx.typeSystem.resolveCall({
      sigId,
      argumentCount: expression.arguments.length,
      argTypes: argumentTypes,
    });
    return resolved.returnType.kind === "unknownType"
      ? undefined
      : resolved.returnType;
  }

  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isPropertyAccessChain(expression)
  ) {
    const receiverType = resolveSimpleNumericAssignmentType(
      expression.expression,
      ctx,
      localTypes
    );
    if (!receiverType) {
      return undefined;
    }
    return getReadableMemberTypeForNarrowing(
      receiverType,
      expression.name.text,
      ctx
    );
  }

  if (ts.isParenthesizedExpression(expression)) {
    return resolveSimpleNumericAssignmentType(
      expression.expression,
      ctx,
      localTypes
    );
  }

  if (ts.isNonNullExpression(expression)) {
    return stripRuntimeNullish(
      resolveSimpleNumericAssignmentType(expression.expression, ctx, localTypes)
    );
  }

  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression
  ) {
    if (
      ts.isStringLiteral(expression.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression)
    ) {
      const receiverType = resolveSimpleNumericAssignmentType(
        expression.expression,
        ctx,
        localTypes
      );
      if (!receiverType) {
        return undefined;
      }
      return getReadableMemberTypeForNarrowing(
        receiverType,
        expression.argumentExpression.text,
        ctx
      );
    }

    return getArrayElementType(
      resolveSimpleNumericAssignmentType(expression.expression, ctx, localTypes)
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

    const leftType = resolveSimpleNumericAssignmentType(
      expression.left,
      ctx,
      localTypes
    );
    const rightType = resolveSimpleNumericAssignmentType(
      expression.right,
      ctx,
      localTypes
    );
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
  isIntegerNumericLiteralExpression(decl.initializer);

const collectMutableNumericLiteralWideningDeclIds = (
  block: ts.Block,
  ctx: ProgramContext
): ReadonlySet<number> | undefined => {
  const candidates = new Map<string, number>();
  const wideningDeclIds = new Set<number>();
  const localTypes = new Map<string, IrType>();

  const setTemporaryLocalType = (
    name: string,
    type: IrType | undefined,
    body: () => void
  ): void => {
    if (!type || type.kind === "unknownType") {
      body();
      return;
    }

    const hadPrevious = localTypes.has(name);
    const previous = localTypes.get(name);
    localTypes.set(name, type);
    body();
    if (hadPrevious && previous) {
      localTypes.set(name, previous);
    } else {
      localTypes.delete(name);
    }
  };

  const rememberDeclaration = (decl: ts.VariableDeclaration): void => {
    if (ts.isIdentifier(decl.name)) {
      const declaredType = decl.type
        ? ctx.typeSystem.typeFromSyntax(
            ctx.binding.captureTypeSyntax(decl.type)
          )
        : decl.initializer
          ? resolveSimpleNumericAssignmentType(
              decl.initializer,
              ctx,
              localTypes
            )
          : undefined;
      if (declaredType && declaredType.kind !== "unknownType") {
        localTypes.set(decl.name.text, declaredType);
      }
    }

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

    if (ts.isForOfStatement(node)) {
      const iterableType = resolveSimpleNumericAssignmentType(
        node.expression,
        ctx,
        localTypes
      );
      const elementType = getIterableElementType(iterableType, ctx);
      if (ts.isVariableDeclarationList(node.initializer)) {
        const declaration = node.initializer.declarations[0];
        if (declaration && ts.isIdentifier(declaration.name)) {
          rememberDeclaration(declaration);
          setTemporaryLocalType(declaration.name.text, elementType, () => {
            visit(node.statement);
          });
          return;
        }
      }
      if (ts.isIdentifier(node.initializer)) {
        setTemporaryLocalType(node.initializer.text, elementType, () => {
          visit(node.statement);
        });
        return;
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const candidateDeclId = candidates.get(node.left.text);
      if (
        candidateDeclId !== undefined &&
        isJsNumberType(
          resolveSimpleNumericAssignmentType(node.right, ctx, localTypes)
        )
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

  if (!assignedType || assignedType.kind === "unknownType") {
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

const addAssignedAccessTarget = (
  expr: ts.Expression,
  ctx: ProgramContext,
  targets: Map<string, AccessPathTarget>
): void => {
  const target = getAccessPathTarget(expr, ctx);
  if (!target) {
    return;
  }

  targets.set(getAccessPathKey(target), target);
};

const normalizeFlowResetType = (type: IrType | undefined): IrType | undefined =>
  type?.kind === "unknownType" && type.explicit !== true ? undefined : type;

const optionalReadType = (type: IrType): IrType => {
  if (type.kind === "unionType") {
    return type.types.some(
      (member) =>
        member.kind === "primitiveType" && member.name === "undefined"
    )
      ? type
      : {
          kind: "unionType",
          types: [...type.types, { kind: "primitiveType", name: "undefined" }],
        };
  }

  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

const resolveDeclaredRootAccessType = (
  target: AccessPathTarget,
  ctx: ProgramContext
): IrType | undefined => {
  if (target.kind !== "decl" || target.segments.length !== 0) {
    return undefined;
  }

  const declInfo = (ctx.binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(target.declId);
  const declaration = (declInfo?.valueDeclNode ?? declInfo?.declNode) as
    | ts.Declaration
    | undefined;
  if (!declaration) {
    return normalizeFlowResetType(ctx.typeEnv?.get(target.declId.id));
  }

  if (ts.isVariableDeclaration(declaration) && declaration.type) {
    return normalizeFlowResetType(
      ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(declaration.type)
      )
    );
  }

  if (ts.isParameter(declaration) && declaration.type) {
    const parameterType = ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(declaration.type)
    );
    return normalizeFlowResetType(
      declaration.questionToken ? optionalReadType(parameterType) : parameterType
    );
  }

  return normalizeFlowResetType(ctx.typeEnv?.get(target.declId.id));
};

const collectAssignedAccessTargets = (
  node: ts.Node,
  ctx: ProgramContext
): readonly AccessPathTarget[] => {
  const targets = new Map<string, AccessPathTarget>();

  const visit = (current: ts.Node): void => {
    if (
      current !== node &&
      (ts.isFunctionLike(current) ||
        ts.isClassLike(current) ||
        ts.isInterfaceDeclaration(current) ||
        ts.isTypeAliasDeclaration(current))
    ) {
      return;
    }

    if (
      ts.isBinaryExpression(current) &&
      isAssignmentOperator(current.operatorToken)
    ) {
      addAssignedAccessTarget(current.left, ctx, targets);
    } else if (
      (ts.isPrefixUnaryExpression(current) ||
        ts.isPostfixUnaryExpression(current)) &&
      (current.operator === ts.SyntaxKind.PlusPlusToken ||
        current.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      addAssignedAccessTarget(current.operand, ctx, targets);
    }

    ts.forEachChild(current, visit);
  };

  visit(node);
  return [...targets.values()];
};

const invalidateAssignedAccessTargets = (
  ctx: ProgramContext,
  node: ts.Node
): ProgramContext => {
  let currentCtx = ctx;
  for (const target of collectAssignedAccessTargets(node, ctx)) {
    const clearedCtx = withAssignedAccessPathType(currentCtx, target, undefined);
    const resetType =
      resolveDeclaredRootAccessType(target, currentCtx) ??
      normalizeFlowResetType(getCurrentTypeForAccessPath(target, clearedCtx));
    currentCtx = withAssignedAccessPathType(
      clearedCtx,
      target,
      resetType
    );
  }
  return currentCtx;
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
    let statementFlowHandled = false;

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
        isAssignmentOperator(expr.operatorToken) &&
        single.expression.kind === "assignment"
      ) {
        const target = getAccessPathTarget(expr.left, currentCtx);
        if (target) {
          currentCtx = withAssignedAccessPathType(
            currentCtx,
            target,
            resolveAssignedAccessPathFlowType(
              expr.left,
              expr.operatorToken.kind === ts.SyntaxKind.EqualsToken
                ? single.expression.right.inferredType
                : single.expression.inferredType,
              currentCtx
            )
          );
        }
        statementFlowHandled = true;
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
        statementFlowHandled = true;
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
        if (s.elseStatement) {
          currentCtx = invalidateAssignedAccessTargets(
            currentCtx,
            s.elseStatement
          );
        }
        statementFlowHandled = true;
      }

      if (elseTerminates && !thenTerminates) {
        currentCtx = withAppliedNarrowings(
          currentCtx,
          collectTypeNarrowingsInTruthyExpr(s.expression, currentCtx)
        );
        currentCtx = invalidateAssignedAccessTargets(
          currentCtx,
          s.thenStatement
        );
        statementFlowHandled = true;
      }

      if (thenTerminates && elseTerminates) {
        statementFlowHandled = true;
      }
    }

    if (!statementFlowHandled) {
      currentCtx = invalidateAssignedAccessTargets(currentCtx, s);
    }
  }

  return {
    kind: "blockStatement",
    statements,
  };
};
