import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageReduction, SourceStorageTerm } from "../graph/scoped-model.js";
export interface SourceStorageChildContext {
    readonly contributes?: boolean;
    readonly independentCallee?: Node;
    readonly correlated?: boolean;
    readonly dependencies?: readonly SourceStorageTerm[];
}
export interface SourceStorageChildReduction {
    readonly kind: "child-reduction";
    readonly child: SourceStorageTerm;
    readonly replace: (child: SourceStorageTerm) => SourceStorageTerm;
    readonly context: SourceStorageChildContext;
}
export type SourceStoragePendingReduction = SourceStorageReduction | SourceStorageChildReduction;
export declare function sourceStorageChildDependencies(selected: SourceStorageReduction | undefined, dependencies: readonly SourceStorageTerm[] | undefined): SourceStorageReduction | undefined;
export declare function completeSourceStorageChildReduction(budget: SourceStorageBudget, initial: SourceStoragePendingReduction | undefined, reduce: (term: SourceStorageTerm, correlated: boolean) => SourceStoragePendingReduction | undefined): SourceStorageReduction | undefined;
//# sourceMappingURL=child-reduction.d.ts.map