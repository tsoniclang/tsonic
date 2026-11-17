import type { Original, Presence } from "./foundation-data.js";
import type { SourcePrimitive, LibraryExportIdentity } from "./library-data.js";

export type InputObservation<Value> =
  | { readonly kind: "observed"; readonly value: Value }
  | { readonly kind: "unavailable"; readonly reason: "unvisited"
      | "missing-original-component" | "incomplete-association"
      | "unsupported-checked-structure";
      readonly diagnostics: readonly Original[] };
export type ObservedKey =
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "symbol"; readonly original: Original };
export type ObservedLiteral =
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "bigint"; readonly value: bigint }
  | { readonly kind: "symbol"; readonly declaration: Original };
export type ObservedComponentStep =
  | { readonly kind: "class-value" | "element" | "optional-value" }
  | { readonly kind: "member"; readonly declaration: Original;
      readonly access: "read" | "write" }
  | { readonly kind: "class-prototype"; readonly declaration: Original }
  | { readonly kind: "mapped-member"; readonly declaration: Original;
      readonly source: Original; readonly key: ObservedKey;
      readonly access: "read" | "write" }
  | { readonly kind: "parameter"; readonly signature: Original; readonly index: number }
  | { readonly kind: "receiver" | "result"; readonly signature: Original }
  | { readonly kind: "type-argument"; readonly declaration: Original; readonly index: number }
  | { readonly kind: "union-member" | "tuple-element" | "argument-place"
      | "parameter-place"; readonly index: number }
  | { readonly kind: "index-key" | "index-value"; readonly declaration: Original }
  | { readonly kind: "argument-tail" | "parameter-tail"; readonly start: number }
  | { readonly kind: "tuple-slice"; readonly start: number;
      readonly endCount: number; readonly readonly: boolean }
  | { readonly kind: "signature-tail"; readonly signature: Original;
      readonly start: number; readonly readonly: boolean };
export interface ObservedComponent {
  readonly identity: Original;
  readonly root: Original;
  readonly path: readonly ObservedComponentStep[];
}
export interface ObservedParameter {
  readonly declaration: Presence<Original>;
  readonly kind: "required" | "optional" | "rest";
  readonly component: Original;
}
export interface ObservedSignature {
  readonly identity: Original;
  readonly target: Presence<Original>;
  readonly owner: Presence<Original>;
  readonly declaration: Presence<Original>;
  readonly kind: "call" | "construct";
  readonly typeParameters: InputObservation<readonly Original[]>;
  readonly receiver: Presence<Original>;
  readonly parameters: readonly ObservedParameter[];
  readonly result: Original;
  readonly composition: Presence<{
    readonly kind: "union" | "intersection";
    readonly signatures: readonly Original[];
  }>;
}
export type ObservedMemberOrigin =
  | { readonly kind: "declaration"; readonly declaration: Original;
      readonly access: "read" | "write" }
  | { readonly kind: "class-prototype"; readonly declaration: Original;
      readonly facet: "value" }
  | { readonly kind: "mapped"; readonly declaration: Original;
      readonly source: Original; readonly key: ObservedKey;
      readonly access: "read" | "write" };
export interface ObservedMember {
  readonly key: ObservedKey;
  readonly name: string;
  readonly origins: readonly ObservedMemberOrigin[];
  readonly declarations: readonly Original[];
  readonly getters: readonly Original[];
  readonly setters: readonly Original[];
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly read: InputObservation<Presence<Original>>;
  readonly write: InputObservation<Presence<Original>>;
  readonly readKind: "property" | "accessor" | "method" | "class-prototype"
    | "mapped" | "unavailable";
}
export interface ObservedIndex {
  readonly declaration: Original;
  readonly key: Original;
  readonly value: Original;
  readonly readonly: boolean;
}
export interface ObservedMemberInventory {
  readonly component: Original;
  readonly members: readonly ObservedMember[];
  readonly indexes: readonly ObservedIndex[];
  readonly elementBinders: InputObservation<readonly Original[]>;
  readonly calls: readonly Original[];
  readonly constructs: readonly Original[];
}
export type ObservedType = {
  readonly component: ObservedComponent;
  readonly authoredTypeNode: Presence<Original>;
  readonly declaration: Presence<Original>;
  readonly definitionOwner: Presence<Original>;
  readonly definitionFacet: Presence<"instance" | "value">;
  readonly definitionParameters: InputObservation<readonly Original[]>;
  readonly literal: Presence<ObservedLiteral>;
  readonly primitive: Presence<{
    readonly kind: SourcePrimitive;
    readonly runtimeBase: "number" | "bigint" | "boolean" | "string" | "object";
  }>;
} & (
  | { readonly kind: "scalar"; readonly scalar: "number" | "bigint"
      | "boolean" | "string" | "symbol" | "absence" | "void" | "any"
      | "unknown" | "object" | "never" }
  | { readonly kind: "parameter"; readonly parameter: Original;
      readonly owner: Original; readonly index: number;
      readonly captures: InputObservation<readonly Original[]>;
      readonly constraint: Presence<Original>; readonly defaultType: Presence<Original> }
  | { readonly kind: "enum"; readonly declaration: { readonly kind: "present"; readonly value: Original } }
  | { readonly kind: "declared"; readonly declaration: { readonly kind: "present"; readonly value: Original };
      readonly facet: "instance" | "value"; readonly parameters: readonly Original[];
      readonly arguments: readonly Original[]; readonly definition: Presence<Original>;
      readonly extent: InputObservation<Presence<{
        readonly length: bigint; readonly runtimeBase: "number" | "bigint";
      }>> }
  | { readonly kind: "union" | "intersection"; readonly members: readonly Original[] }
  | { readonly kind: "array"; readonly readonly: boolean; readonly element: Original }
  | { readonly kind: "tuple"; readonly readonly: boolean;
      readonly elements: readonly ObservedParameter[] }
  | { readonly kind: "structure"; readonly inventory: ObservedMemberInventory }
);
export interface ObservedTypeArgument {
  readonly parameter: Original;
  readonly declaration: Presence<Original>;
  readonly argument: InputObservation<Original>;
  readonly explicitTypeNode: Presence<Original>;
  readonly defaultTypeNode: Presence<Original>;
}
export interface ObservedCallValue {
  readonly occurrence: Original;
  readonly component: Original;
  readonly role: "value" | "type";
}
export interface ObservedApplication {
  readonly identity: Original;
  readonly invocation: Original;
  readonly kind: "call" | "construct";
  readonly signature: Original;
  readonly callee: ObservedCallValue;
  readonly receiver: Presence<ObservedCallValue>;
  readonly class: Presence<{
    readonly declaration: Original; readonly arguments: readonly ObservedTypeArgument[];
  }>;
  readonly signatureArguments: readonly ObservedTypeArgument[];
}
export interface ObservedAuthoredArgument {
  readonly occurrence: Original;
  readonly expression: Original;
  readonly form: "value" | "spread";
  readonly component: InputObservation<Original>;
}
export interface ObservedArgumentBinding {
  readonly sourceArgument: Original;
  readonly sourceArgumentIndex: number;
  readonly effectiveArgument: Original;
  readonly effectiveArgumentIndex: number;
  readonly sourceForm: "value" | "spread-element" | "spread-sequence";
  readonly spreadElementIndex: Presence<number>;
  readonly parameterIndex: number;
  readonly parameterForm: "parameter" | "rest-element" | "rest-sequence";
  readonly source: InputObservation<Original>;
  readonly destination: InputObservation<Original>;
}
export interface ObservedInferenceContribution {
  readonly declaration: Presence<Original>;
  readonly origin:
    | { readonly kind: "argument" | "argument-tail"; readonly subject: Original;
        readonly effectiveArgumentIndex: number; readonly parameterIndex: number }
    | { readonly kind: "receiver" | "contextual-result"; readonly subject: Original };
  readonly source: Original;
  readonly formal: Original;
}
export type ObservedDiagnosticCoverage =
  | { readonly kind: "unavailable"; readonly root: Original }
  | { readonly kind: "complete"; readonly root: Original;
      readonly obligations: readonly {
        readonly kind: "applicability" | "backing"; readonly diagnostic: Original;
        readonly application: Presence<Original>;
      }[];
      readonly purpose:
        | { readonly kind: "alternative-applicability"; readonly invocation: Original;
            readonly notes: readonly Original[] }
        | { readonly kind: "other" };
  };
export type ObservedConstraint = {
  readonly site: Original;
  readonly diagnostic: Original;
  readonly rootDiagnostic: Original;
  readonly rootCoverage: ObservedDiagnosticCoverage;
  readonly application: Presence<Original>;
} & (
  | { readonly kind: "operator"; readonly operation: Original;
      readonly left: Original; readonly right: Original }
  | { readonly kind: "index"; readonly access: Original;
      readonly receiver: Original; readonly index: Original }
  | { readonly kind: "write-fit"; readonly source: Original; readonly destination: Original }
);
export interface ObservedCallCandidate {
  readonly identity: Original;
  readonly application: ObservedApplication;
  readonly sourceArguments: readonly ObservedAuthoredArgument[];
  readonly arguments: InputObservation<readonly ObservedArgumentBinding[]>;
  readonly inferenceContributions: InputObservation<readonly ObservedInferenceContribution[]>;
  readonly constraints: readonly ObservedConstraint[];
  readonly diagnostics: readonly Original[];
  readonly diagnosticCoverage: readonly ObservedDiagnosticCoverage[];
}
export type ObservedCallSelection = {
  readonly invocation: Original;
  readonly declarationOrder: InputObservation<readonly Original[]>;
} & (
  | { readonly kind: "applicable"; readonly selection: ObservedCallCandidate;
      readonly result: Original; readonly parameters: readonly ObservedParameter[] }
  | { readonly kind: "conditional-candidates"; readonly candidates: readonly ObservedCallCandidate[];
      readonly diagnostics: readonly Original[] }
  | { readonly kind: "untyped"; readonly diagnostics: readonly Original[] }
);
export interface ObservedCallableAssociation {
  readonly declaration: Original;
  readonly advertised: readonly Original[];
  readonly body: InputObservation<Original>;
  readonly classParameters: InputObservation<readonly Original[]>;
  readonly advertisedParameters: readonly {
    readonly signature: Original; readonly parameters: InputObservation<readonly Original[]>;
  }[];
  readonly bodyParameters: InputObservation<readonly Original[]>;
  readonly captures: InputObservation<readonly Original[]>;
}
export interface ObservedProviderDeclaration {
  readonly original: Original;
  readonly identity: LibraryExportIdentity;
  readonly wellKnownDeclaration: Presence<Original>;
}
