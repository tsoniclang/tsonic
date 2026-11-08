import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageStore } from "../model/stores.js";
import type { SourceStorageScope, SourceStorageTerm, SourceStorageReference, SourceStorageInputFrontier, SourceStorageOperation, SourceStorageScopedSubject } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import { type createSourceStorageExecutionReachability } from "./execution-reachability.js";
export declare function createSourceStorageExecutionContext(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, reachability: ReturnType<typeof createSourceStorageExecutionReachability>, readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined): Readonly<{
    readEffects: (store: SourceStorageStore, selection: {
        readonly kind: "general";
        readonly execution?: SourceStorageTerm;
    } | {
        readonly kind: "own-construction";
        readonly execution: SourceStorageTerm;
    }, deferred?: boolean, context?: SourceStorageScope) => Generator<{
        readonly kind: "unresolved";
        readonly subject: SourceStorageSubject;
        readonly scope: SourceStorageScope;
        readonly reason: string;
        readonly exposure?: Node;
        readonly executionOnly?: true;
        readonly effectOnly?: true;
        readonly demandFailure?: true;
    } | {
        readonly kind: "effect";
        readonly store: SourceStorageStore;
        readonly scope: SourceStorageScope;
    }, void, unknown>;
    creatorScope: (node: Node, scope: SourceStorageScope) => SourceStorageScope;
    leaf: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageReference;
    symbolicInput: (subject: SourceStorageSubject, scope: SourceStorageScope) => boolean;
    classLineages: (value: SourceStorageReference | SourceStorageInputFrontier, mode?: "heritage") => readonly import("../model/construction.js").SourceStorageClassLineage<SourceStorageScope>[] | undefined;
    instanceCaptures: (candidate: Node, value: SourceStorageReference) => ReadonlySet<import("../model/construction.js").SourceStorageClassValue<SourceStorageScope>> | undefined;
    application: (invocation: Node, target: SourceStorageSubject, scope: SourceStorageScope, projection: readonly SourceStorageProjection[], operation: SourceStorageOperation) => SourceStorageTerm;
    dispatchDependencies: (invocation: Node, scope: SourceStorageScope) => readonly SourceStorageTerm[];
    regionsFor: (candidate: Node, invocation: Node, scope: SourceStorageScope, demand: Node, construction?: {
        readonly caller: SourceStorageScope;
        readonly classes: readonly SourceStorageScopedSubject[];
    }, deferred?: boolean, actualTypes?: readonly (readonly SourceTypeDescriptor[] | undefined)[]) => readonly SourceStorageTerm[] | undefined;
    passiveMember: (declaration: Node) => boolean;
    independentCalleeFor: (invocation: Node) => Node | undefined;
}>;
//# sourceMappingURL=execution-context.d.ts.map