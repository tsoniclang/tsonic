/**
 * Miscellaneous expression emitters (template literals, spread, await)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { printExpression } from "../core/format/backend-ast/printer.js";
import type {
  CSharpExpressionAst,
  CSharpInterpolatedStringPart,
} from "../core/format/backend-ast/types.js";

const typeMayBeNullish = (type: IrType | undefined): boolean => {
  if (!type) return false;
  if (
    type.kind === "primitiveType" &&
    (type.name === "null" || type.name === "undefined")
  ) {
    return true;
  }
  if (type.kind === "unionType") {
    return type.types.some(
      (t) =>
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
    );
  }
  return false;
};

/**
 * Escape a string for use in a C# interpolated string literal.
 * Handles backslashes, quotes, newlines, carriage returns, tabs,
 * and curly braces (which are interpolation delimiters in C#).
 */
const escapeForInterpolatedString = (str: string): string =>
  str
    .replace(/\\/g, "\\\\") // Backslash first to avoid double-escaping
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\{/g, "{{") // Escape { for C# interpolated strings
    .replace(/\}/g, "}}"); // Escape } for C# interpolated strings

/**
 * Build a nullish-safe interpolation expression.
 *
 * JavaScript template literal holes use ToString conversion:
 * `${undefined}` -> "undefined". C# interpolated strings render null as "".
 * For nullish unions, force a string conversion with an explicit fallback:
 *   global::System.Convert.ToString(expr) ?? "undefined"
 */
const buildNullishSafeExpr = (
  exprAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "binaryExpression",
  operatorToken: "??",
  left: {
    kind: "invocationExpression",
    expression: {
      kind: "identifierExpression",
      identifier: "global::System.Convert.ToString",
    },
    arguments: [exprAst],
  },
  right: { kind: "literalExpression", text: '"undefined"' },
});

/**
 * Emit a template literal as CSharpExpressionAst (interpolatedStringExpression)
 *
 * Literal curly braces in template strings are escaped as {{ and }}
 * since they are interpolation delimiters in C#.
 *
 * The printer handles wrapping interpolation expressions in parens when they
 * contain ':' to prevent format specifier ambiguity.
 */
export const emitTemplateLiteral = (
  expr: Extract<IrExpression, { kind: "templateLiteral" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;
  const parts: CSharpInterpolatedStringPart[] = [];

  for (let i = 0; i < expr.quasis.length; i++) {
    const quasi = expr.quasis[i];
    if (quasi !== undefined && quasi !== null && quasi.length > 0) {
      parts.push({
        kind: "text",
        text: escapeForInterpolatedString(quasi),
      });
    }

    const exprAtIndex = expr.expressions[i];
    if (i < expr.expressions.length && exprAtIndex) {
      const [exprAst, newContext] = emitExpressionAst(
        exprAtIndex,
        currentContext
      );
      currentContext = newContext;

      // For nullish types, wrap in Convert.ToString(...) ?? "undefined"
      const interpolationExpr = typeMayBeNullish(exprAtIndex.inferredType)
        ? buildNullishSafeExpr(exprAst)
        : exprAst;

      parts.push({ kind: "interpolation", expression: interpolationExpr });
    }
  }

  return [{ kind: "interpolatedStringExpression", parts }, currentContext];
};

/**
 * Emit a spread expression as CSharpExpressionAst
 *
 * Note: Spread is not a standalone C# expression. This is a fallback
 * that preserves the current behavior. Array/call contexts handle spread
 * specially via their own emitters.
 */
export const emitSpread = (
  expr: Extract<IrExpression, { kind: "spread" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [exprAst, newContext] = emitExpressionAst(expr.expression, context);
  // Use identifierExpression as a fallback for the ...expr pattern
  const text = `...${printExpression(exprAst)}`;
  return [{ kind: "identifierExpression", identifier: text }, newContext];
};

/**
 * Emit an await expression as CSharpExpressionAst
 */
export const emitAwait = (
  expr: Extract<IrExpression, { kind: "await" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [exprAst, newContext] = emitExpressionAst(expr.expression, context);
  return [{ kind: "awaitExpression", expression: exprAst }, newContext];
};
