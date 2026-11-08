import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageCallbackEntry, SourceStorageDomainBoundary } from "../model/types.js";
import type { SourceStorageInvocationInputQuery, SourceStorageInvocationInputSelectionQuery } from "../graph/invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
export declare function createSourceStorageCallbackInputFrontiers(source: SourceAnalysisProgram, budget: SourceStorageBudget, graphQueries: ReturnType<typeof createSourceStorageGraphQueries>, host: {
    readonly invocations: ReadonlySet<Node>;
    readonly callbackEntriesFor: (invocation: Node) => readonly SourceStorageCallbackEntry[];
    readonly callbackImplementationsFor: (entry: SourceStorageCallbackEntry) => ReadonlySet<Node>;
    readonly invocationTargets: ReadonlyMap<Node, SourceStorageSubject>;
    readonly subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined;
    readonly originSubjects: (subject: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined;
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    readonly inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
    readonly nativePayloadCandidates: (invocation: Node) => ReadonlySet<{
        readonly values: readonly SourceStorageSubject[];
        readonly complete: boolean;
    }> | undefined;
}): (key: Node) => ReadonlySet<Omit<SourceStorageDomainBoundary<import("../model/types.js").SourceStorageBindings>, "bindings"> & {
    readonly callback?: SourceStorageCallbackEntry;
}> | undefined;
//# sourceMappingURL=callback-input-frontiers.d.ts.map