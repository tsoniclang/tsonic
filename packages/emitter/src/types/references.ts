/**
 * Reference type emission (Array, Promise, Error, etc.)
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext, addUsing } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit reference types with type arguments
 */
export const emitReferenceType = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const { name, typeArguments } = type;

  // Handle built-in types
  if (name === "Array" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
    if (!firstArg) {
      const updatedContext = addUsing(context, "System.Collections.Generic");
      return [`List<object>`, updatedContext];
    }
    const [elementType, newContext] = emitType(firstArg, context);
    const updatedContext = addUsing(newContext, "System.Collections.Generic");
    return [`List<${elementType}>`, updatedContext];
  }

  if (name === "Promise" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
    if (!firstArg) {
      const updatedContext = addUsing(context, "System.Threading.Tasks");
      return [`Task`, updatedContext];
    }
    const [elementType, newContext] = emitType(firstArg, context);
    const updatedContext = addUsing(newContext, "System.Threading.Tasks");
    // Promise<void> should map to Task (not Task<void>)
    if (elementType === "void") {
      return [`Task`, updatedContext];
    }
    return [`Task<${elementType}>`, updatedContext];
  }

  if (name === "Promise") {
    const updatedContext = addUsing(context, "System.Threading.Tasks");
    return ["Task", updatedContext];
  }

  // Map common JS types to .NET equivalents
  // Note: Date, RegExp, Map, Set are NOT SUPPORTED in MVP
  // Users should use System.DateTime, System.Text.RegularExpressions.Regex,
  // Dictionary<K,V>, and HashSet<T> directly
  const runtimeTypes: Record<string, string> = {
    Error: "System.Exception",
  };

  if (name in runtimeTypes) {
    const csharpType = runtimeTypes[name];
    if (!csharpType) {
      return [name, context];
    }

    let updatedContext = context;

    if (csharpType.startsWith("Tsonic.Runtime")) {
      updatedContext = addUsing(context, "Tsonic.Runtime");
    } else if (csharpType.startsWith("System")) {
      updatedContext = addUsing(context, "System");
    }

    if (typeArguments && typeArguments.length > 0) {
      const typeParams: string[] = [];
      let currentContext = updatedContext;

      for (const typeArg of typeArguments) {
        const [paramType, newContext] = emitType(typeArg, currentContext);
        typeParams.push(paramType);
        currentContext = newContext;
      }

      return [`${csharpType}<${typeParams.join(", ")}>`, currentContext];
    }

    return [csharpType, updatedContext];
  }

  // Handle type arguments for other reference types
  if (typeArguments && typeArguments.length > 0) {
    const typeParams: string[] = [];
    let currentContext = context;

    for (const typeArg of typeArguments) {
      const [paramType, newContext] = emitType(typeArg, currentContext);
      typeParams.push(paramType);
      currentContext = newContext;
    }

    return [`${name}<${typeParams.join(", ")}>`, currentContext];
  }

  // Default: use the name as-is
  return [name, context];
};
