import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageKeyValue } from "../graph/key-encoding.js";
export type SourceStorageKeyContinuation = Generator<SourceStorageKeyContinuation, SourceStorageKeyValue | undefined, SourceStorageKeyValue | undefined>;
export declare function completeSourceStorageKeyEncoding(budget: SourceStorageBudget, initial: SourceStorageKeyContinuation): SourceStorageKeyValue | undefined;
//# sourceMappingURL=key-continuations.d.ts.map