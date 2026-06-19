import type { GoPtr } from "../go/compat.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Type } from "../internal/checker/types.js";
import { Signature_HasRestParameter, Signature_Parameters, StructuredType_CallSignatures, Type_AsStructuredType, TypeFlagsStringLike, TypeFlagsStructuredType } from "../internal/checker/types.js";
import { Checker_getReturnTypeOfSignature } from "../internal/checker/checker/signatures.js";
import { Checker_getElementTypeOfArrayType, Checker_isArrayType } from "../internal/checker/checker/types.js";
import { Checker_getTypeOfSymbol } from "../internal/checker/checker/symbols.js";
import { Type_AsTypeReference } from "../internal/checker/types.js";

export interface TypeScriptTypeReferenceInfo {
  readonly targetSymbol: GoPtr<Symbol>;
  readonly typeArguments: readonly Type[];
}

export interface TypeScriptCallSignatureInfo {
  readonly parameterTypes: readonly Type[];
  readonly returnType: GoPtr<Type>;
  readonly hasRestParameter: boolean;
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

export function getSingleTypeScriptCallSignatureInfo(type: GoPtr<Type>): TypeScriptCallSignatureInfo | undefined {
  if (type === undefined || type.checker === undefined) {
    return undefined;
  }
  if ((type.flags & TypeFlagsStructuredType) === 0) {
    return undefined;
  }
  const structured = Type_AsStructuredType(type);
  const callSignatures = StructuredType_CallSignatures(structured);
  if (callSignatures.length !== 1) {
    return undefined;
  }
  const signature = callSignatures[0];
  if (signature === undefined) {
    return undefined;
  }
  const parameterTypes = (Signature_Parameters(signature) ?? [])
    .map((parameter) => Checker_getTypeOfSymbol(type.checker, parameter));
  if (parameterTypes.some((parameterType) => parameterType === undefined)) {
    return undefined;
  }
  return {
    parameterTypes: parameterTypes as readonly Type[],
    returnType: Checker_getReturnTypeOfSignature(type.checker, signature),
    hasRestParameter: Signature_HasRestParameter(signature),
  };
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
