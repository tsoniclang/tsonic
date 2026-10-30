import type { Node } from "@tsonic/tsts";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../../source-semantics/index.js";

export interface SourceErrorCheckedValue {
  readonly node: Node;
  readonly component: SourceTypeComponentEvidence;
}

export interface SourceErrorDeclaredSlot {
  readonly declaration: Node;
  readonly component: SourceTypeComponentEvidence;
}

export interface SourceErrorScalarSlot {
  readonly signatureDeclaration: Node;
  readonly parameterDeclaration: Node;
  readonly parameterIndex: number;
  readonly component: SourceTypeComponentEvidence;
  readonly fields: readonly Node[];
}

export interface SourceErrorDeclarationProtocol {
  readonly fields: readonly SourceErrorDeclaredSlot[];
  readonly constructors: readonly SourceErrorDeclaredSlot[];
  readonly scalarMutators: readonly SourceErrorScalarSlot[];
}

export type SourceErrorDeclarationSelection<Value> =
  | { readonly kind: "resolved"; readonly value: Value }
  | { readonly kind: "not-applicable" }
  | { readonly kind: "unresolved"; readonly reason: string };

export interface SourceErrorFieldUse {
  readonly node: Node;
  readonly receiver: SourceErrorCheckedValue;
  readonly memberDeclaration: Node;
  readonly selection: NonNullable<ReturnType<SourceFileSemantics["operations"]["propertyAccess"]>>;
  readonly accessMode: NonNullable<ReturnType<SourceFileSemantics["operations"]["propertyAccess"]>>["accessMode"];
}

export interface SourceErrorConstruction {
  readonly node: Node;
  readonly signatureDeclaration: Node;
  readonly selection: NonNullable<ReturnType<SourceFileSemantics["operations"]["call"]>>;
  readonly result: SourceErrorCheckedValue;
}

export interface SourceErrorScalarMutation {
  readonly node: Node;
  readonly selection: NonNullable<ReturnType<SourceFileSemantics["operations"]["call"]>>;
  readonly slot: SourceErrorScalarSlot;
  readonly argument: SourceErrorCheckedValue;
}

export type SourceErrorMutation =
  | { readonly kind: "field"; readonly field: SourceErrorFieldUse }
  | { readonly kind: "scalar"; readonly scalar: SourceErrorScalarMutation };

export interface SourceErrorParameterUse {
  readonly parameter: SourceErrorCheckedValue;
  readonly declaration: Node;
  readonly access: "read-only" | "writable";
  readonly uses: readonly Node[];
}

export type SourceErrorLocalInvalidation =
  | { readonly kind: "preserved" }
  | { readonly kind: "invalidated"; readonly at: Node }
  | { readonly kind: "unresolved"; readonly reason: string };

export interface SourceErrorDeclarationQueries {
  constructorFor(node: Node): SourceErrorDeclarationSelection<SourceErrorConstruction>;
  fieldFor(node: Node): SourceErrorDeclarationSelection<SourceErrorFieldUse>;
  mutationFor(node: Node): SourceErrorDeclarationSelection<readonly SourceErrorMutation[]>;
  parameterFor(parameter: Node): SourceErrorDeclarationSelection<SourceErrorParameterUse>;
  invalidationFor(read: SourceErrorFieldUse, expression: Node): SourceErrorLocalInvalidation;
}
