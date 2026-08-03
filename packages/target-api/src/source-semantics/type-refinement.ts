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
    sourceTypeRelationship(
      types,
      checker,
      facts,
      declaredType,
      selectedType,
    ) !== "unrelated"
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
      sourceTypeRelationship(
        types,
        checker,
        facts,
        declaredMember,
        selectedMember,
      ) !== "unrelated"
    );
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
