/**
 * TypeAuthority — Factory (createTypeSystem)
 *
 * Constructs the shared TypeSystemState and delegates to split modules.
 * Split from type-system.ts for file-size compliance.
 *
 * DAG position: orchestrator — imports all split modules, constructs state,
 * returns TypeAuthority with functions bound to shared state.
 */

import type { Diagnostic } from "../../types/diagnostic.js";

import type {
  TypeSystemState,
  RawSignatureInfo,
  NominalLookupResult,
} from "./type-system-state.js";

import type {
  TypeAuthority,
  TypeSystemConfig,
} from "./type-system-types-api.js";

// Import split module functions
import {
  substitute as relSubstitute,
  instantiate as relInstantiate,
  isAssignableTo as relIsAssignableTo,
  typesEqual as relTypesEqual,
  containsTypeParameter as relContainsTypeParameter,
} from "./type-system-relations.js";

import {
  resolveCall as crResolveCall,
  collectExpectedReturnCandidates as crCollectExpectedReturnCandidates,
  collectNarrowingCandidates as crCollectNarrowingCandidates,
  delegateToFunctionType as crDelegateToFunctionType,
} from "./type-system-call-resolution.js";

import {
  typeOfDecl as infTypeOfDecl,
  typeOfValueRead as infTypeOfValueRead,
  typeOfMember as infTypeOfMember,
  getIndexerInfo as infGetIndexerInfo,
  typeOfMemberId as infTypeOfMemberId,
  getFQNameOfDecl as infGetFQNameOfDecl,
  isTypeDecl as infIsTypeDecl,
  isInterfaceDecl as infIsInterfaceDecl,
  isTypeAliasToObjectLiteral as infIsTypeAliasToObjectLiteral,
  signatureHasConditionalReturn as infSignatureHasConditionalReturn,
  signatureHasVariadicTypeParams as infSignatureHasVariadicTypeParams,
  declHasTypeAnnotation as infDeclHasTypeAnnotation,
  checkTsClassMemberOverride as infCheckTsClassMemberOverride,
  hasTypeParameters as infHasTypeParameters,
  typeFromSyntax as infTypeFromSyntax,
} from "./type-system-inference.js";
import { resolveMemberTypeNoDiag } from "./inference-member-lookup.js";

import { expandUtility as utExpandUtility } from "./type-system-utilities.js";

import type { IrType } from "../types/index.js";

// ═══════════════════════════════════════════════════════════════════════════
// TYPESYSTEM FACTORY — Orchestrator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a TypeSystem instance with internal caches.
 *
 * This is the single factory for TypeSystem. All type queries go through
 * the returned TypeSystem instance.
 *
 * Constructs the shared TypeSystemState and delegates to split modules:
 * - type-system-relations.ts: substitute, instantiate, isAssignableTo, typesEqual, containsTypeParameter
 * - type-system-call-resolution.ts: resolveCall, delegateToFunctionType, convertTypeNode
 * - type-system-inference.ts: typeOfDecl, typeOfMember, getIndexerInfo, and declaration queries
 * - type-system-utilities.ts: expandUtility
 */
export const createTypeSystem = (config: TypeSystemConfig): TypeAuthority => {
  const {
    handleRegistry,
    typeRegistry,
    nominalEnv,
    convertTypeNode: convertTypeNodeRaw,
    unifiedCatalog,
    aliasTable,
    resolveIdentifier,
    resolveShorthandAssignment,
    resolveCallSignature,
    resolveConstructorSignature,
    checker,
    tsCompilerOptions,
    sourceFilesByPath,
  } = config;

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL CACHES — Step 4 Implementation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cache for declaration types.
   * Key: DeclId.id (number)
   * Value: IrType
   */
  const declTypeCache = new Map<number, IrType>();

  /**
   * Cache for member declared types (fully substituted).
   * Key: "fqName:memberName" or "fqName:memberName:typeArgs" for generics
   * Value: IrType
   */
  const memberDeclaredTypeCache = new Map<string, IrType>();

  /**
   * Cache for raw signature info (pre-substitution).
   * Key: SignatureId.id (number)
   * Value: RawSignatureInfo
   */
  const signatureRawCache = new Map<number, RawSignatureInfo>();

  /**
   * Cache for nominal member lookups.
   * Key: "fqName:typeArgs:memberName"
   * Value: NominalLookupResult
   */
  const nominalMemberLookupCache = new Map<
    string,
    NominalLookupResult | null
  >();

  /**
   * Accumulated diagnostics from type queries.
   */
  const diagnostics: Diagnostic[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED STATE — DI container for all split functions
  // ─────────────────────────────────────────────────────────────────────────

  const state: TypeSystemState = {
    handleRegistry,
    typeRegistry,
    nominalEnv,
    convertTypeNodeRaw,
    unifiedCatalog,
    aliasTable,
    resolveIdentifier,
    resolveShorthandAssignment,
    resolveCallSignature,
    resolveConstructorSignature,
    checker,
    tsCompilerOptions,
    sourceFilesByPath,
    declTypeCache,
    memberDeclaredTypeCache,
    signatureRawCache,
    nominalMemberLookupCache,
    diagnostics,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN TYPESYSTEM INSTANCE
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // Type syntax conversion (inference module)
    typeFromSyntax: (typeSyntaxId) => infTypeFromSyntax(state, typeSyntaxId),

    // Declaration types (inference module)
    typeOfDecl: (declId) => infTypeOfDecl(state, declId),
    typeOfValueRead: (declId) => infTypeOfValueRead(state, declId),

    // Member types (inference module)
    typeOfMember: (receiver, member, site) =>
      infTypeOfMember(state, receiver, member, site),
    tryTypeOfMember: (receiver, member) =>
      resolveMemberTypeNoDiag(
        state,
        receiver,
        member.kind === "byName" ? member.name : "unknown"
      ),
    getIndexerInfo: (receiver, site) =>
      infGetIndexerInfo(state, receiver, site),

    // Call resolution (call-resolution module)
    resolveCall: (query) => crResolveCall(state, query),
    collectExpectedReturnCandidates: (type) =>
      crCollectExpectedReturnCandidates(state, type),
    collectNarrowingCandidates: (type) =>
      crCollectNarrowingCandidates(state, type),
    delegateToFunctionType: (type) => crDelegateToFunctionType(state, type),

    // Utility type expansion (utilities module)
    expandUtility: (name, args, site) =>
      utExpandUtility(state, name, args, site),

    // Substitution & instantiation (relations module)
    substitute: (type, subst) => relSubstitute(type, subst),
    instantiate: (typeName, typeArgs, site) =>
      relInstantiate(state, typeName, typeArgs, site),

    // Type relations (relations module)
    isAssignableTo: (source, target) =>
      relIsAssignableTo(state, source, target),
    typesEqual: (a, b) => relTypesEqual(a, b),
    containsTypeParameter: (type) => relContainsTypeParameter(type),

    // Declaration inspection (inference module)
    hasTypeParameters: (declId) => infHasTypeParameters(state, declId),
    typeOfMemberId: (memberId, receiverType) =>
      infTypeOfMemberId(state, memberId, receiverType),
    getFQNameOfDecl: (declId) => infGetFQNameOfDecl(state, declId),
    isTypeDecl: (declId) => infIsTypeDecl(state, declId),
    isInterfaceDecl: (declId) => infIsInterfaceDecl(state, declId),
    isTypeAliasToObjectLiteral: (declId) =>
      infIsTypeAliasToObjectLiteral(state, declId),
    signatureHasConditionalReturn: (sigId) =>
      infSignatureHasConditionalReturn(state, sigId),
    signatureHasVariadicTypeParams: (sigId) =>
      infSignatureHasVariadicTypeParams(state, sigId),
    declHasTypeAnnotation: (declId) => infDeclHasTypeAnnotation(state, declId),
    checkTsClassMemberOverride: (
      declId,
      memberName,
      memberKind,
      parameters,
      baseClassType
    ) =>
      infCheckTsClassMemberOverride(
        state,
        declId,
        memberName,
        memberKind,
        parameters,
        baseClassType
      ),

    // Diagnostics
    getDiagnostics: () => diagnostics.slice(),
    clearDiagnostics: () => {
      diagnostics.length = 0;
    },
  };
};
