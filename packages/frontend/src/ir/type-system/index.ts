/**
 * TypeAuthority — Single Source of Truth for All Type Queries
 *
 * ALICE'S SPEC (Phase 5): This is the ONLY public API for type operations.
 * The public module is structurally incapable of supporting a parallel type system.
 *
 * INVARIANT: No ts.Type, ts.Symbol, or computed type APIs appear in this layer.
 * INVARIANT: No raw structures (TypeNodes, declarations, registries) are exported.
 * INVARIANT: All type information flows through semantic methods only.
 *
 * The Binding layer handles TS symbol resolution and produces opaque handles
 * (DeclId, SignatureId, MemberId, TypeSyntaxId) that cross into this layer.
 */

import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
  TypeResult,
  SignatureResult,
  MemberResult,
  PropertyInit,
  SyntaxPosition,
  TypeSubstitution,
  UtilityTypeName,
  ParameterMode,
} from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// OPAQUE HANDLE TYPES — These are the ONLY handle types exported publicly
// ═══════════════════════════════════════════════════════════════════════════════

export type { DeclId, SignatureId, MemberId, TypeSyntaxId };

// ALICE'S SPEC (B.1): All nominal types resolved by TypeId, not string name matching
export type { TypeId } from "./internal/universe/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// SEMANTIC RESULT TYPES — No syntax, no diagnostics arrays, no raw data
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  TypeResult,
  SignatureResult,
  MemberResult,
  PropertyInit,
  SyntaxPosition,
  TypeSubstitution,
  UtilityTypeName,
  ParameterMode,
};

// Re-export semantic result types from Alice's TypeSystem
export type {
  TypeAuthority,
  MemberRef,
  CallQuery,
  ResolvedCall,
  Site,
} from "./type-system.js";

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS — For handle creation and result construction
// ═══════════════════════════════════════════════════════════════════════════════

export {
  makeDeclId,
  makeSignatureId,
  makeMemberId,
  makeTypeSyntaxId,
  typeOk,
  typeError,
  signatureOk,
  unknownType,
  neverType,
  voidType,
  anyType,
} from "./types.js";

export {
  BUILTIN_NOMINALS,
  poisonedCall,
  createTypeSystem,
} from "./type-system.js";

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES — NOT EXPORTED
// ═══════════════════════════════════════════════════════════════════════════════
//
// The following types are INTERNAL ONLY and must NOT be exported:
// - TypeSystemDeps
// - HandleRegistry
// - DeclInfo, SignatureInfo, MemberInfo, TypeSyntaxInfo
// - ParameterNode, TypeParameterNode
// - SignatureTypePredicate
// - DeclKind
// - TypeSystemConfig
// - TypeRegistryAPI, NominalEnvAPI
// - RawSignatureInfo
// - TypeSubstitutionMap (internal)
// - MemberLookupResult (internal)
//
// These are defined in type-system/internal/* and imported only by:
// - type-system implementation
// - binding implementation
//
// ALICE'S SPEC: The public module is structurally incapable of supporting
// a parallel type system. No raw structures. No escape hatches.
// ═══════════════════════════════════════════════════════════════════════════════
