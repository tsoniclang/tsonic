/**
 * Miscellaneous expression emitters (template literals, spread, await)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitExpression } from "../expression-emitter.js";

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
 * Emit a template literal as C# interpolated string
 *
 * All interpolation holes are wrapped in parentheses: {(expr)}
 * This prevents C# parsing ambiguity where ':' in expressions like
 * 'global::Namespace.Type' would be interpreted as a format specifier.
 *
 * Literal curly braces in template strings are escaped as {{ and }}
 * since they are interpolation delimiters in C#.
 */
export const emitTemplateLiteral = (
  expr: Extract<IrExpression, { kind: "templateLiteral" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;
  const parts: string[] = [];

  for (let i = 0; i < expr.quasis.length; i++) {
    const quasi = expr.quasis[i];
    if (quasi !== undefined && quasi !== null) {
      // Escape the quasi for C# interpolated string
      parts.push(escapeForInterpolatedString(quasi));
    }

    const exprAtIndex = expr.expressions[i];
    if (i < expr.expressions.length && exprAtIndex) {
      const [exprFrag, newContext] = emitExpression(
        exprAtIndex,
        currentContext
      );
      // Only wrap in parentheses when needed to avoid ':' being parsed as format specifier
      // Cases that need parens:
      // - Conditional (ternary) expressions: {(cond ? a : b)}
      // - Any expression containing ':' (e.g., global::Namespace.Type)
      const needsParens =
        exprAtIndex.kind === "conditional" || exprFrag.text.includes(":");
      const baseExpr = needsParens ? `(${exprFrag.text})` : exprFrag.text;

      // JavaScript template literal holes use ToString conversion:
      // `${undefined}` -> "undefined". C# interpolated strings render null as "".
      // For nullish unions, force a string conversion with an explicit fallback.
      const interpolationExpr = typeMayBeNullish(exprAtIndex.inferredType)
        ? `global::System.Convert.ToString(${baseExpr}) ?? "undefined"`
        : baseExpr;

      const interpolation =
        needsParens || typeMayBeNullish(exprAtIndex.inferredType)
          ? `{(${interpolationExpr})}`
          : `{${interpolationExpr}}`;
      parts.push(interpolation);
      currentContext = newContext;
    }
  }

  const text = `$"${parts.join("")}"`;
  return [{ text }, currentContext];
};

/**
 * Emit a spread expression
 */
export const emitSpread = (
  expr: Extract<IrExpression, { kind: "spread" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [exprFrag, newContext] = emitExpression(expr.expression, context);
  // Spread syntax needs context-specific handling
  const text = `...${exprFrag.text}`;
  return [{ text }, newContext];
};

/**
 * Emit an await expression
 */
export const emitAwait = (
  expr: Extract<IrExpression, { kind: "await" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [exprFrag, newContext] = emitExpression(expr.expression, context);
  const text = `await ${exprFrag.text}`;
  return [{ text }, newContext];
};
