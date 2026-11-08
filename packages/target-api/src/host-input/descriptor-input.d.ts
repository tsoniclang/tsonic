import type { CheckedSourceProgram, Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputSignature } from "./identities.js";

export interface SourceInputParameter {
  readonly declaration: Node | undefined;
  readonly kind: "required" | "optional" | "rest";
  readonly value: SourceInputComponent;
}

export interface SourceInputSignatureFacts {
  readonly identity: SourceInputSignature;
  readonly receiver: SourceInputComponent | undefined;
  readonly parameters: readonly SourceInputParameter[];
  readonly result: SourceInputComponent;
}

export interface SourceInputMemberFacts {
  readonly name: string;
  readonly declarations: readonly Node[];
  readonly getters: readonly Node[];
  readonly setters: readonly Node[];
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly read: SourceInputComponent | undefined;
  readonly write: SourceInputComponent | undefined;
}

export type SourceInputTypeFacts = {
  readonly component: SourceInputComponent;
  readonly authoredTypeNode: Node | undefined;
  readonly declaration: Node | undefined;
  readonly primitive: { readonly kind: SourcePrimitiveKind; readonly runtimeBase: "number" | "bigint" | "boolean" | "string" | "object" } | undefined;
} & (
  | { readonly kind: "scalar"; readonly scalar: "number" | "bigint" | "boolean" | "string" | "symbol" | "absence" | "void" | "any" | "unknown" | "object" | "never" }
  | { readonly kind: "parameter"; readonly parameter: Node; readonly owner: Node; readonly index: number; readonly constraint: SourceInputComponent | undefined; readonly defaultType: SourceInputComponent | undefined }
  | { readonly kind: "declared"; readonly declaration: Node; readonly parameters: readonly Node[]; readonly arguments: readonly SourceInputComponent[]; readonly definition: SourceInputComponent | undefined; readonly extent: { readonly length: bigint; readonly runtimeBase: "number" | "bigint" } | undefined }
  | { readonly kind: "union"; readonly members: readonly SourceInputComponent[] }
  | { readonly kind: "array"; readonly readonly: boolean; readonly element: SourceInputComponent }
  | { readonly kind: "tuple"; readonly readonly: boolean; readonly elements: readonly SourceInputParameter[] }
  | { readonly kind: "structure"; readonly members: readonly SourceInputMemberFacts[]; readonly indexes: readonly { readonly declaration: Node; readonly key: SourceInputComponent; readonly value: SourceInputComponent; readonly readonly: boolean }[]; readonly calls: readonly SourceInputSignatureFacts[]; readonly constructs: readonly SourceInputSignatureFacts[] }
  | { readonly kind: "unavailable"; readonly reason: "missing-original-component" | "unsupported-checked-structure" }
);

export interface SourceDescriptorInput {
  assertComponent(component: SourceInputComponent): void;
  assertSignature(signature: SourceInputSignature): void;
  syntax(node: Node): SourceInputComponent;
  describe(component: SourceInputComponent): SourceInputTypeFacts;
}

export declare function createSourceDescriptorInput(checked: CheckedSourceProgram): SourceDescriptorInput;
