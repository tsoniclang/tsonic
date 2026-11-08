import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import { type SourceStorageSubject, type SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageEdgeTypes } from "../model/relations.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageArgumentTransport, SourceStorageCallEffect, SourceStorageEffects, SourceStorageCallbackEntry, SourceStorageInvocationInputSlots } from "../model/types.js";
import type { createSourceStorageStoredValues } from "../graph/stored-values.js";
import type { SourceStorageWrite } from "../model/stores.js";
import type { createSourceStorageProjectionFlow } from "../model/projections.js";
import type { createSourceStorageExecutionRegions } from "../graph/execution-regions.js";
import type { createSourceStorageMemberAccessors } from "../scoped/member-accessors.js";
/** The transport state and helpers the per-node collection pass records into; built by createSourceStorageTransport. */
export interface SourceStorageSyntaxCollectionContext {
    readonly source: SourceAnalysisProgram;
    readonly budget: SourceStorageBudget;
    readonly effects: SourceStorageEffects;
    readonly mutationOwners: Map<Node, SourceStorageSubject>;
    readonly invocations: Set<Node>;
    readonly pointerInvocations: Set<Node>;
    readonly invocationEffects: Map<Node, SourceStorageCallEffect>;
    readonly invocationTargets: Map<Node, SourceStorageSubject>;
    readonly invocationArguments: Map<Node, readonly Node[]>;
    readonly invocationDeclarations: Map<Node, Node>;
    readonly argumentTransports: Map<Node, readonly SourceStorageArgumentTransport[]>;
    readonly callbackEntries: Map<Node, readonly SourceStorageCallbackEntry[]>;
    readonly unresolvedInvocations: Map<Node, string>;
    readonly memberImplementations: Map<Node, Set<Node>>;
    readonly callableDeclarations: Node[];
    readonly callableDeclarationRows: SourceStorageRows;
    readonly subject: SourceStorageSubjectQuery;
    readonly step: () => boolean;
    retainCheckedContext(node: Node, sourceFile: SourceFile): boolean;
    enclosingCallable(node: Node): Node | undefined;
    valueWrapper(node: Node): boolean;
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    locationFor(node: Node | undefined): SourceStorageSubject | undefined;
    connect(origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined, types?: SourceStorageEdgeTypes): void;
    readonly projections: ReturnType<typeof createSourceStorageProjectionFlow>;
    readonly regions: ReturnType<typeof createSourceStorageExecutionRegions>;
    readonly memberAccessors: ReturnType<typeof createSourceStorageMemberAccessors>;
    readonly storedValues: ReturnType<typeof createSourceStorageStoredValues>;
    writeFor(node: Node): SourceStorageWrite | undefined;
    connectWrite(location: SourceStorageSubject | undefined, value: SourceStorageSubject | undefined): void;
    recordThrow(region: Node, origin: SourceStorageSubject): void;
    inputSlotsFor(invocation: Node): SourceStorageInvocationInputSlots | undefined;
}
/** The per-node collection pass of source storage transport: subjects, edges, writes, invocations and their transports. */
export declare function createSourceStorageSyntaxCollection(context: SourceStorageSyntaxCollectionContext): Readonly<{
    visit: (node: Node) => void;
    publishInvocationInputs: (node: Node) => void;
}>;
//# sourceMappingURL=syntax-collection.d.ts.map