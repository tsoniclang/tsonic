import type { Node, Signature, SourceFile, Type } from "@tsonic/tsts";
import type { ResolvedSourceCallInfo, SourceFileSemantics, TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageProjection, SourceStorageSubject } from "./subjects.js";
import type { SourceBindingWriteValue } from "../../../source-navigation/types.js";

export interface SourceStorageLimits {
  readonly maximumNodes: number;
  readonly maximumEdges: number;
  readonly maximumSubjectRows: number;
  readonly maximumTransportRows: number;
  readonly maximumSteps: number;
}

export interface SourceStorageCallEffect {
  readonly resultAlias?: Node;
  readonly resultAllocation?: Node;
  readonly resumeReceiver?: true;
}

export interface SourceStorageEffects {
  readonly call?: (node: Node, selected: ResolvedSourceCallInfo) => SourceStorageCallEffect | undefined;
  readonly nativeConstructorsFor?: (declaration: Node, context: SourceFileSemantics) => readonly Node[] | undefined;
  readonly callbackEntries?: (node: Node, selected: ResolvedSourceCallInfo) => readonly {
    readonly parameterIndex: number;
    readonly timing: "synchronous" | "deferred";
    readonly rejection?: number;
    readonly inputs?: readonly {
      readonly parameterIndex: number;
      readonly from: "receiver-element" | "argument-element" | "receiver-rejection";
      readonly sourceParameterIndex?: number;
    }[];
  }[] | undefined;
}

export interface SourceStorageUnresolved {
  readonly kind: "unresolved";
  readonly reason: string;
}

export type SourceStorageSubjectSelection =
  | { readonly kind: "resolved"; readonly subject: SourceStorageSubject }
  | SourceStorageUnresolved;

export type SourceStorageSubjectsSelection =
  | { readonly kind: "resolved"; readonly subjects: readonly SourceStorageSubject[] }
  | SourceStorageUnresolved;

export interface SourceStorageTypedSubject {
  readonly subject: SourceStorageSubject;
  readonly type: Type;
  readonly sourceFile: SourceFile;
}

export interface SourceStorageWrittenValue {
  readonly source: SourceBindingWriteValue | undefined;
  readonly subjects: readonly SourceStorageSubject[];
  readonly reason: string | undefined;
}

export interface SourceStorageWriteOccurrence {
  readonly reference: Node;
  readonly operation: Node;
  readonly region: Node;
  readonly kind: "initialization" | "mutation";
  readonly destination: "binding" | "member" | "element" | "pointer";
  readonly receiver: SourceStorageSubject | undefined;
  readonly value: SourceStorageSubject | undefined;
  readonly values: readonly SourceStorageWrittenValue[];
  readonly reason: string | undefined;
  readonly destinations: readonly SourceStorageSubject[];
}

export type SourceStorageWriteSelection = SourceStorageUnresolved | {
  readonly kind: "resolved";
  readonly write: SourceStorageWriteOccurrence;
  readonly bindings: SourceStorageBindings;
};

export type SourceStorageMemberWritesSelection = SourceStorageUnresolved
  | { readonly kind: "complete"; readonly writes: readonly SourceStorageWriteOccurrence[] }
  | { readonly kind: "open"; readonly writes: readonly SourceStorageWriteOccurrence[];
      readonly boundaries: readonly Omit<SourceStorageDomainBoundary, "bindings">[] };

export type SourceStorageFormalMemberWriteDemandSelection = SourceStorageUnresolved
  | { readonly kind: "complete"; readonly members: readonly Node[] };

export interface SourceStorageProducer extends SourceStorageTypedSubject {
  readonly bindings: SourceStorageBindings;
}

export type SourceStorageTypeSelection =
  | { readonly kind: "resolved"; readonly type: Type; readonly sourceFile: SourceFile }
  | SourceStorageUnresolved;

export type SourceStorageOriginsSelection =
  | { readonly kind: "resolved"; readonly origins: readonly SourceStorageTypedSubject[] }
  | SourceStorageUnresolved;

export interface SourceStorageDomainBoundary<Bindings = SourceStorageBindings> {
  readonly kind: "external-input" | "external-write" | "opaque-write" | "opaque-result" | "unclassified-exposure";
  readonly subject: SourceStorageSubject;
  readonly exposure: Node;
  readonly owner?: SourceStorageSubject;
  readonly bindings: Bindings;
}

export type SourceStorageClosedOriginsSelection =
  | { readonly kind: "complete"; readonly origins: readonly SourceStorageTypedSubject[] }
  | { readonly kind: "open"; readonly origins: readonly SourceStorageTypedSubject[];
      readonly boundaries: readonly SourceStorageDomainBoundary[] }
  | SourceStorageUnresolved;

export type SourceStorageProducersSelection =
  | { readonly kind: "complete"; readonly producers: readonly SourceStorageProducer[] }
  | { readonly kind: "open"; readonly producers: readonly SourceStorageProducer[];
      readonly boundaries: readonly SourceStorageDomainBoundary[] }
  | SourceStorageUnresolved;

export type SourceStorageNodesSelection =
  | { readonly kind: "resolved"; readonly nodes: readonly Node[] }
  | SourceStorageUnresolved;

export type SourceStorageImplementationsSelection =
  | { readonly kind: "resolved"; readonly nodes: readonly Node[]; readonly exact: boolean;
      readonly inputs: readonly SourceStorageInvocationInputSlots[] }
  | SourceStorageUnresolved;

export interface SourceStorageCallableInputSlot {
  readonly parameter: Node;
  readonly sourceParameterIndex: number;
  readonly effectiveIndex: number;
  readonly repeated: boolean;
  readonly projection: readonly SourceStorageProjection[] | undefined;
}

export type SourceStorageInputSlotsSelection =
  | { readonly kind: "resolved"; readonly slots: readonly SourceStorageCallableInputSlot[] }
  | SourceStorageUnresolved;

export type SourceStorageInvocationInputSlots = {
  readonly signature: Signature | undefined;
  readonly selectedDeclaration: Node | undefined;
  readonly selected: SourceStorageInputSlotsSelection;
  readonly implementation: { readonly kind: "resolved" } | SourceStorageUnresolved;
  readonly implementations: readonly {
    readonly declaration: Node;
    readonly selected: SourceStorageInputSlotsSelection;
  }[];
} & (
  | { readonly kind: "call" | "construct"; readonly invocation: Node }
  | { readonly kind: "getter" | "setter"; readonly invocation: Node; readonly accessor: Node; readonly value: Node | undefined }
  | { readonly kind: "native-callback"; readonly entry: SourceStorageCallbackEntry }
  | { readonly kind: "signature"; readonly declaration: Node }
);

export interface SourceStorageArgumentTransport {
  readonly actual: SourceStorageSubject;
  readonly formal: SourceStorageSubject;
  readonly selectedParameterDeclaration: Node;
  readonly binding: ResolvedSourceCallInfo["sourceArgumentBindings"][number];
}

export interface SourceStorageCallbackEntry {
  readonly kind: "source-storage-callback-entry";
  readonly invocation: Node;
  readonly argument: SourceStorageArgumentTransport;
  readonly timing: "synchronous" | "deferred" | "unknown";
  readonly rejection?: number;
  readonly inputs?: NonNullable<ReturnType<NonNullable<SourceStorageEffects["callbackEntries"]>>>[number]["inputs"];
}

export type SourceStorageArgumentsSelection =
  | { readonly kind: "resolved"; readonly arguments: readonly SourceStorageArgumentTransport[] }
  | { readonly kind: "open"; readonly arguments: readonly SourceStorageArgumentTransport[];
      readonly boundaries: readonly SourceStorageDomainBoundary[] }
  | SourceStorageUnresolved;

export interface SourceStorageBoundary {
  readonly kind: "opaque-invocation" | "unresolved-transport";
  readonly invocation: Node;
  readonly declaration?: Node;
  readonly subjects: readonly SourceStorageSubject[];
  readonly reason?: string;
}

export interface SourceStorageBindings {
  readonly kind: "source-storage-bindings";
}

export type SourceStorageBindingsSelection =
  | { readonly kind: "resolved"; readonly bindings: SourceStorageBindings }
  | SourceStorageUnresolved;

export type SourceStorageBoundActivation =
  | { readonly kind: "declaration"; readonly declaration: Node; readonly bindings: SourceStorageBindings;
      readonly nativeEntry?: { readonly invocation: Node; readonly argument: SourceStorageArgumentTransport;
        readonly callerBindings: SourceStorageBindings } }
  | { readonly kind: "invocation"; readonly declaration: Node; readonly invocation: Node;
      readonly bindings: SourceStorageBindings; readonly callerBindings: SourceStorageBindings };

export type SourceStorageActivationsSelection =
  | { readonly kind: "resolved"; readonly activations: readonly SourceStorageBoundActivation[] }
  | SourceStorageUnresolved;

export interface SourceStorageValueFrontier {
  readonly kind: "boundary" | "origin";
  readonly subject: SourceStorageSubject;
  readonly bindings: SourceStorageBindings;
}

export type SourceStorageValueFrontierSelection =
  | { readonly kind: "resolved"; readonly frontier: readonly SourceStorageValueFrontier[] }
  | SourceStorageUnresolved;

export interface SourceStorageInstanceRegion {
  readonly owner: Node;
  readonly node: Node;
}

export type SourceStorageInstanceRegionsSelection =
  | { readonly kind: "resolved"; readonly regions: readonly SourceStorageInstanceRegion[] }
  | SourceStorageUnresolved;

export interface SourceStorageConstructionClass {
  readonly owner: Node;
  readonly regions: readonly { readonly node: Node;
    readonly selection: Extract<SourceStorageBindingsSelection, { readonly kind: "resolved" }> }[];
}

export type SourceStorageConstructionSelection = SourceStorageUnresolved | {
  readonly kind: "resolved";
  readonly alternatives: readonly {
    readonly root: Node;
    readonly allocation: Node;
    readonly classes: readonly SourceStorageConstructionClass[];
    readonly implementation: {
      readonly declaration: Node;
      readonly body: Node;
      readonly regions: readonly Node[];
      readonly selection: Extract<SourceStorageBindingsSelection, { readonly kind: "resolved" }>;
    } | undefined;
  }[];
};

export interface SourceStorageQueries {
  readonly source: TargetSourceProgram;
  readonly sourceFiles: readonly SourceFile[];
  readonly nodes: readonly Node[];
  readonly subjects: readonly SourceStorageSubject[];
  readonly boundaries: readonly SourceStorageBoundary[];
  readonly invocations: readonly Node[];
  readonly accessorInvocations: readonly Node[];
  readonly emptyBindings: SourceStorageBindings;
  failureReason(): string | undefined;
  subject(node: Node, kind?: SourceStorageSubject["kind"], projection?: readonly SourceStorageProjection[]): SourceStorageSubjectSelection;
  subjectFor(node: Node): SourceStorageSubjectSelection;
  memberSubjectFor(node: Node): SourceStorageSubjectSelection;
  storageSubjectFor(node: Node, projection?: readonly SourceStorageProjection[]): SourceStorageSubjectSelection;
  writeAt(reference: Node, bindings: SourceStorageBindings): SourceStorageWriteSelection;
  memberWritesFor(subject: SourceStorageSubject): SourceStorageMemberWritesSelection;
  formalMemberWriteDemand(declaration: Node, parameter: Node): SourceStorageFormalMemberWriteDemandSelection;
  typeFor(subject: SourceStorageSubject): SourceStorageTypeSelection;
  incomingFor(subject: SourceStorageSubject): SourceStorageSubjectsSelection;
  ancestorsFor(subject: SourceStorageSubject): SourceStorageSubjectsSelection;
  originSubjectsFor(subject: SourceStorageSubject): SourceStorageSubjectsSelection;
  originsFor(subject: SourceStorageSubject): SourceStorageOriginsSelection;
  closedOriginsFor(subject: SourceStorageSubject, bindings?: SourceStorageBindings): SourceStorageClosedOriginsSelection;
  storageProducersFor(subject: SourceStorageSubject, bindings?: SourceStorageBindings): SourceStorageProducersSelection;
  localCallableCreationsFor(expression: Node): SourceStorageNodesSelection;
  unresolvedFor(subject: SourceStorageSubject): string | undefined;
  invocationImplementationsFor(invocation: Node, bindings?: SourceStorageBindings,
    callback?: SourceStorageArgumentTransport): SourceStorageImplementationsSelection;
  invocationOriginsFor(subject: SourceStorageSubject, candidate: Node, invocation: Node): SourceStorageSubjectsSelection;
  bindingsForDeclaration(declaration: Node, parent?: SourceStorageBindings): SourceStorageBindingsSelection;
  bindingsForLexicalOwner(node: Node): SourceStorageBindingsSelection;
  bindingsForInvocation(candidate: Node, invocation: Node, parent?: SourceStorageBindings,
    capture?: Pick<SourceStorageProducer, "subject" | "bindings">): SourceStorageBindingsSelection;
  invocationContextKeyFor(invocation: Node, bindings: SourceStorageBindings):
    { readonly kind: "resolved"; readonly key: string } | SourceStorageUnresolved;
  contextKeyFor(subjects: readonly SourceStorageSubject[], bindings: SourceStorageBindings):
    { readonly kind: "resolved"; readonly key: string } | SourceStorageUnresolved;
  boundOriginsFor(subject: SourceStorageSubject, bindings: SourceStorageBindings): SourceStorageSubjectsSelection;
  boundActivationsFor(declaration: Node, bindings: SourceStorageBindings): SourceStorageActivationsSelection;
  contributingExecutionsFor(subject: SourceStorageSubject, declaration: Node,
    entry: Pick<SourceStorageProducer, "subject" | "bindings">): SourceStorageProducersSelection;
  nativeCallbackArgumentsFor(invocation: Node): SourceStorageArgumentsSelection;
  boundValueFrontierFor(subject: SourceStorageSubject, bindings: SourceStorageBindings,
    boundaries: readonly SourceStorageSubject[], position?: "value" | "input"): SourceStorageValueFrontierSelection;
  invocationArgumentsFor(invocation: Node): SourceStorageNodesSelection;
  argumentTransportsFor(invocation: Node): SourceStorageArgumentsSelection;
  mutationOwnerFor(node: Node): SourceStorageSubject | undefined;
  isAccessorInvocation(node: Node): boolean;
  executionRegionsFor(candidate: Node, invocation?: Node, callerBindings?: SourceStorageBindings): SourceStorageNodesSelection;
  constructionFor(invocation: Node, callerBindings?: SourceStorageBindings): SourceStorageConstructionSelection;
  instanceRegionsFor(invocation: Node): SourceStorageInstanceRegionsSelection;
  enclosingRegionFor(node: Node): Node | undefined;
}
