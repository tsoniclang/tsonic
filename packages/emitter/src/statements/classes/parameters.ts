/**
 * Parameter emission for functions and methods
 */

import { IrParameter, IrType } from "@tsonic/frontend";
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

    // Check if this is a ref/out/in parameter modifier type
    let paramModifier = "";
    let actualType: IrType | undefined = param.type;

    if (param.type && param.type.kind === "referenceType") {
      const refType = param.type;
      // Check if it's ref<T>, out<T>, or In<T>
      if (
        (refType.name === "ref" ||
          refType.name === "out" ||
          refType.name === "In") &&
        refType.typeArguments &&
        refType.typeArguments.length > 0
      ) {
        // Extract the modifier
        paramModifier = refType.name === "In" ? "in" : refType.name;
        // Extract the wrapped type
        actualType = refType.typeArguments[0];
      }
    }

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
      // TODO: Rest parameters currently map to Tsonic.Runtime.Array<T> to preserve
      // JavaScript semantics (reduce, join, etc.). In future, could optimize to
      // params T[] and wrap with Array.from() at call sites.
    }

    // Parameter name
    let paramName = "param";
    if (param.pattern.kind === "identifierPattern") {
      paramName = param.pattern.name;
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
