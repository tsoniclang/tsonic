/**
 * Type Emitter - IR types to C# types
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext, addUsing } from "./types.js";

/**
 * Emit a C# type from an IR type
 */
export const emitType = (
  type: IrType,
  context: EmitterContext
): [string, EmitterContext] => {
  switch (type.kind) {
    case "primitiveType":
      return emitPrimitiveType(type, context);

    case "referenceType":
      return emitReferenceType(type, context);

    case "arrayType":
      return emitArrayType(type, context);

    case "functionType":
      return emitFunctionType(type, context);

    case "objectType":
      return emitObjectType(type, context);

    case "unionType":
      return emitUnionType(type, context);

    case "intersectionType":
      return emitIntersectionType(type, context);

    case "literalType":
      return emitLiteralType(type, context);

    case "anyType":
      return ["object", context];

    case "unknownType":
      return ["object", context];

    case "voidType":
      return ["void", context];

    case "neverType":
      return ["void", context];

    default:
      // Fallback for unhandled types
      return ["object", context];
  }
};

const emitPrimitiveType = (
  type: Extract<IrType, { kind: "primitiveType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const typeMap: Record<string, string> = {
    number: "double",
    string: "string",
    boolean: "bool",
    null: "object",
    undefined: "object",
  };

  return [typeMap[type.name] ?? "object", context];
};

const emitReferenceType = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const { name, typeArguments } = type;

  // Handle built-in types
  if (name === "Array" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
    if (!firstArg) {
      const updatedContext = addUsing(context, "Tsonic.Runtime");
      return [`Tsonic.Runtime.Array<object>`, updatedContext];
    }
    const [elementType, newContext] = emitType(firstArg, context);
    const updatedContext = addUsing(newContext, "Tsonic.Runtime");
    return [`Tsonic.Runtime.Array<${elementType}>`, updatedContext];
  }

  if (name === "Promise" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
    if (!firstArg) {
      const updatedContext = addUsing(context, "System.Threading.Tasks");
      return [`Task`, updatedContext];
    }
    const [elementType, newContext] = emitType(firstArg, context);
    const updatedContext = addUsing(newContext, "System.Threading.Tasks");
    return [`Task<${elementType}>`, updatedContext];
  }

  if (name === "Promise") {
    const updatedContext = addUsing(context, "System.Threading.Tasks");
    return ["Task", updatedContext];
  }

  // Map common JS types to Tsonic.Runtime equivalents
  const runtimeTypes: Record<string, string> = {
    Date: "Tsonic.Runtime.Date",
    RegExp: "Tsonic.Runtime.RegExp",
    Map: "Tsonic.Runtime.Map",
    Set: "Tsonic.Runtime.Set",
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

const emitArrayType = (
  type: Extract<IrType, { kind: "arrayType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const [elementType, newContext] = emitType(type.elementType, context);
  const updatedContext = addUsing(newContext, "Tsonic.Runtime");
  return [`Tsonic.Runtime.Array<${elementType}>`, updatedContext];
};

const emitFunctionType = (
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

const emitObjectType = (
  _type: Extract<IrType, { kind: "objectType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // For anonymous object types, we use dynamic or object
  // In a more complete implementation, we might generate anonymous types
  return ["dynamic", addUsing(context, "System")];
};

const emitUnionType = (
  type: Extract<IrType, { kind: "unionType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // C# doesn't have union types, so we need to find a common base type
  // For MVP, we'll use object
  // In a more complete implementation, we might analyze the types for a common base

  // Check if it's a nullable type (T | null | undefined)
  const nonNullTypes = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );

  if (nonNullTypes.length === 1) {
    // This is a nullable type
    const firstType = nonNullTypes[0];
    if (!firstType) {
      return ["object", context];
    }
    const [baseType, newContext] = emitType(firstType, context);
    if (baseType !== "string" && baseType !== "object") {
      return [`${baseType}?`, newContext];
    }
    return [baseType, newContext];
  }

  return ["object", context];
};

const emitIntersectionType = (
  _type: Extract<IrType, { kind: "intersectionType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // C# doesn't have intersection types
  // For MVP, we'll use object
  // In a more complete implementation, we might generate an interface
  return ["object", context];
};

const emitLiteralType = (
  type: Extract<IrType, { kind: "literalType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // For literal types, we emit the base type
  if (typeof type.value === "string") {
    return ["string", context];
  }
  if (typeof type.value === "number") {
    return ["double", context];
  }
  if (typeof type.value === "boolean") {
    return ["bool", context];
  }
  return ["object", context];
};

/**
 * Emit a parameter type with optional and default value handling
 */
export const emitParameterType = (
  type: IrType | undefined,
  isOptional: boolean,
  context: EmitterContext
): [string, EmitterContext] => {
  const typeNode = type ?? { kind: "anyType" as const };
  const [baseType, newContext] = emitType(typeNode, context);

  if (isOptional && baseType !== "string" && baseType !== "object") {
    return [`${baseType}?`, newContext];
  }

  return [baseType, newContext];
};
