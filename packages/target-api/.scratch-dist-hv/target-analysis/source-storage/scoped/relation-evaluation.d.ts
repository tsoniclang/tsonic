import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
import type { SourceStorageForwardSelection } from "../model/relations.js";
import type { createSourceStorageScopes } from "./scoped-scopes.js";
import type { createSourceStorageScopedKeys } from "./scoped-keys.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import type { createSourceStorageExecutionReachability } from "./execution-reachability.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScope, SourceStorageTerm, SourceStorageScopedSubject } from "../graph/scoped-model.js";
import type { SourceStorageCreationContext } from "./activation-keys.js";
declare const sourceStorageRelationKey: unique symbol;
export declare const sourceStorageRelationData: unique symbol;
export declare function sourceStorageIsTerminalValue(term: SourceStorageTerm): boolean;
export type SourceStorageInputWalkBoundary = {
    readonly kind: "input";
    admits(subject: SourceStorageScopedSubject & {
        readonly original: boolean;
    }): boolean;
};
export type SourceStorageRelation = SourceStorageTerm & {
    readonly [sourceStorageRelationKey]: string;
    readonly [sourceStorageRelationData]: SourceStorageRelationState;
};
type SourceStorageRelationState = Map<SourceStorageRelation, number> & {
    witnesses?: Map<SourceStorageScope, Map<SourceStorageSubject, number>>;
    filter?: {
        readonly reference: Node;
        readonly input: SourceStorageRelation;
    };
    forwardProjection?: (value: SourceStorageTerm) => readonly SourceStorageForwardSelection<SourceStorageRelation, SourceStorageTerm>[] | undefined;
    complete: boolean;
    instantiation?: {
        readonly input: SourceStorageRelation;
        readonly substitutions: ReadonlyMap<SourceStorageScope, SourceStorageScope>;
    };
};
export declare function createSourceStorageRelationEvaluation(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, scopes: ReturnType<typeof createSourceStorageScopes>, equations: ReturnType<typeof createSourceStorageEquations>, reachability: ReturnType<typeof createSourceStorageExecutionReachability>, keys: ReturnType<typeof createSourceStorageScopedKeys>, evaluationQueries: ReturnType<typeof createSourceStorageGraphQueries>, creation: SourceStorageCreationContext, boundary?: SourceStorageInputWalkBoundary): {
    intern: (term: SourceStorageTerm) => SourceStorageRelation | undefined;
    derive: (relation: SourceStorageRelation, read: (relation: SourceStorageRelation) => ReadonlySet<SourceStorageTerm> | undefined, emit: (relation: SourceStorageRelation, direct: boolean) => boolean, project: (input: SourceStorageRelation, select: (value: SourceStorageTerm) => readonly SourceStorageRelation[] | undefined) => boolean) => boolean;
    results: import("../model/relations.js").SourceStorageFixedPointQuery<SourceStorageRelation, SourceStorageTerm>;
    witnessScope: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageScope;
    release: () => void;
};
export {};
//# sourceMappingURL=relation-evaluation.d.ts.map