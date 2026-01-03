/**
 * Function expression emitters (function expressions and arrow functions)
 */

import { IrExpression, IrParameter, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, indent } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitStatement } from "../statement-emitter.js";
import { emitType } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";

/**
 * Unwrap ref/out/in wrapper types (e.g., ref<T> -> T)
 * Returns the inner type if it's a wrapper, null otherwise.
 */
const unwrapParameterModifierType = (type: IrType): IrType | null => {
  if (type.kind !== "referenceType") {
    return null;
  }

  const name = type.name;
  // Check for wrapper types: out<T>, ref<T>, In<T>
  if (
    (name === "out" || name === "ref" || name === "In") &&
    type.typeArguments &&
    type.typeArguments.length === 1
  ) {
    const innerType = type.typeArguments[0];
    return innerType ?? null;
  }

  return null;
};

/**
 * Emit lambda parameters.
 * Rules:
 * - If ALL params have types, emit typed: (Type a, Type b) => ...
 * - If ANY param is missing type, emit untyped: (a, b) => ...
 * - Support ref/out/in modifiers
 * - Never emit = default or initializers (not valid in C# lambdas)
 */
const emitLambdaParameters = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;

  // Check if ALL parameters have types - "all-or-nothing" rule
  // C# doesn't allow mixing typed and untyped lambda parameters
  const allHaveTypes = parameters.every((p) => p.type !== undefined);

  const parts: string[] = [];

  for (const param of parameters) {
    // Get parameter name
    let name = "_";
    if (param.pattern.kind === "identifierPattern") {
      name = escapeCSharpIdentifier(param.pattern.name);
    }

    // Get modifier (ref/out/in)
    const modifier = param.passing !== "value" ? `${param.passing} ` : "";

    if (allHaveTypes && param.type) {
      // Emit typed parameter
      // Unwrap ref/out/in wrapper types if present
      const unwrapped = unwrapParameterModifierType(param.type);
      const actualType = unwrapped ?? param.type;

      const [typeStr, newContext] = emitType(actualType, currentContext);
      currentContext = newContext;

      parts.push(`${modifier}${typeStr} ${name}`);
    } else {
      // Emit untyped parameter (name only)
      // Note: modifiers don't work without types in C# lambdas
      parts.push(name);
    }
  }

  return [parts.join(", "), currentContext];
};

/**
 * Emit a function expression as C# lambda
 */
export const emitFunctionExpression = (
  expr: Extract<IrExpression, { kind: "functionExpression" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Emit parameters
  const [paramList, paramContext] = emitLambdaParameters(
    expr.parameters,
    context
  );

  // Function expressions always have block bodies
  const blockContext = paramContext.isStatic
    ? indent(paramContext)
    : paramContext;
  const [blockCode] = emitStatement(expr.body, blockContext);

  const asyncPrefix = expr.isAsync ? "async " : "";
  const text = `${asyncPrefix}(${paramList}) =>\n${blockCode}`;
  return [{ text }, paramContext];
};

/**
 * Emit an arrow function as C# lambda
 */
export const emitArrowFunction = (
  expr: Extract<IrExpression, { kind: "arrowFunction" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Emit parameters
  const [paramList, paramContext] = emitLambdaParameters(
    expr.parameters,
    context
  );

  const asyncPrefix = expr.isAsync ? "async " : "";

  // Arrow function body can be block or expression
  if (expr.body.kind === "blockStatement") {
    // Block body: (params) => { ... }
    const blockContext = paramContext.isStatic
      ? indent(paramContext)
      : paramContext;
    const [blockCode] = emitStatement(expr.body, blockContext);
    const text = `${asyncPrefix}(${paramList}) =>\n${blockCode}`;
    return [{ text }, paramContext];
  } else {
    // Expression body: (params) => expression
    const [exprCode, newContext] = emitExpression(expr.body, paramContext);
    const text = `${asyncPrefix}(${paramList}) => ${exprCode.text}`;
    return [{ text }, newContext];
  }
};
