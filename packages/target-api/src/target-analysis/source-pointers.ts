import type { Node, SourcePointerMutability } from "@tsonic/tsts";
import type { SourcePresence, SourceResult, SourceSignatureIdentity, SourceTypeEvidence, SourceValueOperand } from "../public/source/contracts.js";
import type { TsonicDataLayoutDescriptor, TsonicDataLayoutIdentity } from "../target/data-layout.js";

export type SourceMemoryLayout = {
  readonly occurrence: Node;
  readonly source: SourceTypeEvidence;
  readonly dataLayout: TsonicDataLayoutDescriptor & { readonly providerDeclaration: TsonicDataLayoutIdentity };
  readonly byteSize: bigint;
  readonly byteAlignment: bigint;
  readonly stride: bigint;
} & (
  | { readonly kind: "value"; readonly fields: readonly {
      readonly occurrence: Node; readonly selector: Node; readonly declaration: Node;
      readonly value: SourceTypeEvidence; readonly layout: SourceMemoryLayout;
      readonly byteOffset: bigint; readonly byteAlignment: bigint;
    }[] }
  | { readonly kind: "array"; readonly extent: { readonly length: bigint; readonly runtimeBase: "number" | "bigint" };
      readonly element: SourceMemoryLayout }
);

export type SourceRawLocation = { readonly kind: "resolved"; readonly layout: SourceMemoryLayout }
  | { readonly kind: "rejected"; readonly reason: string };

export type SourcePointerType = { readonly value: SourceTypeEvidence } & (
  | { readonly kind: "raw-address" }
  | { readonly kind: "typed-location" | "native-pointer"; readonly pointee: SourceTypeEvidence;
      readonly mutability: SourcePointerMutability }
  | { readonly kind: "function-pointer"; readonly declaration: Node; readonly signature: SourcePresence<SourceSignatureIdentity>;
      readonly parameters: readonly SourceTypeEvidence[]; readonly result: SourceTypeEvidence; readonly abi: readonly string[] }
);

interface SourcePointerOperationBase {
  readonly occurrence: Node;
  readonly result: SourceTypeEvidence;
}

export type SourceTypedLocationOperation = SourcePointerOperationBase & {
  readonly family: "typed-location";
  readonly pointee: SourceTypeEvidence;
} & (
  | { readonly operation: "address-of"; readonly storage: SourceValueOperand; readonly declaration: SourcePresence<Node>;
      readonly locationIdentity: Node }
  | { readonly operation: "allocate"; readonly initial: SourceValueOperand; readonly locationIdentity: Node }
  | { readonly operation: "load" | "hash-pointer"; readonly pointer: SourceValueOperand }
  | { readonly operation: "store"; readonly pointer: SourceValueOperand; readonly value: SourceValueOperand }
  | { readonly operation: "equal-pointer"; readonly left: SourceValueOperand; readonly right: SourceValueOperand }
  | { readonly operation: "bind-pointer"; readonly identity: SourceValueOperand; readonly read: SourceValueOperand;
      readonly write: SourceValueOperand; readonly locationIdentity: Node }
  | { readonly operation: "project-pointer"; readonly sourcePointee: SourceTypeEvidence; readonly pointer: SourceValueOperand;
      readonly fromSource: SourceValueOperand; readonly toSource: SourceValueOperand }
  | { readonly operation: "view"; readonly sourcePointee: SourceTypeEvidence; readonly pointer: SourceValueOperand;
      readonly read: SourceValueOperand; readonly write: SourceValueOperand; readonly optional: boolean }
);

export type SourceNativePointerOperation = SourcePointerOperationBase & {
  readonly family: "native-pointer";
  readonly pointee: SourceTypeEvidence;
  readonly pointer: SourceValueOperand;
} & (
  | { readonly operation: "load" }
  | { readonly operation: "store"; readonly value: SourceValueOperand }
  | { readonly operation: "offset"; readonly offset: SourceValueOperand }
);

export type SourceRawAddressOperation = SourcePointerOperationBase & { readonly family: "raw-address" } & (
  | { readonly operation: "bind-raw-pointer"; readonly identity: SourceValueOperand }
  | { readonly operation: "equal-raw-pointer"; readonly left: SourceValueOperand; readonly right: SourceValueOperand }
  | { readonly operation: "hash-raw-pointer"; readonly pointer: SourceValueOperand }
);

export type SourceAddressIntegerDomain =
  | { readonly width: 32; readonly runtimeBase: "number"; readonly signedness: "unsigned" }
  | { readonly width: 64; readonly runtimeBase: "bigint"; readonly signedness: "unsigned" };

export type SourceRawMemoryOperation = SourcePointerOperationBase & { readonly family: "raw-memory" } & (
  | { readonly operation: "to-raw"; readonly pointer: SourceValueOperand; readonly pointee: SourceTypeEvidence;
      readonly layout: SourceValueOperand; readonly location: SourceRawLocation }
  | { readonly operation: "reinterpret"; readonly raw: SourceValueOperand; readonly pointee: SourceTypeEvidence;
      readonly layout: SourceValueOperand; readonly location: SourceRawLocation }
  | { readonly operation: "byte-offset"; readonly raw: SourceValueOperand; readonly offset: SourceValueOperand;
      readonly integer: { readonly runtimeBase: "number" | "bigint"; readonly signedness: "signed" | "unsigned";
        readonly width: 8 | 16 | 32 | 64 | 128 }; readonly dataLayout: Node }
  | { readonly operation: "raw-to-address-integer"; readonly raw: SourceValueOperand;
      readonly integer: SourceAddressIntegerDomain; readonly dataLayout: Node }
  | { readonly operation: "address-integer-to-raw"; readonly address: SourceValueOperand;
      readonly integer: SourceAddressIntegerDomain; readonly dataLayout: Node }
);

export type SourcePointerOperation = SourceTypedLocationOperation | SourceNativePointerOperation
  | SourceRawAddressOperation | SourceRawMemoryOperation
  | SourcePointerOperationBase & { readonly family: "keep-alive"; readonly operation: "keep-alive"; readonly value: SourceValueOperand };

export interface SourcePointerFacts {
  pointerType(value: SourceTypeEvidence): SourceResult<SourcePresence<SourcePointerType>>;
  pointerOperation(occurrence: Node): SourceResult<SourcePresence<SourcePointerOperation>>;
}
