/**
 * Function expression emitters (function expressions and arrow functions)
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, indent } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitStatement } from "../statement-emitter.js";

/**
 * Emit a function expression (placeholder for now)
 */
export const emitFunctionExpression = (
  _expr: Extract<IrExpression, { kind: "functionExpression" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Function expressions need to be converted to lambdas or delegates
  // For MVP, we'll emit a placeholder
  const text = "/* function expression */";
  return [{ text }, context];
};

/**
 * Emit an arrow function as C# lambda
 */
export const emitArrowFunction = (
  expr: Extract<IrExpression, { kind: "arrowFunction" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Convert arrow function to C# lambda
  let currentContext = context;
  const paramNames: string[] = [];

  for (const param of expr.parameters) {
    if (param.pattern.kind === "identifierPattern") {
      paramNames.push(param.pattern.name);
    } else {
      paramNames.push("_");
    }
  }

  // Handle body
  let bodyText: string;
  if (typeof expr.body === "object" && "kind" in expr.body) {
    if (expr.body.kind === "blockStatement") {
      // For block statements in lambdas:
      // - In static contexts (field initializers), indent the block one level
      // - In non-static contexts (local variables), keep at same level
      const blockContext = currentContext.isStatic
        ? indent(currentContext)
        : currentContext;
      const [blockCode, _newContext] = emitStatement(expr.body, blockContext);

      const params = paramNames.join(", ");
      // The block code has proper indentation, just prepend the lambda signature
      const text = `(${params}) =>\n${blockCode}`;

      return [{ text }, currentContext];
    } else {
      const [bodyFrag, newContext] = emitExpression(expr.body, currentContext);
      currentContext = newContext;
      bodyText = bodyFrag.text;
    }
  } else {
    bodyText = "/* unknown body */";
  }

  const params = paramNames.join(", ");
  const text = `(${params}) => ${bodyText}`;
  return [{ text }, currentContext];
};
