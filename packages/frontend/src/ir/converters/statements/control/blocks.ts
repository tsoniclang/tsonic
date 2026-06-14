/**
 * Block statement converter
 *
 * Uses ProgramContext for block conversion.
 */

import {
  forEachTstsChild,
  getTstsDeclaredTypeNode,
  getTstsIdentifierText,
  isTstsOptionalParameter,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
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
import { getSourceSemanticIrType } from "../../../expression-converter-helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import { withVariableTypeEnv } from "../../type-env.js";
import { withAssignedAccessPathType } from "../../assignment-flow-env.js";
import {
  getAccessPathTarget,
  getAccessPathKey,
  getCurrentTypeForAccessPath,
  getCurrentTypeForAccessExpression,
  type AccessPathTarget,
} from "../../access-paths.js";
import { getReadableMemberTypeForNarrowing } from "../../narrowing-property-helpers.js";
import { isAssignmentOperator } from "../../expressions/helpers.js";
import { definedTstsNodes } from "../helpers.js";
import { withBranchLoweringPlan } from "../../branch-flow-env.js";

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
  expression: TstsNode
): string | undefined => {
  if (expression.Kind === TstsSyntax.KindNumericLiteral) {
    return TstsSyntax.Node_Text(expression);
  }

  if (
    TstsSyntax.IsPrefixUnaryExpression(expression) &&
    TstsSyntax.AsPrefixUnaryExpression(expression)?.Operand?.Kind ===
      TstsSyntax.KindNumericLiteral &&
    (TstsSyntax.AsPrefixUnaryExpression(expression)?.Operator ===
      TstsSyntax.KindMinusToken ||
      TstsSyntax.AsPrefixUnaryExpression(expression)?.Operator ===
        TstsSyntax.KindPlusToken)
  ) {
    const prefix = TstsSyntax.AsPrefixUnaryExpression(expression);
    return `${prefix?.Operator === TstsSyntax.KindMinusToken ? "-" : ""}${
      prefix?.Operand ? TstsSyntax.Node_Text(prefix.Operand) : ""
    }`;
  }

  return undefined;
};

const getNumericLiteralExpressionType = (
  expression: TstsNode
): IrType | undefined => {
  const text = getSignedNumericLiteralText(expression);
  if (text === undefined) {
    return undefined;
  }
  return Number.isInteger(Number(text)) ? intType : numberType;
};

const isIntegerNumericLiteralExpression = (
  expression: TstsNode
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
  identifier: TstsNode,
  ctx: ProgramContext,
  localTypes?: ReadonlyMap<string, IrType>
): IrType | undefined => {
  const identifierText = getTstsIdentifierText(identifier);
  const localType = identifierText ? localTypes?.get(identifierText) : undefined;
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
  expression: TstsNode,
  ctx: ProgramContext,
  localTypes?: ReadonlyMap<string, IrType>
): IrType | undefined => {
  const literalType = getNumericLiteralExpressionType(expression);
  if (literalType) {
    return literalType;
  }

  if (TstsSyntax.IsIdentifier(expression)) {
    return resolveIdentifierReadType(expression, ctx, localTypes);
  }

  if (TstsSyntax.IsCallExpression(expression)) {
    const args = definedTstsNodes(TstsSyntax.Node_Arguments(expression));
    const argumentTypes = args.map((argument) =>
      TstsSyntax.IsSpreadElement(argument)
        ? undefined
        : resolveSimpleNumericAssignmentType(argument, ctx, localTypes)
    );
    const sourceReturnType = getSourceSemanticIrType(
      ctx.sourceSemantics.getExpressionType(expression),
      expression,
      ctx,
    );
    if (sourceReturnType && sourceReturnType.kind !== "unknownType") {
      return sourceReturnType;
    }

    const sigId = ctx.binding.resolveCallSignature(expression);
    if (!sigId) {
      return undefined;
    }
    const resolved = ctx.typeSystem.resolveCall({
      sigId,
      argumentCount: args.length,
      argTypes: argumentTypes,
    });
    return resolved.returnType.kind === "unknownType"
      ? undefined
      : resolved.returnType;
  }

  if (
    TstsSyntax.IsPropertyAccessExpression(expression)
  ) {
    const receiverType = resolveSimpleNumericAssignmentType(
      TstsSyntax.Node_Expression(expression) ?? expression,
      ctx,
      localTypes
    );
    if (!receiverType) {
      return undefined;
    }
    return getReadableMemberTypeForNarrowing(
      receiverType,
      getTstsIdentifierText(TstsSyntax.Node_Name(expression)) ?? "",
      ctx
    );
  }

  if (TstsSyntax.IsParenthesizedExpression(expression)) {
    return resolveSimpleNumericAssignmentType(
      TstsSyntax.Node_Expression(expression) ?? expression,
      ctx,
      localTypes
    );
  }

  if (TstsSyntax.IsNonNullExpression(expression)) {
    return stripRuntimeNullish(
      resolveSimpleNumericAssignmentType(
        TstsSyntax.Node_Expression(expression) ?? expression,
        ctx,
        localTypes
      )
    );
  }

  if (
    TstsSyntax.IsElementAccessExpression(expression) &&
    TstsSyntax.AsElementAccessExpression(expression)?.ArgumentExpression
  ) {
    const argumentExpression =
      TstsSyntax.AsElementAccessExpression(expression)?.ArgumentExpression;
    if (
      argumentExpression?.Kind === TstsSyntax.KindStringLiteral ||
      argumentExpression?.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral
    ) {
      const receiverType = resolveSimpleNumericAssignmentType(
        TstsSyntax.Node_Expression(expression) ?? expression,
        ctx,
        localTypes
      );
      if (!receiverType) {
        return undefined;
      }
      return getReadableMemberTypeForNarrowing(
        receiverType,
        argumentExpression ? (TstsSyntax.Node_Text(argumentExpression) ?? "") : "",
        ctx
      );
    }

    return getArrayElementType(
      resolveSimpleNumericAssignmentType(
        TstsSyntax.Node_Expression(expression) ?? expression,
        ctx,
        localTypes
      )
    );
  }

  if (TstsSyntax.IsBinaryExpression(expression)) {
    const binary = TstsSyntax.AsBinaryExpression(expression);
    const operator = binary?.OperatorToken?.Kind;
    if (
      operator !== TstsSyntax.KindPlusToken &&
      operator !== TstsSyntax.KindMinusToken &&
      operator !== TstsSyntax.KindAsteriskToken &&
      operator !== TstsSyntax.KindSlashToken &&
      operator !== TstsSyntax.KindPercentToken
    ) {
      return undefined;
    }

    const leftType = resolveSimpleNumericAssignmentType(
      binary?.Left ?? expression,
      ctx,
      localTypes
    );
    const rightType = resolveSimpleNumericAssignmentType(
      binary?.Right ?? expression,
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
  decl: TstsNode,
  declarationList: TstsNode
): boolean => {
  const flags = TstsSyntax.AsVariableDeclarationList(declarationList)?.Flags ?? 0;
  const name = TstsSyntax.Node_Name(decl);
  const initializer = TstsSyntax.Node_Initializer(decl);
  return (
    ((flags & TstsSyntax.NodeFlagsConst) === 0 ||
      (flags & TstsSyntax.NodeFlagsLet) !== 0) &&
    !!name &&
    TstsSyntax.IsIdentifier(name) &&
    getTstsDeclaredTypeNode(decl) === undefined &&
    !!initializer &&
    isIntegerNumericLiteralExpression(initializer)
  );
};

const collectMutableNumericLiteralWideningDeclIds = (
  block: TstsNode,
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

  const rememberDeclaration = (decl: TstsNode): void => {
    const name = TstsSyntax.Node_Name(decl);
    if (name && TstsSyntax.IsIdentifier(name)) {
      const typeNode = getTstsDeclaredTypeNode(decl);
      const initializer = TstsSyntax.Node_Initializer(decl);
      const declaredType = typeNode
        ? ctx.typeSystem.typeFromSyntax(
            ctx.binding.captureTypeSyntax(typeNode)
          )
        : initializer
          ? resolveSimpleNumericAssignmentType(
              initializer,
              ctx,
              localTypes
            )
          : undefined;
      if (declaredType && declaredType.kind !== "unknownType") {
        const nameText = getTstsIdentifierText(name);
        if (nameText) localTypes.set(nameText, declaredType);
      }
    }

    const parent = decl.Parent;
    if (
      !parent ||
      !TstsSyntax.IsVariableDeclarationList(parent) ||
      !isMutableIntegerLiteralDeclaration(decl, parent)
    ) {
      return;
    }

    if (name) {
      const declId = ctx.binding.resolveIdentifier(name);
      const nameText = getTstsIdentifierText(name);
      if (declId && nameText) {
        candidates.set(nameText, declId.id);
      }
    }
  };

  const visit = (node: TstsNode): void => {
    if (
      TstsSyntax.IsFunctionDeclaration(node) ||
      TstsSyntax.IsFunctionExpression(node) ||
      TstsSyntax.IsArrowFunction(node) ||
      TstsSyntax.IsMethodDeclaration(node) ||
      TstsSyntax.IsConstructorDeclaration(node) ||
      TstsSyntax.IsClassDeclaration(node) ||
      TstsSyntax.IsClassExpression(node) ||
      TstsSyntax.IsInterfaceDeclaration(node) ||
      TstsSyntax.IsTypeAliasDeclaration(node)
    ) {
      return;
    }

    if (TstsSyntax.IsVariableDeclaration(node)) {
      rememberDeclaration(node);
      return;
    }

    if (TstsSyntax.IsForOfStatement(node)) {
      const forOf = TstsSyntax.AsForInOrOfStatement(node);
      const iterableType = resolveSimpleNumericAssignmentType(
        forOf?.Expression ?? node,
        ctx,
        localTypes
      );
      const elementType = getIterableElementType(iterableType, ctx);
      if (
        forOf?.Initializer &&
        TstsSyntax.IsVariableDeclarationList(forOf.Initializer)
      ) {
        const declaration = definedTstsNodes(
          TstsSyntax.AsVariableDeclarationList(forOf.Initializer)?.Declarations
            ?.Nodes
        )[0];
        const name = declaration ? TstsSyntax.Node_Name(declaration) : undefined;
        if (declaration && name && TstsSyntax.IsIdentifier(name)) {
          rememberDeclaration(declaration);
          setTemporaryLocalType(getTstsIdentifierText(name) ?? "", elementType, () => {
            if (forOf.Statement) visit(forOf.Statement);
          });
          return;
        }
      }
      if (forOf?.Initializer && TstsSyntax.IsIdentifier(forOf.Initializer)) {
        setTemporaryLocalType(
          getTstsIdentifierText(forOf.Initializer) ?? "",
          elementType,
          () => {
            if (forOf.Statement) visit(forOf.Statement);
          }
        );
        return;
      }
    }

    if (
      TstsSyntax.IsBinaryExpression(node) &&
      TstsSyntax.AsBinaryExpression(node)?.OperatorToken?.Kind ===
        TstsSyntax.KindEqualsToken &&
      TstsSyntax.AsBinaryExpression(node)?.Left &&
      TstsSyntax.IsIdentifier(TstsSyntax.AsBinaryExpression(node)?.Left)
    ) {
      const binary = TstsSyntax.AsBinaryExpression(node);
      const left = binary?.Left;
      const candidateDeclId = left
        ? candidates.get(getTstsIdentifierText(left) ?? "")
        : undefined;
      if (
        candidateDeclId !== undefined &&
        isJsNumberType(
          resolveSimpleNumericAssignmentType(binary?.Right ?? node, ctx, localTypes)
        )
      ) {
        wideningDeclIds.add(candidateDeclId);
      }
    }

    forEachTstsChild(node, (child) => {
      if (child) visit(child);
    });
  };

  for (const statement of definedTstsNodes(TstsSyntax.Node_Statements(block))) {
    visit(statement);
  }

  return wideningDeclIds.size > 0 ? wideningDeclIds : undefined;
};

const tryResolveReadableAssignedAccessType = (
  expr: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  if (TstsSyntax.IsPropertyAccessExpression(expr)) {
    const receiverType = getCurrentTypeForAccessExpression(
      TstsSyntax.Node_Expression(expr) ?? expr,
      ctx
    );
    if (!receiverType) {
      return undefined;
    }

    return getReadableMemberTypeForNarrowing(
      receiverType,
      getTstsIdentifierText(TstsSyntax.Node_Name(expr)) ?? "",
      ctx
    );
  }

  if (TstsSyntax.IsElementAccessExpression(expr)) {
    const propertyExpr = TstsSyntax.AsElementAccessExpression(expr)
      ?.ArgumentExpression;
    if (
      !propertyExpr ||
      (propertyExpr.Kind !== TstsSyntax.KindStringLiteral &&
        propertyExpr.Kind !== TstsSyntax.KindNoSubstitutionTemplateLiteral)
    ) {
      return undefined;
    }

    const receiverType = getCurrentTypeForAccessExpression(
      TstsSyntax.Node_Expression(expr) ?? expr,
      ctx
    );
    if (!receiverType) {
      return undefined;
    }

    return getReadableMemberTypeForNarrowing(
      receiverType,
      TstsSyntax.Node_Text(propertyExpr) ?? "",
      ctx
    );
  }

  return undefined;
};

const resolveAssignedAccessPathFlowType = (
  expr: TstsNode,
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
  expr: TstsNode,
  ctx: ProgramContext,
  targets: Map<string, AccessPathTarget>
): void => {
  const target = getAccessPathTarget(expr, ctx);
  if (!target) {
    return;
  }

  targets.set(getAccessPathKey(target), target);
};

const normalizeFlowResetType = (
  type: IrType | undefined
): IrType | undefined =>
  type?.kind === "unknownType" && type.explicit !== true ? undefined : type;

const optionalReadType = (type: IrType): IrType => {
  if (type.kind === "unionType") {
    return type.types.some(
      (member) => member.kind === "primitiveType" && member.name === "undefined"
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

  const declaration = ctx.binding.getValueDeclarationNode(target.declId);
  if (!declaration) {
    return normalizeFlowResetType(ctx.typeEnv?.get(target.declId.id));
  }

  if (
    TstsSyntax.IsVariableDeclaration(declaration) &&
    getTstsDeclaredTypeNode(declaration)
  ) {
    return normalizeFlowResetType(
      ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(getTstsDeclaredTypeNode(declaration)!)
      )
    );
  }

  if (
    TstsSyntax.IsParameterDeclaration(declaration) &&
    getTstsDeclaredTypeNode(declaration)
  ) {
    const parameterType = ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(getTstsDeclaredTypeNode(declaration)!)
    );
    return normalizeFlowResetType(
      isTstsOptionalParameter(declaration)
        ? optionalReadType(parameterType)
        : parameterType
    );
  }

  return normalizeFlowResetType(ctx.typeEnv?.get(target.declId.id));
};

const collectAssignedAccessTargets = (
  node: TstsNode,
  ctx: ProgramContext
): readonly AccessPathTarget[] => {
  const targets = new Map<string, AccessPathTarget>();

  const visit = (current: TstsNode): void => {
    if (
      current !== node &&
      (TstsSyntax.IsFunctionDeclaration(current) ||
        TstsSyntax.IsFunctionExpression(current) ||
        TstsSyntax.IsArrowFunction(current) ||
        TstsSyntax.IsMethodDeclaration(current) ||
        TstsSyntax.IsConstructorDeclaration(current) ||
        TstsSyntax.IsClassDeclaration(current) ||
        TstsSyntax.IsClassExpression(current) ||
        TstsSyntax.IsInterfaceDeclaration(current) ||
        TstsSyntax.IsTypeAliasDeclaration(current))
    ) {
      return;
    }

    if (
      TstsSyntax.IsBinaryExpression(current) &&
      isAssignmentOperator(TstsSyntax.AsBinaryExpression(current)?.OperatorToken)
    ) {
      const left = TstsSyntax.AsBinaryExpression(current)?.Left;
      if (left) addAssignedAccessTarget(left, ctx, targets);
    } else if (
      (TstsSyntax.IsPrefixUnaryExpression(current) ||
        TstsSyntax.IsPostfixUnaryExpression(current)) &&
      (TstsSyntax.AsPrefixUnaryExpression(current)?.Operator ===
        TstsSyntax.KindPlusPlusToken ||
        TstsSyntax.AsPrefixUnaryExpression(current)?.Operator ===
          TstsSyntax.KindMinusMinusToken ||
        TstsSyntax.AsPostfixUnaryExpression(current)?.Operator ===
          TstsSyntax.KindPlusPlusToken ||
        TstsSyntax.AsPostfixUnaryExpression(current)?.Operator ===
          TstsSyntax.KindMinusMinusToken)
    ) {
      const operand =
        TstsSyntax.AsPrefixUnaryExpression(current)?.Operand ??
        TstsSyntax.AsPostfixUnaryExpression(current)?.Operand;
      if (operand) addAssignedAccessTarget(operand, ctx, targets);
    }

    forEachTstsChild(current, (child) => {
      if (child) visit(child);
    });
  };

  visit(node);
  return [...targets.values()];
};

const invalidateAssignedAccessTargets = (
  ctx: ProgramContext,
  node: TstsNode
): ProgramContext => {
  let currentCtx = ctx;
  for (const target of collectAssignedAccessTargets(node, ctx)) {
    const clearedCtx = withAssignedAccessPathType(
      currentCtx,
      target,
      undefined
    );
    const resetType =
      resolveDeclaredRootAccessType(target, currentCtx) ??
      normalizeFlowResetType(getCurrentTypeForAccessPath(target, clearedCtx));
    currentCtx = withAssignedAccessPathType(clearedCtx, target, resetType);
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
  node: TstsNode,
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

  const blockStatements = definedTstsNodes(TstsSyntax.Node_Statements(node));
  for (let index = 0; index < blockStatements.length; index++) {
    const s = blockStatements[index];
    if (!s) continue;
    const converted = convertStatement(s, currentCtx, expectedReturnType);
    statements.push(...flattenStatementResult(converted));
    let statementFlowHandled = false;

    // Variable declarations introduce new bindings. Thread their inferred types forward
    // so later statements in the same block can use deterministic types (no "unknown").
    if (
      TstsSyntax.IsVariableStatement(s) &&
      converted !== null &&
      !Array.isArray(converted)
    ) {
      const single = converted as IrStatement;
      if (single.kind !== "variableDeclaration") continue;
      const varDecl = single as IrVariableDeclaration;
      const declarationList = TstsSyntax.AsVariableStatement(s)?.DeclarationList;
      currentCtx = withVariableTypeEnv(
        currentCtx,
        definedTstsNodes(
          TstsSyntax.AsVariableDeclarationList(declarationList)?.Declarations
            ?.Nodes
        ),
        varDecl
      );
    }

    if (
      TstsSyntax.IsExpressionStatement(s) &&
      converted !== null &&
      !Array.isArray(converted)
    ) {
      const single = converted as IrStatement;
      if (single.kind !== "expressionStatement") {
        continue;
      }

      const expr = TstsSyntax.Node_Expression(s);
      if (!expr) {
        continue;
      }
      if (
        TstsSyntax.IsBinaryExpression(expr) &&
        isAssignmentOperator(TstsSyntax.AsBinaryExpression(expr)?.OperatorToken) &&
        single.expression.kind === "assignment"
      ) {
        const binary = TstsSyntax.AsBinaryExpression(expr);
        const target = binary?.Left
          ? getAccessPathTarget(binary.Left, currentCtx)
          : undefined;
        if (target) {
          currentCtx = withAssignedAccessPathType(
            currentCtx,
            target,
            resolveAssignedAccessPathFlowType(
              binary?.Left ?? expr,
              binary?.OperatorToken?.Kind === TstsSyntax.KindEqualsToken
                ? single.expression.right.inferredType
                : single.expression.inferredType,
              currentCtx
            )
          );
        }
        statementFlowHandled = true;
      }

      if (
        (TstsSyntax.IsPrefixUnaryExpression(expr) ||
          TstsSyntax.IsPostfixUnaryExpression(expr)) &&
        (TstsSyntax.AsPrefixUnaryExpression(expr)?.Operator ===
          TstsSyntax.KindPlusPlusToken ||
          TstsSyntax.AsPrefixUnaryExpression(expr)?.Operator ===
            TstsSyntax.KindMinusMinusToken ||
          TstsSyntax.AsPostfixUnaryExpression(expr)?.Operator ===
            TstsSyntax.KindPlusPlusToken ||
          TstsSyntax.AsPostfixUnaryExpression(expr)?.Operator ===
            TstsSyntax.KindMinusMinusToken)
      ) {
        const operand =
          TstsSyntax.AsPrefixUnaryExpression(expr)?.Operand ??
          TstsSyntax.AsPostfixUnaryExpression(expr)?.Operand;
        const target = operand
          ? getAccessPathTarget(operand, currentCtx)
          : undefined;
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
      TstsSyntax.IsIfStatement(s) &&
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

      const ifNode = TstsSyntax.AsIfStatement(s);
      if (thenTerminates && !elseTerminates) {
        if (ifNode?.ElseStatement) {
          currentCtx = invalidateAssignedAccessTargets(
            currentCtx,
            ifNode.ElseStatement
          );
        }
        currentCtx = withBranchLoweringPlan(
          currentCtx,
          ifStatement.elsePlan
        );
        statementFlowHandled = true;
      }

      if (elseTerminates && !thenTerminates) {
        if (ifNode?.ThenStatement) {
          currentCtx = invalidateAssignedAccessTargets(
            currentCtx,
            ifNode.ThenStatement
          );
        }
        currentCtx = withBranchLoweringPlan(
          currentCtx,
          ifStatement.thenPlan
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
