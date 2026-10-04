import type { ResolvedSourceObjectLiteralElementInfo, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./types.js";
import type { SourceStructuralMember } from "./structural-members.js";

export function sourceObjectLiteralDestinationMember(
  element: ResolvedSourceObjectLiteralElementInfo,
  destination: Type,
  semantics: Pick<SourceFileSemantics, "types">,
): SourceStructuralMember | undefined {
  const correspondence = semantics.types.structuralMembers(element.objectLiteralType, destination);
  if (correspondence.kind !== "available") return undefined;
  const pairs = correspondence.members.filter(pair => pair.kind === "present" &&
    (pair.source.declarations.includes(element.element) || element.sourceElementSymbol !== undefined &&
      pair.source.property.symbol === element.sourceElementSymbol));
  return pairs.length === 1 ? pairs[0]!.destination : undefined;
}
