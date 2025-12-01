/**
 * Function type emission (global::System.Func<>, global::System.Action<>)
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit function types as global::System.Func<> or global::System.Action<> delegates
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
      return ["global::System.Action", newContext];
    }
    return [`global::System.Action<${paramTypes.join(", ")}>`, newContext];
  }

  if (paramTypes.length === 0) {
    return [`global::System.Func<${returnType}>`, newContext];
  }

  return [
    `global::System.Func<${paramTypes.join(", ")}, ${returnType}>`,
    newContext,
  ];
};
