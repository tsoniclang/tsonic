import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import type { SourceStorageInvocationInputSelectionQuery } from "../graph/invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
import type { SourceStorageCreationContext } from "./activation-keys.js";
import type { SourceStorageEquation, SourceStorageFrame, SourceStorageFrameInput, SourceStorageScopeBinding, SourceStorageReference, SourceStorageInputFrontier, SourceStorageScope, SourceStorageScopeParameter, SourceStorageTerm, SourceStorageVariable } from "../graph/scoped-model.js";
export declare function createSourceStorageScopes(source: SourceAnalysisProgram, budget: SourceStorageBudget, subject: SourceStorageSubjectQuery, invocationInputs: SourceStorageInvocationInputQuery, graphQueries: ReturnType<typeof createSourceStorageGraphQueries>, entryInputFor: (origin: SourceStorageSubject, variable: SourceStorageVariable) => SourceStorageSubject | undefined, creation: SourceStorageCreationContext, inputSlotsFor: SourceStorageInvocationInputSelectionQuery): Readonly<{
    empty: SourceStorageFrame;
    identity: (value: object) => number;
    callbackKey: (callback: SourceStorageCallbackEntry | undefined) => string;
    variable: (equation: SourceStorageEquation, owner: Node, capture?: Node, callback?: SourceStorageCallbackEntry) => SourceStorageVariable | undefined;
    variablesFor: import("../model/relations.js").SourceStorageFixedPointQuery<SourceStorageScope, SourceStorageScope>;
    applyScope: (scope: SourceStorageScope, replacements: ReadonlyMap<SourceStorageScopeParameter, SourceStorageScope>) => SourceStorageScope | undefined;
    applyTerm: (term: SourceStorageTerm, replacements: ReadonlyMap<SourceStorageScopeParameter, SourceStorageScope>) => SourceStorageTerm | undefined;
    lookup: (origin: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageScopeBinding | undefined;
    inputBase: (origin: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageSubject | undefined;
    frameFor: (candidate: Node, invocation: Node, parent: SourceStorageScope, captured: SourceStorageScope, equation?: SourceStorageEquation, callback?: SourceStorageCallbackEntry) => SourceStorageFrame | undefined;
    enterApplication: (term: Extract<SourceStorageTerm, {
        readonly kind: "application";
    }>, candidate: Node, callee: SourceStorageReference | SourceStorageInputFrontier) => import("../graph/scoped-model.js").SourceStorageReduction | undefined;
    declarationFor: (owner: Node, parent: SourceStorageScope) => SourceStorageFrame | undefined;
    executionRoots: (scope: SourceStorageScope) => readonly {
        readonly owner: Node;
        readonly scope: SourceStorageScope;
        readonly invocation?: Node;
        readonly callback?: SourceStorageCallbackEntry;
    }[] | undefined;
    isDeferred: (scope: SourceStorageScope) => boolean;
    isSymbolic: (value: SourceStorageReference | SourceStorageInputFrontier) => boolean;
    owningScope: (scope: SourceStorageScope, owner: Node) => SourceStorageScope | undefined;
    boundActivation: (scope: SourceStorageScope, owner: Node) => {
        readonly scope: SourceStorageScope;
        readonly invocation?: Node;
        readonly caller?: SourceStorageScope;
        readonly nativeEntry?: {
            readonly invocation: Node;
            readonly callback: SourceStorageCallbackEntry;
            readonly caller: SourceStorageScope;
        };
    } | undefined;
    project: (entry: SourceStorageFrameInput["values"][number] | Extract<SourceStorageTerm, {
        readonly kind: "input-frontier";
    }>, origin: SourceStorageSubject, retain: (cost: number) => boolean, selectedRoot: SourceStorageSubject | undefined, selectionScope: SourceStorageScope) => readonly SourceStorageTerm[] | undefined;
    family: (scope: SourceStorageScope) => SourceStorageEquation | undefined;
    activation: (scope: SourceStorageScope) => import("../graph/scoped-model.js").SourceStorageActivation | undefined;
    activationKey: (scope: SourceStorageScope) => string | undefined;
    formals: (scope: SourceStorageScope) => ReadonlySet<SourceStorageSubject> | undefined;
    withQuery: <Value>(collect: () => Value) => Value;
    withTraversal: <Value>(collect: () => Value) => Value;
}>;
export type SourceStorageScopes = ReturnType<typeof createSourceStorageScopes>;
//# sourceMappingURL=scoped-scopes.d.ts.map