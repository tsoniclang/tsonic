import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageScope, SourceStorageProjectionView } from "../graph/scoped-model.js";
import type { SourceStorageBindings, SourceStorageOriginsSelection, SourceStorageTypedSubject, SourceStorageUnresolved, SourceStorageDomainBoundary } from "../model/types.js";
import type { createSourceStorageTransport } from "./transport.js";
import type { createSourceStorageDomains } from "./domains.js";
export type SourceStorageOriginViews = ReadonlyMap<SourceStorageSubject, ReadonlySet<readonly SourceStorageProjectionView[]>>;
export declare function createSourceStorageDomainSelection(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: ReturnType<typeof createSourceStorageTransport>, domains: ReturnType<typeof createSourceStorageDomains>, bindingStates: WeakMap<SourceStorageBindings, readonly SourceStorageScope[]>, bindingView: (states: Iterable<SourceStorageScope>) => SourceStorageBindings | undefined, subjectReason: (subject: SourceStorageSubject) => string | undefined, unresolved: (reason: string) => SourceStorageUnresolved): {
    typedOrigins: (subjects: readonly SourceStorageSubject[], qualified: SourceStorageOriginViews) => SourceStorageOriginsSelection;
    selectDomain: (subject: SourceStorageSubject, bindings: SourceStorageBindings, purpose: "values" | "storage-producers") => Readonly<{
        kind: "complete";
        origins: readonly SourceStorageTypedSubject[];
        producerStates: Map<SourceStorageSubject, Set<SourceStorageScope>>;
        includesAbsence: boolean;
    }> | Readonly<{
        kind: "open";
        origins: readonly SourceStorageTypedSubject[];
        producerStates: Map<SourceStorageSubject, Set<SourceStorageScope>>;
        boundaries: readonly SourceStorageDomainBoundary<SourceStorageBindings>[];
        includesAbsence: boolean;
    }> | SourceStorageUnresolved;
};
//# sourceMappingURL=domain-selection.d.ts.map