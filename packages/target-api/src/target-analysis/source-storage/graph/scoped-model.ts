import type { Node, Type } from "@tsonic/tsts";
import type { SourceStorageProjection, SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageStore } from "./stored-values.js";
import type { SourceStorageValueGuards } from "./guarded-values.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";

export interface SourceStorageFrame {
  readonly kind: "frame";
  readonly owner?: Node;
  readonly boundary?: "declaration";
  readonly invocation?: Node;
  readonly caller?: SourceStorageScope;
  readonly equation?: SourceStorageEquation;
  readonly callback?: SourceStorageCallbackEntry;
  readonly entries: ReadonlyMap<SourceStorageSubject, SourceStorageFrameInput>;
  readonly parents: readonly SourceStorageScope[];
}

export interface SourceStorageFrameInput {
  readonly values: readonly (SourceStorageReference | SourceStorageInputFrontier |
    Extract<SourceStorageTerm, { readonly kind: "empty" }>)[];
  readonly initialization: "actual" | "initialized" | "absent";
}

export interface SourceStorageEquation {
  readonly identity: number;
  readonly component: ReadonlySet<Node>;
  readonly entry: Node;
  readonly initial: SourceStorageScope;
}

export interface SourceStorageVariable {
  readonly kind: "variable";
  readonly equation: SourceStorageEquation;
  readonly owner: Node;
  readonly capture?: Node;
  readonly callback?: SourceStorageCallbackEntry;
}

export interface SourceStorageScopeView {
  readonly kind: "substitution";
  readonly scope: SourceStorageFrame;
  readonly substitutions: ReadonlyMap<SourceStorageScopeParameter, SourceStorageScope>;
}

export type SourceStorageScopeParameter = SourceStorageScope;

export type SourceStorageScope = SourceStorageFrame | SourceStorageVariable | SourceStorageScopeView;

export type SourceStorageActivation = {
  readonly key: string;
  readonly variable: SourceStorageVariable | undefined;
  readonly closed: boolean;
  readonly owner: Node | undefined;
  readonly creation: readonly SourceStorageActivation[];
  readonly nativeEntry?: string;
} & (
  | { readonly invocation: Node; readonly parent: SourceStorageActivation }
  | { readonly invocation: undefined; readonly parent: undefined }
);

export interface SourceStorageReference {
  readonly kind: "reference" | "leaf";
  readonly subject: SourceStorageSubject;
  readonly scope: SourceStorageScope;
  readonly guards?: SourceStorageValueGuards;
  readonly views?: readonly SourceStorageProjectionView[];
}

export interface SourceStorageProjectionView {
  readonly receiver: SourceStorageSubject;
  readonly source: SourceStorageSubject;
  readonly type: Type;
}

export interface SourceStorageInputFrontier {
  readonly kind: "input-frontier";
  readonly input: SourceStorageReference;
  readonly preservesInput: boolean;
  readonly subject: SourceStorageSubject;
  readonly scope: SourceStorageScope;
  readonly guards?: SourceStorageValueGuards;
  readonly views?: readonly SourceStorageProjectionView[];
}

export type SourceStorageOperation =
  | { readonly mode: "value" }
  | { readonly mode: "throw" }
  | { readonly mode: "execution"; readonly demand: Node; readonly deferred?: boolean };

export interface SourceStorageAccessorInvocation {
  readonly kind: "source-storage-accessor-entry";
  readonly invocation: Node;
  readonly declaration: Node;
  readonly receiver: Node;
}

export type SourceStorageMemberSelection =
  | { readonly kind: "access"; readonly node: Node }
  | { readonly kind: "physical"; readonly subject: SourceStorageSubject; readonly declaration: Node; readonly receiverType: Type }
  | { readonly kind: "projection"; readonly subject: SourceStorageSubject; readonly declaration: Node;
      readonly evaluation: Node | undefined; readonly before: Node | undefined };

export type SourceStorageTerm =
  | SourceStorageReference
  | SourceStorageInputFrontier
  | { readonly kind: "instantiation"; readonly value: SourceStorageReference;
      readonly parameter: SourceStorageScope; readonly scope: SourceStorageScope }
  | { readonly kind: "input-projection"; readonly value: SourceStorageInputFrontier;
      readonly subject: SourceStorageSubject; readonly scope: SourceStorageScope }
  | { readonly kind: "unresolved"; readonly subject: SourceStorageSubject;
      readonly scope: SourceStorageScope; readonly reason: string; readonly exposure?: Node; readonly executionOnly?: true;
      readonly effectOnly?: true }
  | { readonly kind: "empty"; readonly absence: SourceStorageReference | undefined }
  | ({ readonly kind: "application"; readonly invocation: Node; readonly callee: SourceStorageTerm;
      readonly scope: SourceStorageScope; readonly projection: readonly SourceStorageProjection[];
      readonly activation: { readonly kind: "invoke" } | { readonly kind: "provided"; readonly argument: SourceStorageTerm | undefined }
        | { readonly kind: "entered"; readonly scope: SourceStorageScope;
        readonly actualTypes: readonly (readonly Type[] | undefined)[] };
      readonly callback?: SourceStorageCallbackEntry } & SourceStorageOperation)
  | ({ readonly kind: "pointer"; readonly invocation: Node; readonly pointer: SourceStorageTerm;
      readonly input: SourceStorageTerm | undefined; readonly scope: SourceStorageScope;
      readonly projection: readonly SourceStorageProjection[] } & SourceStorageOperation)
  | ({ readonly kind: "member"; readonly selection: SourceStorageMemberSelection; readonly receiver: SourceStorageTerm;
      readonly scope: SourceStorageScope; readonly projection: readonly SourceStorageProjection[] } & SourceStorageOperation)
  | { readonly kind: "transition"; readonly capture: SourceStorageVariable;
      readonly condition: SourceStorageTerm; readonly value: SourceStorageTerm }
  | { readonly kind: "guarded"; readonly reference: Node; readonly value: SourceStorageTerm }
  | { readonly kind: "store"; readonly destination: SourceStorageTerm; readonly receiver: SourceStorageTerm;
      readonly value: SourceStorageTerm }
  | { readonly kind: "execution-root"; readonly demand: Node; readonly deferred?: boolean }
  | { readonly kind: "region"; readonly region: Node; readonly scope: SourceStorageScope; readonly demand: Node; readonly deferred?: boolean }
  | { readonly kind: "effect"; readonly store: SourceStorageStore; readonly scope: SourceStorageScope };

export type SourceStorageBinding =
  | { readonly kind: "replace"; readonly terms: readonly SourceStorageTerm[] }
  | { readonly kind: "expand"; readonly variable: SourceStorageVariable };

export type SourceStorageScopeBinding =
  | Extract<SourceStorageBinding, { readonly kind: "replace" }> & {
      readonly initialization: SourceStorageFrameInput["initialization"];
    }
  | Extract<SourceStorageBinding, { readonly kind: "expand" }>;

export type SourceStorageReduction =
  | SourceStorageBinding & { readonly witnesses?: readonly SourceStorageRelationWitness[];
      readonly dependencies?: readonly SourceStorageTerm[] }
  | { readonly kind: "project"; readonly inputs: readonly SourceStorageTerm[];
      readonly valueFilter?: Node;
      readonly select: (value: SourceStorageReference | SourceStorageInputFrontier |
        Extract<SourceStorageTerm, { readonly kind: "empty" }>) => readonly SourceStorageTerm[] | undefined };

export interface SourceStorageScopedSubject {
  readonly subject: SourceStorageSubject;
  readonly bindings: SourceStorageScope;
  readonly views?: readonly SourceStorageProjectionView[];
}

export interface SourceStorageProjectionReceiver extends SourceStorageScopedSubject {
  readonly type: Type;
  readonly view: SourceStorageSubject;
  readonly component: SourceStorageProjection;
}

export interface SourceStorageRelationWitness extends SourceStorageScopedSubject {
  readonly contributes: boolean;
  readonly observesValue: boolean;
}

export function sourceStorageReference(subject: SourceStorageSubject, scope: SourceStorageScope,
  views?: readonly SourceStorageProjectionView[]): SourceStorageReference {
  return Object.freeze({ kind: "reference", subject, scope, ...(views === undefined ? {} : { views }) });
}
