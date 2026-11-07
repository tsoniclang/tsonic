import type { Node } from "@tsonic/tsts";
import type { SourcePointerOperationRecord } from "@tsonic/target-api/source";
import type {
  SourceStorageBindings,
  SourceStorageDomainBoundary,
  SourceStorageProducer,
  SourceStorageQueries,
  SourceStorageSubjectSelection,
} from "@tsonic/target-api/analysis";
import { sourceStorageQueriesProgram, sourceTypeDescriptorIsAbsent, type HostSourceProgram } from "@tsonic/target-api/host";
import type { TsonicPointerBackingOrigin } from "./backing/requirements.js";
import type { TsonicReinterpretRecord, TsonicRejectedRecord } from "../analysis/host-records.js";

/** A pointer storage producer operation: a backing origin, or a Host bind/project pointer record (I1). */
export type TsonicPointerStorageOperation = TsonicPointerBackingOrigin |
  (SourcePointerOperationRecord & { readonly operation: "bind-pointer" | "project-pointer" });

export interface TsonicPointerStorageProducer {
  readonly storage: SourceStorageProducer;
  readonly operation: TsonicPointerStorageOperation;
}

export interface TsonicPointerStorageIssue {
  readonly node: Node;
  readonly reason: string;
}

export type TsonicPointerStorageSelection =
  | {
      readonly kind: "complete";
      readonly producers: readonly TsonicPointerStorageProducer[];
      readonly includesAbsence: boolean;
    }
  | {
      readonly kind: "open";
      readonly producers: readonly TsonicPointerStorageProducer[];
      readonly includesAbsence: boolean;
      readonly boundaries: readonly SourceStorageDomainBoundary[];
    }
  | {
      readonly kind: "unresolved";
      readonly issues: readonly TsonicPointerStorageIssue[];
    };

export interface TsonicPointerStorageRelation {
  value(expression: Node, bindings?: SourceStorageBindings): TsonicPointerStorageSelection;
  returned(declaration: Node, bindings?: SourceStorageBindings): TsonicPointerStorageSelection;
}

export function createTsonicPointerStorageRelation(
  source: HostSourceProgram,
  storage: SourceStorageQueries,
  reinterpret: (call: Node) => TsonicReinterpretRecord | TsonicRejectedRecord | undefined,
): TsonicPointerStorageRelation {
  const unresolved = (node: Node, reason: string): TsonicPointerStorageSelection => Object.freeze({
    kind: "unresolved",
    issues: Object.freeze([Object.freeze({ node, reason })]),
  });
  const select = (
    node: Node,
    subject: SourceStorageSubjectSelection,
    bindings: SourceStorageBindings,
  ): TsonicPointerStorageSelection => {
    if (sourceStorageQueriesProgram(storage) !== source)
      return unresolved(node, "Pointer storage requires the same checked source program as its storage relation.");
    if (subject.kind === "unresolved") return unresolved(node, subject.reason);
    const selected = storage.storageProducersFor(subject.subject, bindings);
    if (selected.kind === "unresolved") return unresolved(node, selected.reason);
    if (selected.includesAbsence === undefined)
      return unresolved(node, "Pointer storage requires completed absence evidence from its canonical storage relation.");
    const producers: TsonicPointerStorageProducer[] = [];
    const issues: TsonicPointerStorageIssue[] = [];
    let includesAbsence = selected.includesAbsence;
    for (const producer of selected.producers) {
      const original = producer.subject;
      if (sourceTypeDescriptorIsAbsent(producer.type)) {
        includesAbsence = true;
        continue;
      }
      const selection = original.kind === "value" && original.projection.length === 0 && source.ast.is.IsCallExpression(original.node)
        ? source.facts.selections.pointerOperation(original.node) : undefined;
      const pointer = selection === undefined || "kind" in selection ? undefined : selection;
      const raw = original.kind === "value" && original.projection.length === 0 && source.ast.is.IsCallExpression(original.node)
        ? reinterpret(original.node) : undefined;
      const operation = pointer?.operation === "allocate" || pointer?.operation === "address-of" ||
        pointer?.operation === "bind-pointer" || pointer?.operation === "project-pointer" ? pointer as TsonicPointerStorageOperation
        : raw?.kind === "resolved" ? raw : undefined;
      if (operation === undefined || operation.call !== original.node) {
        if (selected.kind === "open" && selected.boundaries.some(boundary =>
          boundary.subject === original && boundary.bindings === producer.bindings)) continue;
        issues.push(Object.freeze({ node: original.node,
          reason: "A pointer storage producer requires its exact checked allocation, address, binding, projection or reinterpretation." }));
      } else producers.push(Object.freeze({ storage: producer, operation }));
    }
    if (issues.length !== 0) return Object.freeze({ kind: "unresolved", issues: Object.freeze(issues) });
    const boundaries = selected.kind === "complete" ? [] : selected.boundaries.filter(boundary =>
      boundary.kind !== "opaque-result" || !producers.some(producer =>
        producer.storage.subject === boundary.subject && producer.storage.bindings === boundary.bindings &&
        producer.operation.call === boundary.exposure));
    const completed = { producers: Object.freeze(producers), includesAbsence };
    return boundaries.length === 0 ? Object.freeze({ kind: "complete", ...completed })
      : Object.freeze({ kind: "open", ...completed, boundaries: Object.freeze(boundaries) });
  };
  return Object.freeze({
    value(expression: Node, bindings?: SourceStorageBindings) {
      const selected = bindings === undefined ? storage.bindingsForLexicalOwner(expression)
        : { kind: "resolved" as const, bindings };
      return selected.kind === "unresolved" ? unresolved(expression, selected.reason)
        : select(expression, storage.subjectFor(expression), selected.bindings);
    },
    returned(declaration: Node, bindings?: SourceStorageBindings) {
      const selected = bindings === undefined ? storage.bindingsForLexicalOwner(declaration)
        : { kind: "resolved" as const, bindings };
      return selected.kind === "unresolved" ? unresolved(declaration, selected.reason)
        : select(declaration, storage.subject(declaration, "return"), selected.bindings);
    },
  });
}
