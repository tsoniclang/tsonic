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
import { unwrapTransparentExpression } from "./core/semantic/transparent-expressions.js";

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
  const normalizedExpr = (() => {
    const transparent = unwrapTransparentExpression(expr);
    return transparent !== expr &&
      transparent.kind === "identifier" &&
      context.promiseResolveValueTypes?.has(transparent.name) === true
      ? transparent
      : expr;
  })();

  const [ast, newContext] = (() => {
    switch (normalizedExpr.kind) {
      case "literal":
        return emitLiteral(normalizedExpr, context, expectedType);

      case "identifier":
        return emitIdentifier(normalizedExpr, context, expectedType);

      case "array":
        return emitArray(normalizedExpr, context, expectedType);

      case "object":
        return emitObject(normalizedExpr, context, expectedType);

      case "memberAccess":
        return emitMemberAccess(normalizedExpr, context, "value", expectedType);

      case "call":
        return emitCall(normalizedExpr, context, expectedType);

      case "new":
        return emitNew(normalizedExpr, context);

      case "binary":
        return emitBinary(normalizedExpr, context, expectedType);

      case "logical":
        return emitLogical(normalizedExpr, context, expectedType);

      case "unary":
        return emitUnary(normalizedExpr, context, expectedType);

      case "update":
        return emitUpdate(normalizedExpr, context);

      case "assignment":
        return emitAssignment(normalizedExpr, context);

      case "conditional":
        return emitConditional(normalizedExpr, context, expectedType);

      case "functionExpression":
        return emitFunctionExpression(normalizedExpr, context, expectedType);

      case "arrowFunction":
        return emitArrowFunction(normalizedExpr, context, expectedType);

      case "templateLiteral":
        return emitTemplateLiteral(normalizedExpr, context);

      case "spread":
        return emitSpread(normalizedExpr, context);

      case "await":
        return emitAwait(normalizedExpr, context);

      case "this":
        return [
          {
            kind: "identifierExpression" as const,
            identifier: context.objectLiteralThisIdentifier ?? "this",
          },
          context,
        ];

      case "numericNarrowing":
        return emitNumericNarrowing(normalizedExpr, context);

      case "asinterface":
        return emitAsInterface(normalizedExpr, context, expectedType);

      case "typeAssertion":
        return emitTypeAssertion(normalizedExpr, context, expectedType);

      case "trycast":
        return emitTryCast(normalizedExpr, context);

      case "stackalloc":
        return emitStackAlloc(normalizedExpr, context);

      case "defaultof":
        return emitDefaultOf(normalizedExpr, context);

      case "nameof":
        return emitNameOf(normalizedExpr, context);

      case "sizeof":
        return emitSizeOf(normalizedExpr, context);

      default:
        throw new Error(
          `Unhandled IR expression kind: ${String((expr as { kind?: unknown }).kind)}`
        );
    }
  })();

  return adaptEmittedExpressionAst({
    expr: normalizedExpr,
    valueAst: ast,
    context: newContext,
    expectedType,
  });
};

// Re-export commonly used functions from barrel
export { generateSpecializedName } from "./expressions/identifiers.js";
