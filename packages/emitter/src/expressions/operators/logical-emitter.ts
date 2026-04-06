/**
 * Logical operator expression emitter (&&, ||, ??)
 */

import { IrExpression, IrType, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import { resolveDirectValueSurfaceType } from "../../core/semantic/direct-value-surfaces.js";
import {
  isDefinitelyValueType,
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { isBroadObjectSlotType } from "../../core/semantic/js-value-types.js";
import { isBooleanType } from "./helpers.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { adaptValueToExpectedTypeAst } from "../expected-type-adaptation.js";

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

const getBareTypeParameterName = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind === "typeParameterType") {
    return type.name;
  }

  if (
    type.kind === "referenceType" &&
    (context.typeParameters?.has(type.name) ?? false) &&
    (!type.typeArguments || type.typeArguments.length === 0)
  ) {
    return type.name;
  }

  return undefined;
};

const getUnconstrainedTypeParameterName = (
  type: IrType | undefined,
  context: EmitterContext
): string | undefined => {
  if (!type) {
    return undefined;
  }

  const bareName = getBareTypeParameterName(stripNullish(type), context);
  if (!bareName) {
    return undefined;
  }

  const constraintKind =
    context.typeParamConstraints?.get(bareName) ?? "unconstrained";
  return constraintKind === "unconstrained" ? bareName : undefined;
};

const buildSingleEvalGenericNullishAst = (
  expr: Extract<IrExpression, { kind: "logical" }>,
  leftAst: CSharpExpressionAst,
  leftContext: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (expr.operator !== "??") {
    return undefined;
  }

  const leftType = expr.left.inferredType;
  if (!getUnconstrainedTypeParameterName(leftType, leftContext)) {
    return undefined;
  }

  const rightType = expr.right.inferredType;
  const nonNullLeftType = leftType ? stripNullish(leftType) : undefined;
  const synthesizedUnionTarget =
    nonNullLeftType && rightType
      ? stableIrTypeKey(nonNullLeftType) === stableIrTypeKey(rightType)
        ? nonNullLeftType
        : ({
            kind: "unionType",
            types: [nonNullLeftType, rightType],
          } satisfies IrType)
      : undefined;
  const targetType = expectedType ?? synthesizedUnionTarget ?? expr.inferredType;
  if (!targetType) {
    return undefined;
  }

  const tempName = "__tsonic_nullish_value";
  const [parameterTypeAst, parameterTypeContext] = emitTypeAst(
    leftType ?? { kind: "anyType" },
    leftContext
  );
  const [returnTypeAst, returnTypeContext] = emitTypeAst(
    targetType,
    parameterTypeContext
  );

  const tempIdentifier: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  const [rawRightAst, rightContext] = emitExpressionAst(
    expr.right,
    returnTypeContext,
    targetType
  );

  const adaptedLeft =
    adaptValueToExpectedTypeAst({
      valueAst: tempIdentifier,
      actualType: leftType,
      context: rightContext,
      expectedType: targetType,
    }) ?? [tempIdentifier, rightContext];
  const adaptedRight =
    adaptValueToExpectedTypeAst({
      valueAst: rawRightAst,
      actualType: rightType,
      context: adaptedLeft[1],
      expectedType: targetType,
    }) ?? [rawRightAst, adaptedLeft[1]];

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "parenthesizedExpression",
        expression: {
          kind: "castExpression",
          type: identifierType("global::System.Func", [
            parameterTypeAst,
            returnTypeAst,
          ]),
          expression: {
            kind: "parenthesizedExpression",
            expression: {
              kind: "lambdaExpression",
              isAsync: false,
              parameters: [{ name: tempName, type: parameterTypeAst }],
              body: {
                kind: "conditionalExpression",
                condition: {
                  kind: "binaryExpression",
                  operatorToken: "==",
                  left: {
                    kind: "castExpression",
                    type: { kind: "predefinedType", keyword: "object" },
                    expression: tempIdentifier,
                  },
                  right: { kind: "nullLiteralExpression" },
                },
                whenTrue: adaptedRight[0],
                whenFalse: adaptedLeft[0],
              },
            },
          },
        },
      },
      arguments: [leftAst],
    },
    adaptedRight[1],
  ];
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

const isNullishOnlyType = (type: IrType | undefined): boolean => {
  if (!type) {
    return false;
  }
  if (type.kind !== "unionType") {
    return isNullPrimitive(type) || isUndefinedPrimitive(type);
  }
  return type.types.every(
    (member) => isNullPrimitive(member) || isUndefinedPrimitive(member)
  );
};

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
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const [leftAst, leftContext] = emitExpressionAst(expr.left, context);

  // If || is used with non-boolean left operand, use ?? instead for nullish coalescing
  const operator =
    expr.operator === "||" && !isBooleanType(expr.left.inferredType)
      ? "??"
      : expr.operator;

  // If the left operand is a non-nullable value type, `??` is invalid in C# and the
  // fallback is unreachable. Emit only the left operand.
  const directLeftStorageType = resolveDirectValueSurfaceType(
    leftAst,
    leftContext
  );
  const leftPreservesRuntimeNullish =
    hasUnionMember(directLeftStorageType, isUndefinedPrimitive) ||
    hasUnionMember(directLeftStorageType, isNullPrimitive);
  if (
    operator === "??" &&
    expr.left.inferredType &&
    expr.left.inferredType.kind !== "unionType" &&
    isDefinitelyValueType(expr.left.inferredType)
  ) {
    // Conditional access (`?.` / `?[`) produces nullable value types in C# even when the
    // underlying member type is non-nullable (e.g., `string?.Length` → `int?`).
    // In that case the fallback is still meaningful and must be preserved.
    if (!preservesNullableValueFallback(leftAst) && !leftPreservesRuntimeNullish) {
      return [leftAst, leftContext];
    }
  }

  const genericNullish = buildSingleEvalGenericNullishAst(
    { ...expr, operator },
    leftAst,
    leftContext,
    expectedType
  );
  if (genericNullish) {
    return genericNullish;
  }

  const rightExpectedType =
    operator === "??"
      ? expectedType && isBroadObjectSlotType(expectedType, leftContext)
        ? isNullishOnlyType(expr.right.inferredType)
          ? (expectedType ?? expr.inferredType ?? expr.left.inferredType)
          : (expr.inferredType ?? expr.left.inferredType)
        : (expectedType ?? expr.inferredType ?? expr.left.inferredType)
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
