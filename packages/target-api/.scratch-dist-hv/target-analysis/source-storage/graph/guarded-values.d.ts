import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { type SourceStorageSubject } from "../model/subjects.js";
export interface SourceStorageValueGuards {
    readonly key: string;
    readonly references: readonly Node[];
}
export declare function createSourceStorageGuardedValues(source: SourceAnalysisProgram, budget: SourceStorageBudget, classValues: (expression: Node) => readonly {
    readonly classes: readonly {
        readonly subject: SourceStorageSubject;
    }[];
    readonly complete: boolean;
}[] | undefined): Readonly<{
    appliesTo: (reference: Node) => boolean | undefined;
    admits: (owner: SourceStorageSubject, reference: Node) => boolean | undefined;
    conjoin: (existing: SourceStorageValueGuards | undefined, reference: Node) => SourceStorageValueGuards | null | undefined;
}>;
//# sourceMappingURL=guarded-values.d.ts.map