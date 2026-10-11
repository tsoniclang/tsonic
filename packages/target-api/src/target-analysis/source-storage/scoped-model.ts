import type { Node } from "@tsonic/tsts";
import type { SourceStorageProjection, SourceStorageSubject } from "./subjects.js";
import type { SourceStorageStore } from "./stored-values.js";

export interface SourceStorageFrame {
  readonly kind: "frame";
  readonly owner?: Node;
  readonly invocation?: Node;
  readonly caller?: SourceStorageScope;
  readonly equation?: SourceStorageEquation;
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
}

export interface SourceStorageScopeView {
  readonly kind: "substitution";
  readonly scope: SourceStorageFrame;
  readonly substitutions: ReadonlyMap<SourceStorageVariable, SourceStorageScope>;
}

export type SourceStorageScope = SourceStorageFrame | SourceStorageVariable | SourceStorageScopeView;

export interface SourceStorageActivation {
  readonly key: string;
  readonly variable: SourceStorageVariable | undefined;
}

export interface SourceStorageReference {
  readonly kind: "reference" | "leaf";
  readonly subject: SourceStorageSubject;
  readonly scope: SourceStorageScope;
}

export type SourceStorageOperation =
  | { readonly mode: "value" }
  | { readonly mode: "execution"; readonly demand: Node };

export type SourceStorageTerm =
  | SourceStorageReference
  | { readonly kind: "empty" }
  | ({ readonly kind: "application"; readonly invocation: Node; readonly callee: SourceStorageTerm;
      readonly scope: SourceStorageScope; readonly projection: readonly SourceStorageProjection[] } & SourceStorageOperation)
  | ({ readonly kind: "member"; readonly access: Node; readonly receiver: SourceStorageTerm;
      readonly scope: SourceStorageScope; readonly projection: readonly SourceStorageProjection[] } & SourceStorageOperation)
  | { readonly kind: "transition"; readonly capture: SourceStorageVariable;
      readonly condition: SourceStorageTerm; readonly value: SourceStorageTerm }
  | { readonly kind: "store"; readonly destination: SourceStorageReference; readonly receiver: SourceStorageTerm;
      readonly value: SourceStorageTerm }
  | { readonly kind: "execution-root"; readonly demand: Node }
  | { readonly kind: "region"; readonly region: Node; readonly scope: SourceStorageScope; readonly demand: Node }
  | { readonly kind: "effect"; readonly store: SourceStorageStore; readonly scope: SourceStorageScope };

export type SourceStorageReduction =
  | { readonly kind: "replace"; readonly terms: readonly SourceStorageTerm[];
      readonly witnesses?: readonly SourceStorageScopedSubject[];
      readonly dependencies?: readonly SourceStorageTerm[] }
  | { readonly kind: "expand"; readonly variable: SourceStorageVariable };

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
