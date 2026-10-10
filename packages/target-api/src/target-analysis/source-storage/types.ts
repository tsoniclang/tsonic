import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { ResolvedSourceCallInfo, TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageProjection, SourceStorageSubject } from "./subjects.js";

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
  readonly preservedInputs?: readonly Node[];
}

export interface SourceStorageEffects {
  readonly call?: (node: Node, selected: ResolvedSourceCallInfo) => SourceStorageCallEffect | undefined;
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

export type SourceStorageTypeSelection =
  | { readonly kind: "resolved"; readonly type: Type; readonly sourceFile: SourceFile }
  | SourceStorageUnresolved;

export type SourceStorageOriginsSelection =
  | { readonly kind: "resolved"; readonly origins: readonly SourceStorageTypedSubject[] }
  | SourceStorageUnresolved;

export interface SourceStorageDomainBoundary {
  readonly kind: "external-input" | "external-write" | "opaque-write" | "opaque-result" | "unclassified-exposure";
  readonly subject: SourceStorageSubject;
  readonly exposure: Node;
  readonly owner?: SourceStorageSubject;
}

export type SourceStorageClosedOriginsSelection =
  | { readonly kind: "complete"; readonly origins: readonly SourceStorageTypedSubject[] }
  | { readonly kind: "open"; readonly origins: readonly SourceStorageTypedSubject[];
      readonly boundaries: readonly SourceStorageDomainBoundary[] }
  | SourceStorageUnresolved;

export type SourceStorageProducersSelection =
  | { readonly kind: "complete"; readonly producers: readonly SourceStorageTypedSubject[] }
  | { readonly kind: "open"; readonly producers: readonly SourceStorageTypedSubject[];
      readonly boundaries: readonly SourceStorageDomainBoundary[] }
  | SourceStorageUnresolved;

export type SourceStorageNodesSelection =
  | { readonly kind: "resolved"; readonly nodes: readonly Node[] }
  | SourceStorageUnresolved;

export interface SourceStorageArgumentTransport {
  readonly actual: SourceStorageSubject;
  readonly formal: SourceStorageSubject;
  readonly selectedParameterDeclaration: Node;
  readonly binding: ResolvedSourceCallInfo["sourceArgumentBindings"][number];
}

export type SourceStorageArgumentsSelection =
  | { readonly kind: "resolved"; readonly arguments: readonly SourceStorageArgumentTransport[] }
  | SourceStorageUnresolved;

export interface SourceStorageBoundary {
  readonly kind: "opaque-invocation" | "unresolved-transport";
  readonly invocation: Node;
  readonly declaration?: Node;
  readonly subjects: readonly SourceStorageSubject[];
  readonly reason?: string;
}

export interface SourceStorageSubstitution {
  readonly formal: SourceStorageSubject;
  readonly actuals: readonly SourceStorageSubject[];
}

export interface SourceStorageBindings {
  readonly substitutions: readonly SourceStorageSubstitution[];
}

export type SourceStorageBindingsSelection =
  | { readonly kind: "resolved"; readonly bindings: SourceStorageBindings }
  | SourceStorageUnresolved;

export interface SourceStorageInstanceRegion {
  readonly owner: Node;
  readonly node: Node;
}

export type SourceStorageInstanceRegionsSelection =
  | { readonly kind: "resolved"; readonly regions: readonly SourceStorageInstanceRegion[] }
  | SourceStorageUnresolved;

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
  typeFor(subject: SourceStorageSubject): SourceStorageTypeSelection;
  incomingFor(subject: SourceStorageSubject): SourceStorageSubjectsSelection;
  ancestorsFor(subject: SourceStorageSubject): SourceStorageSubjectsSelection;
  originSubjectsFor(subject: SourceStorageSubject): SourceStorageSubjectsSelection;
  originsFor(subject: SourceStorageSubject): SourceStorageOriginsSelection;
  closedOriginsFor(subject: SourceStorageSubject, bindings?: SourceStorageBindings): SourceStorageClosedOriginsSelection;
  storageProducersFor(subject: SourceStorageSubject, bindings?: SourceStorageBindings): SourceStorageProducersSelection;
  localCallableCreationsFor(expression: Node): SourceStorageNodesSelection;
  unresolvedFor(subject: SourceStorageSubject): string | undefined;
  invocationImplementationsFor(invocation: Node, bindings?: SourceStorageBindings): SourceStorageNodesSelection;
  invocationOriginsFor(subject: SourceStorageSubject, candidate: Node, invocation: Node): SourceStorageSubjectsSelection;
  bindingsForInvocation(candidate: Node, invocation: Node, parent?: SourceStorageBindings): SourceStorageBindingsSelection;
  boundOriginsFor(subject: SourceStorageSubject, bindings: SourceStorageBindings): SourceStorageSubjectsSelection;
  invocationArgumentsFor(invocation: Node): SourceStorageNodesSelection;
  argumentTransportsFor(invocation: Node): SourceStorageArgumentsSelection;
  mutationOwnerFor(node: Node): SourceStorageSubject | undefined;
  isAccessorInvocation(node: Node): boolean;
  executionRegionsFor(candidate: Node, invocation?: Node): SourceStorageNodesSelection;
  instanceRegionsFor(invocation: Node): SourceStorageInstanceRegionsSelection;
  enclosingRegionFor(node: Node): Node | undefined;
}
