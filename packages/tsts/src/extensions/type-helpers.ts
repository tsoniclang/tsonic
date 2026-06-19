import type { GoPtr } from "../go/compat.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Type } from "../internal/checker/types.js";
import { TypeFlagsStringLike } from "../internal/checker/types.js";
import { Checker_getElementTypeOfArrayType, Checker_isArrayType } from "../internal/checker/checker/types.js";
import { Type_AsTypeReference } from "../internal/checker/types.js";

export interface TypeScriptTypeReferenceInfo {
  readonly targetSymbol: GoPtr<Symbol>;
  readonly typeArguments: readonly Type[];
}

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

export function isTypeScriptStringLikeType(type: GoPtr<Type>): boolean {
  return type !== undefined && (type.flags & TypeFlagsStringLike) !== 0;
}

export function getTypeScriptTypeReferenceInfo(type: GoPtr<Type>): TypeScriptTypeReferenceInfo | undefined {
  const reference = Type_AsTypeReference(type);
  if (reference === undefined) {
    return undefined;
  }
  return {
    targetSymbol: reference.__tsgoEmbedded0?.target?.symbol,
    typeArguments: (reference.resolvedTypeArguments ?? []).filter((argument): argument is Type => argument !== undefined),
  };
}
