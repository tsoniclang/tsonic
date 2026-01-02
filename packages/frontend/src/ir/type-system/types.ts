/**
 * TypeSystem Handle Types and Result Types
 *
 * This module defines opaque handles for TS declarations and
 * result types for TypeSystem queries. These form the boundary
 * between the Binding layer (TS-allowed) and TypeSystem layer (TS-free).
 *
 * INVARIANT: No ts.Type, ts.Symbol, or ts.Signature types appear
 * in the TypeSystem layer. Only opaque handles cross the boundary.
 */

import type { IrType } from "../types/index.js";
import type { Diagnostic } from "../../types/diagnostic.js";

// ═══════════════════════════════════════════════════════════════════════════
// HANDLE TYPES — Opaque references to TS declarations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Opaque handle to a declaration (function, class, interface, variable, type alias, etc.)
 *
 * Created by Binding.resolveIdentifier, Binding.resolveTypeReference, etc.
 * Used by TypeSystem.getDeclType to get the declaration's type.
 */
export type DeclId = {
  readonly __brand: "DeclId";
  readonly id: number;
};

/**
 * Opaque handle to a specific function signature.
 *
 * For non-overloaded functions, there's one SignatureId per DeclId.
 * For overloaded functions, Binding.resolveCallSignature picks the right overload.
 */
export type SignatureId = {
  readonly __brand: "SignatureId";
  readonly id: number;
};

/**
 * Opaque handle to a member (property, method) of a type.
 *
 * The member is identified by the declaring type's DeclId and the member name.
 */
export type MemberId = {
  readonly __brand: "MemberId";
  readonly declId: DeclId;
  readonly name: string;
};

/**
 * Opaque handle for a type syntax node.
 *
 * Created by Binding.captureTypeSyntax() for inline type syntax:
 * - `as Foo` type assertions
 * - `satisfies Bar` expressions
 * - Generic type arguments `Foo<T, U>`
 * - Type annotations that need deferred conversion
 *
 * Converted to IrType by TypeSystem.typeFromSyntax().
 *
 * This is NOT an escape hatch — it's the correct boundary for inline syntax
 * that cannot be captured at catalog-build time.
 */
export type TypeSyntaxId = {
  readonly __brand: "TypeSyntaxId";
  readonly id: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// RESULT TYPES — Totality: Queries always return type + diagnostics
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of a type query.
 *
 * The type is ALWAYS present. If the type cannot be determined,
 * it will be { kind: "unknownType" } and diagnostics will explain why.
 */
export type TypeResult = {
  readonly type: IrType;
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Result of a signature query (function type with parameters and return type).
 */
export type SignatureResult = {
  readonly parameters: readonly ParameterType[];
  readonly returnType: IrType;
  readonly typeParameters?: readonly TypeParameterInfo[];
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Parameter type information from a signature.
 */
export type ParameterType = {
  readonly name: string;
  readonly type: IrType;
  readonly isOptional: boolean;
  readonly isRest: boolean;
};

/**
 * Type parameter information from a generic signature.
 */
export type TypeParameterInfo = {
  readonly name: string;
  readonly constraint?: IrType;
  readonly defaultType?: IrType;
};

/**
 * Result of getStructuralMembers — includes declaring type info.
 */
export type MemberResult = {
  readonly name: string;
  readonly type: IrType;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
  readonly declaringType: IrType; // Which type in the inheritance chain declares this
};

/**
 * Property initializer for synthesizeObjectType.
 */
export type PropertyInit = {
  readonly name: string;
  readonly value: IrType;
  readonly isOptional?: boolean;
};

/**
 * Position in syntax tree for getExpectedType.
 */
export type SyntaxPosition = {
  readonly nodeKind: SyntaxNodeKind;
  readonly parentKind: SyntaxNodeKind;
  readonly index?: number; // For arrays, call arguments, etc.
};

/**
 * Simplified syntax node kinds for position queries.
 * Using our own enum to avoid TS dependency in TypeSystem.
 */
export type SyntaxNodeKind =
  | "callExpression"
  | "newExpression"
  | "arrayLiteral"
  | "objectLiteral"
  | "propertyAssignment"
  | "variableDeclaration"
  | "returnStatement"
  | "arrowFunction"
  | "functionExpression"
  | "parameter"
  | "binaryExpression"
  | "conditionalExpression"
  | "other";

// ═══════════════════════════════════════════════════════════════════════════
// TYPE SUBSTITUTION — Mapping type parameters to concrete types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapping from type parameter names to their concrete types.
 */
export type TypeSubstitution = ReadonlyMap<string, IrType>;

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY TYPES — Names of supported utility types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TypeScript utility types that TypeSystem can expand.
 */
export type UtilityTypeName =
  | "Partial"
  | "Required"
  | "Readonly"
  | "Pick"
  | "Omit"
  | "Record"
  | "Exclude"
  | "Extract"
  | "NonNullable"
  | "ReturnType"
  | "Parameters"
  | "Awaited"
  | "InstanceType";

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETER MODE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parameter passing mode for C# interop.
 */
export type ParameterMode = "value" | "ref" | "out" | "in";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Poison type for undeterminable types */
export const unknownType: IrType = { kind: "unknownType" };

/** Poison type for impossible types */
export const neverType: IrType = { kind: "neverType" };

/** Void type for functions with no return */
export const voidType: IrType = { kind: "voidType" };

/** Any type */
export const anyType: IrType = { kind: "anyType" };

// ═══════════════════════════════════════════════════════════════════════════
// HANDLE FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a DeclId (used by Binding module internally).
 */
export const makeDeclId = (id: number): DeclId => ({
  __brand: "DeclId",
  id,
});

/**
 * Create a SignatureId (used by Binding module internally).
 */
export const makeSignatureId = (id: number): SignatureId => ({
  __brand: "SignatureId",
  id,
});

/**
 * Create a MemberId (used by Binding module internally).
 */
export const makeMemberId = (declId: DeclId, name: string): MemberId => ({
  __brand: "MemberId",
  declId,
  name,
});

/**
 * Create a TypeSyntaxId (used by Binding module internally).
 */
export const makeTypeSyntaxId = (id: number): TypeSyntaxId => ({
  __brand: "TypeSyntaxId",
  id,
});

// ═══════════════════════════════════════════════════════════════════════════
// RESULT FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a successful TypeResult with no diagnostics.
 */
export const typeOk = (type: IrType): TypeResult => ({
  type,
  diagnostics: [],
});

/**
 * Create a TypeResult with unknownType and diagnostics.
 */
export const typeError = (diagnostics: readonly Diagnostic[]): TypeResult => ({
  type: unknownType,
  diagnostics,
});

/**
 * Create a SignatureResult.
 */
export const signatureOk = (
  parameters: readonly ParameterType[],
  returnType: IrType,
  typeParameters?: readonly TypeParameterInfo[]
): SignatureResult => ({
  parameters,
  returnType,
  typeParameters,
  diagnostics: [],
});
