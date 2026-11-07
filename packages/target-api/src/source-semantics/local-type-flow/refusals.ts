import type { Node } from "@tsonic/tsts";
import type { SourceTypeFlowRefusal, SourceTypeFlowRefusalCode } from "./types.js";

const reasons: Readonly<Record<SourceTypeFlowRefusalCode, string>> = Object.freeze({
  TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE: "A mapped member requires one checked string literal, number literal or unique symbol key.",
  TSONIC_LOCAL_TYPE_CONFLICT: "Linked values have different concrete source types. Annotate the declaration with one exact type.",
  TSONIC_LOCAL_TYPE_MIXED_ELEMENTS: "This array literal mixes different fixed source types. Annotate the array and convert its elements explicitly.",
  TSONIC_LOCAL_TYPE_SIGNATURE: "This value reaches an inferred signature and cannot take its type from a use. Annotate the value or the signature.",
  TSONIC_UNTYPED_OBJECT_LITERAL: "This object literal has no target type. Declare one, e.g. 'function baseOptions(): MakeDirectoryOptions'.",
  TSONIC_UNTYPED_ARRAY_LITERAL: "This empty array has no element type. Declare one, e.g. 'function emptyBuffer(): number[]'.",
  TSONIC_LOCAL_TYPE_ACCUMULATOR: "The accumulator's callback result differs from its non-cyclic source type. Write a matching seed such as '0.0' or annotate the accumulator.",
  TSONIC_LOCAL_TYPE_UNION: "A union cannot choose one exact local source type. Annotate the value or the selected call's result.",
  TSONIC_LOCAL_TYPE_SELF_REFERENCE: "This local type depends on itself or leaves through a stored function value. Annotate the value or the function signature.",
  TSONIC_LOCAL_TYPE_ADDRESS: "An open local's address requires a fixed storage type. Annotate the local before taking its address.",
  TSONIC_LOCAL_TYPE_LIMIT: "Local type inference exceeds 64 bindings, 1024 uses per binding, or depth 4. Annotate the declaration.",
  TSONIC_LOCAL_TYPE_GENERIC: "The pinned generic declaration cannot establish one exact source instantiation. Annotate the arguments or provide explicit type arguments.",
  TSONIC_LOCAL_TYPE_NUMBER_ERASURE_INEXACT: "This number-origin integer cannot enter an unknown or object slot without a proven exact float64 representation.",
  TSONIC_LOCAL_TYPE_UNSUPPORTED: "This source operation has no proven local type-flow rule or required checked evidence is unavailable. Annotate the value or the selected signature.",
  TSONIC_NATIVE_INTEGER_WIDTH_MISSING: "This native-int / native-uint value needs the native integer width of the active target, which states none. Use a fixed-width integer type, or configure the target architecture.",
  TSONIC_NATIVE_INTEGER_WIDTH_CONFLICTING: "This native-int / native-uint value needs the native integer width of the active target, which states conflicting widths. Use a fixed-width integer type, or configure one target architecture.",
});

export function createSourceTypeFlowRefusal(
  code: SourceTypeFlowRefusalCode,
  site: Node,
  related?: Node,
): SourceTypeFlowRefusal {
  return Object.freeze({ kind: "refused", source: "tsonic", code, site,
    ...(related === undefined ? {} : { related }), reason: reasons[code] });
}
