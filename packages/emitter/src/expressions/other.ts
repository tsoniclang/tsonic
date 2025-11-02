/**
 * Miscellaneous expression emitters (template literals, spread, await)
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitExpression } from "../expression-emitter.js";

/**
 * Emit a template literal as C# interpolated string
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
      parts.push(quasi);
    }

    const exprAtIndex = expr.expressions[i];
    if (i < expr.expressions.length && exprAtIndex) {
      const [exprFrag, newContext] = emitExpression(
        exprAtIndex,
        currentContext
      );
      parts.push(`{${exprFrag.text}}`);
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
