/**
 * Operator expression converters (binary, unary, update, assignment)
 */

import * as ts from "typescript";
import {
  IrExpression,
  IrUnaryExpression,
  IrUpdateExpression,
  IrBinaryOperator,
  IrAssignmentOperator,
  IrInOperatorPlan,
  IrType,
} from "../../types.js";
import { normalizedUnionType } from "../../types/type-ops.js";
import {
  getSourceSpan,
  convertBinaryOperator,
  isAssignmentOperator,
} from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import {
  collectTypeNarrowingsInTruthyExpr,
  withAppliedNarrowings,
} from "../flow-narrowing.js";
import { resolveInstanceofTargetType } from "../narrowing-resolvers-equality.js";
import { getAccessPathKey, getAccessPathTarget } from "../access-paths.js";
import { getReadableMemberTypeForNarrowing } from "../narrowing-property-helpers.js";
import {
  NumericKind,
  getBinaryResultKind,
  NUMERIC_KIND_TO_TYPE_ALIAS,
  TSONIC_TO_NUMERIC_KIND,
} from "../../types/numeric-kind.js";
import type { ProgramContext } from "../../program-context.js";

const isPureNullishType = (type: IrType | undefined): boolean => {
  if (!type) return false;
  if (type.kind === "primitiveType") {
    return type.name === "null" || type.name === "undefined";
  }
  return (
    type.kind === "unionType" &&
    type.types.length > 0 &&
    type.types.every(
      (member) =>
        member.kind === "primitiveType" &&
        (member.name === "null" || member.name === "undefined")
    )
  );
};

const normalizeIdentifierTargetType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type || type.kind === "unknownType" || type.kind === "anyType") {
    return undefined;
  }
  return type;
};

const deriveIdentifierAssignmentTargetType = (
  node: ts.Identifier,
  ctx: ProgramContext
): IrType | undefined => {
  const declId = ctx.binding.resolveIdentifier(node);
  if (!declId) return undefined;

  const envType = normalizeIdentifierTargetType(ctx.typeEnv?.get(declId.id));
  const declType = normalizeIdentifierTargetType(
    ctx.typeSystem.typeOfValueRead(declId)
  );

  if (isPureNullishType(envType) && declType && !isPureNullishType(declType)) {
    return declType;
  }

  return envType ?? declType;
};

const getNumericKindFromIrType = (
  type: IrType | undefined
): NumericKind | undefined => {
  if (!type) return undefined;

  if (type.kind === "primitiveType") {
    if (type.name === "int") return "int32";
    if (type.name === "number") return "float64";
    return undefined;
  }

  if (type.kind === "referenceType") {
    return TSONIC_TO_NUMERIC_KIND.get(type.name);
  }

  return undefined;
};

const isBigIntType = (type: IrType | undefined): boolean => {
  if (!type) return false;
  return type.kind === "primitiveType" && type.name === "bigint";
};

const numericKindToIrType = (kind: NumericKind): IrType => {
  if (kind === "int32") return { kind: "primitiveType", name: "int" };
  if (kind === "float64") return { kind: "primitiveType", name: "number" };

  const alias = NUMERIC_KIND_TO_TYPE_ALIAS.get(kind) ?? "double";
  return { kind: "referenceType", name: alias };
};

const isNullishPrimitiveType = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const hasNullish = (type: IrType): boolean => {
  if (isNullishPrimitiveType(type)) return true;
  if (type.kind !== "unionType") return false;
  return type.types.some((t) => isNullishPrimitiveType(t));
};

const stripNullishFromUnion = (type: IrType): IrType | undefined => {
  if (isNullishPrimitiveType(type)) return undefined;

  if (type.kind !== "unionType") return type;

  const filtered = type.types.filter((t) => !isNullishPrimitiveType(t));
  if (filtered.length === 0) return undefined;
  if (filtered.length === 1) return filtered[0];
  return { kind: "unionType", types: filtered };
};

const makeUnionType = (types: readonly IrType[]): IrType => {
  return normalizedUnionType(types);
};

const getStaticInOperatorKey = (expr: IrExpression): string | undefined =>
  expr.kind === "literal" && typeof expr.value === "string"
    ? expr.value
    : undefined;

const hasStringKeyCarrier = (
  type: IrType | undefined,
  ctx: ProgramContext,
  seen = new Set<IrType>()
): boolean => {
  if (!type || seen.has(type)) {
    return false;
  }

  seen.add(type);
  const nonNullishType = stripNullishFromUnion(type);
  if (!nonNullishType) {
    return false;
  }

  if (nonNullishType.kind === "dictionaryType") {
    return true;
  }

  if (nonNullishType.kind === "unionType") {
    return (
      nonNullishType.types.length > 0 &&
      nonNullishType.types.every((member) =>
        hasStringKeyCarrier(member, ctx, new Set(seen))
      )
    );
  }

  const indexer = ctx.typeSystem.getIndexerInfo(nonNullishType);
  return indexer?.keyTypeName === "string" || indexer?.keyTypeName === "String";
};

const hasKnownProperty = (
  type: IrType,
  key: string,
  ctx: ProgramContext
): boolean => getReadableMemberTypeForNarrowing(type, key, ctx) !== undefined;

const hasStructuralPropertyUnionCarrier = (
  type: IrType | undefined,
  key: string,
  ctx: ProgramContext
): boolean => {
  if (!type) {
    return false;
  }

  const nonNullishType = stripNullishFromUnion(type);
  if (!nonNullishType || nonNullishType.kind !== "unionType") {
    return false;
  }

  const members = nonNullishType.types;
  if (members.length < 2) {
    return false;
  }

  const presence = members.map((member) => hasKnownProperty(member, key, ctx));
  return presence.some(Boolean) && presence.some((present) => !present);
};

const deriveInOperatorPlan = (
  left: IrExpression,
  right: IrExpression,
  ctx: ProgramContext
): IrInOperatorPlan | undefined => {
  const key = getStaticInOperatorKey(left);
  if (!key) {
    return undefined;
  }

  if (hasStringKeyCarrier(right.inferredType, ctx)) {
    return { kind: "dictionaryKey", key };
  }

  if (hasStructuralPropertyUnionCarrier(right.inferredType, key, ctx)) {
    return { kind: "unionProperty", key };
  }

  return undefined;
};

const withoutExactAssignmentTargetReadNarrowing = (
  expr: ts.Expression,
  ctx: ProgramContext
): ProgramContext => {
  if (!ctx.accessEnv || ctx.accessEnv.size === 0) {
    return ctx;
  }

  const target = getAccessPathTarget(expr, ctx);
  if (!target) {
    return ctx;
  }

  const targetKey = getAccessPathKey(target);
  if (!ctx.accessEnv.has(targetKey)) {
    return ctx;
  }

  const nextAccessEnv = new Map(ctx.accessEnv);
  nextAccessEnv.delete(targetKey);
  return {
    ...ctx,
    accessEnv: nextAccessEnv,
  };
};

/**
 * Derive result type from binary operator and operand types.
 *
 * DETERMINISTIC TYPING:
 * - Arithmetic: both int → int, otherwise double
 * - Comparison: always boolean
 * - Bitwise: int
 * - Logical: derives from operands
 */
const deriveBinaryResultType = (
  operator: string,
  leftType: IrType | undefined,
  rightType: IrType | undefined
): IrType | undefined => {
  // Comparison operators always return boolean
  if (["==", "!=", "===", "!==", "<", ">", "<=", ">="].includes(operator)) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Bitwise operators return int
  if (["&", "|", "^", "<<", ">>", ">>>"].includes(operator)) {
    return { kind: "primitiveType", name: "int" };
  }

  // instanceof returns boolean
  if (operator === "instanceof") {
    return { kind: "primitiveType", name: "boolean" };
  }

  // in operator returns boolean
  if (operator === "in") {
    return { kind: "primitiveType", name: "boolean" };
  }

  // String concatenation: if either is string, result is string
  if (operator === "+") {
    if (
      (leftType?.kind === "primitiveType" && leftType.name === "string") ||
      (rightType?.kind === "primitiveType" && rightType.name === "string")
    ) {
      return { kind: "primitiveType", name: "string" };
    }
  }

  if (operator === "**") {
    if (isBigIntType(leftType) && isBigIntType(rightType)) {
      return { kind: "primitiveType", name: "bigint" };
    }

    const leftKind = getNumericKindFromIrType(leftType);
    const rightKind = getNumericKindFromIrType(rightType);
    if (leftKind !== undefined && rightKind !== undefined) {
      return { kind: "primitiveType", name: "number" };
    }
  }

  // Arithmetic operators: both int → int, otherwise double
  if (["+", "-", "*", "/", "%"].includes(operator)) {
    const leftKind = getNumericKindFromIrType(leftType);
    const rightKind = getNumericKindFromIrType(rightType);

    if (leftKind !== undefined && rightKind !== undefined) {
      const resultKind = getBinaryResultKind(leftKind, rightKind);
      return numericKindToIrType(resultKind);
    }
  }

  // Nullish coalescing: A ?? B returns (A without null/undefined) | B.
  // If A is provably non-nullish, the result is just A (B is unreachable).
  if (operator === "??") {
    if (!leftType) return rightType;
    if (!rightType) return leftType;

    if (!hasNullish(leftType)) return leftType;

    const nonNullLeft = stripNullishFromUnion(leftType);
    if (!nonNullLeft) return rightType;

    // Numeric special-case (airplane-grade, native target-aligned):
    // Even though TS would typically model `A ?? B` as a union, in our numeric model
    // we allow implicit widening (e.g., `double? ?? int` → double). Preserve that
    // deterministically for numeric kinds.
    const leftKind = getNumericKindFromIrType(nonNullLeft);
    const rightKind = getNumericKindFromIrType(rightType);
    if (leftKind !== undefined && rightKind !== undefined) {
      const resultKind = getBinaryResultKind(leftKind, rightKind);
      return numericKindToIrType(resultKind);
    }

    return makeUnionType([nonNullLeft, rightType]);
  }

  // Logical operators: result type is one of the operand types
  // For &&, || the result depends on which branch is taken
  if (operator === "&&" || operator === "||") {
    return leftType ?? rightType;
  }

  return undefined;
};

/**
 * Derive result type from unary operator and operand type.
 */
const deriveUnaryResultType = (
  operator: string,
  operandType: IrType | undefined
): IrType | undefined => {
  // Logical not always returns boolean
  if (operator === "!") {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Bitwise not returns int
  if (operator === "~") {
    return { kind: "primitiveType", name: "int" };
  }

  // Numeric + and - return same type as operand
  if (operator === "+" || operator === "-") {
    return operandType;
  }

  if (operator === "void") {
    return { kind: "voidType" };
  }

  // ++/-- return same type as operand
  if (operator === "++" || operator === "--") {
    return operandType;
  }

  return operandType;
};

/**
 * Convert binary expression (including logical and assignment)
 *
 * Threads expectedType through:
 * - Assignment RHS: gets LHS type
 * - Nullish coalescing (??): RHS gets expectedType (fallback value)
 * - Logical OR (||): RHS gets expectedType (fallback value)
 */
export const convertBinaryExpression = (
  node: ts.BinaryExpression,
  ctx: ProgramContext,
  expectedType?: IrType
): IrExpression => {
  const operator = convertBinaryOperator(node.operatorToken);
  const sourceSpan = getSourceSpan(node);

  // Handle assignment separately
  // Thread LHS type to RHS for deterministic typing (e.g., x = 10 where x: int)
  if (isAssignmentOperator(node.operatorToken)) {
    const leftCtx = withoutExactAssignmentTargetReadNarrowing(node.left, ctx);

    // DETERMINISTIC: derive the storage type for identifier assignment targets.
    const leftExpr = ts.isIdentifier(node.left)
      ? {
          kind: "identifier" as const,
          name: node.left.text,
          inferredType: deriveIdentifierAssignmentTargetType(node.left, ctx),
          sourceSpan: getSourceSpan(node.left),
        }
      : convertExpression(node.left, leftCtx, undefined);

    const lhsType = leftExpr.inferredType;
    const rightExpr = convertExpression(node.right, ctx, lhsType);

    return {
      kind: "assignment",
      operator: operator as IrAssignmentOperator,
      left: leftExpr,
      right: rightExpr,
      inferredType: lhsType, // Assignment result is LHS type
      sourceSpan,
    };
  }

  // Handle logical operators
  // For ?? and ||, the RHS is the fallback value, so it gets expectedType
  // For &&, the RHS is only reached if LHS is truthy, no type coercion needed
  if (operator === "&&" || operator === "||" || operator === "??") {
    const leftExpr = convertExpression(node.left, ctx, undefined);
    const lhsFallbackExpectedType =
      operator === "??" || operator === "||"
        ? leftExpr.inferredType
          ? stripNullishFromUnion(leftExpr.inferredType)
          : undefined
        : undefined;
    const rhsExpectedType =
      operator === "??" || operator === "||"
        ? (expectedType ?? lhsFallbackExpectedType)
        : undefined;
    const rhsCtx =
      operator === "&&"
        ? withAppliedNarrowings(
            ctx,
            collectTypeNarrowingsInTruthyExpr(node.left, ctx)
          )
        : ctx;
    const rightExpr = convertExpression(node.right, rhsCtx, rhsExpectedType);

    return {
      kind: "logical",
      operator,
      left: leftExpr,
      right: rightExpr,
      inferredType: deriveBinaryResultType(
        operator,
        leftExpr.inferredType,
        rightExpr.inferredType
      ),
      sourceSpan,
    };
  }

  // Regular binary expression
  const leftExpr = convertExpression(node.left, ctx, undefined);
  const convertedRightExpr = convertExpression(node.right, ctx, undefined);
  const instanceofTargetType =
    operator === "instanceof"
      ? resolveInstanceofTargetType(node.right, ctx)
      : undefined;
  const rightExpr: IrExpression =
    instanceofTargetType !== undefined
      ? ({
          ...convertedRightExpr,
          inferredType: instanceofTargetType,
        } as IrExpression)
      : convertedRightExpr;

  return {
    kind: "binary",
    operator: operator as IrBinaryOperator,
    left: leftExpr,
    right: rightExpr,
    ...(operator === "in"
      ? { inOperatorPlan: deriveInOperatorPlan(leftExpr, rightExpr, ctx) }
      : {}),
    inferredType: deriveBinaryResultType(
      operator,
      leftExpr.inferredType,
      rightExpr.inferredType
    ),
    sourceSpan,
  };
};

/**
 * Convert prefix unary expression
 */
export const convertUnaryExpression = (
  node: ts.PrefixUnaryExpression,
  ctx: ProgramContext
): IrUnaryExpression | IrUpdateExpression => {
  const sourceSpan = getSourceSpan(node);
  const operandExpr = convertExpression(node.operand, ctx, undefined);
  const isNegativeZeroLiteral =
    node.operator === ts.SyntaxKind.MinusToken &&
    operandExpr.kind === "literal" &&
    typeof operandExpr.value === "number" &&
    Object.is(operandExpr.value, 0);
  const effectiveOperandExpr = isNegativeZeroLiteral
    ? ({
        ...operandExpr,
        raw: "0.0",
        numericIntent: "float64",
        inferredType: { kind: "primitiveType", name: "number" },
      } as const)
    : operandExpr;

  // Check if it's an increment/decrement (++ or --)
  if (
    node.operator === ts.SyntaxKind.PlusPlusToken ||
    node.operator === ts.SyntaxKind.MinusMinusToken
  ) {
    const updateOperator =
      node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--";
    return {
      kind: "update",
      operator: updateOperator,
      prefix: true,
      expression: effectiveOperandExpr,
      inferredType: deriveUnaryResultType(
        updateOperator,
        effectiveOperandExpr.inferredType
      ),
      sourceSpan,
    };
  }

  // Handle regular unary operators
  let operator: IrUnaryExpression["operator"] = "+";

  switch (node.operator) {
    case ts.SyntaxKind.PlusToken:
      operator = "+";
      break;
    case ts.SyntaxKind.MinusToken:
      operator = "-";
      break;
    case ts.SyntaxKind.ExclamationToken:
      operator = "!";
      break;
    case ts.SyntaxKind.TildeToken:
      operator = "~";
      break;
  }

  return {
    kind: "unary",
    operator,
    expression: effectiveOperandExpr,
    inferredType: deriveUnaryResultType(
      operator,
      effectiveOperandExpr.inferredType
    ),
    sourceSpan,
  };
};

/**
 * Convert postfix unary expression (++ or --)
 *
 * DETERMINISTIC TYPING: Result type derived from operand type.
 * ++/-- return same type as operand (int → int, number → number)
 */
export const convertUpdateExpression = (
  node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression,
  ctx: ProgramContext
): IrUpdateExpression => {
  const sourceSpan = getSourceSpan(node);

  if (ts.isPrefixUnaryExpression(node)) {
    // Check if it's an increment or decrement
    if (
      node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken
    ) {
      const operandExpr = convertExpression(node.operand, ctx, undefined);
      const updateOperator =
        node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--";
      return {
        kind: "update",
        operator: updateOperator,
        prefix: true,
        expression: operandExpr,
        inferredType: deriveUnaryResultType(
          updateOperator,
          operandExpr.inferredType
        ),
        sourceSpan,
      };
    }
  }

  // Handle postfix unary expression
  const postfix = node as ts.PostfixUnaryExpression;
  const operandExpr = convertExpression(postfix.operand, ctx, undefined);
  const updateOperator =
    postfix.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--";
  return {
    kind: "update",
    operator: updateOperator,
    prefix: false,
    expression: operandExpr,
    inferredType: deriveUnaryResultType(
      updateOperator,
      operandExpr.inferredType
    ),
    sourceSpan,
  };
};
