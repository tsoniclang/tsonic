import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageScopedSubject, SourceStorageScope } from "../graph/scoped-model.js";
import type { createSourceStorageTransport } from "./transport.js";
import type { createSourceStorageDomainWitnesses } from "../graph/domain-witnesses.js";
import type { createSourceStorageDomainPublications } from "../graph/domain-publications.js";
import type { createSourceStorageDomainInputs } from "./domain-inputs.js";
import type { createSourceStoragePublicationDemands } from "./publication-demands.js";
export declare function createSourceStorageDomainInitialization(input: {
    readonly source: SourceAnalysisProgram;
    readonly transport: ReturnType<typeof createSourceStorageTransport>;
    readonly budget: SourceStorageBudget;
    readonly witnesses: ReturnType<typeof createSourceStorageDomainWitnesses>;
    readonly publications: ReturnType<typeof createSourceStorageDomainPublications>;
    readonly publicationDemands: ReturnType<typeof createSourceStoragePublicationDemands>;
    readonly add: ReturnType<typeof createSourceStorageDomainInputs>["add"];
    readonly publicationOriginsIn: (subject: SourceStorageSubject, bindings: SourceStorageScope) => ReadonlySet<SourceStorageScopedSubject> | undefined;
}): () => void;
//# sourceMappingURL=domain-initialization.d.ts.map