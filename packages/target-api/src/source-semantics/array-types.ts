import type { Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./types.js";

export function sourceArrayElementType(type: Type, semantics: SourceFileSemantics): Type | undefined {
  if (!semantics.types.isArrayLike(type) || semantics.types.isTuple(type)) return undefined;
  const indexes = semantics.types.indexInfos(type).filter(index =>
    index.keyType !== undefined && semantics.types.isNumberLike(index.keyType));
  return indexes.length === 1 ? indexes[0]!.valueType : undefined;
}
