import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourceTypeDescriptor, SourceTypeDescriptorIndex } from "./types.js";
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
export declare function sourceTypeFlowEnumValueCategory(inputs: SourceTypeDescriptorKeyInputs, declaration: Node): "string" | "number" | undefined;
/**
 * The key kind of an index value or index-signature key: a string or char value is a string key (JS has no char); any
 * other primitive except bool is a number key; the symbol intrinsic is a symbol key; an enum value keys by its enum's
 * value category. undefined: no index key kind (bool, a union, an object, any/unknown, a heterogeneous enum).
 */
export declare function sourceTypeDescriptorKeyKind(key: SourceTypeDescriptor, inputs?: SourceTypeDescriptorKeyInputs): SourceTypeDescriptorKeyKind | undefined;
/**
 * The index signature a key of kind `key` selects on a shape: the one signature of that key kind; a number key with no
 * number signature reads the string signature (JS converts the key to a string). undefined: none, or more than one.
 */
export declare function sourceTypeDescriptorIndexEntry(shape: Extract<SourceTypeDescriptor, {
    readonly kind: "shape";
}>, key: SourceTypeDescriptorKeyKind): SourceTypeDescriptorIndex | undefined;
/** The value an index of kind `key` reads on a shape (the selected signature's value type). */
export declare function sourceTypeDescriptorIndexValue(shape: Extract<SourceTypeDescriptor, {
    readonly kind: "shape";
}>, key: SourceTypeDescriptorKeyKind): SourceTypeDescriptor | undefined;
/**
 * The element types an array-like value yields when iterated or spread, from its Host descriptor: an array its element,
 * a tuple each element in order, a string a string. undefined: the descriptor states no array-like elements (an
 * iterator-protocol value such as a Map, Set or generator).
 */
export declare function sourceTypeDescriptorArrayLikeElements(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] | undefined;
//# sourceMappingURL=element-selection.d.ts.map