import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageCallbackEntry, SourceStorageDomainBoundary } from "../model/types.js";
import type { SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageSubject } from "../model/subjects.js";
export declare function walkSourceStorageExecution(budget: SourceStorageBudget, roots: Iterable<SourceStorageTerm>, read: (term: SourceStorageTerm) => Iterable<SourceStorageTerm> | undefined): Generator<SourceStorageTerm>;
export declare function sourceStorageExecutionDemands(transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, budget: SourceStorageBudget, demand: Node, context: SourceStorageScope | undefined, deferred: boolean, execution?: SourceStorageTerm): readonly SourceStorageTerm[] | undefined;
export declare function createSourceStorageExecutionReachability(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport): Readonly<{
    frontiers(invocation: Node, target: Node): readonly (Omit<SourceStorageDomainBoundary, "bindings"> & {
        readonly callback?: SourceStorageCallbackEntry;
    })[] | undefined;
    reachableFrom: (region: Node) => ReadonlySet<Node> | undefined;
    region: (region: Node, target: Node) => boolean | undefined;
    invocation: (invocation: Node, target: Node) => boolean | undefined;
}>;
export declare function createSourceStorageInputExecutions(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, reachability: ReturnType<typeof createSourceStorageExecutionReachability>, readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined): Readonly<{
    conditionalExecutions: (roots: Iterable<SourceStorageTerm>, demand: Node, exposure: Node, reasons: {
        readonly value: {
            readonly reason: string;
            readonly executionOnly: boolean;
        };
        readonly effect: string | undefined;
    }, retainProducers: boolean) => readonly SourceStorageTerm[] | undefined;
    nativeInputExecutions: (invocation: Node, scope: SourceStorageScope, demand: Node, deferred: boolean | undefined, callback?: {
        readonly entry: SourceStorageCallbackEntry;
        readonly subject: SourceStorageSubject;
        readonly bindings: SourceStorageScope;
    }) => readonly SourceStorageTerm[] | undefined;
}>;
//# sourceMappingURL=execution-reachability.d.ts.map