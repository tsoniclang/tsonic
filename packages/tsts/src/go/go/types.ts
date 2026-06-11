import type { bool } from "@tsonic/core/types.js";

export interface Type {
  String?(): string;
  readonly __goFacadeName?: string;
}

export interface Object {
  Name?(): string;
  Type?(): Type;
  readonly __goFacadeName?: string;
}

export interface Scope {
  Lookup?(name: string): Object | undefined;
  readonly __goFacadeName?: string;
}

export function Identical(x: Type | undefined, y: Type | undefined): bool {
  if (x === y) {
    return true as bool;
  }
  if (x === undefined || y === undefined) {
    return false as bool;
  }
  if (typeof x.String === "function" && typeof y.String === "function") {
    return (x.String() === y.String()) as bool;
  }
  return false as bool;
}

export const Alias = "Alias";
export const Array = "Array";
export const Basic = "Basic";
export const Chan = "Chan";
export const Interface = "Interface";
export const Map = "Map";
export const Named = "Named";
export const Pointer = "Pointer";
export const Signature = "Signature";
export const Slice = "Slice";
export const Struct = "Struct";
export const TypeName = "TypeName";
export const TypeParam = "TypeParam";
export const Universe: Scope = {};
export const Var = "Var";
