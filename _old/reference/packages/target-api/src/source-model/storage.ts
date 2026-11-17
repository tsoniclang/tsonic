import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceArgumentPlace, SourceRefusal, SourceSignatureIdentity, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceNodeWriteValue } from "./navigation.js";
import type { SourceJsCallbackEffect, SourceJsCallStorageEffect } from "./profile.js";

export type SourceStorageProjection =
  | { readonly kind: "array-element" }
  | { readonly kind: "tuple-element"; readonly index: number }
  | { readonly kind: "member"; readonly declaration: Node }
  | { readonly kind: "method-value"; readonly declaration: Node };

export interface SourceStorageSubject {
  readonly kind: "input" | "value" | "member" | "return" | "receiver";
  readonly node: Node;
  readonly projection: readonly SourceStorageProjection[];
  readonly projectionKey: string;
}

export interface SourceStorageLimits {
  readonly maximumNodes: number;
  readonly maximumEdges: number;
  readonly maximumSubjectRows: number;
  readonly maximumTransportRows: number;
  readonly maximumSteps: number;
}

export type SourceStorageCallEffect = SourceJsCallStorageEffect | { readonly kind: "no-result-storage" };

export interface SourceStorageNativeConstructorPremise {
  readonly binding: Node;
  readonly constructors: readonly SourceSignatureIdentity[];
}

export interface SourceStorageAnalysisOptions {
  readonly sourceFiles: readonly SourceFile[];
  readonly limits: SourceStorageLimits;
  readonly nativeClassConstructors: readonly SourceStorageNativeConstructorPremise[];
}

export type SourceStorageUnresolved = SourceRefusal | {
  readonly kind: "unresolved";
  readonly reason: string;
};

export type SourceStorageSubjectSelection =
  | { readonly kind: "resolved"; readonly subject: SourceStorageSubject }
  | SourceStorageUnresolved;

export type SourceStorageSubjectsSelection =
  | { readonly kind: "resolved"; readonly subjects: readonly SourceStorageSubject[] }
  | SourceStorageUnresolved;

export interface SourceStorageTypedSubject {
  readonly subject: SourceStorageSubject;
  readonly type: SourceTypeEvidence;
  readonly sourceFile: SourceFile;
}

export interface SourceStorageWrittenValue {
  readonly source: SourceNodeWriteValue | undefined;
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
  | { readonly kind: "resolved"; readonly type: SourceTypeEvidence; readonly sourceFile: SourceFile }
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
  | { readonly kind: "complete"; readonly producers: readonly SourceStorageProducer[]; readonly includesAbsence?: boolean }
  | { readonly kind: "open"; readonly producers: readonly SourceStorageProducer[];
      readonly boundaries: readonly SourceStorageDomainBoundary[]; readonly includesAbsence?: boolean }
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
  readonly signature: SourceSignatureIdentity | undefined;
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
  readonly binding: SourceArgumentPlace;
}

export interface SourceStorageCallbackEntry {
  readonly kind: "source-storage-callback-entry";
  readonly invocation: Node;
  readonly argument: SourceStorageArgumentTransport;
  readonly timing: "synchronous" | "deferred" | "unknown";
  readonly rejection?: number;
  readonly inputs?: SourceJsCallbackEffect["inputs"];
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
