import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageIncomingQuery } from "../graph/edges.js";
import type { SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
import type { SourceStorageContextLocation } from "../graph/context-locations.js";
interface SourceStorageContextInputQueries {
    readonly subject: SourceStorageSubjectQuery;
    readonly incomingFor: SourceStorageIncomingQuery;
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    sourceFileFor(subject: SourceStorageSubject): SourceFile | undefined;
    isInvocation(node: Node): boolean;
    implementationsFor(node: Node): ReadonlySet<Node>;
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    locationFor(subject: SourceStorageSubject): SourceStorageContextLocation | undefined;
    ownerFor(node: Node): Node | undefined;
    argumentsFor(node: Node): readonly Node[];
}
export declare function createSourceStorageContextInputs(source: SourceAnalysisProgram, budget: SourceStorageBudget, queries: SourceStorageContextInputQueries, graph: ReturnType<typeof createSourceStorageGraphQueries>): ((origin: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined) & {
    applicationFor: (subject: SourceStorageSubject) => import("../graph/context-footprints.js").SourceStorageContextFootprint | undefined;
};
export {};
//# sourceMappingURL=context-inputs.d.ts.map