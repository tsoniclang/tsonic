import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageInstanceRegion, SourceStorageCallbackEntry } from "../model/types.js";
import type { SourceStorageInvocationInputSelectionQuery } from "./invocation-inputs.js";
export declare function createSourceStorageExecutionRegions(source: SourceAnalysisProgram, budget: SourceStorageBudget, constructionLineages: (invocation: Node) => readonly {
    readonly classes: readonly {
        readonly subject: SourceStorageSubject;
    }[];
    readonly complete: boolean;
}[] | undefined, inputSlotsFor: SourceStorageInvocationInputSelectionQuery, subject: SourceStorageSubjectQuery): Readonly<{
    enclosing: (node: Node) => Node | undefined;
    catchDestination: (node: Node) => Node | undefined;
    callable: (declaration: Node, invocation: Node | undefined, argumentTypes?: (expression: Node) => readonly SourceTypeDescriptor[] | undefined, callback?: SourceStorageCallbackEntry, actualTypes?: readonly (readonly SourceTypeDescriptor[] | undefined)[], phase?: "call" | "active") => readonly Node[];
    instance: (invocation: Node) => {
        readonly regions: readonly SourceStorageInstanceRegion[];
        readonly exact: boolean;
    } | undefined;
    recordInvocation(invocation: Node): void;
    invocationRegions: () => Iterable<Node>;
    invocationsIn(region: Node): Iterable<Node> | undefined;
    seal(): void;
}>;
//# sourceMappingURL=execution-regions.d.ts.map