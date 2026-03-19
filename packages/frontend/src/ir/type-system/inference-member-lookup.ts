/**
 * Member Type Lookup — resolveMemberTypeNoDiag, typeOfMember
 *
 * Contains member lookup and resolution logic:
 * - resolveMemberTypeNoDiag: internal member lookup without diagnostics
 * - typeOfMember: public member type query with diagnostics
 *
 * DAG position: depends on inference-utilities,
 *               type-system-state, type-system-relations, type-system-call-resolution
 */

import type {
  IrType,
  IrInterfaceMember,
} from "../types/index.js";
import {
  substituteIrType as irSubstitute,
} from "../types/ir-substitution.js";
import { unknownType } from "./types.js";
import type { TypeSystemState, Site, MemberRef } from "./type-system-state.js";
import {
  emitDiagnostic,
  normalizeToNominal,
  isNullishPrimitive,
  makeMemberCacheKey,
} from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import {
  attachTypeIds,
} from "./type-system-call-resolution.js";
import {
  buildFunctionTypeFromSignatureShape,
  buildCallableOverloadFamilyType,
  buildStructuralMethodFamilyType,
} from "./inference-utilities.js";

export const resolveMemberTypeNoDiag = (
  state: TypeSystemState,
  receiver: IrType,
  memberName: string
): IrType | undefined => {
  // Built-in dictionary pseudo-members used by TS-side ergonomics.
  // Record<K, V> lowers to dictionaryType, and callers often use:
  // - dict.Keys[i]
  // - dict.Values[i]
  // - dict.Count / dict.Length
  //
  // Resolve these deterministically at TypeSystem level so downstream passes
  // (numeric proof, element access typing) don't receive unknownType poison.
  if (receiver.kind === "dictionaryType") {
    if (memberName === "Keys") {
      return {
        kind: "arrayType",
        elementType: receiver.keyType,
      };
    }
    if (memberName === "Values") {
      return {
        kind: "arrayType",
        elementType: receiver.valueType,
      };
    }
    if (memberName === "Count" || memberName === "Length") {
      return { kind: "primitiveType", name: "int" };
    }

    return receiver.valueType;
  }

  // Built-in array pseudo-members.
  // Arrays are structural IR types and may not resolve via nominal lookup.
  //
  // Support both CLR-style `Length`/`Count` and TS/JS-style `length`.
  // The latter is required for JS surfaces even when the underlying runtime
  // value is an explicit CLR array (for example `Encoding.UTF8.GetBytes(...).length`).
  if (receiver.kind === "arrayType") {
    if (
      memberName === "Length" ||
      memberName === "Count" ||
      memberName === "length"
    ) {
      return { kind: "primitiveType", name: "int" };
    }
  }

  // Tuples behave like fixed-size arrays for length access.
  if (receiver.kind === "tupleType") {
    if (
      memberName === "Length" ||
      memberName === "Count" ||
      memberName === "length"
    ) {
      return { kind: "primitiveType", name: "int" };
    }
  }

  // JavaScript strings expose `.length` as an exact integer at runtime.
  // Preserve that exactness for numeric proof and source-port ergonomics.
  if (receiver.kind === "primitiveType" && receiver.name === "string") {
    if (
      memberName === "Length" ||
      memberName === "Count" ||
      memberName === "length"
    ) {
      return { kind: "primitiveType", name: "int" };
    }
  }

  // 1. Normalize receiver to nominal form
  const normalized = normalizeToNominal(state, receiver);
  if (!normalized) {
    // Handle structural types (objectType)
    if (receiver.kind === "objectType") {
      const members = receiver.members.filter((m) => m.name === memberName);
      if (members.length === 0) return undefined;

      const propertyMembers = members.filter(
        (
          member
        ): member is Extract<
          IrInterfaceMember,
          { kind: "propertySignature" }
        > => member.kind === "propertySignature"
      );
      if (propertyMembers.length > 0) {
        const [property] = propertyMembers;
        if (!property) return undefined;
        if (!property.isOptional) return property.type;
        return {
          kind: "unionType",
          types: [property.type, { kind: "primitiveType", name: "undefined" }],
        };
      }

      const methodMembers = members.filter(
        (
          member
        ): member is Extract<IrInterfaceMember, { kind: "methodSignature" }> =>
          member.kind === "methodSignature"
      );
      return buildStructuralMethodFamilyType(methodMembers);
    }

    if (
      receiver.kind === "referenceType" &&
      receiver.structuralMembers &&
      receiver.structuralMembers.length > 0
    ) {
      const members = receiver.structuralMembers.filter(
        (m) => m.name === memberName
      );
      if (members.length === 0) return undefined;

      const propertyMembers = members.filter(
        (
          member
        ): member is Extract<
          IrInterfaceMember,
          { kind: "propertySignature" }
        > => member.kind === "propertySignature"
      );
      if (propertyMembers.length > 0) {
        const [property] = propertyMembers;
        if (!property) return undefined;
        if (!property.isOptional) return property.type;
        return {
          kind: "unionType",
          types: [property.type, { kind: "primitiveType", name: "undefined" }],
        };
      }

      const methodMembers = members.filter(
        (
          member
        ): member is Extract<IrInterfaceMember, { kind: "methodSignature" }> =>
          member.kind === "methodSignature"
      );
      return buildStructuralMethodFamilyType(methodMembers);
    }
    return undefined;
  }

  // 2. Check cache
  const cacheKey = makeMemberCacheKey(
    normalized.typeId.stableId,
    memberName,
    normalized.typeArgs
  );
  const cached = state.memberDeclaredTypeCache.get(cacheKey);
  if (cached) return cached;

  // 3. Use NominalEnv to find declaring type + substitution (Phase 6: TypeId-based)
  const lookupResult = state.nominalEnv.findMemberDeclaringType(
    normalized.typeId,
    normalized.typeArgs,
    memberName
  );

  // 4a. If NominalEnv found the member, get its declared type from Universe
  if (lookupResult) {
    const memberEntry = state.unifiedCatalog.getMember(
      lookupResult.declaringTypeId,
      memberName
    );

    // Property/field member: return its declared type.
    const memberType = memberEntry?.type;
    if (memberType) {
      const result = attachTypeIds(
        state,
        irSubstitute(memberType, lookupResult.substitution)
      );
      state.memberDeclaredTypeCache.set(cacheKey, result);
      return result;
    }

    // Method member: materialize a callable function type from the first signature.
    // Call resolution (resolveCall) uses SignatureId for overload selection; this
    // type is used only to keep member access expressions deterministic.
    const signatures = memberEntry?.signatures ?? [];
    if (signatures.length > 0) {
      const overloadFamily = buildCallableOverloadFamilyType(
        signatures.map((signature) =>
          buildFunctionTypeFromSignatureShape(
            signature.parameters.map((parameter) => ({
              name: parameter.name,
              type: parameter.type,
              isOptional: parameter.isOptional,
              isRest: parameter.isRest,
              mode: parameter.mode,
            })),
            signature.returnType
          )
        )
      );

      const result = attachTypeIds(
        state,
        irSubstitute(overloadFamily, lookupResult.substitution)
      );
      state.memberDeclaredTypeCache.set(cacheKey, result);
      return result;
    }
  }
  return undefined;
};

export const typeOfMember = (
  state: TypeSystemState,
  receiver: IrType,
  member: MemberRef,
  site?: Site
): IrType => {
  const memberName = member.kind === "byName" ? member.name : "unknown"; // MemberId.name not defined yet

  // Common nullish unions (T | undefined | null) should behave like T for member lookup.
  // This preserves deterministic typing for patterns like:
  //   const url = request.url; if (!url) return; url.absolutePath
  const effectiveReceiver =
    receiver.kind === "unionType"
      ? (() => {
          const nonNullish = receiver.types.filter(
            (t) => t && !isNullishPrimitive(t)
          );
          return nonNullish.length === 1 && nonNullish[0]
            ? nonNullish[0]
            : receiver;
        })()
      : receiver;

  if (effectiveReceiver.kind === "unionType") {
    const nonNullish = effectiveReceiver.types.filter(
      (t) => t && !isNullishPrimitive(t)
    );

    if (nonNullish.length > 1) {
      let resolved: IrType | undefined;
      for (const part of nonNullish) {
        const partType = resolveMemberTypeNoDiag(state, part, memberName);
        if (!partType) {
          emitDiagnostic(
            state,
            "TSN5203",
            `Member '${memberName}' not found`,
            site
          );
          return unknownType;
        }

        if (!resolved) {
          resolved = partType;
          continue;
        }

        if (!typesEqual(resolved, partType)) {
          emitDiagnostic(
            state,
            "TSN5203",
            `Member '${memberName}' has incompatible types across union constituents`,
            site
          );
          return unknownType;
        }
      }

      if (resolved) return resolved;
    }
  }

  const resolved = resolveMemberTypeNoDiag(
    state,
    effectiveReceiver,
    memberName
  );
  if (resolved) return resolved;

  emitDiagnostic(state, "TSN5203", `Member '${memberName}' not found`, site);
  return unknownType;
};
