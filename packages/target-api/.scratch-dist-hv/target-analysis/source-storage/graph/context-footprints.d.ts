import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageContextLocation } from "./context-locations.js";
export interface SourceStorageContextFootprint {
    readonly ports: ReadonlySet<SourceStorageSubject>;
    readonly locations: ReadonlySet<SourceStorageSubject>;
}
export declare function createSourceStorageContextFootprints(budget: SourceStorageBudget, inputsFor: (subject: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined, locationFor: (subject: SourceStorageSubject) => SourceStorageContextLocation | undefined, applicationFor?: (subject: SourceStorageSubject) => SourceStorageContextFootprint | undefined): Readonly<{
    select(subject: SourceStorageSubject): SourceStorageContextFootprint | undefined;
}>;
//# sourceMappingURL=context-footprints.d.ts.map