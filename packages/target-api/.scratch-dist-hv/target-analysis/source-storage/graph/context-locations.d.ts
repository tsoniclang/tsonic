import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageStore } from "../model/stores.js";
import type { SourceStorageCallEffect } from "../model/types.js";
export type SourceStorageContextLocation = "allocation" | "binding";
export declare function createSourceStorageContextLocations(source: SourceAnalysisProgram, budget: SourceStorageBudget, storesFor: (subject: SourceStorageSubject) => Iterable<SourceStorageStore> | undefined, callEffectFor: (subject: SourceStorageSubject) => SourceStorageCallEffect | undefined): (subject: SourceStorageSubject) => SourceStorageContextLocation | undefined;
//# sourceMappingURL=context-locations.d.ts.map