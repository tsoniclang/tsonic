import type { Node, SourcePointerMutability } from "@tsonic/tsts";
import type { SourcePresence } from "../public/source/contracts.js";
import type { SourceInputComponent } from "./identities.js";
import type { SourceInputLayoutIdentity, SourceInputMemoryQueries } from "./memory-input.js";
import type { SourceInputMarkerQueries, SourceInputMarkers } from "./marker-input.js";
import type { SourceInputSafetyQueries } from "./safety-input.js";
import type { SourceAttributeBuilderFact } from "../source-model/attributes.js";

export interface SourceInputOriginalSubjects {
  readonly component: SourcePresence<SourceInputComponent>;
  readonly origins: { readonly kind: "complete"; readonly nodes: readonly Node[] } | { readonly kind: "unavailable" };
}

export type SourceInputPointerType =
  | { readonly kind: "none" | "unavailable" }
  | { readonly kind: "raw-address" }
  | { readonly kind: "typed-location"; readonly pointee: SourceInputComponent; readonly mutability: SourcePointerMutability }
  | { readonly kind: "native-pointer"; readonly declaration: Node }
  | { readonly kind: "function-pointer"; readonly declaration: Node; readonly parameters: readonly SourceInputComponent[];
      readonly result: SourceInputComponent; readonly abi: readonly string[] };

export type SourceInputRawLocation = { readonly kind: "resolved"; readonly layout: SourceInputLayoutIdentity }
  | { readonly kind: "rejected"; readonly reason: string };

export type SourceInputPointerOperation =
  | { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store" |
      "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer";
      readonly exportName: string; readonly arguments: readonly Node[]; readonly typeArguments: readonly Node[];
      readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited";
      readonly pointee: "available" | "unvisited" | "not-applicable" | "missing" }
  | { readonly family: "typed-location"; readonly operation: "view"; readonly pointer: Node; readonly read: Node;
      readonly write: Node; readonly optional: boolean }
  | { readonly family: "native-pointer"; readonly operation: "load"; readonly pointer: Node }
  | { readonly family: "native-pointer"; readonly operation: "store"; readonly pointer: Node; readonly value: Node }
  | { readonly family: "native-pointer"; readonly operation: "offset"; readonly pointer: Node; readonly offset: Node }
  | { readonly family: "raw-address"; readonly operation: "bind-raw-pointer"; readonly identity: Node }
  | { readonly family: "raw-address"; readonly operation: "equal-raw-pointer"; readonly left: Node; readonly right: Node }
  | { readonly family: "raw-address"; readonly operation: "hash-raw-pointer"; readonly pointer: Node }
  | { readonly family: "raw-memory"; readonly operation: "to-raw"; readonly pointer: Node; readonly layout: Node;
      readonly location: SourceInputRawLocation }
  | { readonly family: "raw-memory"; readonly operation: "reinterpret"; readonly raw: Node; readonly layout: Node;
      readonly location: SourceInputRawLocation }
  | { readonly family: "raw-memory"; readonly operation: "byte-offset"; readonly raw: Node; readonly offset: Node;
      readonly integer: { readonly runtimeBase: "number" | "bigint"; readonly signedness: "signed" | "unsigned";
        readonly width: 8 | 16 | 32 | 64 | 128 }; readonly dataLayout: Node }
  | { readonly family: "raw-memory"; readonly operation: "raw-to-address-integer"; readonly raw: Node;
      readonly integer: { readonly width: 32; readonly runtimeBase: "number"; readonly signedness: "unsigned" }
        | { readonly width: 64; readonly runtimeBase: "bigint"; readonly signedness: "unsigned" }; readonly dataLayout: Node }
  | { readonly family: "raw-memory"; readonly operation: "address-integer-to-raw"; readonly address: Node;
      readonly integer: { readonly width: 32; readonly runtimeBase: "number"; readonly signedness: "unsigned" }
        | { readonly width: 64; readonly runtimeBase: "bigint"; readonly signedness: "unsigned" }; readonly dataLayout: Node }
  | { readonly family: "keep-alive"; readonly operation: "keep-alive"; readonly value: Node };

export interface SourceInputCoreQueries extends SourceInputMarkerQueries, SourceInputSafetyQueries {
  readonly memory: SourceInputMemoryQueries;
  attributeBuilder(occurrence: Node): SourcePresence<SourceAttributeBuilderFact>;
  pointerType(subjects: SourceInputOriginalSubjects): SourceInputPointerType;
  typeMarkers(subjects: SourceInputOriginalSubjects): { readonly kind: "available"; readonly value: SourceInputMarkers }
    | { readonly kind: "unavailable" };
  operation(occurrence: Node): SourcePresence<SourceInputPointerOperation>;
  pointeeMatches(occurrence: Node, index: number, component: SourceInputComponent): "matched" | "mismatch" | "unavailable";
}
