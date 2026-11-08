import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
export declare function createSourceStoragePointerBackings(source: SourceAnalysisProgram, budget: SourceStorageBudget, queries: {
    subjectFor(node: Node): SourceStorageSubject | undefined;
    locationFor(node: Node): SourceStorageSubject | undefined;
    originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
}): Readonly<{
    backingsFor: (expression: Node) => ReadonlySet<SourceStorageSubject> | undefined;
    accessorsFor: (invocation: Node) => ReadonlySet<Node> | undefined;
}>;
//# sourceMappingURL=pointer-backings.d.ts.map