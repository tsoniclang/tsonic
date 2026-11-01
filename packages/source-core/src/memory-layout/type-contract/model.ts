import type { Node, Symbol, Type, TypePropertyInfo } from "@tsonic/tsts";

export type DomainPart = object | string | number | bigint | boolean;

export interface MemoryTypeDomain {
  readonly key: number;
  readonly kind: "source" | "nullish" | "primitive" | "pointer" | "raw-pointer" | "union" | "intersection" | "reference" | "fixed-array" | "extent";
  readonly children: readonly MemoryTypeDomain[];
  readonly head: DomainPart | undefined;
}

export interface MemoryRecordMember {
  readonly property: TypePropertyInfo;
  readonly declarations: readonly Node[];
  readonly domain: MemoryTypeDomain;
}

export interface MemoryRecordShape {
  readonly type: Type;
  readonly members: ReadonlyMap<Symbol, MemoryRecordMember>;
}
