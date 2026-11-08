import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputSignature } from "./identities.js";

export interface SourceInputCandidateIdentity {
  readonly kind: "candidate";
  readonly invocation: Node;
}

export interface SourceInputDiagnosticIdentity {
  readonly kind: "diagnostic";
  readonly site: Node | undefined;
}

export type SourceInputDiagnosticCoverage =
  | { readonly kind: "complete"; readonly root: SourceInputDiagnosticIdentity; readonly obligations: readonly {
    readonly kind: "applicability" | "backing";
    readonly diagnostic: SourceInputDiagnosticIdentity;
    readonly application: SourceInputApplication | undefined;
  }[]; readonly purpose:
    | { readonly kind: "alternative-applicability"; readonly invocation: Node; readonly notes: readonly SourceInputDiagnosticIdentity[] }
    | { readonly kind: "other" } }
  | { readonly kind: "unavailable"; readonly root: SourceInputDiagnosticIdentity };

export interface SourceInputTypeArgument {
  readonly parameter: SourceInputComponent;
  readonly declaration: Node | undefined;
  readonly argument: SourceInputComponent | undefined;
  readonly explicitTypeNode: Node | undefined;
  readonly defaultTypeNode: Node | undefined;
}

export interface SourceInputCallValue {
  readonly occurrence: Node;
  readonly component: SourceInputComponent;
  readonly role: "value" | "type";
}

export interface SourceInputApplication {
  readonly invocation: Node;
  readonly kind: "call" | "construct";
  readonly signature: SourceInputSignature;
  readonly callee: SourceInputCallValue;
  readonly receiver: SourceInputCallValue | undefined;
  readonly class: { readonly declaration: Node; readonly arguments: readonly SourceInputTypeArgument[] } | undefined;
  readonly signatureArguments: readonly SourceInputTypeArgument[];
}

export interface SourceInputAuthoredArgument {
  readonly occurrence: Node;
  readonly expression: Node;
  readonly form: "value" | "spread";
  readonly component: SourceInputComponent | undefined;
}

export interface SourceInputArgumentBinding {
  readonly sourceArgument: Node;
  readonly sourceArgumentIndex: number;
  readonly effectiveArgument: Node;
  readonly effectiveArgumentIndex: number;
  readonly sourceForm: "value" | "spread-element" | "spread-sequence";
  readonly spreadElementIndex: number | undefined;
  readonly parameterIndex: number;
  readonly parameterForm: "parameter" | "rest-element" | "rest-sequence";
  readonly source: SourceInputComponent | undefined;
  readonly destination: SourceInputComponent | undefined;
}

export type SourceInputArgumentMap =
  | { readonly kind: "available"; readonly values: readonly SourceInputArgumentBinding[] }
  | { readonly kind: "unavailable" };

export type SourceInputInferenceContributions =
  | { readonly kind: "available"; readonly values: readonly {
    readonly declaration: Node | undefined;
    readonly origin:
      | { readonly kind: "argument" | "argument-tail"; readonly subject: Node; readonly effectiveArgumentIndex: number; readonly parameterIndex: number }
      | { readonly kind: "receiver" | "contextual-result"; readonly subject: Node };
    readonly source: SourceInputComponent;
    readonly formal: SourceInputComponent;
  }[] }
  | { readonly kind: "unavailable" };

export type SourceInputBackingConstraint = {
  readonly site: Node;
  readonly diagnostic: SourceInputDiagnosticIdentity;
  readonly rootDiagnostic: SourceInputDiagnosticIdentity;
  readonly rootCoverage: SourceInputDiagnosticCoverage;
  readonly application: SourceInputApplication | undefined;
} & (
  | { readonly kind: "operator"; readonly operation: Node; readonly left: SourceInputComponent; readonly right: SourceInputComponent }
  | { readonly kind: "index"; readonly access: Node; readonly receiver: SourceInputComponent; readonly index: SourceInputComponent }
  | { readonly kind: "write-fit"; readonly source: SourceInputComponent; readonly destination: SourceInputComponent }
);

export interface SourceInputCallCandidate {
  readonly identity: SourceInputCandidateIdentity;
  readonly application: SourceInputApplication;
  readonly sourceArguments: readonly SourceInputAuthoredArgument[];
  readonly arguments: SourceInputArgumentMap;
  readonly inferenceContributions: SourceInputInferenceContributions;
  readonly constraints: readonly SourceInputBackingConstraint[];
  readonly diagnostics: readonly SourceInputDiagnosticIdentity[];
  readonly diagnosticCoverage: readonly SourceInputDiagnosticCoverage[];
}

export type SourceInputDeclarationOrder =
  | { readonly kind: "available"; readonly signatures: readonly SourceInputSignature[] }
  | { readonly kind: "unavailable" };

export type SourceInputCallSelection = { readonly declarationOrder: SourceInputDeclarationOrder } & (
  | { readonly kind: "applicable"; readonly selection: SourceInputCallCandidate & {
    readonly result: SourceInputComponent;
    readonly parameters: readonly {
      readonly index: number;
      readonly declaration: Node | undefined;
      readonly kind: "required" | "optional" | "rest";
      readonly component: SourceInputComponent;
    }[];
  } }
  | { readonly kind: "conditional-candidates"; readonly candidates: readonly SourceInputCallCandidate[]; readonly diagnostics: readonly SourceInputDiagnosticIdentity[] }
  | { readonly kind: "untyped"; readonly diagnostics: readonly SourceInputDiagnosticIdentity[] });
