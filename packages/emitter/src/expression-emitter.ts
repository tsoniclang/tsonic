/**
 * Expression Emitter - IR expressions to C# code
 * Main dispatcher - delegates to specialized modules
 *
 * Primary entry point is emitExpressionAst which returns [CSharpExpressionAst, EmitterContext].
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import type { CSharpExpressionAst } from "./core/format/backend-ast/types.js";

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

// Import from split modules
import {
  emitNumericNarrowing,
  emitTypeAssertion,
  emitAsInterface,
  emitTryCast,
  emitStackAlloc,
  emitDefaultOf,
  emitNameOf,
  emitSizeOf,
} from "./expressions/type-assertion-emitters.js";
import { adaptEmittedExpressionAst } from "./expressions/expected-type-adaptation.js";

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
        return emitMemberAccess(expr, context, "value", expectedType);

      case "call":
        return emitCall(expr, context, expectedType);

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
        return emitFunctionExpression(expr, context, expectedType);

      case "arrowFunction":
        return emitArrowFunction(expr, context, expectedType);

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
        return emitTypeAssertion(expr, context, expectedType);

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

  return adaptEmittedExpressionAst({
    expr,
    valueAst: ast,
    context: newContext,
    expectedType,
  });
};

// Re-export commonly used functions from barrel
export { generateSpecializedName } from "./expressions/identifiers.js";
