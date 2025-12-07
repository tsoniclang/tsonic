/**
 * Type system types for IR (IrType and its variants)
 */

import { IrParameter, IrInterfaceMember } from "./helpers.js";

export type IrType =
  | IrPrimitiveType
  | IrReferenceType
  | IrTypeParameterType
  | IrArrayType
  | IrTupleType
  | IrFunctionType
  | IrObjectType
  | IrDictionaryType
  | IrUnionType
  | IrIntersectionType
  | IrLiteralType
  | IrAnyType
  | IrUnknownType
  | IrVoidType
  | IrNeverType;

export type IrPrimitiveType = {
  readonly kind: "primitiveType";
  readonly name: "string" | "number" | "boolean" | "null" | "undefined";
};

export type IrReferenceType = {
  readonly kind: "referenceType";
  readonly name: string;
  readonly typeArguments?: readonly IrType[];
  /** Fully-qualified CLR type for imported types (e.g., "MyApp.models.User") */
  readonly resolvedClrType?: string;
};

/**
 * Type parameter reference (e.g., T in Container<T>)
 *
 * This is distinct from IrReferenceType to enable unambiguous detection
 * of generic type parameters during emission (for null → default conversion).
 */
export type IrTypeParameterType = {
  readonly kind: "typeParameterType";
  readonly name: string;
};

export type IrArrayType = {
  readonly kind: "arrayType";
  readonly elementType: IrType;
  /**
   * Set to "explicit" when the array type came from an explicit T[] annotation.
   * Undefined when the type was inferred.
   *
   * In dotnet mode:
   * - origin: "explicit" → emit native CLR array (T[])
   * - origin: undefined → emit List<T>
   */
  readonly origin?: "explicit";
};

/**
 * Tuple type for fixed-length arrays with heterogeneous element types
 *
 * Examples:
 * - `[string, number]` → IrTupleType { elementTypes: [string, number] }
 * - `[boolean, string, number]` → IrTupleType { elementTypes: [boolean, string, number] }
 *
 * Emits to C# ValueTuple<T1, T2, ...>.
 */
export type IrTupleType = {
  readonly kind: "tupleType";
  readonly elementTypes: readonly IrType[];
};

export type IrFunctionType = {
  readonly kind: "functionType";
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType;
};

export type IrObjectType = {
  readonly kind: "objectType";
  readonly members: readonly IrInterfaceMember[];
};

/**
 * Dictionary/map type for index signatures and Record<K, V>
 *
 * Examples:
 * - `{ [k: string]: T }` → IrDictionaryType { keyType: string, valueType: T }
 * - `Record<string, T>` → IrDictionaryType { keyType: string, valueType: T }
 *
 * Emits to C# Dictionary<TKey, TValue>.
 * Access should be via indexer `d["key"]` (dot property access will fail in C#).
 */
export type IrDictionaryType = {
  readonly kind: "dictionaryType";
  readonly keyType: IrType;
  readonly valueType: IrType;
};

export type IrUnionType = {
  readonly kind: "unionType";
  readonly types: readonly IrType[];
};

export type IrIntersectionType = {
  readonly kind: "intersectionType";
  readonly types: readonly IrType[];
};

export type IrLiteralType = {
  readonly kind: "literalType";
  readonly value: string | number | boolean;
};

export type IrAnyType = {
  readonly kind: "anyType";
};

export type IrUnknownType = {
  readonly kind: "unknownType";
};

export type IrVoidType = {
  readonly kind: "voidType";
};

export type IrNeverType = {
  readonly kind: "neverType";
};
