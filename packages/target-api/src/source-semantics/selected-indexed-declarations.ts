import type { Node, TypeIndexedAccessSelection } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./types.js";
import { selectedSourcePropertyDeclarations } from "./selected-property-declarations.js";

export function selectedSourceIndexedDeclarations(
  semantics: SourceFileSemantics,
  selection: TypeIndexedAccessSelection | undefined,
): { readonly declarations: readonly Node[]; readonly readonly: boolean } | undefined {
  if (selection?.kind !== "resolved" || selection.members.length !== 1) return undefined;
  const member = selection.members[0]!;
  const declarations = member.kind === "property"
    ? selectedSourcePropertyDeclarations(semantics, undefined, member.property.symbol, [selection.objectType])
    : member.index.declaration === undefined ? member.index.components : [member.index.declaration];
  if (declarations === undefined || declarations.length === 0) return undefined;
  const exact = new Set<Node>();
  for (const declaration of declarations) {
    if (declaration === undefined) return undefined;
    exact.add(declaration);
  }
  return Object.freeze({ declarations: Object.freeze([...exact]),
    readonly: member.kind === "property" ? member.property.readonly : member.index.readonly });
}
