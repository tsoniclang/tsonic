import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageScopedSubject, SourceStorageScope } from "../graph/scoped-model.js";
import type { createSourceStorageTransport } from "./transport.js";
import type { SourceStorageDomainBoundary } from "../model/types.js";
export declare function createSourceStorageDomains(source: SourceAnalysisProgram, transport: ReturnType<typeof createSourceStorageTransport>, budget: SourceStorageBudget): Readonly<{
    select: (subject: SourceStorageSubject, bindings: SourceStorageScope, purpose?: "values" | "storage-producers") => Readonly<{
        subjects: readonly SourceStorageSubject[];
        boundSubjects: readonly SourceStorageScopedSubject[];
        boundaries: readonly SourceStorageDomainBoundary<SourceStorageScope>[];
        reason: string | undefined;
        absence: boolean;
    }>;
    writeBoundariesFor: (subject: SourceStorageSubject) => Readonly<{
        boundaries: readonly Readonly<{
            kind: "external-input" | "external-write" | "opaque-result" | "opaque-write" | "unclassified-exposure";
            subject: SourceStorageSubject;
            exposure: Node;
            owner?: SourceStorageSubject | undefined;
        }>[];
        reason: string | undefined;
    }>;
}>;
//# sourceMappingURL=domains.d.ts.map