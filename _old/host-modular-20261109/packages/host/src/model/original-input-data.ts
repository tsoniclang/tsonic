import type { Original, Presence } from "./foundation-data.js";
import type { WellKnownSymbol } from "./library-data.js";
import type {
  InputObservation, ObservedKey, ObservedMember, ObservedSignature,
} from "./input-data.js";

export type OriginalRole = "document" | "syntax" | "component" | "signature"
  | "application" | "diagnostic" | "type-parameter";
export interface OriginalRecord {
  readonly original: Original;
  readonly role: OriginalRole;
  readonly document: Presence<Original>;
  readonly start: Presence<number>;
  readonly length: Presence<number>;
}
export interface ObservedReference {
  readonly meaning: "value" | "type" | "namespace";
  readonly declaration: Original;
  readonly document: Original;
  readonly project: boolean;
}
export interface ObservedModuleLink {
  readonly document: Original;
  readonly declaration: Original;
  readonly specifier: Original;
  readonly kind: "import" | "export";
  readonly resolution:
    | { readonly kind: "project"; readonly document: Original }
    | { readonly kind: "non-project" | "unresolved" };
}
export interface ObservedModule {
  readonly document: Original;
  readonly links: readonly ObservedModuleLink[];
  readonly exports: readonly {
    readonly name: string; readonly declaration: Original;
    readonly document: Original;
  }[];
}
export type ObservedImplementation =
  | { readonly kind: "selected"; readonly contract: Original;
      readonly implementation: ObservedReference }
  | { readonly kind: "unrelated" };
export interface ObservedHeritageEdge {
  readonly kind: "extends" | "implements";
  readonly declaration: Original;
  readonly heritage: Original;
  readonly target: ObservedReference;
  readonly typeArguments: readonly Original[];
  readonly selected: Original;
  readonly arguments: readonly Original[];
}
export interface ObservedConstructor {
  readonly declaration: Original;
  readonly witness: "implicit" | "declared";
  readonly signatures: readonly {
    readonly signature: ObservedSignature;
    readonly base: Presence<{
      readonly declaration: Original; readonly signature: Original;
    }>;
    readonly parameters: readonly {
      readonly index: number; readonly name: string;
      readonly declaration: Presence<Original>;
      readonly authoredTypeNode: Presence<Original>;
      readonly component: Original;
      readonly acceptsOmission: boolean; readonly rest: boolean;
    }[];
  }[];
}
export interface ObservedEnum {
  readonly declarations: readonly Original[];
  readonly members: readonly {
    readonly declaration: Original;
    readonly constant: InputObservation<
      | { readonly kind: "number"; readonly value: number }
      | { readonly kind: "string"; readonly value: string }
    >;
  }[];
}
export interface ObservedPropertyName {
  readonly original: Original;
  readonly selected: Presence<ObservedKey>;
  readonly numericIndex: boolean;
  readonly symbol: Presence<{
    readonly declaration: Original;
    readonly wellKnown: Presence<WellKnownSymbol>;
  }>;
}
export type ObservedIndexSelection =
  | { readonly kind: "array-element" | "index-signature";
      readonly declarations: readonly Original[] }
  | { readonly kind: "tuple-element"; readonly index: number;
      readonly declarations: readonly Original[] }
  | { readonly kind: "string-character"; readonly receiver: Original;
      readonly read: Original };
export type ObservedMemberArm =
  | { readonly kind: "member"; readonly receiver: Original;
      readonly member: ObservedMember;
      readonly readDeclarations: readonly Original[];
      readonly writeDeclarations: readonly Original[] }
  | { readonly kind: "index"; readonly receiver: Original;
      readonly selection: ObservedIndexSelection; readonly key: Original;
      readonly read: Presence<Original>; readonly write: Presence<Original>;
      readonly readonly: boolean };
export interface ObservedMemberUse {
  readonly occurrence: Original;
  readonly receiver: { readonly occurrence: Original; readonly component: Original };
  readonly key: Presence<Original>;
  readonly access: "read" | "write" | "read-write" | "delete";
  readonly callCallee: boolean;
  readonly optionalChain: boolean;
  readonly chainContinuation: boolean;
  readonly selectedDeclaration: Presence<Original>;
  readonly selectedDeclarations: readonly Original[];
  readonly readDeclarations: readonly Original[];
  readonly writeDeclarations: readonly Original[];
  readonly read: Presence<Original>;
  readonly write: Presence<Original>;
  readonly arms: readonly ObservedMemberArm[];
}
export interface ObservedIteratorWitness {
  readonly declarations: readonly Original[];
  readonly receiver: Original;
  readonly member: ObservedMember;
  readonly signatures: readonly Original[];
}
export type ObservedAtomicIteration = { readonly source: Original } & (
  | { readonly kind: "synchronous-iterator-protocol"
        | "asynchronous-iterator-protocol" | "synchronous-iterator-adapted-to-async";
      readonly witness: ObservedIteratorWitness }
  | { readonly kind: "array-like-index" | "array-like-index-adapted-to-async";
      readonly declarations: readonly Original[] }
  | { readonly kind: "string-code-unit-index" | "string-code-unit-index-adapted-to-async"
        | "untyped-dynamic-iteration" }
);
export type ObservedIterationMechanism = ObservedAtomicIteration
  | { readonly kind: "union"; readonly alternatives: readonly ObservedAtomicIteration[] }
  | { readonly kind: "property-key-enumeration" };
export type ObservedProtocol =
  | { readonly kind: "iteration"; readonly occurrence: Original;
      readonly operand: Original;
      readonly form: "for-in" | "for-of" | "for-await-of" | "spread";
      readonly mechanism: Presence<ObservedIterationMechanism> }
  | { readonly kind: "generator"; readonly declaration: Original;
      readonly form: "sync" | "async"; readonly signature: Original;
      readonly resultDeclaration: Presence<Original>;
      readonly returnTypeBinding: Presence<Original> }
  | { readonly kind: "yield"; readonly occurrence: Original;
      readonly generator: Original; readonly form: "value" | "delegate";
      readonly operand: Presence<Original>;
      readonly mechanism: Presence<ObservedIterationMechanism> }
  | { readonly kind: "resource-management"; readonly declaration: Original;
      readonly form: "using" | "await using";
      readonly acquisition:
        | { readonly kind: "initializer"; readonly expression: Original }
        | { readonly kind: "iteration"; readonly statement: Original };
      readonly disposal:
        | { readonly kind: "selected"; readonly alternatives: readonly {
            readonly kind: "sync" | "async";
            readonly declarations: readonly Original[];
            readonly signatures: readonly Original[];
          }[] }
        | { readonly kind: "untyped-dynamic" | "unavailable" } }
  | { readonly kind: "callable-completion"; readonly declaration: Original;
      readonly canFallThrough: boolean }
  | { readonly kind: "flow-conditions"; readonly reference: Original;
      readonly conditions: readonly {
        readonly expression: Original; readonly assumed: boolean;
        readonly assignments: readonly Original[];
      }[] };
