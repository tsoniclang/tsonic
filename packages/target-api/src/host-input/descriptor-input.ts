import type { AstReader, Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputSignature } from "./identities.js";
import type { SourceInputBackingConstraint, SourceInputCallSelection } from "./call-input.js";
import type { SourceLiteralKey } from "../source-model/literals/key.js";

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

export interface SourceInputSignatureShape {
  readonly identity: SourceInputSignature;
  readonly target: SourceInputSignature | undefined;
  readonly parameters: readonly {
    readonly index: number;
    readonly declaration: Node | undefined;
    readonly rest: boolean;
    readonly optional: boolean;
  }[];
  readonly receiver: { readonly declaration: Node | undefined } | undefined;
}

export type SourceInputScalarLiteral =
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "bigint"; readonly value: bigint }
  | { readonly kind: "symbol"; readonly declaration: Node };

export interface SourceInputEnumDeclaration {
  readonly declarations: readonly Node[];
  readonly members: readonly {
    readonly declaration: Node;
    readonly constant: { readonly kind: "number"; readonly value: number } | { readonly kind: "string"; readonly value: string } | { readonly kind: "unavailable" };
  }[];
}

export interface SourceInputMemberFacts {
  readonly key: SourceLiteralKey;
  readonly name: string;
  readonly declarations: readonly Node[];
  readonly getters: readonly Node[];
  readonly setters: readonly Node[];
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly read: SourceInputComponent | undefined;
  readonly write: SourceInputComponent | undefined;
  readonly readKind: "property" | "accessor" | "method" | "unavailable";
}

export interface SourceInputIndexFacts {
  readonly declaration: Node;
  readonly key: SourceInputComponent;
  readonly value: SourceInputComponent;
  readonly readonly: boolean;
}

export type SourceInputMemberInventory =
  | { readonly kind: "available"; readonly members: readonly SourceInputMemberFacts[]; readonly indexes: readonly SourceInputIndexFacts[];
      readonly elementBinders: readonly Node[] }
  | { readonly kind: "unavailable" };

export type SourceInputTypeFacts = {
  readonly component: SourceInputComponent;
  readonly authoredTypeNode: Node | undefined;
  readonly declaration: Node | undefined;
  readonly definitionOwner: Node | undefined;
  readonly literal: SourceInputScalarLiteral | undefined;
  readonly primitive: { readonly kind: SourcePrimitiveKind; readonly runtimeBase: "number" | "bigint" | "boolean" | "string" | "object" } | undefined;
} & (
  | { readonly kind: "scalar"; readonly scalar: "number" | "bigint" | "boolean" | "string" | "symbol" | "absence" | "void" | "any" | "unknown" | "object" | "never" }
  | { readonly kind: "parameter"; readonly parameter: Node; readonly owner: Node; readonly index: number; readonly captures: readonly Node[]; readonly constraint: SourceInputComponent | undefined; readonly defaultType: SourceInputComponent | undefined }
  | { readonly kind: "enum"; readonly declaration: Node }
  | { readonly kind: "declared"; readonly declaration: Node; readonly parameters: readonly Node[]; readonly arguments: readonly SourceInputComponent[]; readonly definition: SourceInputComponent | undefined; readonly extent: { readonly length: bigint; readonly runtimeBase: "number" | "bigint" } | undefined }
  | { readonly kind: "union"; readonly members: readonly SourceInputComponent[] }
  | { readonly kind: "array"; readonly readonly: boolean; readonly element: SourceInputComponent }
  | { readonly kind: "tuple"; readonly readonly: boolean; readonly elements: readonly SourceInputParameter[] }
  | { readonly kind: "structure"; readonly members: readonly SourceInputMemberFacts[]; readonly indexes: readonly SourceInputIndexFacts[]; readonly calls: readonly SourceInputSignatureFacts[]; readonly constructs: readonly SourceInputSignatureFacts[] }
  | { readonly kind: "unavailable"; readonly reason: "missing-original-component" | "unsupported-checked-structure" }
);

export interface SourceDescriptorInput {
  readonly ast: AstReader;
  assertNode(node: Node): void;
  assertComponent(component: SourceInputComponent): void;
  assertSignature(signature: SourceInputSignature): void;
  syntax(node: Node): SourceInputComponent;
  describe(component: SourceInputComponent): SourceInputTypeFacts;
  members(component: SourceInputComponent): SourceInputMemberInventory;
  describeSignature(signature: SourceInputSignature): SourceInputSignatureShape;
  signatureComponent(signature: SourceInputSignature, part: { readonly kind: "parameter"; readonly index: number } | { readonly kind: "receiver" | "result" }): SourceInputComponent;
  enumDeclaration(declaration: Node): SourceInputEnumDeclaration;
  application(invocation: Node): SourceInputCallSelection;
  constraints(occurrence: Node): readonly SourceInputBackingConstraint[];
}

