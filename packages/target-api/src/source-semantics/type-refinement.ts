import type {
  ReadonlySourceFactResolver,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import {
  sourceTypeRelationship,
} from "./type-relationship.js";

export type SourceTypeRefinement =
  | { readonly kind: "exact"; readonly type: Type }
  | { readonly kind: "members"; readonly types: readonly Type[] }
  | { readonly kind: "ambiguous" }
  | { readonly kind: "unrelated" };

export function selectSourceTypeRefinement(
  types: TypeShapeQueries,
  checker: TypeCheckerQueries,
  facts: ReadonlySourceFactResolver,
  declaredType: Type,
  selectedType: Type,
): SourceTypeRefinement {
  if (
    sourceTypeMemberRefines(types, checker, facts, declaredType, selectedType)
  ) {
    return { kind: "exact", type: declaredType };
  }
  if (!types.isUnion(declaredType)) {
    return { kind: "unrelated" };
  }
  const rawDeclaredMembers = types.getUnionOrIntersectionTypes(declaredType);
  const rawSelectedMembers = types.isUnion(selectedType)
    ? types.getUnionOrIntersectionTypes(selectedType)
    : [selectedType];
  if (
    rawDeclaredMembers.some((member) => member === undefined) ||
    rawSelectedMembers.some((member) => member === undefined)
  ) {
    return { kind: "unrelated" };
  }
  const declaredMembers = rawDeclaredMembers.filter(
    (member): member is Type => member !== undefined,
  );
  const selectedMembers = rawSelectedMembers.filter(
    (member): member is Type => member !== undefined,
  );
  const refined: Type[] = [];
  for (const selectedMember of selectedMembers) {
    const candidates = declaredMembers.filter((declaredMember) =>
      sourceTypeMemberRefines(types, checker, facts, declaredMember, selectedMember));
    if (candidates.length === 0) {
      return { kind: "unrelated" };
    }
    if (candidates.length !== 1) {
      return { kind: "ambiguous" };
    }
    if (!refined.includes(candidates[0]!)) {
      refined.push(candidates[0]!);
    }
  }
  return { kind: "members", types: Object.freeze(refined) };

}

export function sourceTypeMemberRefines(
  types: TypeShapeQueries,
  checker: TypeCheckerQueries,
  facts: ReadonlySourceFactResolver,
  declaredMember: Type,
  selectedMember: Type,
): boolean {
  const pending = [selectedMember];
  const visited = new Set<Type>();
  let remaining = 2_048;
  while (pending.length > 0) {
    if (--remaining < 0) return false;
    const member = pending.pop()!;
    if (visited.has(member)) continue;
    visited.add(member);
    if (sourceTypeRelationship(types, checker, facts, declaredMember, member) !== "unrelated") return true;
    const base = types.getBaseTypeOfLiteralType(member);
    if (base !== undefined && base !== member &&
      sourceTypeRelationship(types, checker, facts, declaredMember, base) !== "unrelated") return true;
    if (types.getNumericLiteralTypeValue(member) !== undefined && types.getNumericLiteralTypeValue(declaredMember) === undefined &&
      (types.isNumberLike(member) && types.isNumberLike(declaredMember) || types.isBigIntLike(member) && types.isBigIntLike(declaredMember))) return true;
    if (types.isIntersection(member)) {
      const parts = types.getUnionOrIntersectionTypes(member);
      if (parts.some(part => part === undefined) || parts.length > remaining - pending.length) return false;
      pending.push(...parts as Type[]);
    }
  }
  return false;
}
