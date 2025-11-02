/**
 * Function type emission (Func<>, Action<>)
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext, addUsing } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit function types as Func<> or Action<> delegates
 */
export const emitFunctionType = (
  type: Extract<IrType, { kind: "functionType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // For function types, we'll use Func<> or Action<> delegates
  const paramTypes: string[] = [];
  let currentContext = context;

  for (const param of type.parameters) {
    const paramType = param.type ?? { kind: "anyType" as const };
    const [typeStr, newContext] = emitType(paramType, currentContext);
    paramTypes.push(typeStr);
    currentContext = newContext;
  }

  const returnTypeNode = type.returnType ?? { kind: "voidType" as const };
  const [returnType, newContext] = emitType(returnTypeNode, currentContext);

  if (returnType === "void") {
    if (paramTypes.length === 0) {
      return ["Action", addUsing(newContext, "System")];
    }
    return [`Action<${paramTypes.join(", ")}>`, addUsing(newContext, "System")];
  }

  if (paramTypes.length === 0) {
    return [`Func<${returnType}>`, addUsing(newContext, "System")];
  }

  return [
    `Func<${paramTypes.join(", ")}, ${returnType}>`,
    addUsing(newContext, "System"),
  ];
};
