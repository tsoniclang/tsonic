/**
 * Expression Emitter - IR expressions to C# code
 * Main dispatcher - delegates to specialized modules
 */

import {
  IrExpression,
  IrType,
  IrNumericNarrowingExpression,
  IrTypeAssertionExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
} from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "./types.js";
import { emitType } from "./type-emitter.js";
import { substituteTypeArgs } from "./core/type-resolution.js";

// Import expression emitters from specialized modules
import { emitLiteral } from "./expressions/literals.js";
import { emitIdentifier } from "./expressions/identifiers.js";
import { emitArray, emitObject } from "./expressions/collections.js";
import { emitMemberAccess } from "./expressions/access.js";
import { emitCall, emitNew } from "./expressions/calls.js";
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
import { formatCastOperandText } from "./expressions/parentheses.js";

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

const maybeCastNullishTypeParam = (
  expr: IrExpression,
  fragment: CSharpFragment,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpFragment, EmitterContext] => {
  if (!expectedType) return [fragment, context];
  if (!expr.inferredType) return [fragment, context];

  const expectedTypeParam = getBareTypeParameterName(expectedType, context);
  if (!expectedTypeParam) return [fragment, context];

  const unionTypeParam = getUnconstrainedNullishTypeParamName(
    expr.inferredType,
    context
  );
  if (!unionTypeParam) return [fragment, context];
  if (unionTypeParam !== expectedTypeParam) return [fragment, context];

  const [typeName, newContext] = emitType(expectedType, context);
  return [{ text: `(${typeName})${fragment.text}` }, newContext];
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
    // C# primitive aliases represented as reference types via @tsonic/core.
    // Keep this list strict — we only unwrap when `.Value` exists.
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

const isSameTypeForNullableUnwrap = (base: IrType, expected: IrType): boolean => {
  if (base.kind !== expected.kind) return false;

  if (base.kind === "primitiveType" && expected.kind === "primitiveType") {
    return base.name === expected.name;
  }

  if (base.kind === "referenceType" && expected.kind === "referenceType") {
    // This unwrap is only for Nullable<T> value types, so keep matching strict.
    return (
      base.name === expected.name &&
      (base.typeArguments?.length ?? 0) === 0 &&
      (expected.typeArguments?.length ?? 0) === 0
    );
  }

  return false;
};

const maybeUnwrapNullableValueType = (
  expr: IrExpression,
  fragment: CSharpFragment,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpFragment, EmitterContext] => {
  if (!expectedType) return [fragment, context];
  if (!expr.inferredType) return [fragment, context];

  // Only unwrap direct nullable values. For composite expressions (e.g. `a ?? b`)
  // C# nullish coalescing already produces a non-nullable result when the
  // fallback is non-nullable, so adding `.Value` is incorrect.
  if (expr.kind !== "identifier" && expr.kind !== "memberAccess") {
    return [fragment, context];
  }

  // If a narrowing pass already rewrote this identifier (e.g., `id` → `id.Value`
  // or `id` → `id__n`), don't apply a second Nullable<T> unwrap.
  if (
    expr.kind === "identifier" &&
    (context.narrowedBindings?.has(expr.name) ?? false)
  ) {
    return [fragment, context];
  }

  const nullableBase = getNullableUnionBaseType(expr.inferredType);
  if (!nullableBase) return [fragment, context];

  // Only unwrap when the expected type is a non-nullable value type and
  // the expression is a nullable union of that exact base type.
  if (!isNonNullableValueType(expectedType)) return [fragment, context];
  if (!isSameTypeForNullableUnwrap(nullableBase, expectedType)) {
    return [fragment, context];
  }

  const needsParens =
    expr.kind !== "identifier" && expr.kind !== "memberAccess";
  const inner = needsParens ? `(${fragment.text})` : fragment.text;
  return [{ text: `${inner}.Value` }, context];
};

/**
 * Emit a numeric narrowing expression.
 *
 * If the inner expression is already proven to produce the target type,
 * emit it directly without a cast. Otherwise, emit with an explicit cast.
 *
 * Key cases:
 * - Literal 10 as int → "10" (no cast, no .0)
 * - Variable x as int (where x is already int) → "x" (no cast)
 * - Expression (x + y) as int (where result is int) → "x + y" (no cast)
 */
const emitNumericNarrowing = (
  expr: IrNumericNarrowingExpression,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // If we have a proof that the inner expression already produces the target type,
  // we don't need a cast - just emit the inner expression
  if (expr.proof !== undefined) {
    // For literals, pass the target type so they emit without decimal point
    if (expr.proof.source.type === "literal") {
      const [innerCode, newContext] = emitExpression(
        expr.expression,
        context,
        expr.inferredType // Pass target type for correct literal format
      );
      return [innerCode, newContext];
    }

    // Numeric narrowings represent explicit user intent (`x as int`, `x as long`).
    // Even when the conversion is proven sound, C# generic inference can become
    // ambiguous without an explicit cast (e.g., choosing between `int` and `long`).
    const [innerCode, ctx1] = emitExpression(expr.expression, context);
    const [typeName, ctx2] = emitType(expr.inferredType, ctx1);
    const operandText = formatCastOperandText(expr.expression, innerCode.text);
    return [{ text: `(${typeName})${operandText}` }, ctx2];
  }

  // HARD GATE: No proof means the proof pass failed to catch an unprovable narrowing.
  // This is an internal compiler error - the proof pass should have aborted compilation.
  // We must NOT silently emit a cast, as that would be a soundness violation.
  throw new Error(
    `Internal error: numericNarrowing without proof reached emitter. ` +
      `Target: ${expr.targetKind}, Expression kind: ${expr.expression.kind}. ` +
      `This indicates a bug in the numeric proof pass - it should have ` +
      `emitted a diagnostic and aborted compilation.`
  );
};

/**
 * Emit a type assertion expression.
 *
 * TypeScript `x as T` becomes C# `(T)x` (throwing cast).
 * This is a checked cast that throws InvalidCastException on failure.
 */
const emitTypeAssertion = (
  expr: IrTypeAssertionExpression,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [innerCode, ctx1] = emitExpression(expr.expression, context, expr.targetType);

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
    // tsbindgen `ExtensionMethods<TShape>` is a TYPE-ONLY helper used to surface C#
    // extension methods as instance-style members in TypeScript. It must never
    // introduce runtime casts in emitted C# (notably for EF Core query precompilation).
    //
    // `x as ExtensionMethods<T>` (or a local alias that expands to it) is a no-op
    // at runtime; preserve the original expression verbatim.
    const resolved = resolveLocalTypeAliases(target);

    // TypeScript `as unknown` is also type-only. Casting to `object` in C# is a
    // semantic no-op and can break analyzers that expect idiomatic syntax.
    if (resolved.kind === "unknownType") {
      return true;
    }

    if (resolved.kind === "referenceType" && resolved.typeArguments?.length) {
      const importBinding = ctx1.importBindings?.get(resolved.name);
      const clrName = importBinding?.kind === "type" ? importBinding.clrName : "";
      if (clrName.endsWith(".ExtensionMethods")) {
        return true;
      }
    }

    // ExtensionMethods_* aliases often normalize to an intersection that includes one
    // or more `__Ext_*` constituents. Those `__Ext_*` types have no runtime
    // representation, so the assertion must be erased.
    if (resolved.kind === "intersectionType") {
      return resolved.types.some(
        (t) => t.kind === "referenceType" && t.name.startsWith("__Ext_")
      );
    }

    return false;
  };

  if (shouldEraseTypeAssertion(expr.targetType)) {
    return [innerCode, ctx1];
  }

  const resolveRuntimeCastTarget = (
    target: IrType,
    ctx: EmitterContext
  ): IrType => {
    // 1) Resolve local type aliases for runtime casting.
    //    TypeScript type aliases have no runtime representation in C#, except for
    //    object-literal aliases which we synthesize as classes (`Foo__Alias`).
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
        // objectType aliases are emitted as `Name__Alias` by emitReferenceType
        return target;
      }
    }

    // 2) Erase tsbindgen extension-method wrapper types at runtime:
    //    ExtensionMethods<TShape> is type-only; values are just TShape.
    if (target.kind === "referenceType" && target.typeArguments?.length) {
      const importBinding = ctx.importBindings?.get(target.name);
      const clrName = importBinding?.kind === "type" ? importBinding.clrName : "";
      if (clrName.endsWith(".ExtensionMethods")) {
        const shape = target.typeArguments[0];
        if (shape) return resolveRuntimeCastTarget(shape, ctx);
      }
    }

    // 3) Intersection types have no C# cast target; cast to the first runtime-like constituent.
    if (target.kind === "intersectionType") {
      for (const part of target.types) {
        const resolved = resolveRuntimeCastTarget(part, ctx);
        if (resolved.kind !== "intersectionType" && resolved.kind !== "objectType") {
          return resolved;
        }
      }
      const fallback = target.types[0];
      return fallback ? resolveRuntimeCastTarget(fallback, ctx) : target;
    }

    return target;
  };

  const runtimeTarget = resolveRuntimeCastTarget(expr.targetType, ctx1);
  const [typeName, ctx2] = emitType(runtimeTarget, ctx1);
  const operandText = formatCastOperandText(expr.expression, innerCode.text);
  return [{ text: `(${typeName})${operandText}` }, ctx2];
};

/**
 * Emit an asinterface expression.
 *
 * `asinterface<T>(x)` is a compile-time-only intrinsic. It must never emit a runtime
 * cast or function call. Emission relies on contextual typing in C# (typed locals,
 * parameter types, return types) to apply the interface conversion.
 */
const emitAsInterface = (
  expr: IrAsInterfaceExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  const expected = expectedType ?? expr.targetType;
  return emitExpression(expr.expression, context, expected);
};

/**
 * Emit a trycast expression.
 *
 * TypeScript `trycast<T>(x)` becomes C# `x as T` (safe cast).
 * This returns null if the cast fails instead of throwing.
 */
const emitTryCast = (
  expr: IrTryCastExpression,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [innerCode, ctx1] = emitExpression(expr.expression, context);
  const [typeName, ctx2] = emitType(expr.targetType, ctx1);
  const operandText = formatCastOperandText(expr.expression, innerCode.text);
  return [{ text: `${operandText} as ${typeName}` }, ctx2];
};

/**
 * Emit a stackalloc expression.
 *
 * TypeScript `stackalloc<T>(n)` becomes C# `stackalloc T[n]`.
 */
const emitStackAlloc = (
  expr: IrStackAllocExpression,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [elementTypeName, ctx1] = emitType(expr.elementType, context);
  const [sizeFrag, ctx2] = emitExpression(expr.size, ctx1, {
    kind: "primitiveType",
    name: "int",
  });
  return [{ text: `stackalloc ${elementTypeName}[${sizeFrag.text}]` }, ctx2];
};

/**
 * Emit a C# expression from an IR expression
 * @param expr The IR expression to emit
 * @param context The emitter context
 * @param expectedType Optional expected type for contextual typing (e.g., array element type inference)
 */
export const emitExpression = (
  expr: IrExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  const [fragment, newContext] = (() => {
    switch (expr.kind) {
    case "literal":
      // Pass expectedType for null → default conversion in generic contexts
      // Numeric literals use raw lexeme (no contextual widening under new spec)
      return emitLiteral(expr, context, expectedType);

    case "identifier":
      return emitIdentifier(expr, context);

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
      return [{ text: "this" }, context];

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

    default:
      throw new Error(
        `Unhandled IR expression kind: ${String((expr as { kind?: unknown }).kind)}`
      );
    }
  })();

  const [castedFrag, castedContext] = maybeCastNullishTypeParam(
    expr,
    fragment,
    newContext,
    expectedType
  );
  return maybeUnwrapNullableValueType(
    expr,
    castedFrag,
    castedContext,
    expectedType
  );
};

// Re-export commonly used functions for backward compatibility
export {
  emitTypeArguments,
  generateSpecializedName,
} from "./expressions/identifiers.js";
