import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScope, SourceStorageTerm, SourceStorageScopedSubject, SourceStorageProjectionReceiver, SourceStorageRelationWitness } from "../graph/scoped-model.js";
import { type SourceStorageInputWalkBoundary } from "./relation-evaluation.js";
export declare const sourceStorageMissingProducerReason = "A demanded source storage relation has no completed correlated producer or absence proof.";
type SourceStorageWalkBoundary = SourceStorageInputWalkBoundary | ((subject: SourceStorageScopedSubject & {
    readonly original: boolean;
}) => boolean);
export declare function createSourceStorageSubstitutions(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, graphQueries: ReturnType<typeof createSourceStorageGraphQueries>): Readonly<{
    empty: import("../graph/scoped-model.js").SourceStorageFrame;
    withQuery: <Value>(collect: () => Value) => Value;
    values: (origin: SourceStorageSubject, scope: SourceStorageScope) => ReadonlySet<SourceStorageScopedSubject> | undefined;
    projectedValues: (receiver: SourceStorageProjectionReceiver) => ReadonlySet<SourceStorageScopedSubject> | undefined;
    origins: (origin: SourceStorageSubject, scope: SourceStorageScope) => ReadonlySet<SourceStorageSubject> | undefined;
    provenance: (origin: SourceStorageSubject, scope: SourceStorageScope) => Readonly<{
        origins: Set<SourceStorageSubject>;
        reason: string | undefined;
        fatalReason: string | undefined;
    }> | undefined;
    trace: (origin: SourceStorageSubject, scope: SourceStorageScope) => readonly SourceStorageRelationWitness[] | undefined;
    walk: (origin: SourceStorageSubject, scope: SourceStorageScope, boundary?: SourceStorageWalkBoundary, preserveValuePath?: boolean) => Readonly<{
        subjects: readonly (SourceStorageRelationWitness & {
            readonly original: boolean;
        })[];
        origins: Set<SourceStorageSubject>;
        reason: string | undefined;
        fatalReason: string | undefined;
        demandReason: string | undefined;
        absence: boolean;
        effectFrontiers: readonly {
            readonly kind: "unresolved";
            readonly subject: SourceStorageSubject;
            readonly scope: SourceStorageScope;
            readonly reason: string;
            readonly exposure?: Node;
            readonly executionOnly?: true;
            readonly effectOnly?: true;
            readonly demandFailure?: true;
        }[];
        emptyDemands: readonly SourceStorageTerm[];
    }> | undefined;
    frontier: (origin: SourceStorageSubject, scope: SourceStorageScope, boundaries: ReadonlySet<SourceStorageSubject>, position: "value" | "input") => {
        reason: string;
        subjects: never[];
    } | {
        subjects: readonly (SourceStorageScopedSubject & {
            readonly kind: "boundary" | "origin";
        })[];
        reason: undefined;
    } | undefined;
    selection: (origin: SourceStorageSubject, scope: SourceStorageScope) => readonly SourceStorageScopedSubject[] | undefined;
    contributingExecutions: (origin: SourceStorageSubject, declaration: Node, creation: SourceStorageScope, entry: "callable" | "generator-result") => Readonly<{
        subjects: readonly SourceStorageScopedSubject[];
        boundaries: readonly {
            readonly kind: "unresolved";
            readonly subject: SourceStorageSubject;
            readonly scope: SourceStorageScope;
            readonly reason: string;
            readonly exposure?: Node;
            readonly executionOnly?: true;
            readonly effectOnly?: true;
            readonly demandFailure?: true;
        }[];
        reason: string | undefined;
    }> | undefined;
    forLexicalOwner: (node: Node) => SourceStorageScope | undefined;
    formals: (scope: SourceStorageScope) => ReadonlySet<SourceStorageSubject> | undefined;
    invocationContextKeyFor(invocation: Node, bindings: readonly SourceStorageScope[]): string | undefined;
    contextKeyFor(subjects: readonly SourceStorageSubject[], bindings: readonly SourceStorageScope[]): string | undefined;
    boundActivation: (scope: SourceStorageScope, owner: Node) => {
        readonly scope: SourceStorageScope;
        readonly invocation?: Node;
        readonly caller?: SourceStorageScope;
        readonly nativeEntry?: {
            readonly invocation: Node;
            readonly callback: import("../model/types.js").SourceStorageCallbackEntry;
            readonly caller: SourceStorageScope;
        };
    } | undefined;
    creationKeyFor: (subject: SourceStorageSubject, bindings: SourceStorageScope) => string | undefined;
    ownerScope: (scope: SourceStorageScope, owner: Node) => SourceStorageScope | undefined;
    isBound: (origin: SourceStorageSubject, scope: SourceStorageScope) => boolean;
    forDeclaration: (owner: Node, parent: SourceStorageScope) => import("../graph/scoped-model.js").SourceStorageFrame | undefined;
    forInvocation: (candidate: Node, invocation: Node, caller: SourceStorageScope, captured: SourceStorageScope, callee: SourceStorageSubject | undefined) => SourceStorageScope | undefined;
    identityFor: (value: object) => number;
}>;
export {};
//# sourceMappingURL=substitutions.d.ts.map