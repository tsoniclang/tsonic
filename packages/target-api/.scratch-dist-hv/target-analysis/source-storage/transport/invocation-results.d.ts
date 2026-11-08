import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageScopedSubject, SourceStorageScope } from "../graph/scoped-model.js";
interface SourceStorageInvocationResultQueries {
    readonly subject: SourceStorageSubjectQuery;
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    nativeConstructorsFor(subject: SourceStorageSubject): readonly Node[] | undefined;
    valuesFor(subject: SourceStorageSubject, bindings: SourceStorageScope): ReadonlySet<SourceStorageScopedSubject> | undefined;
    targetFor(invocation: Node): SourceStorageSubject | undefined;
    bindingsFor(candidate: Node, invocation: Node, bindings: SourceStorageScope, captured: SourceStorageScope, callee: SourceStorageSubject | undefined): SourceStorageScope | undefined;
    hasResultAlias(invocation: Node): boolean;
}
export interface SourceStorageInvocationResultQueriesContract {
    forInvocation(candidate: Node, invocation: Node, bindings: SourceStorageScope, capture?: SourceStorageScopedSubject): ReadonlySet<SourceStorageScope>;
    hasAllocation(subject: SourceStorageSubject): boolean;
}
export declare function createSourceStorageInvocationResults(source: SourceAnalysisProgram, budget: SourceStorageBudget, queries: SourceStorageInvocationResultQueries): SourceStorageInvocationResultQueriesContract;
export {};
//# sourceMappingURL=invocation-results.d.ts.map