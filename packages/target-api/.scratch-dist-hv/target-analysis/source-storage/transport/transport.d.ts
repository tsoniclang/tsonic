import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import { type SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageInvocationInputSelectionQuery } from "../graph/invocation-inputs.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageArgumentTransport, SourceStorageBoundary, SourceStorageCallEffect, SourceStorageEffects, SourceStorageCallbackEntry, SourceStorageInvocationInputSlots } from "../model/types.js";
export declare function createSourceStorageTransport(source: SourceAnalysisProgram, sourceFiles: readonly SourceFile[], budget: SourceStorageBudget, effects?: SourceStorageEffects): {
    subject: import("../model/subjects.js").SourceStorageSubjectQuery;
    subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined;
    nativeConstructorsFor: (subject: SourceStorageSubject) => readonly Node[] | undefined;
    locationFor: (node: Node | undefined) => SourceStorageSubject | undefined;
    declarationIsAmbient: (declaration: Node) => boolean | undefined;
    storageSubject: (node: Node, projection?: readonly import("../model/subjects.js").SourceStorageProjection[]) => SourceStorageSubject | undefined;
    incomingFor: import("../graph/edges.js").SourceStorageIncomingQuery;
    identities: Set<SourceStorageSubject>;
    mutationOwners: Map<Node, SourceStorageSubject>;
    storedInputsFor: (storage: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined;
    storedValuesFor: (selected: SourceStorageSubject) => readonly import("../graph/store-projections.js").SourceStorageStoredProjection[] | undefined;
    storesFor: (storage: SourceStorageSubject) => Iterable<import("../model/stores.js").SourceStorageStore> | undefined;
    storesIn: (region: Node) => Iterable<import("../model/stores.js").SourceStorageStore> | undefined;
    writeAt: (reference: Node) => import("../model/types.js").SourceStorageWriteOccurrence | undefined;
    formalMemberWriteDemand: (declaration: Node, parameter: Node) => import("../model/types.js").SourceStorageFormalMemberWriteDemandSelection;
    sealFormalMemberWriteDemands: () => void;
    invocationImplementationSelection: (invocation: Node, originsFor?: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined) => Readonly<{
        nodes: ReadonlySet<Node>;
        exact: boolean;
        sourceOwned: boolean;
        sourceConstruction: boolean;
        inputs: readonly SourceStorageInvocationInputSlots[];
    }> | undefined;
    inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
    callbackImplementationSelection: (entry: SourceStorageCallbackEntry) => {
        readonly nodes: ReadonlySet<Node>;
        readonly exact: boolean;
        readonly sourceOwned: boolean;
        readonly sourceConstruction: boolean;
        readonly inputs: readonly SourceStorageInvocationInputSlots[];
    } | undefined;
    unresolvedStoredInputsFor: (storage: SourceStorageSubject) => string | undefined;
    sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined;
    retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean;
    checkedDeclarations: Map<Node, SourceFile>;
    invocationTargets: Map<Node, SourceStorageSubject>;
    invocations: Set<Node>;
    pointerInvocations: Set<Node>;
    pointerAccessors: (key: Node) => ReadonlySet<Node> | undefined;
    resumedImplementations: (key: Node) => ReadonlySet<Node> | undefined;
    invocationEffects: Map<Node, SourceStorageCallEffect>;
    invocationArguments: Map<Node, readonly Node[]>;
    invocationDeclarations: Map<Node, Node>;
    argumentTransports: Map<Node, readonly SourceStorageArgumentTransport[]>;
    unresolvedInvocations: Map<Node, string>;
    boundaries: SourceStorageBoundary[];
    callbackEntriesFor: (invocation: Node) => readonly SourceStorageCallbackEntry[];
    callbackImplementationsFor: (entry: SourceStorageCallbackEntry) => ReadonlySet<Node>;
    invocationInputs: import("../graph/invocation-inputs.js").SourceStorageInvocationInputQuery;
    accessorTargets: Map<Node, readonly import("../graph/scoped-model.js").SourceStorageAccessorInvocation[]>;
    visitedNodes: Node[];
    hasNode: (node: Node) => boolean;
    regions: Readonly<{
        enclosing: (node: Node) => Node | undefined;
        catchDestination: (node: Node) => Node | undefined;
        callable: (declaration: Node, invocation: Node | undefined, argumentTypes?: (expression: Node) => readonly import("../../../source-semantics/descriptor-model.js").SourceTypeDescriptor[] | undefined, callback?: SourceStorageCallbackEntry, actualTypes?: readonly (readonly import("../../../source-semantics/descriptor-model.js").SourceTypeDescriptor[] | undefined)[], phase?: "call" | "active") => readonly Node[];
        instance: (invocation: Node) => {
            readonly regions: readonly import("../model/types.js").SourceStorageInstanceRegion[];
            readonly exact: boolean;
        } | undefined;
        recordInvocation(invocation: Node): void;
        invocationRegions: () => Iterable<Node>;
        invocationsIn(region: Node): Iterable<Node> | undefined;
        seal(): void;
    }>;
    memberFlow: Readonly<{
        memberFor: (owner: SourceStorageSubject, declaration: Node, receiverType: import("../../../source-semantics/descriptor-model.js").SourceTypeDescriptor) => import("../../../public/source.js").SourceMemberPair | undefined;
        membersInLineage: <Bindings>(lineage: import("../model/construction.js").SourceStorageClassLineage<Bindings>, declaration: Node, destinationType: import("../../../source-semantics/descriptor-model.js").SourceTypeDescriptor) => {
            readonly members: readonly {
                readonly declaration: Node;
                readonly bindings: Bindings;
            }[];
            readonly absent: boolean;
        } | undefined;
        declarationsFor: (owner: SourceStorageSubject, declaration: Node, receiverType: import("../../../source-semantics/descriptor-model.js").SourceTypeDescriptor) => readonly Node[] | undefined;
        excludes: (owner: SourceStorageSubject, destinationType: import("../../../source-semantics/descriptor-model.js").SourceTypeDescriptor) => boolean;
        copyContributionFor: (owner: SourceStorageSubject, declaration: Node, destinationType: import("../../../source-semantics/descriptor-model.js").SourceTypeDescriptor, before: Node) => {
            readonly kind: "own";
            readonly declaration: Node;
        } | {
            readonly kind: "spread";
            readonly expression: Node;
            readonly components: readonly import("../model/subjects.js").SourceStorageProjection[];
            readonly evaluation: Node;
            readonly definite: boolean;
        } | {
            readonly kind: "absent";
        } | undefined;
        memberStorageKindFor: (owner: SourceStorageSubject, declaration: Node, destinationType: import("../../../source-semantics/descriptor-model.js").SourceTypeDescriptor) => "direct" | "copied" | "absent" | undefined;
        spreadMembersFor: (expression: Node, evaluation: Node) => readonly import("../graph/member-flow.js").SourceStorageSpreadMember[] | undefined;
        componentsFor: (owner: SourceStorageSubject) => readonly import("../model/subjects.js").SourceStorageProjection[] | undefined;
        membersFor: (owner: SourceStorageSubject, destinationType: import("../../../source-semantics/descriptor-model.js").SourceTypeDescriptor) => readonly import("../../../public/source.js").SourceMemberPair[] | undefined;
    }>;
    guardedValues: Readonly<{
        appliesTo: (reference: Node) => boolean | undefined;
        admits: (owner: SourceStorageSubject, reference: Node) => boolean | undefined;
        conjoin: (existing: import("../graph/guarded-values.js").SourceStorageValueGuards | undefined, reference: Node) => import("../graph/guarded-values.js").SourceStorageValueGuards | null | undefined;
    }>;
    ancestorSubjects: (key: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined;
    invocationImplementations: (invocation: Node, originsFor?: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined) => ReadonlySet<Node>;
    hasOnlySourceImplementations: (invocation: Node) => boolean;
    physicalMemberInputs: (invocation: Node, originsFor?: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined) => ReadonlySet<SourceStorageSubject> | undefined;
    invocationOrigins: (origin: SourceStorageSubject, candidate: Node, invocation: Node) => ReadonlySet<SourceStorageSubject> | undefined;
    invocationResults: import("./invocation-results.js").SourceStorageInvocationResultQueriesContract;
    substitutions: Readonly<{
        empty: import("../graph/scoped-model.js").SourceStorageFrame;
        withQuery: <Value>(collect: () => Value) => Value;
        values: (origin: SourceStorageSubject, scope: import("../graph/scoped-model.js").SourceStorageScope) => ReadonlySet<import("../graph/scoped-model.js").SourceStorageScopedSubject> | undefined;
        projectedValues: (receiver: import("../graph/scoped-model.js").SourceStorageProjectionReceiver) => ReadonlySet<import("../graph/scoped-model.js").SourceStorageScopedSubject> | undefined;
        origins: (origin: SourceStorageSubject, scope: import("../graph/scoped-model.js").SourceStorageScope) => ReadonlySet<SourceStorageSubject> | undefined;
        provenance: (origin: SourceStorageSubject, scope: import("../graph/scoped-model.js").SourceStorageScope) => Readonly<{
            origins: Set<SourceStorageSubject>;
            reason: string | undefined;
            fatalReason: string | undefined;
        }> | undefined;
        trace: (origin: SourceStorageSubject, scope: import("../graph/scoped-model.js").SourceStorageScope) => readonly import("../graph/scoped-model.js").SourceStorageRelationWitness[] | undefined;
        walk: (origin: SourceStorageSubject, scope: import("../graph/scoped-model.js").SourceStorageScope, boundary?: import("../scoped/relation-evaluation.js").SourceStorageInputWalkBoundary | ((subject: import("../graph/scoped-model.js").SourceStorageScopedSubject & {
            readonly original: boolean;
        }) => boolean), preserveValuePath?: boolean) => Readonly<{
            subjects: readonly (import("../graph/scoped-model.js").SourceStorageRelationWitness & {
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
                readonly scope: import("../graph/scoped-model.js").SourceStorageScope;
                readonly reason: string;
                readonly exposure?: Node;
                readonly executionOnly?: true;
                readonly effectOnly?: true;
                readonly demandFailure?: true;
            }[];
            emptyDemands: readonly import("../graph/scoped-model.js").SourceStorageTerm[];
        }> | undefined;
        frontier: (origin: SourceStorageSubject, scope: import("../graph/scoped-model.js").SourceStorageScope, boundaries: ReadonlySet<SourceStorageSubject>, position: "value" | "input") => {
            reason: string;
            subjects: never[];
        } | {
            subjects: readonly (import("../graph/scoped-model.js").SourceStorageScopedSubject & {
                readonly kind: "boundary" | "origin";
            })[];
            reason: undefined;
        } | undefined;
        selection: (origin: SourceStorageSubject, scope: import("../graph/scoped-model.js").SourceStorageScope) => readonly import("../graph/scoped-model.js").SourceStorageScopedSubject[] | undefined;
        contributingExecutions: (origin: SourceStorageSubject, declaration: Node, creation: import("../graph/scoped-model.js").SourceStorageScope, entry: "callable" | "generator-result") => Readonly<{
            subjects: readonly import("../graph/scoped-model.js").SourceStorageScopedSubject[];
            boundaries: readonly {
                readonly kind: "unresolved";
                readonly subject: SourceStorageSubject;
                readonly scope: import("../graph/scoped-model.js").SourceStorageScope;
                readonly reason: string;
                readonly exposure?: Node;
                readonly executionOnly?: true;
                readonly effectOnly?: true;
                readonly demandFailure?: true;
            }[];
            reason: string | undefined;
        }> | undefined;
        forLexicalOwner: (node: Node) => import("../graph/scoped-model.js").SourceStorageScope | undefined;
        formals: (scope: import("../graph/scoped-model.js").SourceStorageScope) => ReadonlySet<SourceStorageSubject> | undefined;
        invocationContextKeyFor(invocation: Node, bindings: readonly import("../graph/scoped-model.js").SourceStorageScope[]): string | undefined;
        contextKeyFor(subjects: readonly SourceStorageSubject[], bindings: readonly import("../graph/scoped-model.js").SourceStorageScope[]): string | undefined;
        boundActivation: (scope: import("../graph/scoped-model.js").SourceStorageScope, owner: Node) => {
            readonly scope: import("../graph/scoped-model.js").SourceStorageScope;
            readonly invocation?: Node;
            readonly caller?: import("../graph/scoped-model.js").SourceStorageScope;
            readonly nativeEntry?: {
                readonly invocation: Node;
                readonly callback: SourceStorageCallbackEntry;
                readonly caller: import("../graph/scoped-model.js").SourceStorageScope;
            };
        } | undefined;
        creationKeyFor: (subject: SourceStorageSubject, bindings: import("../graph/scoped-model.js").SourceStorageScope) => string | undefined;
        ownerScope: (scope: import("../graph/scoped-model.js").SourceStorageScope, owner: Node) => import("../graph/scoped-model.js").SourceStorageScope | undefined;
        isBound: (origin: SourceStorageSubject, scope: import("../graph/scoped-model.js").SourceStorageScope) => boolean;
        forDeclaration: (owner: Node, parent: import("../graph/scoped-model.js").SourceStorageScope) => import("../graph/scoped-model.js").SourceStorageFrame | undefined;
        forInvocation: (candidate: Node, invocation: Node, caller: import("../graph/scoped-model.js").SourceStorageScope, captured: import("../graph/scoped-model.js").SourceStorageScope, callee: SourceStorageSubject | undefined) => import("../graph/scoped-model.js").SourceStorageScope | undefined;
        identityFor: (value: object) => number;
    }>;
    contextualInputs: ((origin: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined) & {
        applicationFor: (subject: SourceStorageSubject) => import("../graph/context-footprints.js").SourceStorageContextFootprint | undefined;
    };
    contextLocation: (subject: SourceStorageSubject) => import("../graph/context-locations.js").SourceStorageContextLocation | undefined;
    classLineagesFor: (expression: Node | undefined, originsFor?: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined, mode?: "heritage") => readonly import("../model/construction.js").SourceStorageClassLineage<undefined>[] | undefined;
    constructionLineagesFor: (invocation: Node, originsFor?: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined, mode?: "heritage") => readonly import("../model/construction.js").SourceStorageClassLineage<undefined>[] | undefined;
    unresolvedFor: (selected: SourceStorageSubject) => string | undefined;
    directlyUnresolvedFor: (selected: SourceStorageSubject) => string | undefined;
};
//# sourceMappingURL=transport.d.ts.map