import type { Node, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "../types.js";
import { sourceTypeDescriptorStructure, sourceTypeDescriptorUnion } from "./terms.js";
import type { SourceTypeDescriptor } from "./types.js";

// The awaited payload of an await operand from the operand's own descriptor: the declared type argument identical to the
// checker's awaited type (the same rule as async returns). A non-thenable operand is its own payload.
export function sourceTypeFlowAwaitedPayload(queries: SourceFileSemantics, operand: Node,
  described: SourceTypeDescriptor | undefined): SourceTypeDescriptor | undefined {
  const actual = queries.types.expressionType(operand);
  const awaited = actual === undefined ? undefined : queries.types.awaitedType(actual);
  if (actual === undefined || awaited === undefined || described === undefined) return undefined;
  if (queries.types.isIdentical(actual, awaited)) return described;
  const argumentIndex = (selected: Type): number => {
    const result = queries.types.awaitedType(selected);
    return result === undefined || queries.types.isIdentical(selected, result) ? -1
      : queries.types.typeArguments(selected).findIndex(argument => queries.types.isIdentical(argument, result));
  };
  const structure = sourceTypeDescriptorStructure(described);
  if (structure.kind !== "union" && structure.kind !== "optional") {
    const index = argumentIndex(actual);
    return described.kind === "declared" && index >= 0 ? described.typeArguments[index] : undefined;
  }
  const pending: SourceTypeDescriptor[] = [structure];
  const originals: Extract<SourceTypeDescriptor, { kind: "declared" }>[] = [];
  let sourceAbsent = false;
  while (pending.length > 0) {
    const selected = pending.pop()!;
    if (selected.kind === "union") { pending.push(...selected.types); continue; }
    if (selected.kind === "optional") { sourceAbsent = true; pending.push(selected.value); continue; }
    if (selected.kind === "intrinsic" && selected.intrinsic === "absence") { sourceAbsent = true; continue; }
    if (selected.kind !== "declared") return undefined;
    originals.push(selected);
  }
  const members = queries.types.isUnion(actual) ? queries.types.unionOrIntersectionTypes(actual) : [actual];
  const positions = new Map<Node, number>();
  let absent = false;
  for (const member of members) {
    if (queries.types.isNullish(member)) { absent = true; continue; }
    const index = argumentIndex(member);
    const symbol = queries.declarations.typeAliasSymbol(member) ?? queries.declarations.typeSymbol(member);
    const declarations = symbol === undefined ? [] : queries.declarations.symbolDeclarations(symbol)
      .filter(declaration => originals.some(selected => selected.declaration === declaration));
    if (index < 0 || declarations.length === 0) return undefined;
    for (const declaration of declarations) {
      const previous = positions.get(declaration);
      if (previous !== undefined && previous !== index) return undefined;
      positions.set(declaration, index);
    }
  }
  const payloads: SourceTypeDescriptor[] = [];
  for (const selected of originals) {
    const index = positions.get(selected.declaration);
    const payload = index === undefined ? undefined : selected.typeArguments[index];
    if (payload === undefined) return undefined;
    payloads.push(payload);
  }
  if (sourceAbsent !== absent) return undefined;
  if (absent) payloads.push({ kind: "intrinsic", intrinsic: "absence" });
  return sourceTypeDescriptorUnion(payloads);
}
