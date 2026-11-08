import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageIncomingQuery } from "./edges.js";
export declare function createSourceStorageAncestorQuery(budget: SourceStorageBudget, incoming: SourceStorageIncomingQuery): (selected: SourceStorageSubject, accepts?: (subject: SourceStorageSubject, origins: ReadonlySet<SourceStorageSubject>) => boolean) => IterableIterator<SourceStorageSubject>;
//# sourceMappingURL=ancestors.d.ts.map