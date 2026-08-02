import type {
  Node,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";

export type SourceContextualValueTypeSelection =
  | { readonly kind: "selected"; readonly type: Type }
  | { readonly kind: "ambiguous"; readonly types: readonly Type[] }
  | { readonly kind: "unavailable" };

export function selectSourceContextualValueType(
  types: TypeShapeQueries,
  checker: TypeCheckerQueries,
  node: Node,
): SourceContextualValueTypeSelection {
  const contextualType = checker.getContextualType(node);
  if (contextualType === undefined) {
    return { kind: "unavailable" };
  }
  const rawCandidates = types.isUnion(contextualType)
    ? types.getUnionOrIntersectionTypes(contextualType)
    : [contextualType];
  if (rawCandidates.some((candidate) => candidate === undefined)) {
    return { kind: "unavailable" };
  }
  const candidates = rawCandidates.filter(
    (candidate): candidate is Type =>
      candidate !== undefined && !types.isNullish(candidate),
  );
  if (candidates.length === 1) {
    return { kind: "selected", type: candidates[0]! };
  }
  return candidates.length === 0
    ? { kind: "unavailable" }
    : { kind: "ambiguous", types: Object.freeze(candidates) };
}
