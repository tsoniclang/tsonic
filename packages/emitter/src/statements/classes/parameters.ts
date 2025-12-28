/**
 * Parameter emission for functions and methods
 */

import { IrParameter, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitParameterType } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";

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

    // Use the passing mode from IR (frontend already unwrapped ref<T>/out<T>/in<T>)
    const paramModifier = param.passing !== "value" ? param.passing : "";
    const actualType: IrType | undefined = param.type;

    // Parameter type
    let paramType = "object";
    if (actualType) {
      const [typeName, newContext] = emitParameterType(
        actualType,
        isOptional,
        currentContext
      );
      currentContext = newContext;
      paramType = typeName;
      // Rest parameters use native T[] arrays with params modifier
    }

    // Parameter name (escape C# keywords)
    let paramName = "param";
    if (param.pattern.kind === "identifierPattern") {
      paramName = escapeCSharpIdentifier(param.pattern.name);
    }

    // Construct parameter string with modifier if present
    let paramStr = paramModifier
      ? `${paramModifier} ${paramType} ${paramName}`
      : `${paramType} ${paramName}`;
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
