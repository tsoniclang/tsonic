/**
 * Arrow Return Finalization — Expression Walkers
 *
 * Expression-level recursive walkers for the arrow return finalization pass.
 * Handles arrow function return type inference from body expression's
 * inferredType, plus all other expression kinds.
 */

import {
  IrExpression,
  IrArrowFunctionExpression,
  IrFunctionExpression,
  IrParameter,
} from "../types.js";

import { processBlockStatement } from "./arrow-return-statement-walk.js";

/**
 * Process an expression, handling arrow functions specially
 */
export const processExpression = (expr: IrExpression): IrExpression => {
  switch (expr.kind) {
    case "arrowFunction":
      return processArrowFunction(expr);

    case "functionExpression":
      return processFunctionExpression(expr);

    case "array":
      return {
        ...expr,
        elements: expr.elements.map((el) =>
          el === undefined ? undefined : processExpression(el)
        ),
      };

    case "object":
      return {
        ...expr,
        properties: expr.properties.map((prop) => {
          if (prop.kind === "spread") {
            return {
              ...prop,
              expression: processExpression(prop.expression),
            };
          }
          return {
            ...prop,
            key:
              typeof prop.key === "string"
                ? prop.key
                : processExpression(prop.key),
            value: processExpression(prop.value),
          };
        }),
      };

    case "call":
      return {
        ...expr,
        callee: processExpression(expr.callee),
        arguments: expr.arguments.map((arg) =>
          arg.kind === "spread"
            ? { ...arg, expression: processExpression(arg.expression) }
            : processExpression(arg)
        ),
      };

    case "new":
      return {
        ...expr,
        callee: processExpression(expr.callee),
        arguments: expr.arguments.map((arg) =>
          arg.kind === "spread"
            ? { ...arg, expression: processExpression(arg.expression) }
            : processExpression(arg)
        ),
      };

    case "memberAccess":
      return {
        ...expr,
        object: processExpression(expr.object),
        property:
          typeof expr.property === "string"
            ? expr.property
            : processExpression(expr.property),
      };

    case "binary":
      return {
        ...expr,
        left: processExpression(expr.left),
        right: processExpression(expr.right),
      };

    case "logical":
      return {
        ...expr,
        left: processExpression(expr.left),
        right: processExpression(expr.right),
      };

    case "unary":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "update":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "conditional":
      return {
        ...expr,
        condition: processExpression(expr.condition),
        whenTrue: processExpression(expr.whenTrue),
        whenFalse: processExpression(expr.whenFalse),
      };

    case "assignment":
      return {
        ...expr,
        left:
          "kind" in expr.left && expr.left.kind !== undefined
            ? processExpression(expr.left as IrExpression)
            : expr.left,
        right: processExpression(expr.right),
      };

    case "templateLiteral":
      return {
        ...expr,
        expressions: expr.expressions.map(processExpression),
      };

    case "spread":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "await":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "yield":
      return {
        ...expr,
        expression: expr.expression
          ? processExpression(expr.expression)
          : undefined,
      };

    case "numericNarrowing":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "typeAssertion":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "trycast":
      return {
        ...expr,
        expression: processExpression(expr.expression),
      };

    case "stackalloc":
      return {
        ...expr,
        size: processExpression(expr.size),
      };

    // Leaf expressions - no recursion needed
    case "literal":
    case "identifier":
    case "this":
      return expr;

    default:
      return expr;
  }
};

/**
 * Process arrow function - finalize return type from body if needed
 */
const processArrowFunction = (
  expr: IrArrowFunctionExpression
): IrArrowFunctionExpression => {
  // Process nested expressions in parameters (default values)
  const processedParams = expr.parameters.map(processParameter);

  // Process the body
  const processedBody =
    expr.body.kind === "blockStatement"
      ? processBlockStatement(expr.body)
      : processExpression(expr.body);

  // If returnType is already set (explicit annotation), keep it
  if (expr.returnType !== undefined) {
    return {
      ...expr,
      parameters: processedParams,
      body: processedBody,
    };
  }

  // For expression-bodied arrows without explicit return type,
  // infer return type from body's inferredType
  if (processedBody.kind !== "blockStatement") {
    // Prefer the arrow's own inferred function signature when available.
    //
    // This is critical for airplane-grade correctness:
    // - The anonymous-type lowering pass runs before this pass and *does* lower
    //   `arrow.inferredType.returnType` (when inferredType is a functionType).
    // - Expression `inferredType` fields (including object literals) are intentionally
    //   not lowered/validated globally, so using `body.inferredType` here can
    //   reintroduce IrObjectType into a type position and crash the emitter.
    const inferredReturnType =
      expr.inferredType?.kind === "functionType"
        ? expr.inferredType.returnType
        : processedBody.inferredType;

    if (inferredReturnType !== undefined) {
      return {
        ...expr,
        parameters: processedParams,
        body: processedBody,
        returnType: inferredReturnType,
      };
    }
  }

  // Block-bodied arrows without explicit return type:
  // The escape hatch validation (TSN7430) should have caught this.
  // If we reach here, just return the processed arrow without returnType.
  return {
    ...expr,
    parameters: processedParams,
    body: processedBody,
  };
};

/**
 * Process function expression
 */
const processFunctionExpression = (
  expr: IrFunctionExpression
): IrFunctionExpression => ({
  ...expr,
  parameters: expr.parameters.map(processParameter),
  body: processBlockStatement(expr.body),
});

/**
 * Process a parameter (handle default values)
 */
const processParameter = (param: IrParameter): IrParameter => ({
  ...param,
  initializer: param.initializer
    ? processExpression(param.initializer)
    : undefined,
});
