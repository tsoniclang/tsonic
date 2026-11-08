import type { CheckedSourceProgram, Node, Signature, Type } from "@tsonic/tsts";

export type SourceCheckedDiagnostic = CheckedSourceProgram["diagnostics"][number];

export interface SourceCheckedTypeArgument {
  readonly typeParameter: Type;
  readonly declaration: Node | undefined;
  readonly checkedArgument: Type | undefined;
  readonly explicitTypeNode: Node | undefined;
  readonly defaultTypeNode: Node | undefined;
}

export interface SourceCheckedApplication {
  readonly invocation: Node;
  readonly kind: "call" | "construct";
  readonly signature: Signature;
  readonly instantiatedSignature: Signature;
  readonly signatureDeclaration: Node | undefined;
  readonly receiver: { readonly occurrence: Node; readonly type: Type } | undefined;
  readonly class: { readonly owner: Type; readonly declaration: Node; readonly typeArguments: readonly SourceCheckedTypeArgument[] } | undefined;
  readonly signatureTypeArguments: readonly SourceCheckedTypeArgument[];
}

export interface SourceCheckedComponent {
  readonly root: {
    readonly kind: "value" | "annotation" | "declaration";
    readonly node: Node;
    readonly type: Type;
  };
  readonly path: readonly SourceCheckedComponentPart[];
  readonly type: Type;
  readonly application: SourceCheckedApplication | undefined;
}

export type SourceCheckedComponentPart =
  | { readonly kind: "parameter"; readonly owner: Type; readonly signature: Signature; readonly index: number; readonly declaration: Node | undefined }
  | { readonly kind: "receiver"; readonly owner: Type; readonly signature: Signature; readonly declaration: Node | undefined }
  | { readonly kind: "signature-tail"; readonly owner: Type; readonly signature: Signature; readonly signatureKind: "call" | "construct"; readonly start: number; readonly readonly: boolean }
  | { readonly kind: "result"; readonly owner: Type; readonly signature: Signature }
  | { readonly kind: "type-argument"; readonly owner: Type; readonly parameter: Type; readonly index: number }
  | { readonly kind: "member"; readonly owner: Type; readonly declaration: Node }
  | { readonly kind: "element"; readonly owner: Type }
  | { readonly kind: "optional-value"; readonly owner: Type }
  | { readonly kind: "tuple-element"; readonly owner: Type; readonly index: number }
  | { readonly kind: "tuple-slice"; readonly owner: Type; readonly start: number; readonly readonly: boolean };

export interface SourceCheckedArgumentBinding {
  readonly sourceArgument: Node;
  readonly sourceArgumentIndex: number;
  readonly effectiveArgument: Node;
  readonly effectiveArgumentIndex: number;
  readonly sourceForm: "value" | "spread-element" | "spread-sequence";
  readonly spreadElementIndex: number | undefined;
  readonly parameterIndex: number;
  readonly parameterForm: "parameter" | "rest-element" | "rest-sequence";
}

export interface SourceCheckedDiagnosticOwnership {
  readonly diagnostic: SourceCheckedDiagnostic;
  readonly root: SourceCheckedDiagnostic;
  readonly candidate: Signature | undefined;
}

export type SourceBackingConstraint = {
  readonly diagnostic: SourceCheckedDiagnosticOwnership;
  readonly site: Node;
  readonly application: SourceCheckedApplication | undefined;
} & (
  | { readonly kind: "operator"; readonly operation: Node; readonly left: SourceCheckedComponent; readonly right: SourceCheckedComponent }
  | { readonly kind: "index"; readonly access: Node; readonly receiver: SourceCheckedComponent; readonly index: SourceCheckedComponent }
  | { readonly kind: "write-fit"; readonly source: SourceCheckedComponent; readonly destination: SourceCheckedComponent }
);

export type SourceCheckedArgumentMap =
  | { readonly kind: "available"; readonly values: readonly SourceCheckedArgumentBinding[] }
  | { readonly kind: "unavailable" };

export type SourceCheckedInferenceContributions =
  | { readonly kind: "available"; readonly values: readonly {
      readonly parameter: Type;
      readonly declaration: Node | undefined;
      readonly source: SourceCheckedComponent;
      readonly formal: SourceCheckedComponent;
    }[] }
  | { readonly kind: "unavailable" };

export interface SourceCheckedCallCandidate {
  readonly application: SourceCheckedApplication;
  readonly sourceArguments: readonly Node[];
  readonly arguments: SourceCheckedArgumentMap;
  readonly inferenceContributions: SourceCheckedInferenceContributions;
  readonly constraints: readonly SourceBackingConstraint[];
  readonly diagnostics: CheckedSourceProgram["diagnostics"];
}

export type SourceCheckedCallSelection =
  | { readonly kind: "applicable"; readonly selection: SourceCheckedCallCandidate }
  | { readonly kind: "conditional-candidates"; readonly candidates: readonly SourceCheckedCallCandidate[]; readonly diagnostics: CheckedSourceProgram["diagnostics"] }
  | { readonly kind: "untyped"; readonly diagnostics: CheckedSourceProgram["diagnostics"] };
