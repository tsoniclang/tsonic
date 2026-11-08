import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { type SourceStorageSubject, type SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageStore } from "../model/stores.js";
import type { createSourceStorageExecutionReachability } from "./execution-reachability.js";
import { type SourceStorageActivation, type SourceStorageReduction, type SourceStorageScope, type SourceStorageTerm, type SourceStorageReference, type SourceStorageInputFrontier, type SourceStorageOperation } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { sourceStorageClassLineages, SourceStorageClassValue } from "../model/construction.js";
import type { SourceStorageScopedSubject } from "../graph/scoped-model.js";
import type { SourceStorageProjectionView } from "../graph/scoped-model.js";
import type { SourceStorageChildContext, SourceStoragePendingReduction } from "./child-reduction.js";
/** A read of one store's effects from a demand, as the scoped successors select it. */
export type SourceStorageEffectSelection = {
    readonly kind: "general";
    readonly execution?: SourceStorageTerm;
} | {
    readonly kind: "own-construction";
    readonly execution: SourceStorageTerm;
};
/** The scoped-successor values the member reductions read; built once by createSourceStorageScopedSuccessors. */
export interface SourceStorageMemberSuccessorContext {
    readonly source: SourceAnalysisProgram;
    readonly budget: SourceStorageBudget;
    readonly transport: SourceStorageScopedTransport;
    readonly scopes: SourceStorageScopes;
    readonly reachability: ReturnType<typeof createSourceStorageExecutionReachability>;
    birth(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageActivation | undefined;
    readRelation(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    initialize(value: SourceStorageSubject, scope: SourceStorageScope): SourceStorageTerm | undefined;
    pointerWrites(destination: SourceStorageReference, store: SourceStorageStore, projection: readonly SourceStorageProjection[], scope: SourceStorageScope): readonly SourceStorageTerm[] | undefined;
    readEffects(store: SourceStorageStore, selection: SourceStorageEffectSelection, deferred?: boolean, context?: SourceStorageScope): Iterable<SourceStorageTerm>;
    leaf(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference;
    outside(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference | undefined;
    creatorScope(node: Node, scope: SourceStorageScope): SourceStorageScope;
    passiveMember(declaration: Node): boolean;
    regionsFor(candidate: Node, invocation: Node, scope: SourceStorageScope, demand: Node, construction?: {
        readonly caller: SourceStorageScope;
        readonly classes: readonly SourceStorageScopedSubject[];
    }, deferred?: boolean): readonly SourceStorageTerm[] | undefined;
    application(invocation: Node, target: SourceStorageSubject, scope: SourceStorageScope, projection: readonly SourceStorageProjection[], operation: SourceStorageOperation): SourceStorageTerm;
    classLineages(value: SourceStorageReference, mode?: "heritage"): ReturnType<typeof sourceStorageClassLineages<SourceStorageClassValue<SourceStorageScope>["bindings"]>>;
    materializeChild(child: SourceStorageTerm, select: (child: SourceStorageReference | SourceStorageInputFrontier) => readonly SourceStorageTerm[] | undefined, independentCallee?: Node): Extract<SourceStorageReduction, {
        readonly kind: "project";
    }>;
    replaceChild(child: SourceStorageTerm, replace: (child: SourceStorageTerm) => SourceStorageTerm, context?: SourceStorageChildContext): SourceStoragePendingReduction | undefined;
}
/** Member reads and symbolic projections of the scoped successors. */
export declare function createSourceStorageMemberSuccessors(context: SourceStorageMemberSuccessorContext): Readonly<{
    member: (term: Extract<SourceStorageTerm, {
        readonly kind: "member";
    }>, correlated: boolean) => SourceStoragePendingReduction | undefined;
    symbolicProjection: (subject: SourceStorageSubject, scope: SourceStorageScope, frontier?: SourceStorageInputFrontier, views?: readonly SourceStorageProjectionView[] | undefined) => SourceStorageReduction | undefined;
}>;
//# sourceMappingURL=scoped-member-successors.d.ts.map