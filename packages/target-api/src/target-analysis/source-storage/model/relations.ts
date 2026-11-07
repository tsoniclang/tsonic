import type { SourceTypeDescriptor } from "../../../source-semantics/local-type-flow/types.js";

/** Host descriptors of the two ends of a storage value edge. */
export interface SourceStorageEdgeTypes {
  readonly from: SourceTypeDescriptor;
  readonly to: SourceTypeDescriptor;
}

export type SourceStorageForwardSelection<Key, Value> =
  | { readonly kind: "value"; readonly value: Value }
  | { readonly kind: "relation"; readonly key: Key };

export interface SourceStorageFixedPointQuery<Key, Value> {
  (key: Key): ReadonlySet<Value> | undefined;
  release(): void;
}

export interface SourceStorageFixedPointQueries {
  seal(): void;
  fixedPoint<Key, Value>(collect: (key: Key, read: (key: Key) => ReadonlySet<Value> | undefined,
    add: (value: Value) => boolean,
    forward: (key: Key, projection?: (value: Value) => readonly SourceStorageForwardSelection<Key, Value>[] | undefined) => boolean) => boolean,
    family: string): SourceStorageFixedPointQuery<Key, Value>;
}
