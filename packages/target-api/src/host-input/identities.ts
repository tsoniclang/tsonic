import type { Node } from "@tsonic/tsts";

export interface SourceInputSignature {
  readonly kind: "signature";
  readonly owner: Node;
  readonly signatureKind: "call" | "construct";
  readonly declaration: Node | undefined;
  readonly typeParameters: readonly Node[];
}

export interface SourceInputComponent {
  readonly kind: "component";
  readonly root: Node;
  readonly path: readonly SourceInputComponentPart[];
}

export type SourceInputComponentPart =
  | { readonly kind: "member"; readonly declaration: Node; readonly access: "read" | "write" }
  | { readonly kind: "parameter"; readonly signature: SourceInputSignature; readonly index: number }
  | { readonly kind: "receiver"; readonly signature: SourceInputSignature }
  | { readonly kind: "result"; readonly signature: SourceInputSignature }
  | { readonly kind: "type-argument"; readonly declaration: Node; readonly index: number }
  | { readonly kind: "element" }
  | { readonly kind: "optional-value" }
  | { readonly kind: "union-member"; readonly index: number }
  | { readonly kind: "index-key" | "index-value"; readonly declaration: Node }
  | { readonly kind: "argument-place" | "parameter-place"; readonly index: number }
  | { readonly kind: "argument-tail" | "parameter-tail"; readonly start: number }
  | { readonly kind: "tuple-element"; readonly index: number }
  | { readonly kind: "tuple-slice"; readonly start: number; readonly readonly: boolean }
  | { readonly kind: "signature-tail"; readonly signature: SourceInputSignature; readonly start: number; readonly readonly: boolean };
