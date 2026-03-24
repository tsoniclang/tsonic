import { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveArrayLiteralContextType } from "../../core/semantic/array-expected-types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";

const numericReferenceNames = new Set([
  "byte",
  "sbyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "float",
  "double",
  "decimal",
]);

const isNumericLikeType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "primitiveType") {
    return resolved.name === "number" || resolved.name === "int";
  }

  if (resolved.kind === "literalType") {
    return typeof resolved.value === "number";
  }

  if (resolved.kind === "referenceType") {
    return numericReferenceNames.has(resolved.name);
  }

  if (resolved.kind === "unionType") {
    return resolved.types.length > 0
      ? resolved.types.every((member) => isNumericLikeType(member, context))
      : false;
  }

  return false;
};

const hasArrayLiteralRuntimeContext = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  const contextualType = resolveArrayLiteralContextType(type, context);
  if (!contextualType) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(contextualType), context);
  if (resolved.kind === "arrayType" || resolved.kind === "tupleType") {
    return true;
  }

  return (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray" ||
      resolved.name === "ArrayLike" ||
      resolved.name === "JSArray")
  );
};

export const shouldPreferRuntimeExpectedType = (
  arg: IrExpression,
  actualType: IrType | undefined,
  runtimeExpectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!runtimeExpectedType) {
    return false;
  }

  if (
    arg.kind === "array" &&
    hasArrayLiteralRuntimeContext(runtimeExpectedType, context)
  ) {
    return true;
  }

  return (
    isNumericLikeType(actualType, context) &&
    isNumericLikeType(runtimeExpectedType, context)
  );
};
