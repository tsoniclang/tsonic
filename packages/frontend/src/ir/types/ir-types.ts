/**
 * Type system types for IR (IrType and its variants)
 */

import { IrParameter, IrInterfaceMember } from "./helpers.js";
import type { TypeId } from "../type-system/internal/universe/types.js";

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

/**
 * Primitive types in IR.
 *
 * INVARIANT A: "number" always emits as C# "double". No exceptions.
 * INVARIANT B: "int" always emits as C# "int". No exceptions.
 *
 * These are distinct types, not decorated versions of each other.
 * - User writes `: number` → primitiveType(name="number") → emits "double"
 * - User writes `: int` → primitiveType(name="int") → emits "int"
 *
 * The numeric classification of LITERALS is separate (see IrLiteralExpression.numericIntent).
 * Type-level and expression-level concerns are strictly separated.
 */
export type IrPrimitiveType = {
  readonly kind: "primitiveType";
  readonly name:
    | "string"
    | "number" // Always double in C#
    | "int" // Always int in C#
    | "char" // For string indexer access (str[i] returns char in C#)
    | "boolean"
    | "null"
    | "undefined";
};

export type IrReferenceType = {
  readonly kind: "referenceType";
  readonly name: string;
  readonly typeArguments?: readonly IrType[];
  /** Fully-qualified CLR type for imported types (e.g., "MyApp.models.User") */
  readonly resolvedClrType?: string;
  /**
   * Canonical type identity from UnifiedTypeCatalog.
   * When present, this is the authoritative source of type identity.
   * Use typeId.clrName for emission, typeId.stableId for equality checks.
   */
  readonly typeId?: TypeId;
  /**
   * Structural members for interfaces and type aliases that resolve to object types.
   * Populated when the reference resolves to a structural type (interface, type literal, etc.)
   * Used by TSN5110 to validate object literal properties against expected types.
   */
  readonly structuralMembers?: readonly IrInterfaceMember[];
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
   * All array types emit as native CLR arrays (T[]).
   * Users must explicitly use List<T> to get a List.
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

/**
 * C# Attribute attached to a declaration (class, function, method, property, parameter)
 *
 * Attributes are collected from marker calls like `A.on(Class).type(Attr)` and
 * attached to the corresponding IR declaration nodes.
 *
 * Example:
 * ```typescript
 * A.on(User).type(SerializableAttribute);
 * A.on(User).type(DataContractAttribute, { Name: "UserDTO" });
 * ```
 *
 * Emits to C#:
 * ```csharp
 * [global::System.SerializableAttribute]
 * [global::System.Runtime.Serialization.DataContractAttribute(Name = "UserDTO")]
 * public class User { ... }
 * ```
 */
export type IrAttribute = {
  readonly kind: "attribute";
  /** The attribute class type (e.g., SerializableAttribute) */
  readonly attributeType: IrType;
  /** Positional constructor arguments (string, number, boolean, typeof) */
  readonly positionalArgs: readonly IrAttributeArg[];
  /** Named property assignments (e.g., { Name: "UserDTO" }) */
  readonly namedArgs: ReadonlyMap<string, IrAttributeArg>;
};

/**
 * Attribute argument value - must be a constant expression.
 * C# attributes only accept compile-time constants.
 */
export type IrAttributeArg =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "typeof"; readonly type: IrType }
  | { readonly kind: "enum"; readonly type: IrType; readonly member: string };
