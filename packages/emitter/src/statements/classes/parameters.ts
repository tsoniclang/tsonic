/**
 * Parameter emission for functions and methods
 */

import { IrParameter } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitParameterType } from "../../type-emitter.js";

/**
 * Emit parameters for functions and methods
 */
export const emitParameters = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;
  const params: string[] = [];

  for (const param of parameters) {
    const isRest = param.isRest;
    const isOptional = param.isOptional;

    // Parameter type
    let paramType = "object";
    if (param.type) {
      const [typeName, newContext] = emitParameterType(
        param.type,
        isOptional,
        currentContext
      );
      currentContext = newContext;
      paramType = typeName;
      // TODO: Rest parameters currently map to Tsonic.Runtime.Array<T> to preserve
      // JavaScript semantics (reduce, join, etc.). In future, could optimize to
      // params T[] and wrap with Array.from() at call sites.
    }

    // Parameter name
    let paramName = "param";
    if (param.pattern.kind === "identifierPattern") {
      paramName = param.pattern.name;
    }

    // Default value - emit the actual default value in the parameter signature
    let paramStr = `${paramType} ${paramName}`;
    if (param.initializer) {
      // Emit the default value directly
      const [defaultExpr, newContext] = emitExpression(
        param.initializer,
        currentContext
      );
      currentContext = newContext;
      paramStr = `${paramType} ${paramName} = ${defaultExpr.text}`;
    } else if (isOptional && !isRest) {
      paramStr += " = default";
    }

    params.push(paramStr);
  }

  return [params.join(", "), currentContext];
};
