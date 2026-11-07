import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceLiteralValue } from "../literal-values-model.js";
import { sourceTypeDescriptorStructure } from "./terms.js";
import type { SourceTypeDescriptor, SourceTypeDescriptorIndex } from "./types.js";

// Element, index-signature and iteration selection over Host descriptors. Every reader that asks "which key kind is
// this index", "which index signature does this key select" or "which elements does this iterable value yield" calls
// here (R4: one selector per question). No checker input.

export type SourceTypeDescriptorKeyKind = "number" | "string" | "symbol";

/** Declaration input the key rule reads: the AST and the Host literal value of an enum member initializer. */
export interface SourceTypeDescriptorKeyInputs {
  readonly ast: AstReader;
  literal(node: Node): SourceLiteralValue | undefined;
}

/**
 * The value category of an enum declaration (one owner; the typeof category and the key rule read it): "string" when
 * every member is initialized with a string literal, "number" when no member is, undefined for a heterogeneous enum
 * (some members string, some numeric), whose values have no single category.
 */
export function sourceTypeFlowEnumValueCategory(inputs: SourceTypeDescriptorKeyInputs, declaration: Node): "string" | "number" | undefined {
  const { ast } = inputs;
  const members = ast.members(declaration).filter((member): member is Node => member !== undefined);
  const strings = members.filter(member => {
    const initializer = ast.as.AsEnumMember(member)?.Initializer;
    const value = initializer === undefined ? undefined : inputs.literal(initializer);
    return value?.form === "string" || value?.form === "template";
  }).length;
  return members.length > 0 && strings === members.length ? "string" : strings === 0 ? "number" : undefined;
}

/**
 * The key kind of an index value or index-signature key: a string or char value is a string key (JS has no char); any
 * other primitive except bool is a number key; the symbol intrinsic is a symbol key; an enum value keys by its enum's
 * value category. undefined: no index key kind (bool, a union, an object, any/unknown, a heterogeneous enum).
 */
export function sourceTypeDescriptorKeyKind(key: SourceTypeDescriptor, inputs?: SourceTypeDescriptorKeyInputs): SourceTypeDescriptorKeyKind | undefined {
  const structure = sourceTypeDescriptorStructure(key);
  if (structure.kind === "declared" && inputs !== undefined && inputs.ast.is.IsEnumDeclaration(structure.declaration)) {
    return sourceTypeFlowEnumValueCategory(inputs, structure.declaration);
  }
  if (structure.kind === "string") return "string";
  if (structure.kind === "primitive") return structure.primitive === "char" ? "string" : structure.primitive === "bool" ? undefined : "number";
  return structure.kind === "intrinsic" && structure.intrinsic === "symbol" ? "symbol" : undefined;
}

/**
 * The index signature a key of kind `key` selects on a shape: the one signature of that key kind; a number key with no
 * number signature reads the string signature (JS converts the key to a string). undefined: none, or more than one.
 */
export function sourceTypeDescriptorIndexEntry(shape: Extract<SourceTypeDescriptor, { readonly kind: "shape" }>,
  key: SourceTypeDescriptorKeyKind): SourceTypeDescriptorIndex | undefined {
  let selected = shape.indexes.filter(index => sourceTypeDescriptorKeyKind(index.key) === key);
  if (selected.length === 0 && key === "number") selected = shape.indexes.filter(index => sourceTypeDescriptorKeyKind(index.key) === "string");
  return selected.length === 1 ? selected[0] : undefined;
}

/** The value an index of kind `key` reads on a shape (the selected signature's value type). */
export function sourceTypeDescriptorIndexValue(shape: Extract<SourceTypeDescriptor, { readonly kind: "shape" }>,
  key: SourceTypeDescriptorKeyKind): SourceTypeDescriptor | undefined {
  return sourceTypeDescriptorIndexEntry(shape, key)?.value;
}

/**
 * The element types an array-like value yields when iterated or spread, from its Host descriptor: an array its element,
 * a tuple each element in order, a string a string. undefined: the descriptor states no array-like elements (an
 * iterator-protocol value such as a Map, Set or generator).
 */
export function sourceTypeDescriptorArrayLikeElements(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] | undefined {
  const structure = sourceTypeDescriptorStructure(type);
  if (structure.kind === "array") return [structure.element];
  if (structure.kind === "tuple") return structure.elements.map(element => element.type);
  if (structure.kind === "string") return [structure];
  return undefined;
}
