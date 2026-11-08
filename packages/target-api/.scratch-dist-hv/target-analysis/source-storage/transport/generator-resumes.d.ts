import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageCallEffect } from "../model/types.js";
import type { SourceStorageSubject } from "../model/subjects.js";
export declare function createSourceStorageGeneratorResumes(source: SourceAnalysisProgram, budget: SourceStorageBudget, queries: {
    readonly invocationEffects: ReadonlyMap<Node, SourceStorageCallEffect>;
    subjectFor(node: Node): SourceStorageSubject | undefined;
    originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
    implementationsFor(invocation: Node): ReadonlySet<Node> | undefined;
}): (invocation: Node) => ReadonlySet<Node> | undefined;
//# sourceMappingURL=generator-resumes.d.ts.map