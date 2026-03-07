/**
 * Expression Emitter - IR expressions to C# code
 * Main dispatcher - delegates to specialized modules
 *
 * Primary entry point is emitExpressionAst which returns [CSharpExpressionAst, EmitterContext].
 */

import {
  IrExpression,
  IrType,
  IrNumericNarrowingExpression,
  IrTypeAssertionExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  IrNameOfExpression,
  IrSizeOfExpression,
} from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import {
  substituteTypeArgs,
  resolveTypeAlias,
  stripNullish,
} from "./core/semantic/type-resolution.js";
import type { CSharpExpressionAst } from "./core/format/backend-ast/types.js";
import { renderTypeAst } from "./core/format/backend-ast/utils.js";

// Import expression emitters from specialized modules
import { emitLiteral } from "./expressions/literals.js";
import { emitIdentifier } from "./expressions/identifiers.js";
import { emitArray, emitObject } from "./expressions/collections.js";
import { emitMemberAccess } from "./expressions/access.js";
import { emitCall } from "./expressions/calls/call-emitter.js";
import { emitNew } from "./expressions/calls/new-emitter.js";
import {
  emitBinary,
  emitLogical,
  emitUnary,
  emitUpdate,
  emitAssignment,
  emitConditional,
} from "./expressions/operators.js";
import {
  emitFunctionExpression,
  emitArrowFunction,
} from "./expressions/functions.js";
import {
  emitTemplateLiteral,
  emitSpread,
  emitAwait,
} from "./expressions/other.js";

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

const maybeCastNullishTypeParamAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType) return [ast, context];
  if (!expr.inferredType) return [ast, context];

  const expectedTypeParam = getBareTypeParameterName(expectedType, context);
  if (!expectedTypeParam) return [ast, context];

  const unionTypeParam = getUnconstrainedNullishTypeParamName(
    expr.inferredType,
    context
  );
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

const maybeUnwrapNullableValueTypeAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType) return [ast, context];
  if (!expr.inferredType) return [ast, context];

  // Only unwrap direct nullable values.
  if (expr.kind !== "identifier" && expr.kind !== "memberAccess") {
    return [ast, context];
  }

  const getMemberAccessNarrowKey = (
    m: Extract<IrExpression, { kind: "memberAccess" }>
  ): string | undefined => {
    if (m.isComputed) return undefined;
    if (typeof m.property !== "string") return undefined;

    const obj = m.object;
    if (obj.kind === "identifier") return `${obj.name}.${m.property}`;
    if (obj.kind === "memberAccess") {
      const prefix = getMemberAccessNarrowKey(obj);
      return prefix ? `${prefix}.${m.property}` : undefined;
    }
    return undefined;
  };

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

  const nullableBase = getNullableUnionBaseType(expr.inferredType);
  if (!nullableBase) return [ast, context];

  if (!isNonNullableValueType(expectedType)) return [ast, context];
  if (!isSameTypeForNullableUnwrap(nullableBase, expectedType)) {
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

const normalizeComparableType = (
  type: IrType,
  context: EmitterContext
): IrType => resolveTypeAlias(stripNullish(type), context);

const areIrTypesEquivalent = (
  left: IrType,
  right: IrType,
  context: EmitterContext
): boolean => {
  const a = normalizeComparableType(left, context);
  const b = normalizeComparableType(right, context);

  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "primitiveType":
      return a.name === (b as typeof a).name;
    case "literalType":
      return a.value === (b as typeof a).value;
    case "referenceType": {
      const rb = b as typeof a;
      if (a.name !== rb.name) return false;
      const aArgs = a.typeArguments ?? [];
      const bArgs = rb.typeArguments ?? [];
      if (aArgs.length !== bArgs.length) return false;
      for (let i = 0; i < aArgs.length; i++) {
        const aa = aArgs[i];
        const bb = bArgs[i];
        if (!aa || !bb || !areIrTypesEquivalent(aa, bb, context)) return false;
      }
      return true;
    }
    case "arrayType":
      return areIrTypesEquivalent(
        a.elementType,
        (b as typeof a).elementType,
        context
      );
    case "dictionaryType":
      return (
        areIrTypesEquivalent(a.keyType, (b as typeof a).keyType, context) &&
        areIrTypesEquivalent(a.valueType, (b as typeof a).valueType, context)
      );
    case "tupleType": {
      const rb = b as typeof a;
      if (a.elementTypes.length !== rb.elementTypes.length) return false;
      for (let i = 0; i < a.elementTypes.length; i++) {
        const ae = a.elementTypes[i];
        const be = rb.elementTypes[i];
        if (!ae || !be || !areIrTypesEquivalent(ae, be, context)) return false;
      }
      return true;
    }
    case "functionType": {
      const rb = b as typeof a;
      if (a.parameters.length !== rb.parameters.length) return false;
      for (let i = 0; i < a.parameters.length; i++) {
        const ap = a.parameters[i];
        const bp = rb.parameters[i];
        if (!ap || !bp) return false;
        if (!ap.type && !bp.type) continue;
        if (!ap.type || !bp.type) return false;
        if (!areIrTypesEquivalent(ap.type, bp.type, context)) return false;
      }
      return areIrTypesEquivalent(a.returnType, rb.returnType, context);
    }
    case "unionType":
    case "intersectionType": {
      const rb = b as typeof a;
      if (a.types.length !== rb.types.length) return false;
      const used = new Set<number>();
      for (const at of a.types) {
        if (!at) return false;
        let matched = false;
        for (let i = 0; i < rb.types.length; i++) {
          if (used.has(i)) continue;
          const bt = rb.types[i];
          if (!bt) continue;
          if (areIrTypesEquivalent(at, bt, context)) {
            used.add(i);
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }
    case "typeParameterType":
      return a.name === (b as typeof a).name;
    case "voidType":
    case "anyType":
    case "unknownType":
    case "neverType":
      return true;
    case "objectType": {
      const rb = b as typeof a;
      if (a.members.length !== rb.members.length) return false;
      for (let i = 0; i < a.members.length; i++) {
        const am = a.members[i];
        const bm = rb.members[i];
        if (!am || !bm || am.kind !== bm.kind) return false;
        if (
          am.kind === "propertySignature" &&
          bm.kind === "propertySignature"
        ) {
          if (am.name !== bm.name) return false;
          if (!areIrTypesEquivalent(am.type, bm.type, context)) return false;
          continue;
        }
        if (am.kind === "methodSignature" && bm.kind === "methodSignature") {
          if (am.name !== bm.name) return false;
          if (am.parameters.length !== bm.parameters.length) return false;
          for (let j = 0; j < am.parameters.length; j++) {
            const ap = am.parameters[j];
            const bp = bm.parameters[j];
            if (!ap || !bp) return false;
            if (!ap.type || !bp.type) return false;
            if (!areIrTypesEquivalent(ap.type, bp.type, context)) return false;
          }
          if (!am.returnType || !bm.returnType) return false;
          if (!areIrTypesEquivalent(am.returnType, bm.returnType, context))
            return false;
          continue;
        }
        return false;
      }
      return true;
    }
  }
};

const maybeUpcastDictionaryUnionValueAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType || !expr.inferredType) return [ast, context];

  const expected = normalizeComparableType(expectedType, context);
  const actual = normalizeComparableType(expr.inferredType, context);
  if (expected.kind !== "dictionaryType" || actual.kind !== "dictionaryType") {
    return [ast, context];
  }

  if (!areIrTypesEquivalent(expected.keyType, actual.keyType, context)) {
    return [ast, context];
  }

  const expectedValue = normalizeComparableType(expected.valueType, context);
  if (expectedValue.kind !== "unionType") return [ast, context];

  const actualValue = normalizeComparableType(actual.valueType, context);
  if (areIrTypesEquivalent(expectedValue, actualValue, context)) {
    return [ast, context];
  }

  let matchingMemberIndex = -1;
  for (let i = 0; i < expectedValue.types.length; i++) {
    const member = expectedValue.types[i];
    if (!member) continue;
    if (areIrTypesEquivalent(member, actualValue, context)) {
      matchingMemberIndex = i + 1;
      break;
    }
  }
  if (matchingMemberIndex === -1) return [ast, context];

  const [unionValueTypeAst, ctx1] = emitTypeAst(expected.valueType, context);
  const unionTypeText = renderTypeAst(unionValueTypeAst);
  const kvpId = "kvp";
  const keySelector: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [{ name: kvpId }],
    body: {
      kind: "memberAccessExpression",
      expression: { kind: "identifierExpression", identifier: kvpId },
      memberName: "Key",
    },
  };
  const valueSelector: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [{ name: kvpId }],
    body: {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: {
          kind: "identifierExpression",
          identifier: unionTypeText,
        },
        memberName: `From${matchingMemberIndex}`,
      },
      arguments: [
        {
          kind: "memberAccessExpression",
          expression: { kind: "identifierExpression", identifier: kvpId },
          memberName: "Value",
        },
      ],
    },
  };

  const converted: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: {
        kind: "identifierExpression",
        identifier: "global::System.Linq.Enumerable",
      },
      memberName: "ToDictionary",
    },
    arguments: [ast, keySelector, valueSelector],
  };

  return [converted, ctx1];
};

/**
 * Emit a numeric narrowing expression as CSharpExpressionAst.
 */
const emitNumericNarrowing = (
  expr: IrNumericNarrowingExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (expr.proof !== undefined) {
    if (expr.proof.source.type === "literal") {
      const [innerAst, newContext] = emitExpressionAst(
        expr.expression,
        context,
        expr.inferredType
      );
      return [innerAst, newContext];
    }

    const [innerAst, ctx1] = emitExpressionAst(expr.expression, context);
    const [typeAst, ctx2] = emitTypeAst(expr.inferredType, ctx1);
    return [
      {
        kind: "castExpression",
        type: typeAst,
        expression: innerAst,
      },
      ctx2,
    ];
  }

  throw new Error(
    `Internal error: numericNarrowing without proof reached emitter. ` +
      `Target: ${expr.targetKind}, Expression kind: ${expr.expression.kind}. ` +
      `This indicates a bug in the numeric proof pass - it should have ` +
      `emitted a diagnostic and aborted compilation.`
  );
};

/**
 * Emit a type assertion expression as CSharpExpressionAst.
 *
 * TypeScript `x as T` becomes C# `(T)x` (throwing cast).
 */
const emitTypeAssertion = (
  expr: IrTypeAssertionExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [innerAst, ctx1] = emitExpressionAst(
    expr.expression,
    context,
    expr.targetType
  );

  const resolveLocalTypeAliases = (target: IrType): IrType => {
    if (target.kind === "referenceType" && ctx1.localTypes) {
      const typeInfo = ctx1.localTypes.get(target.name);
      if (typeInfo?.kind === "typeAlias") {
        const substituted =
          target.typeArguments && target.typeArguments.length > 0
            ? substituteTypeArgs(
                typeInfo.type,
                typeInfo.typeParameters,
                target.typeArguments
              )
            : typeInfo.type;
        return resolveLocalTypeAliases(substituted);
      }
    }
    return target;
  };

  const shouldEraseTypeAssertion = (target: IrType): boolean => {
    const resolved = resolveLocalTypeAliases(target);

    if (resolved.kind === "unknownType") {
      return true;
    }

    if (resolved.kind === "referenceType" && resolved.typeArguments?.length) {
      const importBinding = ctx1.importBindings?.get(resolved.name);
      const clrName =
        importBinding?.kind === "type" ? importBinding.clrName : "";
      if (clrName.endsWith(".ExtensionMethods")) {
        return true;
      }
    }

    if (resolved.kind === "intersectionType") {
      return resolved.types.some(
        (t) => t.kind === "referenceType" && t.name.startsWith("__Ext_")
      );
    }

    return false;
  };

  if (shouldEraseTypeAssertion(expr.targetType)) {
    return [innerAst, ctx1];
  }

  const resolveRuntimeCastTarget = (
    target: IrType,
    ctx: EmitterContext
  ): IrType => {
    if (target.kind === "referenceType" && ctx.localTypes) {
      const typeInfo = ctx.localTypes.get(target.name);
      if (typeInfo?.kind === "typeAlias") {
        if (typeInfo.type.kind !== "objectType") {
          const substituted =
            target.typeArguments && target.typeArguments.length > 0
              ? substituteTypeArgs(
                  typeInfo.type,
                  typeInfo.typeParameters,
                  target.typeArguments
                )
              : typeInfo.type;
          return resolveRuntimeCastTarget(substituted, ctx);
        }
        return target;
      }
    }

    if (target.kind === "referenceType" && target.typeArguments?.length) {
      const importBinding = ctx.importBindings?.get(target.name);
      const clrName =
        importBinding?.kind === "type" ? importBinding.clrName : "";
      if (clrName.endsWith(".ExtensionMethods")) {
        const shape = target.typeArguments[0];
        if (shape) return resolveRuntimeCastTarget(shape, ctx);
      }
    }

    if (target.kind === "intersectionType") {
      for (const part of target.types) {
        const resolved = resolveRuntimeCastTarget(part, ctx);
        if (
          resolved.kind !== "intersectionType" &&
          resolved.kind !== "objectType"
        ) {
          return resolved;
        }
      }
      const fallback = target.types[0];
      return fallback ? resolveRuntimeCastTarget(fallback, ctx) : target;
    }

    return target;
  };

  const runtimeTarget = resolveRuntimeCastTarget(expr.targetType, ctx1);
  const [typeAst, ctx2] = emitTypeAst(runtimeTarget, ctx1);
  return [
    {
      kind: "castExpression",
      type: typeAst,
      expression: innerAst,
    },
    ctx2,
  ];
};

/**
 * Emit an asinterface expression as CSharpExpressionAst.
 */
const emitAsInterface = (
  expr: IrAsInterfaceExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const expected = expectedType ?? expr.targetType;
  return emitExpressionAst(expr.expression, context, expected);
};

/**
 * Emit a trycast expression as CSharpExpressionAst.
 *
 * TypeScript `trycast<T>(x)` becomes C# `x as T` (safe cast).
 */
const emitTryCast = (
  expr: IrTryCastExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [innerAst, ctx1] = emitExpressionAst(expr.expression, context);
  const [typeAst, ctx2] = emitTypeAst(expr.targetType, ctx1);
  return [
    {
      kind: "asExpression",
      expression: innerAst,
      type: typeAst,
    },
    ctx2,
  ];
};

/**
 * Emit a stackalloc expression as CSharpExpressionAst.
 */
const emitStackAlloc = (
  expr: IrStackAllocExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [elementTypeAst, ctx1] = emitTypeAst(expr.elementType, context);
  const [sizeAst, ctx2] = emitExpressionAst(expr.size, ctx1, {
    kind: "primitiveType",
    name: "int",
  });
  return [
    {
      kind: "stackAllocArrayCreationExpression",
      elementType: elementTypeAst,
      sizeExpression: sizeAst,
    },
    ctx2,
  ];
};

/**
 * Emit a defaultof expression as CSharpExpressionAst.
 */
const emitDefaultOf = (
  expr: IrDefaultOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [typeAst, ctx1] = emitTypeAst(expr.targetType, context);
  return [
    {
      kind: "defaultExpression",
      type: typeAst,
    },
    ctx1,
  ];
};

/**
 * Emit a nameof expression as a compile-time string literal using the authored TS name.
 */
const emitNameOf = (
  expr: IrNameOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => [
  {
    kind: "literalExpression",
    text: JSON.stringify(expr.name),
  },
  context,
];

/**
 * Emit a sizeof expression as C# sizeof(T).
 */
const emitSizeOf = (
  expr: IrSizeOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [typeAst, ctx1] = emitTypeAst(expr.targetType, context);
  return [
    {
      kind: "sizeOfExpression",
      type: typeAst,
    },
    ctx1,
  ];
};

/**
 * Emit a C# expression AST from an IR expression.
 * Primary entry point for expression emission.
 *
 * @param expr The IR expression to emit
 * @param context The emitter context
 * @param expectedType Optional expected type for contextual typing
 */
export const emitExpressionAst = (
  expr: IrExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const [ast, newContext] = (() => {
    switch (expr.kind) {
      case "literal":
        return emitLiteral(expr, context, expectedType);

      case "identifier":
        return emitIdentifier(expr, context, expectedType);

      case "array":
        return emitArray(expr, context, expectedType);

      case "object":
        return emitObject(expr, context, expectedType);

      case "memberAccess":
        return emitMemberAccess(expr, context);

      case "call":
        return emitCall(expr, context);

      case "new":
        return emitNew(expr, context);

      case "binary":
        return emitBinary(expr, context, expectedType);

      case "logical":
        return emitLogical(expr, context);

      case "unary":
        return emitUnary(expr, context, expectedType);

      case "update":
        return emitUpdate(expr, context);

      case "assignment":
        return emitAssignment(expr, context);

      case "conditional":
        return emitConditional(expr, context, expectedType);

      case "functionExpression":
        return emitFunctionExpression(expr, context);

      case "arrowFunction":
        return emitArrowFunction(expr, context);

      case "templateLiteral":
        return emitTemplateLiteral(expr, context);

      case "spread":
        return emitSpread(expr, context);

      case "await":
        return emitAwait(expr, context);

      case "this":
        return [
          {
            kind: "identifierExpression" as const,
            identifier: context.objectLiteralThisIdentifier ?? "this",
          },
          context,
        ];

      case "numericNarrowing":
        return emitNumericNarrowing(expr, context);

      case "asinterface":
        return emitAsInterface(expr, context, expectedType);

      case "typeAssertion":
        return emitTypeAssertion(expr, context);

      case "trycast":
        return emitTryCast(expr, context);

      case "stackalloc":
        return emitStackAlloc(expr, context);

      case "defaultof":
        return emitDefaultOf(expr, context);

      case "nameof":
        return emitNameOf(expr, context);

      case "sizeof":
        return emitSizeOf(expr, context);

      default:
        throw new Error(
          `Unhandled IR expression kind: ${String((expr as { kind?: unknown }).kind)}`
        );
    }
  })();

  const [castedAst, castedContext] = maybeCastNullishTypeParamAst(
    expr,
    ast,
    newContext,
    expectedType
  );
  const [dictUpcastAst, dictUpcastContext] = maybeUpcastDictionaryUnionValueAst(
    expr,
    castedAst,
    castedContext,
    expectedType
  );
  return maybeUnwrapNullableValueTypeAst(
    expr,
    dictUpcastAst,
    dictUpcastContext,
    expectedType
  );
};

// Re-export commonly used functions from barrel
export { generateSpecializedName } from "./expressions/identifiers.js";
