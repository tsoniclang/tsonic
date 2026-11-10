import type { Original, Presence } from "./foundation-data.js";
import type { LibraryExportIdentity, PassingMode } from "./library-data.js";
import type { ObservedComponentStep, InputObservation } from "./input-data.js";

export interface ObservedDataLayout {
  readonly identity: LibraryExportIdentity;
  readonly fingerprint: string;
  readonly byteOrder: "little" | "big";
  readonly addressWidth: 32 | 64;
}
export type ObservedMemorySource =
  | { readonly kind: "binding"; readonly application: Original;
      readonly declaration: Original; readonly component: Original }
  | { readonly kind: "result"; readonly application: Original;
      readonly path: readonly ObservedComponentStep[]; readonly component: Original };
export type ObservedLayout = {
  readonly identity: Original;
  readonly occurrence: Original;
  readonly source: ObservedMemorySource;
  readonly dataLayout: ObservedDataLayout;
  readonly byteSize: bigint;
  readonly byteAlignment: bigint;
  readonly stride: bigint;
} & (
  | { readonly kind: "value"; readonly fields: readonly Original[] }
  | { readonly kind: "array"; readonly extent: {
        readonly length: bigint; readonly runtimeBase: "number" | "bigint";
      }; readonly element: Original }
);
export interface ObservedMemoryField {
  readonly identity: Original;
  readonly owner: ObservedMemorySource;
  readonly value: ObservedMemorySource;
  readonly selector: Original;
  readonly selection: Original;
  readonly primary: Presence<Original>;
  readonly selectedDeclarations: readonly Original[];
  readonly layout: Original;
  readonly byteOffset: bigint;
  readonly byteAlignment: bigint;
}
export type ObservedMemoryMetadata =
  | { readonly kind: "data-layout"; readonly occurrence: Original;
      readonly dataLayout: ObservedDataLayout }
  | { readonly kind: "memory-layout" | "memory-field"; readonly identity: Original };
export interface ObservedFieldBinding {
  readonly occurrence: Original;
  readonly application: Original;
  readonly owner: ObservedMemorySource;
  readonly pointee: ObservedMemorySource;
  readonly fieldExpression: Original;
  readonly field: Original;
  readonly pointerExpression: Original;
}
export interface ObservedRecordBinding {
  readonly occurrence: Original;
  readonly application: Original;
  readonly source: ObservedMemorySource;
  readonly layoutExpression: Original;
  readonly layout: Original;
  readonly fields: readonly { readonly expression: Original; readonly binding: Original }[];
}
export type ObservedLayoutQuery = {
  readonly occurrence: Original;
  readonly source: ObservedMemorySource;
  readonly layoutExpression: Original;
  readonly layout: Original;
} & (
  | { readonly operation: "size" | "alignment" | "stride" }
  | { readonly operation: "field-offset"; readonly selector: Original;
      readonly selection: Original; readonly primary: Presence<Original>;
      readonly selectedDeclarations: readonly Original[] }
);
export type ObservedPointerType =
  | { readonly kind: "raw-address" }
  | { readonly kind: "typed-location"; readonly pointee: Original;
      readonly mutability: "readonly" | "readwrite" | "unspecified" }
  | { readonly kind: "native-pointer"; readonly declaration: Original }
  | { readonly kind: "function-pointer"; readonly declaration: Original;
      readonly parameters: readonly Original[]; readonly result: Original;
      readonly abi: readonly string[] };
export interface ObservedIntegerOperand {
  readonly runtimeBase: "number" | "bigint";
  readonly signedness: "signed" | "unsigned";
  readonly width: 8 | 16 | 32 | 64 | 128;
}
export type ObservedAddressInteger =
  | { readonly width: 32; readonly runtimeBase: "number"; readonly signedness: "unsigned" }
  | { readonly width: 64; readonly runtimeBase: "bigint"; readonly signedness: "unsigned" };
export type ObservedPointerOperation =
  | { readonly family: "typed-location"; readonly operation: "address-of"
      | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer"
      | "bind-pointer" | "project-pointer"; readonly exportName: string;
      readonly arguments: readonly Original[]; readonly typeArguments: readonly Original[];
      readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited";
      readonly pointee: "available" | "unvisited" | "not-applicable" | "missing" }
  | { readonly family: "typed-location"; readonly operation: "view";
      readonly pointer: Original; readonly read: Original; readonly write: Original;
      readonly optional: boolean }
  | { readonly family: "native-pointer"; readonly operation: "load"; readonly pointer: Original }
  | { readonly family: "native-pointer"; readonly operation: "store";
      readonly pointer: Original; readonly value: Original }
  | { readonly family: "native-pointer"; readonly operation: "offset";
      readonly pointer: Original; readonly offset: Original }
  | { readonly family: "raw-address"; readonly operation: "bind-raw-pointer"; readonly identity: Original }
  | { readonly family: "raw-address"; readonly operation: "equal-raw-pointer";
      readonly left: Original; readonly right: Original }
  | { readonly family: "raw-address"; readonly operation: "hash-raw-pointer"; readonly pointer: Original }
  | { readonly family: "raw-memory"; readonly operation: "to-raw";
      readonly pointer: Original; readonly layout: Original }
  | { readonly family: "raw-memory"; readonly operation: "reinterpret";
      readonly raw: Original; readonly layout: Original }
  | { readonly family: "raw-memory"; readonly operation: "byte-offset";
      readonly raw: Original; readonly offset: Original;
      readonly integer: ObservedIntegerOperand; readonly dataLayout: Original }
  | { readonly family: "raw-memory"; readonly operation: "raw-to-address-integer";
      readonly raw: Original; readonly integer: ObservedAddressInteger; readonly dataLayout: Original }
  | { readonly family: "raw-memory"; readonly operation: "address-integer-to-raw";
      readonly address: Original; readonly integer: ObservedAddressInteger; readonly dataLayout: Original }
  | { readonly family: "keep-alive"; readonly operation: "keep-alive"; readonly value: Original };
export interface ObservedFieldMarker {
  readonly name: string;
  readonly typeNode: Original;
  readonly readonly: boolean;
}
export interface ObservedMarkers {
  readonly struct: Presence<{
    readonly valueType: boolean; readonly fields: InputObservation<readonly ObservedFieldMarker[]>;
  }>;
  readonly field: Presence<ObservedFieldMarker>;
  readonly defaultValue: Presence<{ readonly typeNode: Original }>;
  readonly jsString: boolean;
}
export type ObservedAttribute = {
  readonly occurrence: Original;
  readonly applicationTarget: Original;
  readonly selectedMember: Presence<{
    readonly selectedDeclaration: Presence<Original>; readonly declarations: readonly Original[];
  }>;
  readonly applicationMemberKind: Presence<"property" | "method">;
  readonly applicationPlacement: Presence<"declaration" | "constructor">;
  readonly applicationParameterName: Presence<string>;
  readonly applicationTargetSpecifier: Presence<string>;
} & (
  | { readonly kind: "builder-state" }
  | { readonly kind: "application"; readonly invocation: Original }
);
export type ObservedSafetySelection =
  | { readonly kind: "selected"; readonly expression: Original;
      readonly declaration: Presence<Original>; readonly declarations: readonly Original[] }
  | { readonly kind: "unavailable"; readonly reason: "function-shape" | "receiver" | "member-evidence" };
export type ObservedSafety = {
  readonly occurrence: Original;
  readonly provider: LibraryExportIdentity;
} & (
  | { readonly family: "unsafe-context"; readonly operation: "expression"; readonly expression: Original }
  | { readonly family: "unsafe-context"; readonly operation: "remaining-block"; readonly firstDirectStatement: boolean }
  | { readonly family: "safety"; readonly operation: "root";
      readonly form: "type" | "value"; readonly target: Presence<Original> }
  | { readonly family: "safety"; readonly operation: "select-member";
      readonly predecessor: Presence<Original>;
      readonly memberKind: "indexer" | "method" | "property";
      readonly selection: ObservedSafetySelection }
  | { readonly family: "safety"; readonly operation: "placement";
      readonly predecessor: Presence<Original>;
      readonly placement: "declaration" | "constructor" | "getter" | "setter" }
  | { readonly family: "safety"; readonly operation: "apply";
      readonly predecessor: Presence<Original>; readonly contract: "requires-unsafe" | "safe" }
);
export interface CoreInputObservation {
  readonly original: Original;
  readonly provider: InputObservation<Presence<LibraryExportIdentity>>;
  readonly markers: InputObservation<ObservedMarkers>;
  readonly pointerType: InputObservation<Presence<ObservedPointerType>>;
  readonly pointerOperation: InputObservation<Presence<ObservedPointerOperation>>;
  readonly metadata: InputObservation<Presence<ObservedMemoryMetadata>>;
  readonly layout: InputObservation<Presence<ObservedLayout>>;
  readonly field: InputObservation<Presence<ObservedMemoryField>>;
  readonly fieldBinding: InputObservation<Presence<ObservedFieldBinding>>;
  readonly recordBinding: InputObservation<Presence<ObservedRecordBinding>>;
  readonly layoutQuery: InputObservation<Presence<ObservedLayoutQuery>>;
  readonly attribute: InputObservation<Presence<ObservedAttribute>>;
  readonly safety: InputObservation<Presence<ObservedSafety>>;
  readonly argumentPassing: InputObservation<Presence<
    | { readonly role: "declaration"; readonly mode: PassingMode }
    | { readonly role: "argument"; readonly mode: PassingMode; readonly storageExpression: Original }
  >>;
  readonly flowState: InputObservation<Presence<"moved" | "borrowed-shared" | "borrowed-mut">>;
}
