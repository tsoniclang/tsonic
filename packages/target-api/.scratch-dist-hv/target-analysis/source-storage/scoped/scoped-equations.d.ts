import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageScope, SourceStorageTerm, SourceStorageVariable } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopedRecursion } from "./scoped-recursion.js";
export declare function createSourceStorageEquations(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, recursion: SourceStorageScopedRecursion, keyFor: (term: Extract<SourceStorageTerm, {
    readonly kind: "application";
}>) => string | undefined): Readonly<{
    scopeFor: (candidate: Node, invocation: Node, caller: SourceStorageScope, captured: SourceStorageScope, term: Extract<SourceStorageTerm, {
        readonly kind: "application";
    }>) => SourceStorageScope | undefined;
    expand: (variable: SourceStorageVariable, term: SourceStorageTerm, read: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) => readonly SourceStorageTerm[] | undefined;
}>;
//# sourceMappingURL=scoped-equations.d.ts.map