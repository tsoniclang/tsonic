import type { Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./types.js";

export function sourcePresentCallableType(
  type: Type | undefined,
  semantics: SourceFileSemantics,
): Type | undefined {
  if (type === undefined) return undefined;
  const members = semantics.types.isUnion(type)
    ? semantics.types.unionOrIntersectionTypes(type)
    : [type];
  if (members.some(member => member === undefined)) return undefined;
  const present = members.filter(member => !semantics.types.isNullish(member!));
  const selected = present.length === 1 ? present[0] : undefined;
  return selected !== undefined && semantics.types.callSignatures(selected).length > 0
    ? selected : undefined;
}
