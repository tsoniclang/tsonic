import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageScope, SourceStorageScopedSubject, SourceStorageProjectionReceiver } from "../graph/scoped-model.js";
import type { createSourceStorageTransport } from "./transport.js";
interface SourceStoragePublicationDemand extends SourceStorageScopedSubject {
    readonly type: SourceTypeDescriptor;
    readonly receiver: SourceStorageProjectionReceiver;
}
export declare function createSourceStoragePublicationDemands(source: SourceAnalysisProgram, transport: ReturnType<typeof createSourceStorageTransport>, budget: SourceStorageBudget, origins: (subject: SourceStorageSubject, bindings: SourceStorageScope) => ReadonlySet<SourceStorageScopedSubject> | undefined): Readonly<{
    values(receiver: SourceStorageSubject, bindings: SourceStorageScope): Iterable<SourceStoragePublicationDemand>;
    finish(): void;
}>;
export {};
//# sourceMappingURL=publication-demands.d.ts.map