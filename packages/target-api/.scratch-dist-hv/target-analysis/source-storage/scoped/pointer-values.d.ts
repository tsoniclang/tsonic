import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageReference, SourceStorageReduction, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageStore } from "../model/stores.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
interface SourceStoragePointerQueries {
    read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    readEffects(store: SourceStorageStore, selection: {
        readonly kind: "general";
    }, deferred: boolean, scope: SourceStorageScope): Iterable<SourceStorageTerm>;
    deferred(scope: SourceStorageScope): boolean;
    isSymbolic(value: SourceStorageReference): boolean;
    creatorScope(node: SourceStorageReference["subject"]["node"], scope: SourceStorageScope): SourceStorageScope;
}
export declare function createSourceStoragePointerValues(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, queries: SourceStoragePointerQueries): Readonly<{
    reduce: (term: SourceStorageReference) => SourceStorageReduction | undefined;
    operation: (term: Extract<SourceStorageTerm, {
        readonly kind: "pointer";
    }>) => SourceStorageReduction | undefined;
    writes: (destination: SourceStorageReference, store: SourceStorageStore, projection: readonly SourceStorageProjection[], context: SourceStorageScope) => readonly SourceStorageTerm[] | undefined;
    locations: Readonly<{
        address: (operation: Extract<import("../model/host-reads.js").SourceStoragePointerOperation, {
            readonly operation: "address-of";
        }>, scope: SourceStorageScope) => readonly (import("../graph/scoped-model.js").SourceStorageInputFrontier | SourceStorageReference | {
            readonly kind: "unresolved";
            readonly subject: import("../model/subjects.js").SourceStorageSubject;
            readonly scope: SourceStorageScope;
            readonly reason: string;
            readonly exposure?: Node;
            readonly executionOnly?: true;
            readonly effectOnly?: true;
            readonly demandFailure?: true;
        } | {
            readonly kind: "empty";
            readonly absence: SourceStorageReference | undefined;
        })[] | undefined;
        identities: (pointer: SourceStorageReference) => readonly (import("../graph/scoped-model.js").SourceStorageInputFrontier | SourceStorageReference | {
            readonly kind: "unresolved";
            readonly subject: import("../model/subjects.js").SourceStorageSubject;
            readonly scope: SourceStorageScope;
            readonly reason: string;
            readonly exposure?: Node;
            readonly executionOnly?: true;
            readonly effectOnly?: true;
            readonly demandFailure?: true;
        } | {
            readonly kind: "empty";
            readonly absence: SourceStorageReference | undefined;
        })[] | undefined;
    }>;
    execution: (invocation: Node, scope: SourceStorageScope, demand: Node, deferred?: boolean, mode?: "execution" | "throw") => readonly SourceStorageTerm[] | undefined;
}>;
export {};
//# sourceMappingURL=pointer-values.d.ts.map