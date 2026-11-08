import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageActivation, SourceStorageReduction, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageChildContext, SourceStoragePendingReduction } from "./child-reduction.js";
interface SourceStorageStoreSuccessorContext {
    readonly budget: SourceStorageBudget;
    readonly transport: SourceStorageScopedTransport;
    readonly absent: Extract<SourceStorageReduction, {
        readonly kind: "replace";
    }>;
    birth(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageActivation | undefined;
    symbolicInput(subject: SourceStorageSubject, scope: SourceStorageScope): boolean;
    replaceChild(child: SourceStorageTerm, replace: (child: SourceStorageTerm) => SourceStorageTerm, context?: SourceStorageChildContext): SourceStoragePendingReduction | undefined;
}
export declare function createSourceStorageStoreSuccessors(context: SourceStorageStoreSuccessorContext): (term: Extract<SourceStorageTerm, {
    readonly kind: "store";
}>) => SourceStoragePendingReduction | undefined;
export {};
//# sourceMappingURL=store-successors.d.ts.map