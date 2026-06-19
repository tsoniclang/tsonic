import type { GoPtr } from "../go/compat.js";
import type { Type } from "../internal/checker/types.js";
import { Checker_getElementTypeOfArrayType, Checker_isArrayType } from "../internal/checker/checker/types.js";

export function isTypeScriptArrayType(type: GoPtr<Type>): boolean {
  if (type === undefined || type.checker === undefined) {
    return false;
  }
  return Checker_isArrayType(type.checker, type);
}

export function getTypeScriptArrayElementType(type: GoPtr<Type>): GoPtr<Type> {
  if (type === undefined || type.checker === undefined) {
    return undefined;
  }
  return Checker_getElementTypeOfArrayType(type.checker, type);
}
