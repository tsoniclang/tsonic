import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageVariable } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";
interface SourceStorageIncomingCallSite {
    readonly invocation: Node;
    readonly caller: Node;
    readonly callback?: SourceStorageCallbackEntry;
}
export declare function createSourceStorageScopedRecursion(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, invocationInputs: SourceStorageInvocationInputQuery): Readonly<{
    ownerFor: (invocation: Node) => Node | undefined;
    entryInputFor: (origin: SourceStorageSubject, variable: SourceStorageVariable) => SourceStorageSubject | undefined;
    componentFor: (candidate: Node) => ReadonlySet<Node> | undefined;
    incomingFor: (candidate: Node) => readonly SourceStorageIncomingCallSite[] | undefined;
}>;
export type SourceStorageScopedRecursion = ReturnType<typeof createSourceStorageScopedRecursion>;
export {};
//# sourceMappingURL=scoped-recursion.d.ts.map