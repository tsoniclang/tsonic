/**
 * Support Types Recognition - Detect and work with source support marker types.
 *
 * This module provides type guards and helpers to recognize special native
 * interop marker types that do not have JavaScript equivalents: TSByRef,
 * TSUnsafePointer, TSDelegate, etc.
 *
 * @see spec/support-types.md for complete documentation
 */

import type { GoPtr, TstsType } from "@tsonic/tsts";
import type { TstsSourceSemanticView } from "../source-frontend/index.js";

type SourceType = GoPtr<TstsType>;

/**
 * Support type kind enumeration.
 * Represents the different source support marker types.
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
  readonly wrappedType: SourceType;
  readonly typeArguments: readonly SourceType[];
};

/**
 * Check if a type is a support type (TSByRef, TSUnsafePointer, etc.).
 *
 * @param type - TypeScript type to check
 * @param sourceSemantics - Source semantic view
 * @returns Support type info if recognized, undefined otherwise
 */
export const getSupportTypeInfo = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): SupportTypeInfo | undefined => {
  const typeName =
    sourceSemantics.getTypeAliasSymbolName(type) ??
    sourceSemantics.getTypeSymbolName(type);

  // Check if it's a recognized support type
  const kind = getSupportTypeKind(typeName);
  if (!kind) {
    return undefined;
  }

  const aliasTypeArguments = sourceSemantics.getAliasTypeArguments(type);
  const referenceTypeArguments =
    sourceSemantics.getReferenceTypeArguments(type);
  const typeArguments =
    aliasTypeArguments.length > 0 ? aliasTypeArguments : referenceTypeArguments;

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
const getSupportTypeKind = (
  typeName: string | undefined
): SupportTypeKind | undefined => {
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
 * @param sourceSemantics - Source semantic view
 * @returns True if type is TSByRef<T>
 */
export const isTSByRef = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): boolean => {
  const info = getSupportTypeInfo(type, sourceSemantics);
  return info?.kind === "TSByRef";
};

/**
 * Check if a type is TSUnsafePointer<T>.
 *
 * @param type - TypeScript type to check
 * @param sourceSemantics - Source semantic view
 * @returns True if type is TSUnsafePointer<T>
 */
export const isTSUnsafePointer = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): boolean => {
  const info = getSupportTypeInfo(type, sourceSemantics);
  return info?.kind === "TSUnsafePointer";
};

/**
 * Check if a type is TSDelegate<TArgs, TReturn>.
 *
 * @param type - TypeScript type to check
 * @param sourceSemantics - Source semantic view
 * @returns True if type is TSDelegate<TArgs, TReturn>
 */
export const isTSDelegate = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): boolean => {
  const info = getSupportTypeInfo(type, sourceSemantics);
  return info?.kind === "TSDelegate";
};

/**
 * Check if a type is TSNullable<T>.
 *
 * @param type - TypeScript type to check
 * @param sourceSemantics - Source semantic view
 * @returns True if type is TSNullable<T>
 */
export const isTSNullable = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): boolean => {
  const info = getSupportTypeInfo(type, sourceSemantics);
  return info?.kind === "TSNullable";
};

/**
 * Check if a type is TSFixed<T, N>.
 *
 * @param type - TypeScript type to check
 * @param sourceSemantics - Source semantic view
 * @returns True if type is TSFixed<T, N>
 */
export const isTSFixed = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): boolean => {
  const info = getSupportTypeInfo(type, sourceSemantics);
  return info?.kind === "TSFixed";
};

/**
 * Check if a type is TSStackAlloc<T>.
 *
 * @param type - TypeScript type to check
 * @param sourceSemantics - Source semantic view
 * @returns True if type is TSStackAlloc<T>
 */
export const isTSStackAlloc = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): boolean => {
  const info = getSupportTypeInfo(type, sourceSemantics);
  return info?.kind === "TSStackAlloc";
};

/**
 * Extract the wrapped type from TSByRef<T>.
 *
 * @param type - TypeScript type (must be TSByRef<T>)
 * @param sourceSemantics - Source semantic view
 * @returns Wrapped type T, or undefined if not TSByRef
 */
export const getTSByRefWrappedType = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): SourceType | undefined => {
  const info = getSupportTypeInfo(type, sourceSemantics);
  if (info?.kind === "TSByRef") {
    return info.wrappedType;
  }
  return undefined;
};

/**
 * Extract the wrapped type from TSUnsafePointer<T>.
 *
 * @param type - TypeScript type (must be TSUnsafePointer<T>)
 * @param sourceSemantics - Source semantic view
 * @returns Wrapped type T, or undefined if not TSUnsafePointer
 */
export const getTSUnsafePointerWrappedType = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): SourceType | undefined => {
  const info = getSupportTypeInfo(type, sourceSemantics);
  if (info?.kind === "TSUnsafePointer") {
    return info.wrappedType;
  }
  return undefined;
};

/**
 * Check if any support type is unsupported (unsafe pointers, fixed buffers, stackalloc).
 *
 * @param type - TypeScript type to check
 * @param sourceSemantics - Source semantic view
 * @returns Error message if unsupported, undefined if supported
 */
export const checkUnsupportedSupportType = (
  type: SourceType,
  sourceSemantics: TstsSourceSemanticView
): string | undefined => {
  const info = getSupportTypeInfo(type, sourceSemantics);
  if (!info) {
    return undefined;
  }

  switch (info.kind) {
    case "TSUnsafePointer":
      return "Unsafe pointers are not supported in Tsonic. Use nint or nuint for opaque native handles.";
    case "TSFixed":
      return "Fixed-size buffers (unsafe feature) are not supported. Use arrays or a safe buffer abstraction instead.";
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
