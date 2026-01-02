/**
 * Internal Handle Types — NOT FOR PUBLIC EXPORT
 *
 * ALICE'S SPEC: These types are INTERNAL ONLY.
 * They may contain raw TypeNodes (as unknown) for internal use.
 * They must NOT be exported from type-system/index.ts.
 *
 * Allowed importers:
 * - ir/type-system/**
 * - ir/binding/**
 */

import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
  ParameterMode,
} from "../types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLE REGISTRY — Internal interface for handle lookups
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle registry — maps opaque handles to their underlying data.
 *
 * INTERNAL ONLY. Not exported from public API.
 */
export interface HandleRegistry {
  getDecl(id: DeclId): DeclInfo | undefined;
  getSignature(id: SignatureId): SignatureInfo | undefined;
  getMember(id: MemberId): MemberInfo | undefined;
  getTypeSyntax(id: TypeSyntaxId): TypeSyntaxInfo | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFO TYPES — Internal structures with raw TypeNodes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type syntax info stored in the handle registry.
 */
export interface TypeSyntaxInfo {
  readonly typeNode: unknown; // ts.TypeNode — INTERNAL ONLY
}

/**
 * Declaration info stored in the handle registry.
 */
export interface DeclInfo {
  readonly typeNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly kind: DeclKind;
  readonly fqName?: string;
  readonly declNode?: unknown; // ts.Declaration — INTERNAL ONLY
}

export type DeclKind =
  | "variable"
  | "function"
  | "class"
  | "interface"
  | "typeAlias"
  | "enum"
  | "parameter"
  | "property"
  | "method";

/**
 * Signature info stored in the handle registry.
 */
export interface SignatureInfo {
  readonly parameters: readonly ParameterNode[];
  readonly returnTypeNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly typeParameters?: readonly TypeParameterNode[];
  readonly declaringTypeFQName?: string;
  readonly declaringMemberName?: string;
  readonly typePredicate?: SignatureTypePredicate;
}

/**
 * Type predicate extracted from signature's return type.
 */
export type SignatureTypePredicate =
  | {
      readonly kind: "param";
      readonly parameterName: string;
      readonly parameterIndex: number;
      readonly targetTypeNode: unknown; // ts.TypeNode — INTERNAL ONLY
    }
  | {
      readonly kind: "this";
      readonly targetTypeNode: unknown; // ts.TypeNode — INTERNAL ONLY
    };

export interface ParameterNode {
  readonly name: string;
  readonly typeNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly isOptional: boolean;
  readonly isRest: boolean;
  readonly mode?: ParameterMode;
}

export interface TypeParameterNode {
  readonly name: string;
  readonly constraintNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly defaultNode?: unknown; // ts.TypeNode — INTERNAL ONLY
}

/**
 * Member info stored in the handle registry.
 */
export interface MemberInfo {
  readonly name: string;
  readonly typeNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
}
