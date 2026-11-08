import type { SourceStorageBudget } from "../model/resource-budget.js";
export type SourceStorageKeyValue = null | string | number | readonly SourceStorageKeyValue[] | SourceStorageKeySet | SourceStorageKey;
export interface SourceStorageKey {
    readonly kind: "key";
    readonly identity: number;
    readonly signature: string;
    readonly reference: string | number;
}
export interface SourceStorageKeySet {
    readonly kind: "set";
    readonly values: readonly SourceStorageKeyValue[];
}
export declare function createSourceStorageKeyEncoder(budget: SourceStorageBudget): Readonly<{
    intern: (value: SourceStorageKeyValue) => SourceStorageKey | undefined;
    encode(value: SourceStorageKeyValue): string | undefined;
}>;
//# sourceMappingURL=key-encoding.d.ts.map