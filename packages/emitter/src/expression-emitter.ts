/**
 * Expression Emitter - IR expressions to C# code
 * Main dispatcher - delegates to specialized modules
 */

import {
  IrExpression,
  IrType,
  IrNumericNarrowingExpression,
  NUMERIC_KIND_TO_CSHARP,
} from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "./types.js";

// Import expression emitters from specialized modules
import {
  emitLiteral,
  getExpectedClrTypeForNumeric,
} from "./expressions/literals.js";
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
  const targetKind = expr.targetKind;
  const targetCSharpType = NUMERIC_KIND_TO_CSHARP.get(targetKind) ?? "int";

  // If we have a proof that the inner expression already produces the target type,
  // we don't need a cast - just emit the inner expression
  if (expr.proof !== undefined) {
    // The proof validates the narrowing is sound, so emit the inner expression
    // with the appropriate numeric context
    const [innerCode, newContext] = emitExpression(
      expr.expression,
      context,
      expr.inferredType // Pass the target type as expected type
    );

    // If the inner is a literal, it will already emit correctly based on inferredType
    // If the inner is a binary op between ints, it produces int, no cast needed
    if (expr.proof.source.type === "literal") {
      // Literal was already proven to fit - emitExpression will handle it
      return [innerCode, newContext];
    }

    if (
      expr.proof.source.type === "binaryOp" ||
      expr.proof.source.type === "unaryOp"
    ) {
      // Binary/unary op that produces the target type - no cast needed
      return [innerCode, newContext];
    }

    if (
      expr.proof.source.type === "variable" ||
      expr.proof.source.type === "parameter"
    ) {
      // Variable/parameter already has the target type - no cast needed
      return [innerCode, newContext];
    }

    // For other proof types (dotnetReturn, narrowing from same type), emit as-is
    return [innerCode, newContext];
  }

  // No proof - this shouldn't happen after proof pass, but handle defensively
  // Emit with explicit cast
  const [innerCode, newContext] = emitExpression(expr.expression, context);
  return [{ text: `(${targetCSharpType})(${innerCode.text})` }, newContext];
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
  switch (expr.kind) {
    case "literal":
      // Pass expectedType for null → default conversion in generic contexts
      // Also check if the literal has an inferredType that requires integer emission
      return emitLiteral(
        expr,
        context,
        expectedType,
        getExpectedClrTypeForNumeric(expr.inferredType)
      );

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

    default:
      // Fallback for unhandled expressions
      return [{ text: "/* TODO: unhandled expression */" }, context];
  }
};

// Re-export commonly used functions for backward compatibility
export {
  emitTypeArguments,
  generateSpecializedName,
} from "./expressions/identifiers.js";
