import type { SourceTypeEvidence } from "../../../public/source/contracts.js";


export interface SourceStorageEdgeTypes {
  readonly from: SourceTypeEvidence;
  readonly to: SourceTypeEvidence;
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
