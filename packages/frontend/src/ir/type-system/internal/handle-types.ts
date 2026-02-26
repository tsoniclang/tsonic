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
export type HandleRegistry = {
  getDecl(id: DeclId): DeclInfo | undefined;
  getSignature(id: SignatureId): SignatureInfo | undefined;
  getMember(id: MemberId): MemberInfo | undefined;
  getTypeSyntax(id: TypeSyntaxId): TypeSyntaxInfo | undefined;
};

// ═══════════════════════════════════════════════════════════════════════════════
// INFO TYPES — Internal structures with raw TypeNodes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type syntax info stored in the handle registry.
 */
export type TypeSyntaxInfo = {
  readonly typeNode: unknown; // ts.TypeNode — INTERNAL ONLY
};

/**
 * Captured class member names for override detection.
 * Pure data — no TS nodes.
 */
export type ClassMemberNames = {
  readonly methods: ReadonlySet<string>;
  readonly properties: ReadonlySet<string>;
};

/**
 * Declaration info stored in the handle registry.
 */
export type DeclInfo = {
  readonly typeNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly kind: DeclKind;
  readonly fqName?: string;
  readonly declNode?: unknown; // ts.Declaration — INTERNAL ONLY
  /**
   * When a symbol merges a value and a type declaration under the same name
   * (common in tsbindgen facades), Binding stores both so type conversion can
   * prefer the correct declaration in type contexts.
   */
  readonly typeDeclNode?: unknown; // ts.Declaration — INTERNAL ONLY
  readonly valueDeclNode?: unknown; // ts.Declaration — INTERNAL ONLY
  readonly classMemberNames?: ClassMemberNames; // For class declarations only
};

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
export type SignatureInfo = {
  readonly parameters: readonly ParameterNode[];
  /** Type node of a TypeScript `this:` parameter (if present). Excluded from `parameters`. */
  readonly thisTypeNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly returnTypeNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly typeParameters?: readonly TypeParameterNode[];
  /**
   * Declaring type simple TS name (e.g., "Box" not "Test.Box").
   * TypeSystem uses UnifiedTypeCatalog.resolveTsName() to get CLR FQ name.
   */
  readonly declaringTypeTsName?: string;
  readonly declaringMemberName?: string;
  readonly typePredicate?: SignatureTypePredicate;
};

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

export type ParameterNode = {
  readonly name: string;
  readonly typeNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly isOptional: boolean;
  readonly isRest: boolean;
  readonly mode?: ParameterMode;
};

export type TypeParameterNode = {
  readonly name: string;
  readonly constraintNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly defaultNode?: unknown; // ts.TypeNode — INTERNAL ONLY
};

/**
 * Member info stored in the handle registry.
 */
export type MemberInfo = {
  readonly name: string;
  readonly declNode?: unknown; // ts.Declaration — INTERNAL ONLY
  readonly typeNode?: unknown; // ts.TypeNode — INTERNAL ONLY
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
};
