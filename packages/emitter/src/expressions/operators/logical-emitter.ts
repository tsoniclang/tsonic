/**
 * Logical operator expression emitter (&&, ||, ??)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  isDefinitelyValueType,
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { isBooleanType } from "./helpers.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

/**
 * Check if an expression AST can still produce a nullable value type.
 * Used to detect nullable value type scenarios in `??` optimization.
 */
const preservesNullableValueFallback = (ast: CSharpExpressionAst): boolean => {
  switch (ast.kind) {
    case "conditionalMemberAccessExpression":
    case "conditionalElementAccessExpression":
      return true;
    case "conditionalExpression":
      return (
        preservesNullableValueFallback(ast.whenTrue) ||
        preservesNullableValueFallback(ast.whenFalse) ||
        (ast.whenTrue.kind === "defaultExpression" &&
          ast.whenTrue.type?.kind === "nullableType") ||
        (ast.whenFalse.kind === "defaultExpression" &&
          ast.whenFalse.type?.kind === "nullableType")
      );
    case "memberAccessExpression":
      return preservesNullableValueFallback(ast.expression);
    case "invocationExpression":
      return preservesNullableValueFallback(ast.expression);
    case "elementAccessExpression":
      return preservesNullableValueFallback(ast.expression);
    case "parenthesizedExpression":
      return preservesNullableValueFallback(ast.expression);
    case "castExpression":
    case "asExpression":
      return preservesNullableValueFallback(ast.expression);
    default:
      return false;
  }
};

const hasUnionMember = (
  type: IrType | undefined,
  predicate: (member: IrType) => boolean
): boolean => {
  if (!type) {
    return false;
  }
  if (type.kind !== "unionType") {
    return predicate(type);
  }
  return type.types.some(predicate);
};

const isRepeatableExpressionAst = (ast: CSharpExpressionAst): boolean => {
  switch (ast.kind) {
    case "identifierExpression":
    case "qualifiedIdentifierExpression":
    case "typeReferenceExpression":
    case "nullLiteralExpression":
    case "booleanLiteralExpression":
    case "stringLiteralExpression":
    case "charLiteralExpression":
    case "numericLiteralExpression":
      return true;
    case "memberAccessExpression":
      return isRepeatableExpressionAst(ast.expression);
    case "elementAccessExpression":
      return (
        isRepeatableExpressionAst(ast.expression) &&
        ast.arguments.every(isRepeatableExpressionAst)
      );
    case "parenthesizedExpression":
    case "castExpression":
    case "asExpression":
    case "suppressNullableWarningExpression":
      return isRepeatableExpressionAst(ast.expression);
    default:
      return false;
  }
};

const getMapValueType = (
  receiverType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!receiverType) {
    return undefined;
  }
  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  if (resolved.kind !== "referenceType" || resolved.name !== "Map") {
    return undefined;
  }
  return resolved.typeArguments?.[1];
};

const isUndefinedPrimitive = (type: IrType): boolean =>
  type.kind === "primitiveType" && type.name === "undefined";

const isNullPrimitive = (type: IrType): boolean =>
  type.kind === "primitiveType" && type.name === "null";

const tryEmitMapGetUndefinedFallback = (
  expr: Extract<IrExpression, { kind: "logical" }>,
  leftAst: CSharpExpressionAst,
  rightAst: CSharpExpressionAst,
  rightContext: EmitterContext,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (expr.operator !== "??" || expr.left.kind !== "call") {
    return undefined;
  }

  const callee = expr.left.callee;
  if (
    callee.kind !== "memberAccess" ||
    callee.isComputed ||
    callee.isOptional ||
    callee.property !== "get"
  ) {
    return undefined;
  }

  if (
    expr.left.arguments.length !== 1 ||
    (typeof expr.left.arguments[0] === "object" &&
      "kind" in expr.left.arguments[0] &&
      expr.left.arguments[0].kind === "spread")
  ) {
    return undefined;
  }

  if (
    !hasUnionMember(expr.left.inferredType, isUndefinedPrimitive) ||
    hasUnionMember(expr.left.inferredType, isNullPrimitive)
  ) {
    return undefined;
  }

  const mapValueType = getMapValueType(callee.object.inferredType, context);
  if (
    !mapValueType ||
    hasUnionMember(mapValueType, isUndefinedPrimitive) ||
    hasUnionMember(mapValueType, isNullPrimitive) ||
    !isDefinitelyValueType(stripNullish(mapValueType))
  ) {
    return undefined;
  }

  if (
    leftAst.kind !== "invocationExpression" ||
    leftAst.expression.kind !== "memberAccessExpression" ||
    leftAst.expression.memberName !== "get" ||
    leftAst.arguments.length !== 1
  ) {
    return undefined;
  }

  const receiverAst = leftAst.expression.expression;
  const argumentAst = leftAst.arguments[0];
  if (!argumentAst) {
    return undefined;
  }
  if (
    !isRepeatableExpressionAst(receiverAst) ||
    !isRepeatableExpressionAst(argumentAst)
  ) {
    return undefined;
  }

  return [
    {
      kind: "conditionalExpression",
      condition: {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: receiverAst,
          memberName: "has",
        },
        arguments: [argumentAst],
      },
      whenTrue: leftAst,
      whenFalse: rightAst,
    },
    rightContext,
  ];
};

/**
 * Emit a logical operator expression as CSharpExpressionAst
 *
 * In TypeScript, || is used both for:
 * 1. Boolean OR (when operands are booleans)
 * 2. Nullish coalescing fallback (when left operand is nullable)
 *
 * In C#:
 * - || only works with booleans
 * - ?? is used for nullish coalescing
 *
 * We check if || is used with non-boolean operands and emit ?? instead.
 */
export const emitLogical = (
  expr: Extract<IrExpression, { kind: "logical" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [leftAst, leftContext] = emitExpressionAst(expr.left, context);

  // If || is used with non-boolean left operand, use ?? instead for nullish coalescing
  const operator =
    expr.operator === "||" && !isBooleanType(expr.left.inferredType)
      ? "??"
      : expr.operator;

  // If the left operand is a non-nullable value type, `??` is invalid in C# and the
  // fallback is unreachable. Emit only the left operand.
  if (
    operator === "??" &&
    expr.left.inferredType &&
    expr.left.inferredType.kind !== "unionType" &&
    isDefinitelyValueType(expr.left.inferredType)
  ) {
    // Conditional access (`?.` / `?[`) produces nullable value types in C# even when the
    // underlying member type is non-nullable (e.g., `string?.Length` → `int?`).
    // In that case the fallback is still meaningful and must be preserved.
    if (!preservesNullableValueFallback(leftAst)) {
      return [leftAst, leftContext];
    }
  }

  const rightExpectedType =
    operator === "??"
      ? (expr.inferredType ?? expr.left.inferredType)
      : undefined;
  const [rightAst, rightContext] = emitExpressionAst(
    expr.right,
    leftContext,
    rightExpectedType
  );

  const mapGetFallback = tryEmitMapGetUndefinedFallback(
    expr,
    leftAst,
    rightAst,
    rightContext,
    context
  );
  if (mapGetFallback) {
    return mapGetFallback;
  }

  return [
    {
      kind: "binaryExpression",
      operatorToken: operator,
      left: leftAst,
      right: rightAst,
    },
    rightContext,
  ];
};
