/**
 * Union member selection by object-literal keys and predicate targets.
 *
 * Selects the best-matching union member for object literal instantiation
 * and finds union member indices by structural/nominal type matching.
 */

import type { IrType } from "@tsonic/frontend";
import { normalizedUnionType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { isAssignable } from "./type-compatibility.js";
import {
  resolveTypeAlias,
  stripNullish,
  getArrayLikeElementType,
} from "./nullish-value-helpers.js";
import {
  resolveLocalTypeInfo,
  getAllPropertySignatures,
} from "./property-member-lookup.js";
import { getRuntimeUnionAliasReferenceKey } from "./runtime-union-alias-identity.js";
import { typesHaveDeterministicIdentityConflict } from "./clr-type-identity.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { referenceTypesShareNominalIdentity } from "./reference-type-identity.js";
import {
  getContextualTypeVisitKey,
  tryContextualTypeIdentityKey,
} from "./deterministic-type-keys.js";

/**
 * Select the best union member type to instantiate for an object literal.
 *
 * Example:
 *   type Result<T,E> = Result__0<T,E> | Result__1<T,E>
 *   return { ok: true, value }  // keys: ["ok","value"]
 * → choose Result__0<T,E>
 *
 * Matching rules (conservative):
 * - Only considers union members that are referenceTypes to local interfaces or classes.
 * - Object literal keys must be a subset of the candidate's property names.
 * - All *required* (non-optional) candidate properties must be present in the literal.
 *
 * Scoring (pick "most specific" deterministically):
 * 1) Fewer extra properties (candidateProps - literalKeys)
 * 2) More required properties (prefer tighter required shape)
 * 3) Fewer total properties
 * 4) Lexicographic by type name (stable tie-break)
 */
export const selectObjectLiteralUnionMember = (
  unionType: Extract<IrType, { kind: "unionType" }>,
  literalKeys: readonly string[],
  context: EmitterContext
): IrType | undefined => {
  // Normalize keys (defensive: dedupe)
  const keySet = new Set(literalKeys.filter((k) => k.length > 0));
  const keys = [...keySet];

  type Candidate = {
    type: IrType;
    order: number;
    kind: "dictionary" | "object";
    allProps: Set<string>;
    requiredProps: Set<string>;
  };

  const candidates: Candidate[] = [];

  for (const member of unionType.types) {
    const resolved = resolveTypeAlias(stripNullish(member), context);

    if (resolved.kind === "dictionaryType") {
      if (
        resolved.keyType.kind === "primitiveType" &&
        resolved.keyType.name === "string"
      ) {
        candidates.push({
          type: member,
          order: candidates.length,
          kind: "dictionary",
          allProps: new Set<string>(),
          requiredProps: new Set<string>(),
        });
      }
      continue;
    }

    if (resolved.kind === "objectType") {
      const props = resolved.members.filter(
        (
          candidate
        ): candidate is Extract<
          (typeof resolved.members)[number],
          { kind: "propertySignature" }
        > => candidate.kind === "propertySignature"
      );
      const allProps = new Set(props.map((p) => p.name));
      const requiredProps = new Set(
        props.filter((p) => !p.isOptional).map((p) => p.name)
      );
      candidates.push({
        type: member,
        order: candidates.length,
        kind: "object",
        allProps,
        requiredProps,
      });
      continue;
    }

    if (member.kind !== "referenceType" && resolved.kind !== "referenceType") {
      continue;
    }

    const ref =
      resolved.kind === "referenceType"
        ? resolved
        : (member as Extract<IrType, { kind: "referenceType" }>);

    const infoResult = resolveLocalTypeInfo(ref, context);
    const info = infoResult?.info;
    if (!info) continue;

    // Interface members: use property signatures (includes inherited interfaces).
    if (info.kind === "interface") {
      const props = getAllPropertySignatures(ref, context);
      if (!props) continue;

      const allProps = new Set(props.map((p) => p.name));
      const requiredProps = new Set(
        props.filter((p) => !p.isOptional).map((p) => p.name)
      );

      candidates.push({
        type: member,
        order: candidates.length,
        kind: "object",
        allProps,
        requiredProps,
      });
      continue;
    }

    // Class members: use property declarations.
    // Anonymous object literal synthesis (TSN7403) emits DTO-like classes with `required` properties,
    // so unions over synthesized shapes must be matched here (not only interfaces).
    if (info.kind === "class") {
      const props = info.members.filter(
        (m) => m.kind === "propertyDeclaration"
      );
      const allProps = new Set(props.map((p) => p.name));
      const requiredProps = new Set(
        props.filter((p) => p.isRequired).map((p) => p.name)
      );

      candidates.push({
        type: member,
        order: candidates.length,
        kind: "object",
        allProps,
        requiredProps,
      });
      continue;
    }
  }

  // Filter by match rules
  const matches = candidates.filter((c) => {
    if (c.kind === "dictionary") {
      return true;
    }

    // literal keys must exist on candidate
    for (const k of keys) {
      if (!c.allProps.has(k)) return false;
    }
    // candidate required props must be provided by literal
    for (const r of c.requiredProps) {
      if (!keySet.has(r)) return false;
    }
    return true;
  });

  if (matches.length === 0) return undefined;
  const firstMatch = matches[0];
  if (matches.length === 1 && firstMatch) return firstMatch.type;

  // Pick best by score
  matches.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "dictionary" ? 1 : -1;
    }

    if (a.kind === "dictionary" && b.kind === "dictionary") {
      const aKey = tryContextualTypeIdentityKey(a.type, context);
      const bKey = tryContextualTypeIdentityKey(b.type, context);
      return aKey && bKey ? aKey.localeCompare(bKey) : a.order - b.order;
    }

    const aTotal = a.allProps.size;
    const bTotal = b.allProps.size;

    const aExtra = aTotal - keySet.size;
    const bExtra = bTotal - keySet.size;

    if (aExtra !== bExtra) return aExtra - bExtra; // fewer extras is better

    const aReq = a.requiredProps.size;
    const bReq = b.requiredProps.size;
    if (aReq !== bReq) return bReq - aReq; // more required is better

    if (aTotal !== bTotal) return aTotal - bTotal; // fewer total props is better

    const aKey = tryContextualTypeIdentityKey(a.type, context);
    const bKey = tryContextualTypeIdentityKey(b.type, context);
    return aKey && bKey ? aKey.localeCompare(bKey) : a.order - b.order;
  });

  const best = matches[0];
  return best?.type;
};

export const selectUnionMemberForObjectLiteral = (
  unionType: Extract<IrType, { kind: "unionType" }>,
  literalKeys: readonly string[],
  context: EmitterContext
): Extract<IrType, { kind: "referenceType" }> | undefined => {
  const selected = selectObjectLiteralUnionMember(
    unionType,
    literalKeys,
    context
  );
  return selected?.kind === "referenceType" ? selected : undefined;
};

export const findUnionMemberIndex = (
  unionType: Extract<IrType, { kind: "unionType" }>,
  target: IrType,
  context: EmitterContext
): number | undefined => {
  const canonicalUnion = normalizedUnionType(unionType.types);
  const unionMembers =
    canonicalUnion.kind === "unionType"
      ? canonicalUnion.types
      : [canonicalUnion];
  const resolvedTarget = resolveTypeAlias(stripNullish(target), context);
  const matchesPredicateTarget = (
    member: IrType,
    candidate: IrType,
    visited: Set<string> = new Set<string>()
  ): boolean => {
    const memberAliasKey = getRuntimeUnionAliasReferenceKey(member, context);
    if (memberAliasKey) {
      const candidateAliasKey = getRuntimeUnionAliasReferenceKey(
        candidate,
        context
      );
      if (candidateAliasKey) {
        return memberAliasKey === candidateAliasKey;
      }
    }

    const resolvedMember = resolveTypeAlias(stripNullish(member), context);
    const resolvedCandidate = resolveTypeAlias(
      stripNullish(candidate),
      context
    );
    if (areIrTypesEquivalent(resolvedMember, resolvedCandidate, context)) {
      return true;
    }
    const visitedKey = `${getContextualTypeVisitKey(
      resolvedMember,
      context
    )}=>${getContextualTypeVisitKey(resolvedCandidate, context)}`;
    if (visited.has(visitedKey)) {
      return true;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(visitedKey);

    if (resolvedCandidate.kind === "unionType") {
      return resolvedCandidate.types.some((candidateMember) =>
        matchesPredicateTarget(resolvedMember, candidateMember, nextVisited)
      );
    }

    if (resolvedMember.kind === "unionType") {
      return resolvedMember.types.some((memberType) =>
        matchesPredicateTarget(memberType, resolvedCandidate, nextVisited)
      );
    }

    if (
      resolvedMember.kind === "anyType" ||
      resolvedCandidate.kind === "anyType"
    ) {
      return true;
    }

    if (
      resolvedMember.kind === "unknownType" ||
      resolvedCandidate.kind === "unknownType"
    ) {
      return (
        resolvedMember.kind === "unknownType" &&
        resolvedCandidate.kind === "unknownType"
      );
    }

    if (resolvedMember.kind === "literalType") {
      if (resolvedCandidate.kind === "literalType") {
        return resolvedMember.value === resolvedCandidate.value;
      }
      if (resolvedCandidate.kind === "primitiveType") {
        return (
          (typeof resolvedMember.value === "string" &&
            resolvedCandidate.name === "string") ||
          (typeof resolvedMember.value === "number" &&
            (resolvedCandidate.name === "number" ||
              resolvedCandidate.name === "int")) ||
          (typeof resolvedMember.value === "boolean" &&
            resolvedCandidate.name === "boolean")
        );
      }
    }

    if (resolvedMember.kind === "primitiveType") {
      if (isAssignable(resolvedCandidate, resolvedMember)) {
        return true;
      }
      if (resolvedCandidate.kind === "primitiveType") {
        return (
          resolvedMember.name === resolvedCandidate.name ||
          isAssignable(resolvedMember, resolvedCandidate)
        );
      }
      if (resolvedCandidate.kind === "literalType") {
        return matchesPredicateTarget(resolvedCandidate, resolvedMember);
      }
    }

    if (
      resolvedMember.kind === "arrayType" &&
      resolvedCandidate.kind === "arrayType"
    ) {
      if (
        resolvedMember.elementType.kind === "unknownType" ||
        resolvedCandidate.elementType.kind === "unknownType"
      ) {
        return true;
      }
      return matchesPredicateTarget(
        resolvedMember.elementType,
        resolvedCandidate.elementType,
        nextVisited
      );
    }

    const memberArrayLikeElement = getArrayLikeElementType(
      resolvedMember,
      context
    );
    const candidateArrayLikeElement = getArrayLikeElementType(
      resolvedCandidate,
      context
    );
    if (memberArrayLikeElement && candidateArrayLikeElement) {
      if (
        memberArrayLikeElement.kind === "unknownType" ||
        candidateArrayLikeElement.kind === "unknownType"
      ) {
        return true;
      }
      return matchesPredicateTarget(
        memberArrayLikeElement,
        candidateArrayLikeElement,
        nextVisited
      );
    }

    if (
      resolvedMember.kind === "tupleType" &&
      resolvedCandidate.kind === "tupleType"
    ) {
      if (
        resolvedMember.elementTypes.length !==
        resolvedCandidate.elementTypes.length
      ) {
        return false;
      }
      return resolvedMember.elementTypes.every((elementType, index) => {
        const other = resolvedCandidate.elementTypes[index];
        return other
          ? matchesPredicateTarget(elementType, other, nextVisited)
          : false;
      });
    }

    if (
      resolvedMember.kind === "functionType" &&
      resolvedCandidate.kind === "functionType"
    ) {
      if (
        resolvedMember.parameters.length !== resolvedCandidate.parameters.length
      ) {
        return false;
      }

      for (
        let index = 0;
        index < resolvedMember.parameters.length;
        index += 1
      ) {
        const memberParam = resolvedMember.parameters[index];
        const candidateParam = resolvedCandidate.parameters[index];
        if (!memberParam || !candidateParam) {
          return false;
        }

        if (!memberParam.type && !candidateParam.type) {
          continue;
        }

        if (!memberParam.type || !candidateParam.type) {
          return false;
        }

        if (
          !matchesPredicateTarget(
            memberParam.type,
            candidateParam.type,
            nextVisited
          )
        ) {
          return false;
        }
      }

      return matchesPredicateTarget(
        resolvedMember.returnType,
        resolvedCandidate.returnType,
        nextVisited
      );
    }

    if (
      resolvedMember.kind === "referenceType" &&
      resolvedCandidate.kind === "referenceType"
    ) {
      if (
        typesHaveDeterministicIdentityConflict(
          resolvedMember,
          resolvedCandidate
        )
      ) {
        return false;
      }

      if (
        referenceTypesShareNominalIdentity(
          resolvedMember,
          resolvedCandidate,
          context
        )
      ) {
        return true;
      }

      return false;
    }

    return false;
  };

  for (let i = 0; i < unionMembers.length; i++) {
    const m = unionMembers[i];
    if (m && matchesPredicateTarget(m, resolvedTarget)) {
      return i;
    }
  }
  return undefined;
};

export const unionMemberMatchesTarget = (
  member: IrType,
  candidate: IrType,
  context: EmitterContext
): boolean => {
  const resolvedCandidate = resolveTypeAlias(stripNullish(candidate), context);
  const wrapper = {
    kind: "unionType",
    types: [member],
  } as const satisfies Extract<IrType, { kind: "unionType" }>;
  return findUnionMemberIndex(wrapper, resolvedCandidate, context) === 0;
};
