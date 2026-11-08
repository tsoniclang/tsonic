import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { type createSourceStorageExecutionReachability } from "./execution-reachability.js";
import type { SourceStorageActivation, SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
export declare function createSourceStorageScopedSuccessors(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, equations: ReturnType<typeof createSourceStorageEquations>, reachability: ReturnType<typeof createSourceStorageExecutionReachability>, birth: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageActivation | undefined, closed: (term: SourceStorageTerm) => boolean | undefined, readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined, initialize: (value: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageTerm | undefined, outside?: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageReference | undefined): Readonly<{
    reduce: (term: SourceStorageTerm, correlated?: boolean) => SourceStorageReduction | undefined;
}>;
//# sourceMappingURL=scoped-successors.d.ts.map