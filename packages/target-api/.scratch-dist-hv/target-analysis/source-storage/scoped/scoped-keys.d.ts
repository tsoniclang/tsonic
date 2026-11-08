import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageActivation, SourceStorageTerm, SourceStorageScope } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageCreationContext } from "./activation-keys.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
export declare function createSourceStorageScopedKeys(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, creation: SourceStorageCreationContext): Readonly<{
    encode: (term: SourceStorageTerm, invocation?: boolean) => string | undefined;
    releaseReferenceMemo(): void;
    context(inputs: readonly (readonly {
        readonly subject: SourceStorageSubject;
        readonly term: SourceStorageTerm;
    }[])[]): string | undefined;
    closed: (term: SourceStorageTerm) => boolean | undefined;
    birth: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageActivation | undefined;
    invocation: (term: Extract<SourceStorageTerm, {
        readonly kind: "application";
    }>) => string | undefined;
}>;
//# sourceMappingURL=scoped-keys.d.ts.map