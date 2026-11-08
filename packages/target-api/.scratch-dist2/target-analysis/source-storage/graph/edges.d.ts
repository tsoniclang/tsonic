import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceFile } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageEdgeTypes } from "../model/relations.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
export type SourceStorageIncomingQuery = (subject: SourceStorageSubject) => ReadonlySet<SourceStorageSubject>;
export declare function createSourceStorageEdges(source: SourceAnalysisProgram, budget: SourceStorageBudget, subject: SourceStorageSubjectQuery, sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined): Readonly<{
    add: (origin: SourceStorageSubject, destination: SourceStorageSubject, types?: SourceStorageEdgeTypes) => boolean;
    incomingFor: SourceStorageIncomingQuery;
    projectOrigin: (origin: SourceStorageSubject, destination: SourceStorageSubject, selected: SourceStorageSubject, collect: (origin: SourceStorageSubject) => void) => void;
}>;
//# sourceMappingURL=edges.d.ts.map