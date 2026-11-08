import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageForwardSelection, SourceStorageFixedPointQuery } from "../model/relations.js";
interface GraphInput {
    readonly node: Node;
    readonly kind: unknown;
}
export type SourceStorageReconciliation = (once: (key: object) => boolean) => void;
type ValueProjection<Key, Value> = ((value: Value) => readonly SourceStorageForwardSelection<Key, Value>[] | undefined) | undefined;
export declare function createSourceStorageGraphQueries(budget: SourceStorageBudget): Readonly<{
    seal(): void;
    read(subject: GraphInput): void;
    invalidate(subject: GraphInput): void;
    reconcile(operations: Iterable<SourceStorageReconciliation>): void;
    query<Key, Value>(collect: (key: Key, retain: (cost: number) => boolean) => ReadonlySet<Value> | undefined): (key: Key) => ReadonlySet<Value> | undefined;
    fixedPoint<Key, Value>(collect: (key: Key, read: (key: Key) => ReadonlySet<Value> | undefined, add: (value: Value) => boolean, forward: (key: Key, projection?: ValueProjection<Key, Value>) => boolean) => boolean, family: string): SourceStorageFixedPointQuery<Key, Value>;
}>;
export {};
//# sourceMappingURL=graph-queries.d.ts.map