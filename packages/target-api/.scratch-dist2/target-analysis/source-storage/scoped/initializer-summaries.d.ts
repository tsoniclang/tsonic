import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { type SourceStorageScope, type SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageCreationContext } from "./activation-keys.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { createSourceStorageScopedKeys } from "./scoped-keys.js";
export declare function createSourceStorageInitializerSummaries(source: SourceAnalysisProgram, budget: SourceStorageBudget, scopes: SourceStorageScopes, creation: SourceStorageCreationContext, keys: ReturnType<typeof createSourceStorageScopedKeys>): Readonly<{
    instantiate(value: SourceStorageSubject, scope: SourceStorageScope): SourceStorageTerm | undefined;
    release(): void;
}>;
//# sourceMappingURL=initializer-summaries.d.ts.map