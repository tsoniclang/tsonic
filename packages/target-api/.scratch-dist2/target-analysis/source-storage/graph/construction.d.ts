import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageBindings, SourceStorageConstructionSelection, SourceStorageQueries } from "../model/types.js";
type ConstructionQueries = Pick<SourceStorageQueries, "subject" | "bindingsForInvocation" | "executionRegionsFor" | "subjectFor" | "storageProducersFor">;
export declare function createSourceStorageConstructionQuery(source: SourceAnalysisProgram, budget: SourceStorageBudget, queries: ConstructionQueries, nativeConstructorsFor: (subject: SourceStorageSubject) => readonly Node[] | undefined): (invocation: Node, bindings: SourceStorageBindings) => SourceStorageConstructionSelection;
export {};
//# sourceMappingURL=construction.d.ts.map