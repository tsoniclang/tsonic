import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";
import type { createSourceStorageExecutionRegions } from "../graph/execution-regions.js";
import type { createSourceStorageGraphQueries, SourceStorageReconciliation } from "../graph/graph-queries.js";
interface SourceStorageRejectionQueries {
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
    callbackEntriesFor(invocation: Node): readonly SourceStorageCallbackEntry[];
    implementationsFor(invocation: Node): {
        readonly nodes: ReadonlySet<Node>;
        readonly exact: boolean;
    } | undefined;
    invocationOrigins(origin: SourceStorageSubject, candidate: Node, invocation: Node): ReadonlySet<SourceStorageSubject> | undefined;
    readonly regions: ReturnType<typeof createSourceStorageExecutionRegions>;
    readonly graph: Pick<ReturnType<typeof createSourceStorageGraphQueries>, "read" | "query">;
    readonly thrownOrigins: ReadonlyMap<Node, ReadonlySet<SourceStorageSubject>>;
    readonly unresolvedThrows: ReadonlyMap<Node, string>;
    readonly unresolvedSubjects: Map<SourceStorageSubject, string>;
    readonly unresolvedInvocations: ReadonlyMap<Node, string>;
    isAccessorInvocation(node: Node): boolean;
    sealed(): boolean;
    subject(node: Node | undefined, kind: SourceStorageSubject["kind"]): SourceStorageSubject | undefined;
    enclosingCallable(node: Node): Node | undefined;
    connect(origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined): void;
    recordThrow(region: Node, subject: SourceStorageSubject): void;
    recordUnresolvedThrow(region: Node, reason: string): void;
}
export declare function createSourceStorageRejections(source: SourceAnalysisProgram, budget: SourceStorageBudget, queries: SourceStorageRejectionQueries): Readonly<{
    receiverOriginsFor: (receiver: Node, formal: SourceStorageSubject) => readonly SourceStorageSubject[] | undefined;
    operations: (nodes: readonly Node[], invocations: Iterable<Node>) => Generator<SourceStorageReconciliation>;
}>;
export {};
//# sourceMappingURL=rejections.d.ts.map