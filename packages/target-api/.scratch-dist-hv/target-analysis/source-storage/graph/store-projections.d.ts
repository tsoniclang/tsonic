import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageStore } from "../model/stores.js";
import type { createSourceStorageEdges } from "./edges.js";
export interface SourceStorageStoredProjection {
    readonly store: SourceStorageStore;
    readonly value: SourceStorageSubject | undefined;
}
export declare function createSourceStorageStoreProjections(budget: SourceStorageBudget, subject: SourceStorageSubjectQuery, storesFor: (subject: SourceStorageSubject) => Iterable<SourceStorageStore> | undefined, projectOrigin: ReturnType<typeof createSourceStorageEdges>["projectOrigin"]): (selected: SourceStorageSubject) => readonly SourceStorageStoredProjection[] | undefined;
//# sourceMappingURL=store-projections.d.ts.map