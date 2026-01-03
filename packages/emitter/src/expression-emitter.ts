/**
 * Expression Emitter - IR expressions to C# code
 * Main dispatcher - delegates to specialized modules
 */

import {
  IrExpression,
  IrType,
  IrNumericNarrowingExpression,
  IrTypeAssertionExpression,
  IrTryCastExpression,
} from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "./types.js";
import { emitType } from "./type-emitter.js";

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
    return [{ text: `(${typeName})${innerCode.text}` }, ctx2];
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
  const [innerCode, ctx1] = emitExpression(expr.expression, context);
  const [typeName, ctx2] = emitType(expr.targetType, ctx1);
  return [{ text: `(${typeName})${innerCode.text}` }, ctx2];
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
  return [{ text: `${innerCode.text} as ${typeName}` }, ctx2];
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

    case "typeAssertion":
      return emitTypeAssertion(expr, context);

    case "trycast":
      return emitTryCast(expr, context);

    default:
      // Fallback for unhandled expressions
      return [{ text: "/* TODO: unhandled expression */" }, context];
    }
  })();

  return maybeCastNullishTypeParam(expr, fragment, newContext, expectedType);
};

// Re-export commonly used functions for backward compatibility
export {
  emitTypeArguments,
  generateSpecializedName,
} from "./expressions/identifiers.js";
