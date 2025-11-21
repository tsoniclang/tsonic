/**
 * Support Types Recognition - Detect and work with _support/types.d.ts marker types.
 *
 * This module provides type guards and helpers to recognize special CLR interop types
 * that don't have JavaScript equivalents: TSByRef, TSUnsafePointer, TSDelegate, etc.
 *
 * @see spec/support-types.md for complete documentation
 */

import * as ts from "typescript";

/**
 * Support type kind enumeration.
 * Represents the different marker types from _support/types.d.ts.
 */
export type SupportTypeKind =
  | "TSByRef"
  | "TSUnsafePointer"
  | "TSDelegate"
  | "TSNullable"
  | "TSFixed"
  | "TSStackAlloc";

/**
 * Information about a recognized support type.
 */
export type SupportTypeInfo = {
  readonly kind: SupportTypeKind;
  readonly wrappedType: ts.Type;
  readonly typeArguments: readonly ts.Type[];
};

/**
 * Check if a type is a support type (TSByRef, TSUnsafePointer, etc.).
 *
 * @param type - TypeScript type to check
 * @param checker - TypeScript type checker
 * @returns Support type info if recognized, undefined otherwise
 */
export const getSupportTypeInfo = (
  type: ts.Type,
  _checker: ts.TypeChecker
): SupportTypeInfo | undefined => {
  // Try to get type name from either symbol or aliasSymbol
  const symbol = type.aliasSymbol || type.symbol;
  if (!symbol) {
    return undefined;
  }

  const typeName = symbol.getName();

  // Check if it's a recognized support type
  const kind = getSupportTypeKind(typeName);
  if (!kind) {
    return undefined;
  }

  // Extract type arguments - try alias type arguments first, then regular
  let typeArguments: readonly ts.Type[] = [];

  // Type aliases have aliasTypeArguments
  if (type.aliasTypeArguments && type.aliasTypeArguments.length > 0) {
    typeArguments = type.aliasTypeArguments;
  }
  // Generic type references have typeArguments through TypeReference interface
  else if (isGenericTypeReference(type)) {
    typeArguments = getTypeArguments(type);
  }

  if (typeArguments.length === 0) {
    return undefined;
  }

  const wrappedType = typeArguments[0];
  if (!wrappedType) {
    return undefined;
  }

  return {
    kind,
    wrappedType,
    typeArguments,
  };
};

/**
 * Get support type kind from type name.
 *
 * @param typeName - Type symbol name
 * @returns Support type kind if recognized, undefined otherwise
 */
const getSupportTypeKind = (typeName: string): SupportTypeKind | undefined => {
  switch (typeName) {
    case "TSByRef":
      return "TSByRef";
    case "TSUnsafePointer":
      return "TSUnsafePointer";
    case "TSDelegate":
      return "TSDelegate";
    case "TSNullable":
      return "TSNullable";
    case "TSFixed":
      return "TSFixed";
    case "TSStackAlloc":
      return "TSStackAlloc";
    default:
      return undefined;
  }
};

/**
 * Check if a type is TSByRef<T>.
 *
 * @param type - TypeScript type to check
 * @param checker - TypeScript type checker
 * @returns True if type is TSByRef<T>
 */
export const isTSByRef = (type: ts.Type, checker: ts.TypeChecker): boolean => {
  const info = getSupportTypeInfo(type, checker);
  return info?.kind === "TSByRef";
};

/**
 * Check if a type is TSUnsafePointer<T>.
 *
 * @param type - TypeScript type to check
 * @param checker - TypeScript type checker
 * @returns True if type is TSUnsafePointer<T>
 */
export const isTSUnsafePointer = (
  type: ts.Type,
  checker: ts.TypeChecker
): boolean => {
  const info = getSupportTypeInfo(type, checker);
  return info?.kind === "TSUnsafePointer";
};

/**
 * Check if a type is TSDelegate<TArgs, TReturn>.
 *
 * @param type - TypeScript type to check
 * @param checker - TypeScript type checker
 * @returns True if type is TSDelegate<TArgs, TReturn>
 */
export const isTSDelegate = (
  type: ts.Type,
  checker: ts.TypeChecker
): boolean => {
  const info = getSupportTypeInfo(type, checker);
  return info?.kind === "TSDelegate";
};

/**
 * Check if a type is TSNullable<T>.
 *
 * @param type - TypeScript type to check
 * @param checker - TypeScript type checker
 * @returns True if type is TSNullable<T>
 */
export const isTSNullable = (
  type: ts.Type,
  checker: ts.TypeChecker
): boolean => {
  const info = getSupportTypeInfo(type, checker);
  return info?.kind === "TSNullable";
};

/**
 * Check if a type is TSFixed<T, N>.
 *
 * @param type - TypeScript type to check
 * @param checker - TypeScript type checker
 * @returns True if type is TSFixed<T, N>
 */
export const isTSFixed = (type: ts.Type, checker: ts.TypeChecker): boolean => {
  const info = getSupportTypeInfo(type, checker);
  return info?.kind === "TSFixed";
};

/**
 * Check if a type is TSStackAlloc<T>.
 *
 * @param type - TypeScript type to check
 * @param checker - TypeScript type checker
 * @returns True if type is TSStackAlloc<T>
 */
export const isTSStackAlloc = (
  type: ts.Type,
  checker: ts.TypeChecker
): boolean => {
  const info = getSupportTypeInfo(type, checker);
  return info?.kind === "TSStackAlloc";
};

/**
 * Extract the wrapped type from TSByRef<T>.
 *
 * @param type - TypeScript type (must be TSByRef<T>)
 * @param checker - TypeScript type checker
 * @returns Wrapped type T, or undefined if not TSByRef
 */
export const getTSByRefWrappedType = (
  type: ts.Type,
  checker: ts.TypeChecker
): ts.Type | undefined => {
  const info = getSupportTypeInfo(type, checker);
  if (info?.kind === "TSByRef") {
    return info.wrappedType;
  }
  return undefined;
};

/**
 * Extract the wrapped type from TSUnsafePointer<T>.
 *
 * @param type - TypeScript type (must be TSUnsafePointer<T>)
 * @param checker - TypeScript type checker
 * @returns Wrapped type T, or undefined if not TSUnsafePointer
 */
export const getTSUnsafePointerWrappedType = (
  type: ts.Type,
  checker: ts.TypeChecker
): ts.Type | undefined => {
  const info = getSupportTypeInfo(type, checker);
  if (info?.kind === "TSUnsafePointer") {
    return info.wrappedType;
  }
  return undefined;
};

/**
 * Check if type is a generic type reference with type arguments.
 *
 * @param type - TypeScript type
 * @returns True if type is a generic type reference
 */
const isGenericTypeReference = (type: ts.Type): boolean => {
  return (
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0
  );
};

/**
 * Get type arguments from a generic type reference.
 *
 * @param type - TypeScript type (must be generic reference)
 * @returns Array of type arguments
 */
const getTypeArguments = (type: ts.Type): readonly ts.Type[] => {
  const typeRef = type as ts.TypeReference;
  if (!typeRef.typeArguments) {
    return [];
  }
  return typeRef.typeArguments;
};

/**
 * Check if any support type is unsupported (unsafe pointers, fixed buffers, stackalloc).
 *
 * @param type - TypeScript type to check
 * @param checker - TypeScript type checker
 * @returns Error message if unsupported, undefined if supported
 */
export const checkUnsupportedSupportType = (
  type: ts.Type,
  checker: ts.TypeChecker
): string | undefined => {
  const info = getSupportTypeInfo(type, checker);
  if (!info) {
    return undefined;
  }

  switch (info.kind) {
    case "TSUnsafePointer":
      return "Unsafe pointers are not supported in Tsonic. Use IntPtr for opaque handles.";
    case "TSFixed":
      return "Fixed-size buffers (unsafe feature) are not supported. Use arrays or Span<T> instead.";
    case "TSStackAlloc":
      return "stackalloc is not supported in Tsonic. Use heap-allocated arrays instead.";
    case "TSByRef":
    case "TSDelegate":
    case "TSNullable":
      return undefined; // These are supported
    default:
      return undefined;
  }
};
