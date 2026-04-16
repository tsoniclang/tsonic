/**
 * Post-emission adaptation helpers for nullish type-parameter casting,
 * nullable value-type unwrapping, and char-to-string conversion.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  stripNullish,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
} from "../core/semantic/type-resolution.js";
import { isAssignable } from "../core/semantic/type-compatibility.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import { isBroadObjectSlotType } from "../core/semantic/js-value-types.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  getIdentifierTypeName,
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import {
  identifierExpression,
  nullLiteral,
} from "../core/format/backend-ast/builders.js";

// ---------------------------------------------------------------------------
// Nullish type-parameter casting
// ---------------------------------------------------------------------------

const getBareTypeParameterName = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind === "typeParameterType") return type.name;
  if (
    type.kind === "referenceType" &&
    (context.typeParameters?.has(type.name) ?? false) &&
    (!type.typeArguments || type.typeArguments.length === 0)
  ) {
    return type.name;
  }
  return undefined;
};

const getUnconstrainedNullishTypeParamName = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind !== "unionType") return undefined;

  const nonNullTypes = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullTypes.length !== 1) return undefined;

  const nonNull = nonNullTypes[0];
  if (!nonNull) return undefined;

  const typeParamName = getBareTypeParameterName(nonNull, context);
  if (!typeParamName) return undefined;

  const constraintKind =
    context.typeParamConstraints?.get(typeParamName) ?? "unconstrained";
  return constraintKind === "unconstrained" ? typeParamName : undefined;
};

export const maybeCastNullishTypeParamAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType) return [ast, context];
  const actualType = resolveEffectiveExpressionType(expr, context);
  const narrowKey =
    expr.kind === "identifier"
      ? expr.name
      : expr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(expr)
        : undefined;
  const narrowedSourceType =
    narrowKey && context.narrowedBindings
      ? context.narrowedBindings.get(narrowKey)?.sourceType
      : undefined;
  const sourceStorageType =
    narrowedSourceType ?? expr.inferredType ?? actualType;
  if (!actualType && !sourceStorageType) return [ast, context];

  const expectedTypeParam = getBareTypeParameterName(expectedType, context);
  if (!expectedTypeParam) return [ast, context];

  const unionTypeParam =
    (actualType
      ? getUnconstrainedNullishTypeParamName(actualType, context)
      : undefined) ??
    (sourceStorageType
      ? getUnconstrainedNullishTypeParamName(sourceStorageType, context)
      : undefined);
  if (!unionTypeParam) return [ast, context];
  if (unionTypeParam !== expectedTypeParam) return [ast, context];

  const [typeAst, newContext] = emitTypeAst(expectedType, context);
  return [
    {
      kind: "castExpression",
      type: typeAst,
      expression: ast,
    },
    newContext,
  ];
};

// ---------------------------------------------------------------------------
// Nullable value-type unwrapping
// ---------------------------------------------------------------------------

const getNullableUnionBaseType = (type: IrType): IrType | undefined => {
  if (type.kind !== "unionType") return undefined;

  const nonNullTypes = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullTypes.length !== 1) return undefined;
  return nonNullTypes[0];
};

const isNonNullableValueType = (type: IrType): boolean => {
  if (type.kind === "primitiveType") {
    return (
      type.name === "number" ||
      type.name === "int" ||
      type.name === "boolean" ||
      type.name === "char"
    );
  }

  if (type.kind === "referenceType") {
    return (
      type.name === "sbyte" ||
      type.name === "short" ||
      type.name === "int" ||
      type.name === "long" ||
      type.name === "nint" ||
      type.name === "int128" ||
      type.name === "byte" ||
      type.name === "ushort" ||
      type.name === "uint" ||
      type.name === "ulong" ||
      type.name === "nuint" ||
      type.name === "uint128" ||
      type.name === "half" ||
      type.name === "float" ||
      type.name === "double" ||
      type.name === "decimal" ||
      type.name === "bool" ||
      type.name === "char"
    );
  }

  return false;
};

const isSameTypeForNullableUnwrap = (
  base: IrType,
  expected: IrType
): boolean => {
  if (base.kind !== expected.kind) return false;

  if (base.kind === "primitiveType" && expected.kind === "primitiveType") {
    return base.name === expected.name;
  }

  if (base.kind === "referenceType" && expected.kind === "referenceType") {
    return (
      base.name === expected.name &&
      (base.typeArguments?.length ?? 0) === 0 &&
      (expected.typeArguments?.length ?? 0) === 0
    );
  }

  return false;
};

const astAlreadyCastsToConcreteValueType = (
  ast: CSharpExpressionAst
): boolean => {
  const isConcreteValueTypeAst = (targetAst: ReturnType<typeof stripNullableTypeAst>): boolean => {
    if (targetAst.kind === "predefinedType") {
      return (
        targetAst.keyword === "int" ||
        targetAst.keyword === "long" ||
        targetAst.keyword === "short" ||
        targetAst.keyword === "byte" ||
        targetAst.keyword === "sbyte" ||
        targetAst.keyword === "uint" ||
        targetAst.keyword === "ulong" ||
        targetAst.keyword === "ushort" ||
        targetAst.keyword === "float" ||
        targetAst.keyword === "double" ||
        targetAst.keyword === "decimal" ||
        targetAst.keyword === "bool" ||
        targetAst.keyword === "char"
      );
    }

    const identifierName = getIdentifierTypeName(targetAst);
    return (
      identifierName === "System.Int32" ||
      identifierName === "global::System.Int32" ||
      identifierName === "System.Int64" ||
      identifierName === "global::System.Int64" ||
      identifierName === "System.Int16" ||
      identifierName === "global::System.Int16" ||
      identifierName === "System.Byte" ||
      identifierName === "global::System.Byte" ||
      identifierName === "System.SByte" ||
      identifierName === "global::System.SByte" ||
      identifierName === "System.UInt32" ||
      identifierName === "global::System.UInt32" ||
      identifierName === "System.UInt64" ||
      identifierName === "global::System.UInt64" ||
      identifierName === "System.UInt16" ||
      identifierName === "global::System.UInt16" ||
      identifierName === "System.Single" ||
      identifierName === "global::System.Single" ||
      identifierName === "System.Double" ||
      identifierName === "global::System.Double" ||
      identifierName === "System.Decimal" ||
      identifierName === "global::System.Decimal" ||
      identifierName === "System.Boolean" ||
      identifierName === "global::System.Boolean" ||
      identifierName === "System.Char" ||
      identifierName === "global::System.Char"
    );
  };

  switch (ast.kind) {
    case "castExpression":
    case "asExpression":
      return isConcreteValueTypeAst(stripNullableTypeAst(ast.type));
    case "defaultExpression":
      return ast.type !== undefined && isConcreteValueTypeAst(stripNullableTypeAst(ast.type));
    case "objectCreationExpression":
      return isConcreteValueTypeAst(stripNullableTypeAst(ast.type));
    case "conditionalExpression":
      return (
        astAlreadyCastsToConcreteValueType(ast.whenTrue) &&
        astAlreadyCastsToConcreteValueType(ast.whenFalse)
      );
    default:
      return false;
  }
};

export const maybeUnwrapNullableValueTypeAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType) return [ast, context];
  const actualType = resolveEffectiveExpressionType(expr, context);
  if (!actualType) return [ast, context];

  // Only unwrap direct nullable values.
  if (expr.kind !== "identifier" && expr.kind !== "memberAccess") {
    return [ast, context];
  }

  if (
    context.narrowedBindings &&
    ((expr.kind === "identifier" && context.narrowedBindings.has(expr.name)) ||
      (expr.kind === "memberAccess" &&
        (() => {
          const key = getMemberAccessNarrowKey(expr);
          return key ? context.narrowedBindings.has(key) : false;
        })()))
  ) {
    return [ast, context];
  }

  const nullableBase = getNullableUnionBaseType(actualType);
  if (!nullableBase) return [ast, context];

  if (!isNonNullableValueType(expectedType)) return [ast, context];
  if (!isSameTypeForNullableUnwrap(nullableBase, expectedType)) {
    return [ast, context];
  }
  if (astAlreadyCastsToConcreteValueType(ast)) {
    return [ast, context];
  }

  // Append .Value
  return [
    {
      kind: "memberAccessExpression",
      expression: ast,
      memberName: "Value",
    },
    context,
  ];
};

// ---------------------------------------------------------------------------
// Char-to-string conversion
// ---------------------------------------------------------------------------

const isCharIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "char") ||
    (resolved.kind === "referenceType" && resolved.name === "char")
  );
};

const expectsStringIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "string") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "string" || resolved.name === "String"))
  );
};

const isParameterlessToStringInvocation = (ast: CSharpExpressionAst): boolean =>
  ast.kind === "invocationExpression" &&
  ast.arguments.length === 0 &&
  ast.expression.kind === "memberAccessExpression" &&
  ast.expression.memberName === "ToString";

export const maybeConvertCharToStringAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectsStringIrType(expectedType, context)) return [ast, context];
  if (!isCharIrType(resolveEffectiveExpressionType(expr, context), context)) {
    return [ast, context];
  }
  if (isParameterlessToStringInvocation(ast)) return [ast, context];

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: ast,
        memberName: "ToString",
      },
      arguments: [],
    },
    context,
  ];
};

// ---------------------------------------------------------------------------
// Numeric integral adaptation
// ---------------------------------------------------------------------------

const INTEGRAL_EXPECTED_TYPE_NAMES = new Set([
  "int",
  "Int32",
  "System.Int32",
  "long",
  "Int64",
  "System.Int64",
  "short",
  "Int16",
  "System.Int16",
  "byte",
  "Byte",
  "System.Byte",
  "sbyte",
  "SByte",
  "System.SByte",
  "uint",
  "UInt32",
  "System.UInt32",
  "ulong",
  "UInt64",
  "System.UInt64",
  "ushort",
  "UInt16",
  "System.UInt16",
  "nint",
  "IntPtr",
  "System.IntPtr",
  "nuint",
  "UIntPtr",
  "System.UIntPtr",
]);

export const isExpectedIntegralIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "primitiveType") {
    return resolved.name === "int";
  }
  if (resolved.kind === "referenceType") {
    return (
      INTEGRAL_EXPECTED_TYPE_NAMES.has(resolved.name) ||
      (resolved.resolvedClrType !== undefined &&
        INTEGRAL_EXPECTED_TYPE_NAMES.has(resolved.resolvedClrType))
    );
  }
  return false;
};

const isNumericSourceIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "typeParameterType") {
    return (context.typeParamConstraints?.get(resolved.name) ?? "unconstrained") === "numeric";
  }
  return (
    (resolved.kind === "primitiveType" &&
      (resolved.name === "number" || resolved.name === "int")) ||
    (resolved.kind === "literalType" && typeof resolved.value === "number") ||
    (resolved.kind === "referenceType" &&
      (INTEGRAL_EXPECTED_TYPE_NAMES.has(resolved.name) ||
        resolved.name === "double" ||
        resolved.name === "float" ||
        resolved.name === "decimal" ||
        resolved.name === "Half" ||
        (resolved.resolvedClrType !== undefined &&
          (INTEGRAL_EXPECTED_TYPE_NAMES.has(resolved.resolvedClrType) ||
            resolved.resolvedClrType === "System.Double" ||
            resolved.resolvedClrType === "global::System.Double" ||
            resolved.resolvedClrType === "System.Single" ||
            resolved.resolvedClrType === "global::System.Single" ||
            resolved.resolvedClrType === "System.Decimal" ||
            resolved.resolvedClrType === "global::System.Decimal" ||
            resolved.resolvedClrType === "System.Half" ||
            resolved.resolvedClrType === "global::System.Half"))))
  );
};

const resolveNumericFactoryTypeName = (
  type: IrType | undefined,
  context: EmitterContext
): string | undefined => {
  if (!type) return undefined;
  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "primitiveType") {
    switch (resolved.name) {
      case "number":
        return "global::System.Double";
      case "int":
        return "global::System.Int32";
    }
    return undefined;
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  switch (resolved.name) {
    case "byte":
      return "global::System.Byte";
    case "sbyte":
      return "global::System.SByte";
    case "short":
      return "global::System.Int16";
    case "ushort":
      return "global::System.UInt16";
    case "int":
      return "global::System.Int32";
    case "uint":
      return "global::System.UInt32";
    case "long":
      return "global::System.Int64";
    case "ulong":
      return "global::System.UInt64";
    case "nint":
      return "global::System.IntPtr";
    case "nuint":
      return "global::System.UIntPtr";
    case "float":
      return "global::System.Single";
    case "double":
      return "global::System.Double";
    case "decimal":
      return "global::System.Decimal";
    case "half":
      return "global::System.Half";
  }

  switch (resolved.resolvedClrType) {
    case "System.Byte":
    case "global::System.Byte":
      return "global::System.Byte";
    case "System.SByte":
    case "global::System.SByte":
      return "global::System.SByte";
    case "System.Int16":
    case "global::System.Int16":
      return "global::System.Int16";
    case "System.UInt16":
    case "global::System.UInt16":
      return "global::System.UInt16";
    case "System.Int32":
    case "global::System.Int32":
      return "global::System.Int32";
    case "System.UInt32":
    case "global::System.UInt32":
      return "global::System.UInt32";
    case "System.Int64":
    case "global::System.Int64":
      return "global::System.Int64";
    case "System.UInt64":
    case "global::System.UInt64":
      return "global::System.UInt64";
    case "System.IntPtr":
    case "global::System.IntPtr":
      return "global::System.IntPtr";
    case "System.UIntPtr":
    case "global::System.UIntPtr":
      return "global::System.UIntPtr";
    case "System.Single":
    case "global::System.Single":
      return "global::System.Single";
    case "System.Double":
    case "global::System.Double":
      return "global::System.Double";
    case "System.Decimal":
    case "global::System.Decimal":
      return "global::System.Decimal";
    case "System.Half":
    case "global::System.Half":
      return "global::System.Half";
    default:
      return undefined;
  }
};

const hasRuntimeNullishSurface = (type: IrType | undefined): boolean =>
  type !== undefined &&
  (splitRuntimeNullishUnionMembers(type)?.hasRuntimeNullish ?? false);

const canSkipSameFamilyIntegralCast = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  expectedType: IrType,
  actualNumericTypeName: string | undefined,
  expectedNumericTypeName: string | undefined
): boolean => {
  if (
    !actualNumericTypeName ||
    !expectedNumericTypeName ||
    actualNumericTypeName !== expectedNumericTypeName
  ) {
    return false;
  }

  if (ast.kind !== "conditionalExpression") {
    return false;
  }

  return hasRuntimeNullishSurface(actualType) === hasRuntimeNullishSurface(expectedType);
};

const maybeConvertNumericTypeParamToExpectedNumericAst = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!actualType || !expectedType) return [ast, context];

  const resolvedActual = resolveTypeAlias(stripNullish(actualType), context);
  if (resolvedActual.kind !== "typeParameterType") {
    return [ast, context];
  }

  if (
    (context.typeParamConstraints?.get(resolvedActual.name) ?? "unconstrained") !==
    "numeric"
  ) {
    return [ast, context];
  }

  if (isAssignable(actualType, expectedType)) {
    return [ast, context];
  }

  const targetFactoryType = resolveNumericFactoryTypeName(expectedType, context);
  if (!targetFactoryType) {
    return [ast, context];
  }

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression(targetFactoryType),
        memberName: "CreateChecked",
      },
      arguments: [ast],
    },
    context,
  ];
};

type IntegralTargetKind =
  | "sbyte"
  | "byte"
  | "short"
  | "ushort"
  | "int"
  | "uint"
  | "long"
  | "ulong";

const resolveIntegralTargetKind = (
  type: IrType | undefined,
  context: EmitterContext
): IntegralTargetKind | undefined => {
  if (!type) return undefined;
  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "primitiveType") {
    return resolved.name === "int" ? "int" : undefined;
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  switch (resolved.name) {
    case "sbyte":
    case "SByte":
      return "sbyte";
    case "byte":
    case "Byte":
      return "byte";
    case "short":
    case "Int16":
      return "short";
    case "ushort":
    case "UInt16":
      return "ushort";
    case "int":
    case "Int32":
      return "int";
    case "uint":
    case "UInt32":
      return "uint";
    case "long":
    case "Int64":
      return "long";
    case "ulong":
    case "UInt64":
      return "ulong";
  }

  switch (resolved.resolvedClrType) {
    case "System.SByte":
    case "global::System.SByte":
      return "sbyte";
    case "System.Byte":
    case "global::System.Byte":
      return "byte";
    case "System.Int16":
    case "global::System.Int16":
      return "short";
    case "System.UInt16":
    case "global::System.UInt16":
      return "ushort";
    case "System.Int32":
    case "global::System.Int32":
      return "int";
    case "System.UInt32":
    case "global::System.UInt32":
      return "uint";
    case "System.Int64":
    case "global::System.Int64":
      return "long";
    case "System.UInt64":
    case "global::System.UInt64":
      return "ulong";
    default:
      return undefined;
  }
};

const resolveIntegralLiteralValue = (
  ast: CSharpExpressionAst
): { readonly value: bigint; readonly suffix?: string } | undefined => {
  if (ast.kind === "prefixUnaryExpression") {
    if (ast.operatorToken !== "-" && ast.operatorToken !== "+") {
      return undefined;
    }
    const operand = resolveIntegralLiteralValue(ast.operand);
    if (!operand) {
      return undefined;
    }
    return {
      value: ast.operatorToken === "-" ? -operand.value : operand.value,
      suffix: operand.suffix,
    };
  }

  if (ast.kind !== "numericLiteralExpression") {
    return undefined;
  }

  if (
    ast.fractionalPart !== undefined ||
    ast.exponentDigits !== undefined ||
    ast.suffix === "f" ||
    ast.suffix === "d" ||
    ast.suffix === "m"
  ) {
    return undefined;
  }

  const value =
    ast.base === "decimal"
      ? BigInt(ast.wholePart)
      : ast.base === "hexadecimal"
        ? BigInt(`0x${ast.wholePart}`)
        : BigInt(`0b${ast.wholePart}`);

  return { value, suffix: ast.suffix };
};

const fitsIntegralTargetRange = (
  value: bigint,
  targetKind: IntegralTargetKind
): boolean => {
  switch (targetKind) {
    case "sbyte":
      return value >= -128n && value <= 127n;
    case "byte":
      return value >= 0n && value <= 255n;
    case "short":
      return value >= -32768n && value <= 32767n;
    case "ushort":
      return value >= 0n && value <= 65535n;
    case "int":
      return value >= -2147483648n && value <= 2147483647n;
    case "uint":
      return value >= 0n && value <= 4294967295n;
    case "long":
      return value >= -9223372036854775808n && value <= 9223372036854775807n;
    case "ulong":
      return value >= 0n && value <= 18446744073709551615n;
  }
};

const isImplicitIntegralLiteralForExpectedType = (
  ast: CSharpExpressionAst,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  const targetKind = resolveIntegralTargetKind(expectedType, context);
  if (!targetKind) {
    return false;
  }

  const literal = resolveIntegralLiteralValue(ast);
  if (!literal) {
    return false;
  }

  if (!fitsIntegralTargetRange(literal.value, targetKind)) {
    return false;
  }

  switch (literal.suffix) {
    case undefined:
      return true;
    case "L":
      return targetKind === "long";
    case "U":
      return targetKind === "uint";
    case "UL":
      return targetKind === "ulong";
    default:
      return false;
  }
};

export const maybeCastNumericToExpectedIntegralAst = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  const [numericTypeParamAdjustedAst, numericTypeParamAdjustedContext] =
    maybeConvertNumericTypeParamToExpectedNumericAst(
      ast,
      actualType,
      context,
      expectedType
    );

  if (numericTypeParamAdjustedAst !== ast) {
    return [numericTypeParamAdjustedAst, numericTypeParamAdjustedContext];
  }

  if (!expectedType || !actualType) return [ast, context];
  if (!isExpectedIntegralIrType(expectedType, context)) return [ast, context];
  if (!isNumericSourceIrType(actualType, context)) return [ast, context];
  const actualNumericTypeName = resolveNumericFactoryTypeName(actualType, context);
  const expectedNumericTypeName = resolveNumericFactoryTypeName(
    expectedType,
    context
  );
  if (
    canSkipSameFamilyIntegralCast(
      ast,
      actualType,
      expectedType,
      actualNumericTypeName,
      expectedNumericTypeName
    )
  ) {
    return [ast, context];
  }
  if (isImplicitIntegralLiteralForExpectedType(ast, expectedType, context)) {
    return [ast, context];
  }
  if (isAssignable(actualType, expectedType)) return [ast, context];

  const [typeAst, newContext] = emitTypeAst(expectedType, context);
  if (ast.kind === "castExpression" && sameTypeAstSurface(ast.type, typeAst)) {
    return [ast, newContext];
  }
  return [
    {
      kind: "castExpression",
      type: typeAst,
      expression: ast,
    },
    newContext,
  ];
};

// ---------------------------------------------------------------------------
// JS number boxing
// ---------------------------------------------------------------------------

const isJsNumberIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" &&
      (resolved.name === "number" || resolved.name === "int")) ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "int" ||
        resolved.name === "double" ||
        resolved.resolvedClrType === "System.Int32" ||
        resolved.resolvedClrType === "global::System.Int32" ||
        resolved.resolvedClrType === "System.Double" ||
        resolved.resolvedClrType === "global::System.Double"))
  );
};

const expectsBoxedObjectIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => isBroadObjectSlotType(type, context);

export const maybeBoxJsNumberAsObjectAst = (
  ast: CSharpExpressionAst,
  expr: IrExpression | undefined,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (context.options.surface !== "@tsonic/js") return [ast, context];
  const isNumericLiteral =
    expr?.kind === "literal" && typeof expr.value === "number";
  if (!isNumericLiteral && !isJsNumberIrType(actualType, context)) {
    return [ast, context];
  }
  if (!expectsBoxedObjectIrType(expectedType, context)) return [ast, context];

  const nullableNumericBaseType = actualType
    ? getNullableUnionBaseType(actualType)
    : undefined;
  if (
    nullableNumericBaseType &&
    isJsNumberIrType(nullableNumericBaseType, context)
  ) {
    const widenedNullableValueAst: CSharpExpressionAst = {
      kind: "castExpression",
      type: { kind: "predefinedType", keyword: "double" },
      expression: ast,
    };

    return [
      {
        kind: "conditionalExpression",
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: {
            kind: "castExpression",
            type: { kind: "predefinedType", keyword: "object" },
            expression: ast,
          },
          right: nullLiteral(),
        },
        whenTrue: nullLiteral(),
        whenFalse: {
          kind: "castExpression",
          type: { kind: "predefinedType", keyword: "object" },
          expression: widenedNullableValueAst,
        },
      },
      context,
    ];
  }

  const widenedNumericAst: CSharpExpressionAst = {
    kind: "castExpression",
    type: { kind: "predefinedType", keyword: "double" },
    expression: ast,
  };

  return [
    {
      kind: "castExpression",
      type: { kind: "predefinedType", keyword: "object" },
      expression: widenedNumericAst,
    },
    context,
  ];
};
