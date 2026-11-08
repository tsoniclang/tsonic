import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageScope, SourceStorageScopeParameter } from "./scoped-model.js";
export interface SourceStorageSubstitutionPath {
    readonly replacements: ReadonlyMap<SourceStorageScopeParameter, SourceStorageScope>;
    readonly parent: SourceStorageSubstitutionPath | undefined;
}
export declare function createSourceStorageScopedTraversal(budget: SourceStorageBudget): (scope: SourceStorageScope, direction?: "lexical" | "caller") => Generator<{
    scope: import("./scoped-model.js").SourceStorageFrame | import("./scoped-model.js").SourceStorageVariable;
    path: SourceStorageSubstitutionPath | undefined;
}, void, unknown>;
//# sourceMappingURL=scoped-traversal.d.ts.map