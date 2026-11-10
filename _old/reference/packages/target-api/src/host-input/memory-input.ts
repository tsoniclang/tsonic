import type { Node } from "@tsonic/tsts";
import type { SourcePresence } from "../public/source/contracts.js";
import type { TsonicDataLayoutDescriptor, TsonicDataLayoutIdentity } from "../target/data-layout.js";
import type { SourceInputApplication } from "./call-input.js";
import type { SourceInputComponent, SourceInputComponentPart } from "./identities.js";

export type SourceInputMemorySelection<Value> =
  | { readonly kind: "none" }
  | { readonly kind: "available"; readonly value: Value }
  | { readonly kind: "unavailable"; readonly occurrence: Node; readonly reason: string };

export type SourceInputMemorySource =
  | { readonly kind: "binding"; readonly application: SourceInputApplication;
      readonly declaration: Node; readonly component: SourceInputComponent }
  | { readonly kind: "result"; readonly application: SourceInputApplication;
      readonly path: readonly SourceInputComponentPart[]; readonly component: SourceInputComponent };

export interface SourceInputLayoutIdentity {
  readonly kind: "memory-layout";
  readonly occurrence: Node;
}

export interface SourceInputMemoryFieldIdentity {
  readonly kind: "memory-field";
  readonly occurrence: Node;
}

export interface SourceInputMemoryField {
  readonly identity: SourceInputMemoryFieldIdentity;
  readonly owner: SourceInputMemorySource;
  readonly value: SourceInputMemorySource;
  readonly selector: Node;
  readonly selection: Node;
  readonly primary: SourcePresence<Node>;
  readonly selectedDeclarations: readonly Node[];
  readonly layout: SourceInputLayoutIdentity;
  readonly byteOffset: bigint;
  readonly byteAlignment: bigint;
}

export type SourceInputMemoryLayout = {
  readonly occurrence: Node;
  readonly source: SourceInputMemorySource;
  readonly dataLayout: TsonicDataLayoutDescriptor & { readonly providerDeclaration: TsonicDataLayoutIdentity };
  readonly byteSize: bigint;
  readonly byteAlignment: bigint;
  readonly stride: bigint;
} & (
  | { readonly kind: "value"; readonly fields: readonly SourceInputMemoryFieldIdentity[] }
  | { readonly kind: "array"; readonly extent: { readonly length: bigint; readonly runtimeBase: "number" | "bigint" };
      readonly element: SourceInputLayoutIdentity }
);

export type SourceInputMemoryMetadata =
  | { readonly kind: "data-layout"; readonly occurrence: Node;
      readonly dataLayout: SourceInputMemoryLayout["dataLayout"] }
  | { readonly kind: "memory-layout"; readonly identity: SourceInputLayoutIdentity }
  | { readonly kind: "memory-field"; readonly identity: SourceInputMemoryFieldIdentity };

export interface SourceInputMemoryFieldBinding {
  readonly occurrence: Node;
  readonly application: SourceInputApplication;
  readonly owner: SourceInputMemorySource;
  readonly pointee: SourceInputMemorySource;
  readonly fieldExpression: Node;
  readonly field: SourceInputMemoryFieldIdentity;
  readonly pointerExpression: Node;
}

export interface SourceInputMemoryRecordBinding {
  readonly occurrence: Node;
  readonly application: SourceInputApplication;
  readonly source: SourceInputMemorySource;
  readonly layoutExpression: Node;
  readonly layout: SourceInputLayoutIdentity;
  readonly fields: readonly {
    readonly expression: Node;
    readonly binding: Node;
  }[];
}

export type SourceInputMemoryObservation = {
  readonly occurrence: Node;
  readonly source: SourceInputMemorySource;
  readonly layoutExpression: Node;
  readonly layout: SourceInputLayoutIdentity;
} & (
  | { readonly operation: "size" | "alignment" | "stride" }
  | { readonly operation: "field-offset"; readonly selector: Node; readonly selection: Node;
      readonly primary: SourcePresence<Node>; readonly selectedDeclarations: readonly Node[] }
);

export interface SourceInputMemoryQueries {
  observation(occurrence: Node): SourceInputMemorySelection<SourceInputMemoryObservation>;
  metadata(occurrence: Node): SourceInputMemorySelection<SourceInputMemoryMetadata>;
  layout(identity: SourceInputLayoutIdentity): SourceInputMemorySelection<SourceInputMemoryLayout>;
  field(identity: SourceInputMemoryFieldIdentity): SourceInputMemorySelection<SourceInputMemoryField>;
  fieldBinding(occurrence: Node): SourceInputMemorySelection<SourceInputMemoryFieldBinding>;
  recordBinding(occurrence: Node): SourceInputMemorySelection<SourceInputMemoryRecordBinding>;
  compileTimeUse(occurrence: Node): SourcePresence<{
    readonly operation: Node;
    readonly operand: Node;
    readonly role: "descriptor" | "selector" | "field-layout" | "record-layout" | "raw-layout" | "data-layout";
  }>;
}
