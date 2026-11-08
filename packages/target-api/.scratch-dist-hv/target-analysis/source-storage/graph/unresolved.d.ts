import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
export interface SourceStorageUnresolvedAncestry {
    readonly subjects: readonly {
        readonly subject: SourceStorageSubject;
    }[];
    readonly reason?: string;
}
export declare function createSourceStorageUnresolvedQueries(budget: SourceStorageBudget, subject: SourceStorageSubjectQuery, ancestry: (selected: SourceStorageSubject) => SourceStorageUnresolvedAncestry | undefined, unresolved: ReadonlyMap<SourceStorageSubject, string>): Readonly<{
    directFor: (selected: SourceStorageSubject) => string | undefined;
    ancestryFor: (selected: SourceStorageSubject) => string | undefined;
}>;
//# sourceMappingURL=unresolved.d.ts.map