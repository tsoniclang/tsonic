import type { Node } from "@tsonic/tsts";
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
  readonly entries: ReadonlyMap<SourceStorageSubject, readonly SourceStorageReference[]>;
  readonly parents: readonly SourceStorageScope[];
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
  readonly substitutions: ReadonlyMap<SourceStorageVariable, SourceStorageScope>;
}

export type SourceStorageScope = SourceStorageFrame | SourceStorageVariable | SourceStorageScopeView;

export type SourceStorageActivation = {
  readonly key: string;
  readonly variable: SourceStorageVariable | undefined;
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
}

export type SourceStorageOperation =
  | { readonly mode: "value" }
  | { readonly mode: "execution"; readonly demand: Node; readonly deferred?: boolean };

export type SourceStorageMemberSelection =
  | { readonly kind: "access"; readonly node: Node }
  | { readonly kind: "projection"; readonly subject: SourceStorageSubject; readonly declaration: Node };

export type SourceStorageTerm =
  | SourceStorageReference
  | { readonly kind: "unresolved"; readonly subject: SourceStorageSubject;
      readonly scope: SourceStorageScope; readonly reason: string; readonly exposure?: Node }
  | { readonly kind: "empty" }
  | ({ readonly kind: "application"; readonly invocation: Node; readonly callee: SourceStorageTerm;
      readonly scope: SourceStorageScope; readonly projection: readonly SourceStorageProjection[];
      readonly callback?: SourceStorageCallbackEntry } & SourceStorageOperation)
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

export type SourceStorageReduction =
  | SourceStorageBinding & { readonly witnesses?: readonly SourceStorageRelationWitness[];
      readonly dependencies?: readonly SourceStorageTerm[] }
  | { readonly kind: "project"; readonly input: SourceStorageTerm;
      readonly valueFilter?: Node;
      readonly select: (value: SourceStorageReference) => readonly SourceStorageTerm[] | undefined };

export interface SourceStorageScopedSubject {
  readonly subject: SourceStorageSubject;
  readonly bindings: SourceStorageScope;
}

export interface SourceStorageRelationWitness extends SourceStorageScopedSubject {
  readonly contributes: boolean;
}

export function sourceStorageReference(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference {
  return Object.freeze({ kind: "reference", subject, scope });
}
