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
} from "../core/semantic/type-resolution.js";
import { isAssignable } from "../core/semantic/type-compatibility.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  getIdentifierTypeName,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import { nullLiteral } from "../core/format/backend-ast/builders.js";

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
  if (ast.kind !== "castExpression" && ast.kind !== "asExpression") {
    return false;
  }

  const concreteTarget = stripNullableTypeAst(ast.type);
  if (concreteTarget.kind === "predefinedType") {
    return (
      concreteTarget.keyword === "int" ||
      concreteTarget.keyword === "long" ||
      concreteTarget.keyword === "short" ||
      concreteTarget.keyword === "byte" ||
      concreteTarget.keyword === "sbyte" ||
      concreteTarget.keyword === "uint" ||
      concreteTarget.keyword === "ulong" ||
      concreteTarget.keyword === "ushort" ||
      concreteTarget.keyword === "float" ||
      concreteTarget.keyword === "double" ||
      concreteTarget.keyword === "decimal" ||
      concreteTarget.keyword === "bool" ||
      concreteTarget.keyword === "char"
    );
  }

  const identifierName = getIdentifierTypeName(concreteTarget);
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

const isExpectedIntegralIrType = (
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

export const maybeCastNumericToExpectedIntegralAst = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType || !actualType) return [ast, context];
  if (!isExpectedIntegralIrType(expectedType, context)) return [ast, context];
  if (!isNumericSourceIrType(actualType, context)) return [ast, context];
  if (isAssignable(actualType, expectedType)) return [ast, context];

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
): boolean => {
  if (!type) return false;
  if (type.kind === "unknownType" || type.kind === "anyType") {
    return true;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "unknownType" || resolved.kind === "anyType") {
    return true;
  }
  return (
    resolved.kind === "referenceType" &&
    (resolved.name === "object" ||
      resolved.resolvedClrType === "System.Object" ||
      resolved.resolvedClrType === "global::System.Object")
  );
};

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
