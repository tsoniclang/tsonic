import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
import type { SourceStorageContextFootprint } from "../graph/context-footprints.js";
import type { SourceStorageContextLocation } from "../graph/context-locations.js";
interface ContextApplicationQueries {
    readonly subject: SourceStorageSubjectQuery;
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    inputsFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined;
    incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
    argumentsFor(node: Node): readonly Node[];
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    implementationsFor(node: Node): ReadonlySet<Node>;
    isInvocation(node: Node): boolean;
    locationFor(subject: SourceStorageSubject): SourceStorageContextLocation | undefined;
    ownerFor(node: Node): Node | undefined;
}
export declare function createSourceStorageContextApplications(source: SourceAnalysisProgram, budget: SourceStorageBudget, queries: ContextApplicationQueries, graph: ReturnType<typeof createSourceStorageGraphQueries>): (subject: SourceStorageSubject) => SourceStorageContextFootprint | undefined;
export {};
//# sourceMappingURL=context-applications.d.ts.map