import type { Node } from "@tsonic/tsts";
import type {
  SourcePresence,
  SourceTypeBinding,
  SourceTypeEvidence,
  SourceValueOperand,
} from "../public/source/contracts.js";
import type {
  SourceMemoryField,
  SourceMemoryLayout,
  SourcePointerOperation,
} from "./pointers.js";
import type {
  SourceStorageBindings,
  SourceStorageDomainBoundary,
  SourceStorageProducer,
  SourceStorageSubject,
  SourceStorageTypedSubject,
  SourceStorageUnresolved,
} from "./storage.js";
import type { SourceMemberUse } from "./member-use.js";

export type SourceMemorySelection<Value> =
  | { readonly kind: "resolved"; readonly value: Value }
  | SourceStorageUnresolved;

export interface SourceMemoryProducer extends SourceStorageProducer {
  readonly typeBindings: readonly SourceTypeBinding[];
}

export interface SourceMemoryBoundary
  extends SourceStorageDomainBoundary, SourceStorageTypedSubject {
  readonly typeBindings: readonly SourceTypeBinding[];
}

export interface SourcePointerBackingProducer {
  readonly storage: SourceMemoryProducer;
  readonly operation:
    | Extract<SourcePointerOperation, { readonly family: "typed-location"; readonly operation:
        "allocate" | "address-of" | "bind-pointer" | "project-pointer" }>
    | Extract<SourcePointerOperation, { readonly family: "raw-memory"; readonly operation: "reinterpret" }>;
}

export type SourcePointerBacking =
  | { readonly kind: "complete"; readonly producers: readonly SourcePointerBackingProducer[];
      readonly includesAbsence: boolean }
  | { readonly kind: "open"; readonly producers: readonly SourcePointerBackingProducer[];
      readonly includesAbsence: boolean; readonly boundaries: readonly SourceMemoryBoundary[] };

export interface SourceMemoryIssue {
  readonly node: Node;
  readonly reason: string;
}

export type SourceMemoryMetadata =
  | { readonly kind: "data-layout"; readonly occurrence: Node;
      readonly dataLayout: SourceMemoryLayout["dataLayout"] }
  | { readonly kind: "memory-layout"; readonly layout: SourceMemoryLayout }
  | { readonly kind: "memory-field"; readonly field: SourceMemoryField };

export interface SourceMemoryMetadataDeclaration {
  readonly value: SourceMemoryMetadata;
  readonly issues: readonly SourceMemoryIssue[];
}

export type SourceClosedArrayStorage =
  | { readonly kind: "unproven"; readonly reason: string }
  | { readonly kind: "closed"; readonly declarations: readonly Node[];
      readonly references: readonly Node[]; readonly literals: readonly Node[];
      readonly elements: readonly SourceMemberUse[] };

export interface SourceMemoryFieldBinding {
  readonly occurrence: Node;
  readonly result: SourceTypeEvidence;
  readonly owner: SourceTypeEvidence;
  readonly fieldExpression: Node;
  readonly field: SourceMemoryField;
  readonly pointer: SourceValueOperand;
  readonly pointee: SourceTypeEvidence;
  readonly bindings: SourceStorageBindings;
  readonly typeBindings: readonly SourceTypeBinding[];
}

export interface SourceMemoryRecordBinding {
  readonly occurrence: Node;
  readonly result: SourceTypeEvidence;
  readonly layoutExpression: Node;
  readonly layout: Extract<SourceMemoryLayout, { readonly kind: "value" }>;
  readonly bindings: SourceStorageBindings;
  readonly typeBindings: readonly SourceTypeBinding[];
  readonly fields: readonly {
    readonly expression: Node;
    readonly binding: SourceMemoryFieldBinding;
  }[];
}

export interface SourceMemoryBindingInventory {
  readonly records: readonly {
    readonly occurrence: Node;
    readonly selection:
      | { readonly kind: "bound"; readonly value: SourceMemoryRecordBinding }
      | { readonly kind: "rejected"; readonly issues: readonly SourceMemoryIssue[] };
  }[];
  readonly selectedDeclarations: readonly Node[];
}

export interface SourceMemoryQueries {
  readonly pointerBacking: {
    value(subject: SourceStorageSubject, bindings: SourceStorageBindings): SourceMemorySelection<SourcePointerBacking>;
    returned(declaration: Node, bindings: SourceStorageBindings): SourceMemorySelection<SourcePointerBacking>;
  };
  readonly memoryMetadata: {
    value(occurrence: Node, bindings: SourceStorageBindings): SourceMemorySelection<SourcePresence<SourceMemoryMetadata>>;
    declaration(declaration: Node, bindings: SourceStorageBindings): SourceMemorySelection<SourcePresence<SourceMemoryMetadataDeclaration>>;
    isCompileTimeExpression(occurrence: Node): SourceMemorySelection<boolean>;
  };
  readonly closedArrayStorage: {
    resolve(occurrence: Node, bindings: SourceStorageBindings): SourceMemorySelection<SourceClosedArrayStorage>;
  };
  readonly memoryBindings: {
    field(occurrence: Node, bindings: SourceStorageBindings): SourceMemorySelection<SourcePresence<SourceMemoryFieldBinding>>;
    record(occurrence: Node, bindings: SourceStorageBindings): SourceMemorySelection<SourcePresence<SourceMemoryRecordBinding>>;
    inventory(): SourceMemorySelection<SourceMemoryBindingInventory>;
  };
}
