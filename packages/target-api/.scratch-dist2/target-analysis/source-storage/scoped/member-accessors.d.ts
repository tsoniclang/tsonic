import { type SourceAnalysisProgram } from "../../analysis-program.js";
import { type SourceStorageInvocationInputSelectionQuery } from "../graph/invocation-inputs.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageIncomingQuery } from "../graph/edges.js";
import type { createSourceStorageGraphQueries, SourceStorageReconciliation } from "../graph/graph-queries.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { createSourceStorageMemberFlow, createSourceStorageMemberImplementations } from "../graph/member-flow.js";
import type { SourceStorageAccessorInvocation } from "../graph/scoped-model.js";
interface SourceStorageAccessorQueries {
    readonly subject: SourceStorageSubjectQuery;
    readonly incomingFor: SourceStorageIncomingQuery;
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    implementationsFor(declaration: Node, invocation: Node, receiver: Node): ReturnType<ReturnType<typeof createSourceStorageMemberImplementations>>;
    readonly spreadMembersFor: ReturnType<typeof createSourceStorageMemberFlow>["spreadMembersFor"];
    connect(origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined): void;
    recordInvocation(invocation: Node): void;
    readonly inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
}
export declare function createSourceStorageMemberAccessors(source: SourceAnalysisProgram, budget: SourceStorageBudget, queries: SourceStorageAccessorQueries, graph: ReturnType<typeof createSourceStorageGraphQueries>): Readonly<{
    record: (access: Node) => void;
    sites: Set<Node>;
    declarationsFor: (key: Node) => ReadonlySet<Node> | undefined;
    operations: () => Generator<SourceStorageReconciliation>;
    targets: Map<Node, readonly SourceStorageAccessorInvocation[]>;
}>;
export {};
//# sourceMappingURL=member-accessors.d.ts.map