import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { AstReader, Node } from "@tsonic/tsts";
import { type SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import type { SourceStorageFixedPointQueries } from "../model/relations.js";
import type { SourceStorageFormalMemberWriteDemandSelection, SourceStorageWriteOccurrence } from "../model/types.js";
import type { SourceBindingWriteValue } from "../../../source-navigation/types.js";
import type { SourceStorageWriteProjection } from "../model/projections.js";
import type { SourceStorageStore, SourceStorageWrite } from "../model/stores.js";
export declare function createSourceStorageFormalMemberWrites(source: SourceAnalysisProgram, sourceBudget: SourceStorageBudget, createEquations: (budget: SourceStorageBudget) => SourceStorageFixedPointQueries, queries: {
    readonly declarations: readonly Node[];
    readonly invocations: Iterable<Node>;
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    readonly subject: SourceStorageSubjectQuery;
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    inputsFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined;
    implementationsFor(invocation: Node): {
        readonly nodes: ReadonlySet<Node>;
        readonly exact: boolean;
    } | undefined;
    unresolvedFor(invocation: Node): string | undefined;
}): Readonly<{
    recordWrite: (write: SourceStorageWriteOccurrence) => SourceStorageWriteOccurrence;
    closeInputs(): void;
    seal(): void;
    get(declaration: Node, parameter: Node): SourceStorageFormalMemberWriteDemandSelection;
}>;
export declare function createSourceStorageStoredValues(ast: AstReader, budget: SourceStorageBudget, regionFor: (node: Node) => Node | undefined, receiverFor: (node: Node) => SourceStorageSubject | undefined, declarationIsAmbient: (declaration: Node) => boolean | undefined): Readonly<{
    initialize(storage: SourceStorageSubject | undefined, occurrence: Node, value?: SourceStorageSubject): void;
    recordWrite: (storage: SourceStorageSubject | undefined, write: ReturnType<(reference: Node, valueFor: (input: SourceBindingWriteValue) => SourceStorageWriteProjection | undefined, aggregate: (values: readonly SourceStorageSubject[]) => SourceStorageSubject | undefined) => SourceStorageWrite | undefined>) => void;
    writeFor: (reference: Node, valueFor: (input: SourceBindingWriteValue) => SourceStorageWriteProjection | undefined, aggregate: (values: readonly SourceStorageSubject[]) => SourceStorageSubject | undefined) => SourceStorageWrite | undefined;
    storesFor: (storage: SourceStorageSubject) => Iterable<SourceStorageStore> | undefined;
    inputsFor: (storage: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined;
    bind(storage: SourceStorageSubject | undefined, occurrence: Node): void;
    publish(select: (write: SourceStorageWriteOccurrence) => SourceStorageWriteOccurrence): void;
    writeAt(reference: Node): SourceStorageWriteOccurrence | undefined;
    storesIn: (region: Node) => Iterable<SourceStorageStore> | undefined;
    unresolvedFor(storage: SourceStorageSubject): string | undefined;
}>;
//# sourceMappingURL=stored-values.d.ts.map