import type { Node } from "@tsonic/tsts";
import type { SourceStorageLimits, SourceStorageQueries, SourceStorageUnresolved } from "../source-storage/model/types.js";
export type SourceReceiverOccurrencesSelection = {
    readonly kind: "resolved";
    readonly occurrences: ReadonlyMap<Node, readonly Node[]>;
} | SourceStorageUnresolved;
export declare function analyzeSourceReceiverOccurrences(storage: SourceStorageQueries, limits?: Partial<SourceStorageLimits>): SourceReceiverOccurrencesSelection;
//# sourceMappingURL=receiver-occurrences.d.ts.map