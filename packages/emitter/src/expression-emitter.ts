/**
 * Expression Emitter - IR expressions to C# code
 * Main dispatcher - delegates to specialized modules
 */

import {
  IrExpression,
  IrType,
  IrNumericNarrowingExpression,
} from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "./types.js";

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

    // For binary/unary ops, variables, and parameters that already produce the
    // target type, emit without expectedType to avoid redundant casts.
    // The proof confirms the expression produces the correct type naturally.
    if (
      expr.proof.source.type === "binaryOp" ||
      expr.proof.source.type === "unaryOp" ||
      expr.proof.source.type === "variable" ||
      expr.proof.source.type === "parameter" ||
      expr.proof.source.type === "narrowing"
    ) {
      const [innerCode, newContext] = emitExpression(
        expr.expression,
        context
        // No expectedType - the expression produces the target type naturally
      );
      return [innerCode, newContext];
    }

    // For dotnetReturn and other proof types, emit without forcing a cast
    const [innerCode, newContext] = emitExpression(expr.expression, context);
    return [innerCode, newContext];
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
